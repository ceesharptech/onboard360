# Architecture Rules

These rules apply at all times, across all phases of the HR Onboarding Platform build. They are binding constraints, not suggestions — if a task seems to require violating one of these, stop and flag it rather than working around it silently.

## 1. Service Boundaries

The system is three separate services under one root: `frontend/`, `backend/`, `rag-service/`. Respect the boundary between them strictly:

- `frontend/` never talks to `rag-service/` directly. All requests from the browser go through `backend/`, which proxies to `rag-service/` where needed. This keeps auth, rate limiting, and company/role scoping enforced in one place instead of duplicated across services.
- `rag-service/` never talks to the database directly for anything except its own retrieval queries (embeddings, chunk similarity search). It does not own business logic about employees, templates, or roles — that stays in `backend/`.
- `backend/` is the single source of truth for authentication, authorization, and all relational data. If `rag-service/` needs to know something about the current user (e.g. `company_id` to scope retrieval), that must be passed to it explicitly by `backend/` on each request — never assumed or cached independently in `rag-service/`.
- Do not introduce direct service-to-service trust. Every internal call between `backend/` and `rag-service/` should be treated as if it could fail or time out, with explicit error handling — not assumed to always succeed because "it's internal."

## 2. Backend Layering (`backend/`)

Structure Express code in clear layers and do not collapse them for convenience:

```
backend/src/
  routes/       -- HTTP route definitions only; no business logic
  controllers/  -- request/response handling, calls into services
  services/     -- business logic, orchestrates Prisma calls
  middleware/   -- auth, authorization, error handling, validation
  utils/        -- pure helper functions (hashing, token utils, etc.)
  prisma/       -- schema, migrations, seed (already established in Phase 0)
```

- Route handlers should be thin: parse request, call a controller/service, return a response. They should not contain Prisma queries directly.
- Business logic (e.g. "match a template to an employee," "compute due dates from start_date") belongs in `services/`, not scattered across route files, so it can be tested and reused independent of HTTP.
- Do not put authorization checks inline in individual route handlers. Use the shared middleware built in Phase 1 (`authenticate`, `requireRole`, `scopeToCompany`, `scopeToDepartment`, `scopeToOwnEmployee`) consistently. A route handler re-implementing its own ad hoc scoping check is a bug, not a shortcut.

## 3. Database Access

- All database access goes through Prisma. No raw SQL except where Prisma cannot express something (e.g. the `pgvector` similarity query, or the vector index migration) — and even then, isolate raw queries in a dedicated module (e.g. `services/vectorSearch.ts`), never inline in a route or controller.
- Every query touching `employees`, `documents`, `onboarding_templates`, or any table with a `company_id` column must filter by the authenticated user's `company_id`. There is no database-level Row-Level Security safety net in this stack (unlike a managed-Postgres option) — this discipline has to be enforced consistently in application code, every time, with no exceptions for "internal" or "admin" code paths.
- Do not write a query that fetches by primary key alone (e.g. `employee.findUnique({ where: { id } })`) when the result will be returned to the client, without first checking that the record belongs to the requester's company/department/own-record scope. Fetching by ID without a scope check is the most common way this kind of app leaks data across companies or departments.

## 4. API Design

- REST conventions: resource-based URLs (`/employees`, `/employees/:id/tasks`), correct HTTP verbs, correct status codes (200/201/204 for success, 400 for bad input, 401 for missing/invalid auth, 403 for insufficient permission, 404 for not-found *within the requester's own scope* — never leak the existence of a resource outside the requester's scope by returning 403 instead of 404, or vice versa, inconsistently; pick one behavior and document it).
- All request bodies are validated before touching business logic (see `code-style.md` for the validation library convention). Do not trust client input to be well-formed.
- Every endpoint returns a consistent JSON error shape, e.g. `{ error: { message, code } }`. Do not let raw exception messages or stack traces reach the client response — log them server-side, return a generic message client-side.
- Pagination is required on any list endpoint that could grow unbounded (employees, documents, tasks). Do not ship an endpoint that returns "all rows" with no limit, even if it seems fine at MVP scale — this is cheap to add now and expensive to retrofit.

## 5. Configuration & Environments

- All configuration (database URL, JWT secrets, Groq API key, model name, storage paths) lives in environment variables, loaded via `.env` files that are never committed to version control.
- No hardcoded secrets, API keys, or environment-specific values (URLs, ports, file paths) anywhere in source code. If a value could differ between local dev and deployment, it belongs in configuration, not in code.
- The Groq model name is a configuration value, not a hardcoded string in the RAG service code — this was a specific decision in the PRD to absorb model renames/deprecations without a code change.

## 6. Error Handling & Resilience

- Every external call (Groq API, embedding model inference, file storage) must have explicit error handling with a graceful fallback — never let an unhandled exception from an external dependency crash a request or surface a raw stack trace to the user.
- Async processing (document upload/embedding pipeline) must have a defined status lifecycle (`pending → processing → ready → failed`) persisted in the database, not just tracked in memory — if the server restarts mid-processing, the document's state must still be recoverable and visible, not silently lost.
- Do not fail silently. A failed document upload, a failed Groq call, or a failed auth check must always produce a clear, logged, and (where user-facing) visible outcome.

## 7. RAG-Specific Architecture

- Retrieval and generation are separate, independently testable steps. Do not build a single function that both retrieves chunks and calls Groq in a way that can't be tested or debugged independently — this was a deliberate phase-ordering decision (Phase 3 validates retrieval before Phase 4 introduces generation) and the code structure should reflect that same separation permanently, not just during development.
- The grounding instruction and the "I don't know, contact HR" fallback threshold are configuration, not buried logic — keep the prompt template and the similarity threshold in clearly named, easily adjustable locations, since these will likely need tuning after real usage.
- Never let `rag-service/` construct a prompt that includes anything beyond the retrieved chunks, the question, and the fixed system instruction. Do not add user-supplied "context" or free-form instructions into the prompt beyond what retrieval and the question object provide — this is a prompt-injection surface if not tightly bounded.

## 8. Scalability Discipline (proportionate, not premature)

- Do not over-engineer for scale this project doesn't need yet (no need for a message queue, microservices beyond the three defined, or a caching layer at MVP). But do not write code that actively assumes small scale in a way that's expensive to change later:
  - Use indexed columns for anything queried by (foreign keys, `company_id`, `department_id`, `status` fields) — add indexes as part of the Prisma schema, not as an afterthought.
  - Use pagination and limit clauses from the start (see Section 4).
  - Keep the embedding/chunking pipeline able to run asynchronously, even if v1 runs it in-process — do not hardcode assumptions that document processing is instant or synchronous, since this is exactly the kind of assumption that breaks first under real load.

## 9. Frontend Architecture (`frontend/`)

- Organize by feature/domain (e.g. `src/features/onboarding/`, `src/features/documents/`, `src/features/assistant/`), not by generic type-only folders (`components/`, `pages/` alone) once the app grows past the starter scaffold — a flat `components/` folder becomes unmanageable quickly in an app with three distinct role-based dashboards.
- API calls live in a dedicated data-access layer (e.g. `src/api/`), not scattered `fetch` calls inside components. This keeps auth token attachment, error handling, and base URL configuration in one place.
- Role-based UI (HR Admin / Manager / Employee dashboards) should read the authenticated user's role from a single source of truth (e.g. an auth context/store populated after login), not infer it ad hoc in multiple components.
- Client-side role checks are a UX convenience only, never a security boundary — every permission that matters must also be enforced server-side, per `security.md`.
