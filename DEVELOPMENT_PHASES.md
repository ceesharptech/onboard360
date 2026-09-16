# Development Phases — AI-Powered HR Onboarding Platform

This document is the build plan for the coding agent. Follow the phases **in order**. Do not start a phase's feature work until the previous phase's "Done when" criteria are met. This ordering is deliberate, not arbitrary:

- **Auth (Phase 1) comes before any feature work (Phase 2+)** because retrofitting access-control into existing queries is how security bugs happen — it should never be an afterthought.
- **Retrieval (Phase 3) is validated independently of generation (Phase 4)** so that if the assistant ever gives a wrong answer later, you already know whether the bug is "wrong chunks retrieved" or "LLM ignored the chunks" — debugging both at once is much harder.
- **Phase 5 is broken into sub-phases (5.1–5.6)**, added after Phase 4 shipped, based on a second round of feature requests. They're sequenced by shared plumbing rather than the order they were requested: data foundations first (5.1), then the detail-view/task-assignment work that depends on it (5.2), then list-wide UX (5.3), then the two new content areas — documents (5.4) and training (5.5) — and finally analytics and a full failure-mode audit (5.6), which benefits from everything above already existing. Do not start a sub-phase before the previous one's "Done when" criteria are met, same rule as the top-level phases.

Refer to `PRD.md` for full feature detail and rationale. This document focuses on build order, schema, and acceptance criteria.

---

## Phase 0 — Foundations & Architecture

**Goal:** a working skeleton, not features.

**Fixed directives for this phase (not open decisions):**

- Repo structure: one root folder containing exactly three top-level folders — `frontend/`, `backend/`, `rag-service/`. No other repo layout.
- No Docker, no `docker-compose.yml`, no `Dockerfile` at this stage. PostgreSQL is already installed locally on the development machine — connect to it directly via a `DATABASE_URL` connection string in `backend/.env`.
- ORM/migrations: Prisma, in `backend/`, targeting PostgreSQL. No other ORM or migration tool.
- Backend framework: Express.js, in `backend/`. No other framework.

Tasks:

- Scaffold the three folders (`frontend/`, `backend/`, `rag-service/`) under the repo root
- In `backend/`: initialize Node + Express, install and initialize Prisma (`prisma init`), point `DATABASE_URL` at the local PostgreSQL instance
- Manually enable the `pgvector` extension on the local Postgres database (`CREATE EXTENSION IF NOT EXISTS vector;`) — this is a one-time manual step on the dev machine since there's no container to pre-bake it into; document this step in `backend/README.md` so it's not forgotten on a fresh machine
- Define the schema below in `backend/prisma/schema.prisma` and run the first Prisma migration (`prisma migrate dev`) against the local database
- In `rag-service/`: initialize a Python FastAPI project (virtualenv or equivalent), no code yet beyond a health-check endpoint
- Draft initial schema (expand in later phases as needed):

```sql
companies (id, name, created_at)

users (id, company_id, email, password_hash, role, department_id, created_at)
  -- role: 'hr_admin' | 'manager' | 'employee'

departments (id, company_id, name)

employees (id, company_id, user_id, name, email, department_id, job_role,
           start_date, manager_id, employment_type, mentor_id, created_at)

mentors (id, company_id, department_id, user_id, is_active, current_mentee_count)

onboarding_templates (id, company_id, department_id, job_role, name,
                       is_default, created_by, created_at, updated_at)

onboarding_template_tasks (id, template_id, title, description, category,
                            order_index, assignee_type, due_offset_days)

employee_tasks (id, employee_id, title, description, category, order_index,
                 assignee_type, due_date, status, completed_at,
                 source_template_task_id)  -- snapshot copy, not a live FK dependency

documents (id, company_id, uploaded_by, filename, storage_path, status,
           created_at, updated_at)
  -- status: 'pending' | 'processing' | 'ready' | 'failed'

document_chunks (id, document_id, company_id, content, embedding VECTOR(384),
                  chunk_index, created_at)
  -- ON DELETE CASCADE from documents
```

- File storage path for now: local disk under a gitignored folder in `backend/` (e.g. `backend/uploads/`); note the R2/B2 swap point in a comment for Phase 6
- Seed script stub in `backend/prisma/seed.ts` (to be filled in Phase 2 with default templates)

**Done when:** `backend/` starts against the local PostgreSQL install with `npm run dev` (no Docker involved), a health-check endpoint responds, `rag-service/` starts independently and responds on its own health-check endpoint, and all tables above exist in the local database via a Prisma migration (empty, no app logic yet).

---

## Phase 1 — Auth & Role-Based Access Control

**Goal:** nobody can hit a feature endpoint without the right role and scope, before any feature exists to protect.

Tasks:

