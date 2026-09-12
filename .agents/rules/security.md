# Security Rules

These rules apply at all times, across all phases. This is an HR platform handling employee personal data, internal company documents, and policy information — treat security as a hard requirement throughout, not a pass at the end. If a feature request and a security rule conflict, the security rule wins; flag the conflict rather than silently weakening a rule.

## 1. Authentication

- Passwords are hashed with bcrypt before storage. Never store, log, or transmit plaintext passwords — including in error messages or debug logs.
- JWT access tokens are short-lived (15 minutes per the Phase 1 directive); refresh tokens are longer-lived but must be revocable (see Phase 1's token revocation requirement) — never issue a long-lived access token "for convenience."
- JWT secrets are strong, randomly generated values stored only in environment variables, different between access and refresh tokens if the implementation supports it, and never reused across environments (a local dev secret must never be the same value used in a deployed environment).
- Login failure responses must be generic ("invalid credentials") and must not reveal whether the email exists in the system, whether the password was wrong specifically, or any other distinguishing detail — this prevents account enumeration.
- Rate-limit the login endpoint specifically, separate from general API rate limiting, to slow down credential-stuffing/brute-force attempts.
- There is no public self-registration endpoint (per the PRD) — account creation is always performed by an authorized HR Admin or via the initial seed script. Do not add a self-registration path as a convenience later without this being an explicit, discussed decision.

## 2. Authorization

- Every protected route must pass through the shared `authenticate` middleware — there is no endpoint that trusts a client-supplied role, company ID, or user ID without first verifying the JWT.
- Authorization checks (`requireRole`, `scopeToCompany`, `scopeToDepartment`, `scopeToOwnEmployee`) are enforced server-side on every request, never inferred from what the frontend chooses to show or hide. The frontend hiding a button is not a security control.
- Default to denying access. If a new endpoint is added in a later phase and the authorization rule for it isn't obvious from the PRD or existing middleware patterns, the default is to restrict it as narrowly as possible and flag the ambiguity — never default to "any authenticated user can access this" for a new endpoint touching employee, document, or template data.
- Re-verify scope on every request, not just at the point a resource is first created. An employee's `departmentId` or a document's ownership must be checked fresh on each request against the authenticated user's own claims, not trusted from a prior request or cached client-side value.
- Test authorization boundaries explicitly (per the Phase 1 testing requirement) whenever a new role-sensitive endpoint is added in later phases — this is not a one-time Phase 1 exercise, it's a standing requirement for any new protected route.

## 3. Input Validation & Injection Prevention

- Validate and sanitize every piece of client-supplied input (request bodies, query params, URL params, uploaded file metadata) before it touches business logic or the database. Use the project's chosen validation library (see `code-style.md`) consistently — do not hand-roll ad hoc validation per route.
- All database access goes through Prisma's parameterized queries. Any raw SQL (e.g. the pgvector similarity query) must use parameterized queries (`Prisma.sql` tagged templates or equivalent) — never string-concatenate user input into a raw SQL query, under any circumstance.
- Sanitize/escape any user-supplied content that will be rendered in the frontend to prevent stored XSS — React escapes by default, but if `dangerouslySetInnerHTML` or any raw HTML injection is ever considered for rendering assistant answers or document content, treat that as a security review checkpoint, not a routine implementation detail.
- Validate file uploads strictly: check file type by content/magic bytes where feasible (not just the filename extension), enforce a maximum file size, and reject anything outside the PDF/`.docx` scope defined in the PRD — do not process an unexpected file type just because it was accepted by the upload endpoint.

## 4. Secrets & Configuration

- No secrets, API keys, database credentials, or JWT signing keys are ever committed to version control, hardcoded in source files, or logged — this applies to every service, every phase, with no exceptions for "just testing locally."
- `.env` files are gitignored from Phase 0 onward; only a `.env.example` with placeholder values (no real secrets) is committed, if one is provided at all.
- The Groq API key and any future third-party credentials are loaded from environment variables in `rag-service/`, never hardcoded, never passed through the frontend, and never included in any response payload sent to the client.
- Before deployment (Phase 6), rotate any secret that was ever used during local development if there's a chance it was exposed (e.g. shared in a chat, committed accidentally at any point) — treat any credential that touched an insecure channel as compromised.

## 5. Data Protection & Privacy

- Employee personal data (name, email, employment details) and uploaded company documents are sensitive by default. Do not expose more data in an API response than the endpoint's purpose requires — e.g. a team roster endpoint for a Manager doesn't need to return other employees' full records if only name and progress are needed for that view.
- Enforce `company_id` scoping on every query as described in `architecture.md` — this is as much a privacy requirement as an architectural one, since a scoping bug here means one company's HR data becomes visible to another company.
- If document visibility scoping (role-gated documents) is implemented per the PRD's stretch goal, treat it as a real access-control feature with the same rigor as role-based endpoint authorization — not a soft UI filter.
- Do not log full request/response bodies for endpoints touching employee PII or document content — log identifiers and outcomes, not the sensitive payloads themselves (see `code-style.md` Section 6).

## 6. RAG / LLM-Specific Security

- Treat retrieved document content and user questions as untrusted input to the prompt, not as trusted system instructions. The system/grounding instruction to Groq must be fixed and not overridable by anything in the retrieved chunks or the user's question — this guards against prompt injection embedded in an uploaded document (e.g. a document containing text designed to make the assistant ignore its grounding instructions).
- The assistant must never be given the ability to take actions (write to the database, call other internal APIs) based on its output in v1 — it is read-only/informational by design. If any future phase considers giving the assistant tool-use/function-calling capability, that is a significant security review point, not a routine extension.
- Do not pass raw error details from the Groq API back to the end user — log them server-side and return the generic fallback message defined in the PRD.
- Be mindful that uploaded document content is sent to a third-party API (Groq) as part of grounding — this is a documented, accepted v1 tradeoff per the PRD, but it means no document should be uploaded to this system that the company wouldn't accept being processed by a third-party LLM provider. This is a policy note for the humans operating the system, not something the code needs to enforce, but it should be documented visibly (e.g. in the HR upload UI or README) rather than left implicit.

## 7. Transport & Infrastructure

- All communication in a deployed environment must be over HTTPS — no plaintext HTTP for any service once deployed (Phase 6). Local development over HTTP is acceptable.
- Set standard security headers on the Express app (e.g. via `helmet`): appropriate CSP, `X-Content-Type-Options`, `X-Frame-Options`, and disable `X-Powered-By`.
- Configure CORS explicitly and narrowly — allow only the known frontend origin(s), never a wildcard `*` origin, especially once cookies or credentials are involved in any request.
- Apply general API rate limiting (in addition to the stricter login-specific limiting in Section 1) to reduce abuse and denial-of-service risk on all public-facing endpoints.

## 8. Dependency & Supply Chain Hygiene

- Run `npm audit` (for `frontend/`/`backend/`) and an equivalent Python dependency check (e.g. `pip-audit`) periodically, and address high/critical findings — do not let known-vulnerable dependencies sit unaddressed across phases.
- Pin dependency versions (via lockfiles — `package-lock.json`, a Python `requirements.txt` with pinned versions or a lockfile-based tool) so builds are reproducible and a dependency doesn't silently change behavior between environments.
- Do not add dependencies from unmaintained or low-trust sources, per the dependency discipline in `code-style.md`.

## 9. Error Handling & Information Disclosure

- Never return stack traces, internal file paths, raw database error messages, or library-specific error details in an API response to the client — these belong in server-side logs only, per `architecture.md` Section 6.
- Distinguish carefully between "not found" and "not authorized" responses only where the PRD/architecture rules call for it (see `architecture.md` Section 4) — be consistent about which one is used for a given resource type so the behavior itself doesn't become an information leak (e.g. always returning 404 for out-of-scope resources rather than 403, so an attacker can't distinguish "exists but you can't see it" from "doesn't exist").

## 10. Standing Requirement Across All Phases

Security is not a phase-5-polish concern. Every phase from Phase 1 onward must be built with these rules already applied — authentication and authorization in Phase 1, input validation and file-upload checks from the moment the document pipeline is built in Phase 3, prompt-injection-aware RAG design from the moment generation is introduced in Phase 4. If a later phase's implementation would require weakening any rule in this document to ship faster, stop and flag it rather than proceeding.
