# AGENTS.md

Instructions for any AI coding agent working in this repository. Read this file first, in every session, before making any change.

## Project

An internal HR onboarding platform with a RAG-based AI assistant. Full product scope, feature detail, and rationale live in **`PRD.md`** (repo root). Full build order, phase-by-phase tasks, schema, and "done when" acceptance criteria live in **`DEVELOPMENT_PHASES.md`** (repo root). Read both before starting or resuming any phase of work.

## Standing Rules

The following apply **at all times, across every phase, with no exceptions**:

- **`.agents/rules/architecture.md`** — service boundaries, layering, API design, database access patterns, RAG structure, scalability discipline
- **`.agents/rules/code-style.md`** — naming, formatting, typing, testing conventions, logging, git practices, dependency discipline
- **`.agents/rules/security.md`** — authentication, authorization, input validation, secrets handling, RAG/prompt-injection safety, transport security
- **`.agents/skills/frontend-design`** — component structure, spacing, and interaction pattern guidance for all frontend work. Read this before generating any UI component, in every phase that touches `frontend/`, not just once at project start.
- **`DESIGN-notion.md`** (repo root) — the visual design system (dark mode, Notion-style layout and typography) that every UI surface must follow. Phosphor icons are the only icon library used across the app — do not mix in another icon set for any reason. This is a standing visual-design requirement for the life of the project, not a one-page or one-phase exercise, and applies to every screen built in every future phase (dashboards, the RAG assistant chat UI, analytics views, etc.) whether or not a given phase's prompt repeats it explicitly.

These files are binding regardless of which phase is currently being worked on. If you only load a subset into context for a given task, load all of: `PRD.md`, `DEVELOPMENT_PHASES.md`, the relevant rules file(s), and — for any frontend work — the frontend-design skill and `DESIGN-notion.md`. Do not act on partial context, especially for anything touching auth, data scoping, the RAG pipeline, or visual design consistency. Several rules span more than one file on purpose (e.g. the shared authorization middleware requirement is described in both `architecture.md` and `security.md`); treat them as one combined rule set, not independent checklists.

## Operating Principles

1. **Work one phase at a time, in order.** Do not start a phase before the previous phase's "Done when" criteria in `DEVELOPMENT_PHASES.md` are actually met and verified — not assumed.
2. **Do not make undocumented architectural decisions.** The tech stack, repo structure, and major design choices (snapshot-on-assignment, no Docker, Prisma-only, Express-only, three-folder layout, etc.) are already fixed in `PRD.md` and `DEVELOPMENT_PHASES.md`. Do not substitute, add, or "improve on" these choices unprompted.
3. **If something is genuinely ambiguous or not covered** by `PRD.md`, `DEVELOPMENT_PHASES.md`, the rules files, `DESIGN-notion.md`, or the current task's prompt — stop and ask, or state your reasoning and proceed with the most defensible choice while clearly flagging it in your summary. Never silently pick a default on anything touching data scope, auth, the RAG grounding behavior, or database migration history.
4. **Security and access control are never deferred.** Every phase from the point auth exists onward must already comply with `security.md` — this is not a pass done at the end of the project.
5. **Database migrations are append-only. Never edit an already-applied migration file.** If a schema change is needed after a migration has been generated and applied — including something discovered mid-phase, such as needing to enable a Postgres extension the initial migration didn't account for — create a **new** migration for it. Editing a previously-applied migration's SQL file rewrites history that may already be relied upon and is not standard practice. This applies even in local-only, single-developer development where no drift has occurred yet — the discipline exists so it's never wrong later, not just when a shared environment exists.
6. **Every phase ends with verification, not just implementation.** Where `DEVELOPMENT_PHASES.md` specifies automated tests or explicit "done when" checks, produce and show actual passing output — not a description of what should work.
7. **Report deviations.** If you had to install an unplanned package, work around an environment issue, edit a file outside the current phase's expected scope, or take an approach different from what a prompt specified, say so clearly in your summary rather than letting it pass unmentioned.

## File Map

```
/
├── AGENTS.md                  <- this file
├── PRD.md                     <- product scope and feature requirements
├── DEVELOPMENT_PHASES.md      <- build order, schema, acceptance criteria
├── DESIGN-notion.md           <- visual design system (dark mode, Notion-style)
├── .agents/
│   ├── rules/
│   │   ├── architecture.md
│   │   ├── code-style.md
│   │   └── security.md
│   └── skills/
│       └── frontend-design/   <- component/interaction guidance for all UI work
├── frontend/                  <- React + Vite + Tailwind
├── backend/                   <- Express + Prisma + PostgreSQL (+ pgvector)
└── rag-service/                <- Python + FastAPI (embeddings + Groq generation)
```

## When In Doubt

Priority order for resolving any conflict or ambiguity:

1. Explicit instruction in the current task prompt
2. `DEVELOPMENT_PHASES.md` (what to build, in what order, with what acceptance criteria)
3. `PRD.md` (what the feature should do and why)
4. `.agents/rules/` (how to build it — architecture, style, security)
5. `DESIGN-notion.md` and `.agents/skills/frontend-design` (how it should look and feel, for any frontend work)
6. If still unresolved: ask, or proceed conservatively and flag it — never guess silently on anything affecting data scope, security, database migration history, or another phase's assumptions.