- User registration/login flow (HR Admin creates accounts for Managers/Employees — no public self-registration)
- Password hashing (bcrypt or argon2)
- JWT issuing (access token + refresh token), refresh/expiry handling
- Middleware that, on every request: verifies the token, attaches `user`, `role`, `company_id`, `department_id` to the request context
- A reusable authorization helper/middleware that enforces:
  - `hr_admin`: full access within their `company_id`
  - `manager`: access limited to resources where `department_id` matches their own
  - `employee`: access limited to resources tied to their own `employee_id`
- This helper is the **single place** scoping logic lives — feature code in later phases should call it, not re-implement `WHERE` clauses ad hoc, since forgetting one is the most common way this kind of app leaks data across roles/departments.

**Done when:** you can log in as each of the three roles and have automated tests (not just manual spot checks) proving: a Manager cannot access another department's data, an Employee cannot access another employee's data, and an unauthenticated request is rejected on every protected route.

---

## Phase 2 — Employee, Onboarding & Workflow Builder

**Goal:** the full non-AI onboarding backbone, including the template builder.

Tasks:

- HR Admin: create/edit/list employees
- Onboarding Workflow Builder:
  - HR Admin can create/edit/reorder/delete templates for any department/role
  - Manager can create/edit/reorder/delete templates **only** where `template.department_id` matches their own (enforced via the Phase 1 authorization helper, not a UI-only restriction)
  - Template tasks: title, description, category, order_index, assignee_type, due_offset_days
  - Flat ordered list only — no dependency/unlock logic in v1
- Seed default templates per common role/department as starter data (so the builder is never shown empty)
- **Snapshot-on-assignment logic:** on employee creation, copy the matched template's tasks into `employee_tasks` at that moment. Store `source_template_task_id` for traceability only — this is **not** a live foreign-key dependency, and later template edits must not alter already-created `employee_tasks` rows. Write a test that specifically confirms this: edit a template after an employee is assigned, and assert the employee's existing tasks are unchanged.
- Mentor assignment: round-robin or least-currently-assigned within the department's mentor pool at employee-creation time; Manager can manually reassign afterward
- Employee dashboard: roadmap grouped by category, task completion toggling, due dates
- Manager dashboard: team roster, per-employee progress, task reassignment, entry point into the department's template builder

**Done when:** HR creates an employee, the correct role/department template is matched and snapshotted into that employee's task list, the employee can log in and check off tasks, a Manager can see their team's progress and edit only their own department's template, and the "template edit doesn't affect existing employees" test passes.

---

## Phase 3 — Document Upload & Processing Pipeline (retrieval only, no LLM yet)

**Goal:** validate retrieval quality in isolation before generation is introduced.

Tasks:

- HR Admin upload UI (PDF and `.docx` only for v1 — explicitly reject/flag scanned image-only PDFs rather than silently mishandling them)
- Text extraction: PyMuPDF or `pdfplumber` for PDF, `python-docx` for Word
- Chunking: a simple recursive splitter you write yourself (no LangChain dependency needed for this)
- Embedding generation: `sentence-transformers` (`all-MiniLM-L6-v2` or similar), stored in `document_chunks.embedding`
- Async processing: status lifecycle `pending → processing → ready → failed`, visible in the HR UI in real time or via polling
- Re-upload/replace: deleting/replacing a document must cascade-delete its old chunks before new ones are inserted (enforced at the DB level via `ON DELETE CASCADE`, not just app logic)
- Failed-extraction handling: a failed document must show `status = 'failed'` with a visible reason in the HR UI, never fail silently
- **Validation step (no LLM):** write a script or test endpoint that takes a plain-text question, embeds it, and runs a cosine similarity query directly against `document_chunks`, returning the top-k matches for manual inspection

**Done when:** HR uploads a real leave-policy document, its status moves visibly through the pipeline to `ready`, and a direct similarity query for "how do I apply for leave" returns the correct chunk — confirmed by manual inspection, with zero LLM calls involved.

---

## Phase 4 — RAG Assistant (Generation Layer)

**Goal:** layer Groq-based generation on top of the retrieval already proven correct in Phase 3.

Tasks:

