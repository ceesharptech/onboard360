# Product Requirements Document — AI-Powered HR Onboarding Platform

## 1. Overview

An internal HR onboarding platform that gives new employees a personalized, role-specific onboarding journey and lets them get instant, grounded answers to company questions through a Retrieval-Augmented Generation (RAG) assistant trained on documents the company's own HR team uploads.

**Primary differentiator:** the RAG assistant and the fact that HR fully owns and controls the knowledge base it's grounded in (their own uploaded documents, not a generic dataset).

**Deployment model:** single-tenant-first (one company's data per deployment), but architected so a `company_id` foreign key exists on every relevant table, keeping a future multi-tenant SaaS version cheap to build. Multi-tenant is explicitly out of scope for this build.

## 2. Problem & Solution

**Problem:** New employees feel lost during onboarding — generic checklists, no clear ownership of who answers what, and company knowledge locked in PDFs nobody reads.

**Solution:** A platform where:
- HR creates an employee record and the system auto-generates a role-specific onboarding checklist
- A mentor is automatically assigned from a department pool
- Employees track their own progress against the checklist
- Employees can ask a chat assistant natural-language questions ("How do I apply for leave?") and get answers grounded in the company's own uploaded documents, with a source citation and an honest fallback when the answer isn't in the docs

## 3. User Roles & Permissions

| Role | Can do |
|---|---|
| **HR Admin** | Create/manage employees; create/edit onboarding templates for **any** role/department company-wide; upload/manage/delete documents; view company-wide analytics; manage mentor pools |
| **Manager** | View their team's progress; reassign tasks within their team; create/edit onboarding templates **scoped to their own department only**; cannot touch other departments' templates or company-wide documents |
| **Employee** | View their own onboarding roadmap; mark tasks complete; upload documents requested of them; ask the AI assistant questions |

Access control is enforced server-side on every request (no client-side-only role checks). Manager-scoped actions must additionally verify the target resource (template, team member) belongs to that manager's department — role alone is not a sufficient check.

## 4. Core Features

### 4.1 Employee Creation & Auto-Generated Onboarding

HR enters: Name, Email, Department, Role, Start Date, Manager, Employment Type.

On creation, the system:
1. Matches an onboarding template by role + department (falls back to a department-level default if no exact role match exists)
2. **Snapshots** that template's tasks into the employee's own task list at creation time (see 4.2 — this is a deliberate architectural choice, not a live link)
3. Computes due dates for each task from `start_date + due_offset_days`
4. Assigns a mentor from the department's mentor pool (see 4.4)

### 4.2 Onboarding Workflow Builder (Templates)

This is the feature that makes the platform adaptable to any company/role, not just a fixed checklist.

- HR Admins can create, edit, reorder, and delete templates for any role/department
- Managers can create, edit, reorder, and delete templates **only for their own department**
- Each template has one or more tasks with: title, description, category/section (e.g. "IT Setup", "HR Paperwork"), default assignee type (employee / manager / mentor), and a due-date offset in days from the employee's start date
- Task ordering is a flat, ordered list for v1 — **no task dependencies/unlocking logic** (explicitly deferred to v2)
- Every department/role should have a **pre-seeded default template** as starter data, so the system is never presented to HR as an empty state
- **Template edits do not retroactively change already-onboarded employees.** Templates are snapshotted into `employee_tasks` at assignment time (see data model). Editing a template only affects employees created after the edit.
- **Template versioning** (letting HR see/manage historical versions and selectively migrate employees to a new version) is explicitly **out of scope for v1** and deferred to v2.

### 4.3 Employee & Manager Dashboards

- **Employee dashboard:** roadmap of their tasks grouped by category, checkbox completion, due dates, document upload where required, entry point to the AI assistant
- **Manager dashboard:** team roster, per-employee progress %, ability to reassign a task's owner, access to the department's template builder

### 4.4 Mentor Assignment

- Departments maintain a pool of eligible mentors (opted in by HR or Manager)
- Assignment on employee creation uses round-robin or least-currently-assigned logic within the department's pool — **not** a skill/availability-matching algorithm (explicitly deferred to v2)
- Managers can manually reassign a mentor after the fact

### 4.5 Document Upload & Processing Pipeline (HR-managed knowledge base)

HR Admins upload the documents the RAG assistant will be grounded in (e.g. leave policy, IT setup guide, org chart, team tool pages).

- Supported formats for v1: PDF and Word (`.docx`). Scanned/image-only PDFs (requiring OCR) are explicitly **out of scope for v1**.
- Upload is asynchronous. Each document has a visible status: `pending → processing → ready → failed`.
- Processing pipeline: text extraction → chunking → embedding generation → storage of chunks + embeddings.
- **Re-upload/replace behavior:** replacing a document must delete its old chunks (cascade) before inserting new ones, so the assistant never mixes stale and current content for the same document.
- Failed extraction must surface clearly in the HR UI (not fail silently) — HR must be able to see and act on a failed document.
- Document visibility scoping (e.g. some docs restricted to certain roles) is a stretch goal for v1, not a hard requirement — default is all documents visible to all authenticated employees for retrieval purposes.

### 4.6 AI Company Assistant (RAG)

- Employee-facing chat interface for natural-language questions about company policy, process, and org info
- Retrieval: embed the incoming question, retrieve top-k most similar chunks from the document store
- Generation: pass retrieved chunks + question to Groq with a strict grounding instruction — the model must answer **only** from the provided context
- **Fallback behavior:** if retrieval similarity is low or no relevant chunks are found, the assistant must respond with an honest "I couldn't find this in company documents — please contact HR" rather than guessing. This is a hard requirement, not a nice-to-have — an HR assistant that hallucinates policy is a liability, not just a bug.
- **Source citation:** answers should reference which document they were grounded in (e.g. "According to the Leave Policy...")
- Groq model name must be configuration-driven (not hardcoded) to absorb model deprecations/renames without a code change
- Rate-limit handling: on a Groq rate-limit or downtime response, the user must see a graceful message, never a raw API error

### 4.7 Analytics

- Per-employee % onboarding completion
- Overdue task counts
- Average time-to-complete per task/template
- Department-level rollups

## 5. Non-Functional Requirements

- **Auth & access control must exist before any feature endpoint is built**, not retrofitted afterward
- Every query touching employee, document, or template data must be scoped by `company_id` and, where relevant, `department_id` — there is no database-level Row-Level Security safety net (unlike a managed-Postgres option), so this scoping must be enforced consistently in application/middleware code
- Retrieval quality must be validated independently of the LLM (i.e., confirm the right chunks come back from a similarity query) before the generation layer is wired on top — this keeps debugging tractable if answers are ever wrong
- File storage: local disk for local development; an S3-compatible service (Cloudflare R2 or Backblaze B2) for any deployed environment, since most free app-hosting tiers have an ephemeral filesystem
- Known, accepted tradeoff for v1: uploaded document content is sent to Groq's third-party API as part of grounding the assistant's answers. This is acceptable for an MVP but should be documented as a data-handling consideration to revisit before any real production/enterprise use.

## 6. Explicitly Out of Scope for v1 (Deferred to v2)

- Template versioning / historical migration of employees to new template versions
- Task dependency chains / unlocking logic within a template
- Skill- or availability-based mentor matching
- Meeting/calendar scheduling integration
- Document e-signatures or formal versioning UI
- OCR for scanned documents
- Multi-tenant billing/admin layer
- Per-document role-gated retrieval (visibility scoping) — nice-to-have stretch, not required

## 7. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind |
| Backend | Node.js + Express.js |
| ORM / Migrations | Prisma (targeting PostgreSQL) |
| Database | Locally installed PostgreSQL (no Docker — see Section 9), with `pgvector` extension enabled |
| Auth | Hand-rolled JWT (access + refresh tokens), bcrypt/argon2 password hashing |
| File storage | Local disk (dev) → Cloudflare R2 or Backblaze B2 (deployed) |
| RAG microservice | Python FastAPI |
| Embeddings | `sentence-transformers` (e.g. `all-MiniLM-L6-v2`), self-hosted, no external embedding API |
| LLM generation | Groq (config-driven model string) |
| Deployment | Frontend on Vercel; backend + RAG service + Postgres on Render/Railway/Neon (free tiers) |

These choices are fixed directives, not options for the agent to reconsider or substitute mid-build.

## 9. Repository & Environment Directives

- **Repo structure:** a single root repository containing three separate top-level folders — `frontend/`, `backend/`, `rag-service/`. No monorepo tooling (e.g. Turborepo/Nx) unless explicitly requested later — three plain sibling folders under one root is sufficient.
- **No Docker.** The development machine cannot run Docker due to virtualization being unavailable. Do not generate `Dockerfile`s or `docker-compose.yml` for local development. PostgreSQL is already installed locally and should be connected to directly via a connection string in `.env`.
- **Prisma is the only ORM/migration tool to use** for the `backend/` service — do not introduce Knex, Sequelize, TypeORM, or raw migration SQL files as an alternative.
- **Express.js is the only backend framework** for `backend/` — do not substitute Django, Fastify, NestJS, or anything else.
- Docker remains acceptable **only** at deployment time if the chosen host (Render/Railway) requires a container image — this is a Phase 6 concern, not a development-environment requirement, and should be revisited explicitly then rather than assumed now.

## 8. Success Criteria for v1

- HR can create an employee and the system generates the correct role-specific task list automatically
- HR/Managers can build and edit onboarding templates through a UI, and previously-onboarded employees are unaffected by later template edits
- HR can upload a document and, without any LLM involved, a direct similarity query against stored chunks returns the correct passage for a known question
- An employee can ask the three example questions ("How do I apply for leave?", "Who approves travel requests?", "What tools does the design team use?") and receive grounded, source-cited answers
- Asking a question with no relevant document coverage correctly triggers the "contact HR" fallback instead of a fabricated answer
- Role-based access control is verified, not assumed: a Manager cannot edit another department's template, and an Employee cannot access another employee's data