- FastAPI microservice: accepts a question + `company_id`, retrieves top-k chunks (reusing Phase 3's retrieval logic), constructs a grounded prompt, calls Groq
- Grounding instruction is mandatory and strict: the model must answer only from the provided chunks
- Fallback: if similarity scores are below a defined threshold (or no chunks returned), respond with an explicit "I couldn't find this in company documents — please contact HR" rather than letting the model guess
- Source labeling: pass each chunk into the prompt tagged with its source document name, and instruct the model to cite the source in its answer
- Groq model name must live in one config value, not be hardcoded inline, to absorb future model renames/deprecations
- Rate-limit/downtime handling: catch Groq API errors and rate-limit responses, and surface a graceful user-facing message instead of a raw error
- Employee-facing chat UI wired to this service

**Done when:** an employee can ask each of the three example questions ("How do I apply for leave?", "Who approves travel requests?", "What tools does the design team use?") and get a grounded, source-cited answer, and asking an out-of-scope question correctly triggers the "contact HR" fallback rather than a hallucinated answer.

---

## Phase 5.1 — Admin Data Foundations

**Goal:** small, foundational admin capabilities that later sub-phases (and the employee-creation flow generally) depend on.

Tasks:

- HR Admin: create/edit/list departments (previously seed-data-only)
- Employee creation form: HR Admin can select the new employee's manager from a dropdown of existing managers in the target department (previously not exposed as a field)
- Employee creation form: HR Admin can manually select an onboarding template to assign, as an alternative to the automatic role/department matching built in Phase 2 — the automatic match should still be offered as the default suggestion, with manual override available, not removed

**Done when:** HR Admin can create a new department through the UI and immediately use it elsewhere in the app (employee creation, template builder) without a server restart or manual seed edit; employee creation supports both manager selection and manual template override, with automated tests confirming both the auto-match default and the manual-override path produce a correctly snapshotted employee.

---

## Phase 5.2 — Detail Views & Ad-hoc Task Assignment

**Goal:** let HR Admins and Managers see and act on an individual employee's full onboarding picture, and let both roles assign new tasks beyond what a template originally snapshotted.

Tasks:

- HR Admin: clicking an employee in the employee list opens a detail view showing full employee information, onboarding progress, and their complete task list (grouped by category, same conventions as the Employee dashboard)
- From that detail view, HR Admin can assign new ad-hoc tasks to the employee, added to their existing `employee_tasks` (not replacing the snapshot — this is additive, same table, same shape, no `source_template_task_id` since it didn't come from a template)
- Manager: the same ad-hoc task-assignment capability, scoped to employees in their own department (reuse the Phase 1 `scopeToDepartment` middleware, not a new ad hoc check)
- Employee: clicking a task (any assignee type) opens a detail view showing the full task description with more structured guidance — extend the task description field/model to support longer, more structured content (e.g. numbered steps), not just a single short sentence. This applies to both template-authored tasks and newly ad-hoc-assigned ones.

**Done when:** an HR Admin can open any employee's detail view, see accurate live progress, and assign a new task that immediately appears on that employee's dashboard; a Manager can do the same for their own department's employees only (cross-department attempts rejected per existing scoping conventions); an Employee can click into any task and see its full detail content, including for ad-hoc assigned tasks.

---

## Phase 5.3 — Search, Filtering & Pagination

**Goal:** close a gap flagged back in `architecture.md` Section 4 (pagination required on any unbounded list) that wasn't fully built out as list-heavy features accumulated.

Tasks:

- Pagination on all list endpoints that could grow unbounded: employee lists, onboarding template lists, and any other list view introduced by Phase 5.1/5.2 (e.g. a department's employee roster)
- Search on employee lists (by name/email/department/role) and template lists (by name/department/role)
- Filtering on employee lists (by department, onboarding status/progress range) and template lists (by department)
- Apply consistently across HR Admin, Manager, and Employee-facing list views wherever each role already has a list view

**Done when:** every list view identified above supports pagination with no unbounded "fetch everything" query remaining in the codebase, and search/filtering on employee and template lists returns correct, scoped (company/department-respecting) results, verified by automated tests.

---

## Phase 5.4 — Document Library

**Goal:** a company/department document library distinct in purpose from the Phase 3 RAG knowledge base, though it may reuse its upload/storage plumbing — this is for humans to browse and open documents directly, not just for retrieval grounding.

Fixed directive: **no version history in this sub-phase.** Replacing a document works the same way as the Phase 3 knowledge base — the new file replaces the old one, no historical versions are retained or browsable. Full versioning remains deferred to v2, per the original PRD decision; this was explicitly reconfirmed for this sub-phase.

Tasks:

- HR Admin: upload/manage documents visible company-wide
- Manager: upload/manage documents scoped to their own department only (reuse `scopeToDepartment`)
- Document library view: employees can browse and open documents relevant to them (company-wide documents + their own department's documents), read-only
- Add an optional "Related Document" field on tasks (template tasks and employee tasks, threaded through snapshot-on-assignment the same way `taskUrl` was) that links a task to a document in this library
- When a task has a related document, render it as a clear reference/link on the task card and in the task detail view (Phase 5.2), distinct from the existing `taskUrl` field — a task can reasonably have both an external link and a related internal document
- The Document Library uses its own separate table(s) (e.g. `library_documents`), not the Phase 3 `documents`/`document_chunks` tables — this was decided explicitly rather than left open. Library documents are not RAG-searchable by Qorra; keep the two systems (RAG knowledge base vs. human-browsable library) architecturally independent, even though their upload/storage handling may share similar patterns/utilities.

**Done when:** HR Admin can upload a company-wide document and a Manager can upload a department-scoped document, both correctly visible to the employees who should see them and correctly hidden from those who shouldn't; a task can be linked to a document in the library and that link is visible and functional from both the task card and task detail view; replacing a document behaves like Phase 3 (old content gone, no version history), confirmed by test.

---

## Phase 5.5 — Training & Guides

**Goal:** a lightweight content library for onboarding-relevant guides and videos, distinct from the Document Library (5.4) and the Knowledge Base (Phase 3).

Tasks:

- HR Admin: create/manage training entries — a title, a description, and either a YouTube video URL (embedded via the video ID, not a raw iframe of arbitrary URLs — validate the URL is a genuine YouTube link) or written guide content
- Employee-facing training/guides view: browse and open available entries, watch embedded YouTube videos inline
- No self-hosted video upload/storage in this sub-phase — YouTube embed only, as decided

**Done when:** HR Admin can add a training entry with a YouTube URL, and an employee can browse to it and watch the embedded video inline without leaving the app; a non-YouTube or malformed URL is rejected at creation time with a clear error rather than producing a broken embed.

---

## Phase 5.6 — Analytics & Polish

**Goal:** finish the product, then deliberately try to break it. This is the original Phase 5 scope, sequenced last within Phase 5 because it benefits from the data and views introduced in 5.1–5.5 (e.g. analytics can now reflect ad-hoc assigned tasks and document/training engagement, not just template-originated tasks).

Tasks:

- Analytics: % onboarding completion per employee, overdue task counts, average time-to-complete per template/task, department-level rollups — computed from real data, now including ad-hoc tasks from Phase 5.2
- Document visibility scoping (already implemented as part of Phase 5.4, not a separate decision here)
- UI polish pass across HR Admin, Manager, and Employee dashboards, including the new views added in 5.1–5.5
- Deliberate failure-mode audit — go back through every phase and sub-phase and confirm graceful handling of: a corrupted/unsupported file upload, an expired auth token, a Groq timeout or rate-limit response, a template with zero tasks, an employee with no matching template (should fall back to a department default, not error), a malformed training video URL, an ad-hoc task assignment to an employee outside the assigner's scope

**Done when:** the analytics dashboard shows real numbers reflecting all task sources (template and ad-hoc), and each of the failure modes above has been manually triggered once and confirmed to fail gracefully rather than crash or silently do nothing.

---

## Phase 6 — Deployment

**Goal:** the product works for a stranger hitting a URL, not just on localhost.

Tasks:

- Postgres hosted on a free tier (Render/Railway/Neon) with `pgvector` enabled
- File storage moved from local disk to an S3-compatible bucket (Cloudflare R2 or Backblaze B2)
- Frontend deployed to Vercel; backend + RAG microservice deployed to Render (final host to be confirmed before this phase starts — not an open decision for the agent to make unprompted)
- Environment variables/secrets configured across all deployed services (JWT secret, DB connection string, Groq API key, storage credentials)
- End-to-end smoke test in the deployed environment: HR creates an employee → employee completes tasks → employee asks the assistant a real question — with no localhost dependency remaining anywhere

**Done when:** a fresh visitor can complete that full flow against the live deployed URL.

---

## Deferred / Backlog (not part of this build plan)

- **Notification reminders on tasks** — explicitly deferred to a post-launch v1.1 backlog item, not scheduled within Phase 5 or Phase 6.
- **Multi-tenant company onboarding with subdomain routing** (e.g. `chowdeck.onboard360.com`) — explicitly a post-deployment initiative on the product owner's own timeline, not part of this repo's phase plan. Note this is a meaningfully larger architectural change than anything above (subdomain-based routing, tenant provisioning/admin tooling, workspace branding) — when it's picked up, it deserves its own PRD-style scoping pass rather than being folded into an existing sub-phase.

---

## Cross-Phase Reminders for the Agent

- Never bypass the Phase 1 authorization helper with ad hoc `WHERE` clauses in later phases — this is the most likely source of a real data-leak bug in this kind of app.
- Template edits must never retroactively affect already-assigned employees (snapshot-on-assignment, Phase 2) — this has a dedicated test; don't skip it.
- The RAG assistant must never answer from outside the provided document context — the grounding instruction and fallback (Phase 4) are hard requirements, not nice-to-haves, given this is HR-policy-adjacent content.
- Document re-upload must cascade-delete old chunks (Phase 3) — a document with mixed stale/current chunks will produce confusing, contradictory assistant answers and is hard to debug after the fact.
