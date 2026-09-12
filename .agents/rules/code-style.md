# Code Style Rules

These rules apply at all times, across all phases and all three services (`frontend/`, `backend/`, `rag-service/`). They exist so the codebase reads as if one disciplined engineer wrote it, regardless of which phase or session produced a given file.

## 1. Language & Typing

- `backend/` and `frontend/` are TypeScript, not JavaScript. No `.js` files introduced for application code. `tsconfig.json` should have `strict: true` — do not weaken strictness to make errors go away.
- Avoid `any`. If a type is genuinely unknown at a given point (e.g. a third-party library with poor types), use `unknown` and narrow it, or write a minimal local type — do not reach for `any` as a shortcut.
- `rag-service/` is Python with type hints on all function signatures (parameters and return types). Use Pydantic models for request/response schemas in FastAPI endpoints rather than untyped dicts.

## 2. Naming Conventions

- **Files:** `camelCase.ts` for TypeScript modules, `PascalCase.tsx` for React components, `snake_case.py` for Python modules.
- **Variables/functions:** `camelCase` in TypeScript, `snake_case` in Python. No abbreviations that aren't immediately obvious (`emp` for `employee` is not acceptable; `req`/`res` in Express handlers is a conventional exception).
- **Database:** table and column names follow the Prisma schema already established in Phase 0 (`snake_case` at the DB level via Prisma's `@map`, `camelCase` in the Prisma client/TypeScript). Do not introduce a second naming convention for new tables added in later phases — match what Phase 0 established.
- **Constants:** `SCREAMING_SNAKE_CASE` for true constants (config keys, fixed thresholds like similarity cutoffs).
- **Booleans:** prefix with `is`, `has`, `should` (`isReady`, `hasMentor`, `shouldRetry`) — not bare adjectives.

## 3. Formatting & Linting

- Set up ESLint + Prettier in `frontend/` and `backend/` at Phase 0/1 and do not let later phases drift from it. Run the linter/formatter before considering any phase "done" — a phase is not complete if it doesn't pass lint cleanly.
- Set up `black` + a linter (e.g. `ruff`) in `rag-service/` for the same reason.
- No commented-out dead code left in committed files. If something was tried and abandoned, delete it — version control is the history, not code comments.
- No console.log/print statements left in for debugging once a feature is complete — use a real logging utility (see Section 6) or remove them.

## 4. Function & File Size Discipline

- Prefer small, single-purpose functions over large ones that do several things. If a function needs a comment to explain "step 1 / step 2 / step 3," it's usually a sign it should be three functions.
- A route handler, controller function, or React component that exceeds roughly 100-150 lines is a signal to extract logic into a service, hook, or sub-component — not a hard rule, but a prompt to pause and reconsider structure.
- One React component per file, matching the filename, for anything beyond trivial inline helper components.

## 5. Comments & Documentation

- Comment *why*, not *what* — the code already says what it does; comments should explain non-obvious reasoning (e.g. "snapshotting here intentionally, not a live FK — see PRD.md Section 4.2" is a good comment; "// loop through employees" is not).
- Every non-trivial module (services, middleware, the vector search module) gets a short docblock at the top explaining its responsibility.
- Any deliberate architectural tradeoff (e.g. the known limitation of sending document content to Groq's API, or the `Unsupported("vector(384)")` Prisma escape hatch) must be documented in a comment at the point it occurs, not only in `PRD.md` — a future reader of the code shouldn't have to go hunting through external docs to understand a non-obvious line.

## 6. Logging

- Use a structured logging library (e.g. `pino` or `winston` for `backend/`, Python's standard `logging` module configured with structured output for `rag-service/`) — not bare `console.log`/`print` in application code.
- Never log secrets, passwords, full JWT tokens, or raw document content at anything above debug level. Log identifiers (`userId`, `documentId`) instead of full payloads.
- Log at appropriate levels: `error` for failures needing attention, `warn` for recoverable/unexpected situations, `info` for significant lifecycle events (user login, document processed), `debug` for detailed tracing — and default to `info` in normal operation, not `debug`.

## 7. Testing Conventions

- Test runner: Jest or Vitest for `backend/` and `frontend/` (pick one at Phase 1 and use it consistently across all later phases — do not mix). `pytest` for `rag-service/`.
- Test file naming: colocate as `<filename>.test.ts` next to the file it tests, or mirror the source structure under a `tests/` directory — pick one pattern at Phase 1 and stay consistent.
- Every service function with business logic (template matching, snapshot-on-assignment, mentor assignment, similarity threshold fallback) needs a unit test, not just the authorization tests mandated in Phase 1.
- Do not write tests that depend on execution order or shared mutable state between tests. Each test should set up its own data and clean up after itself (or run in a transaction that's rolled back).

## 8. Git Practices

- Commit messages describe intent, not just action: `Add department-scoped template authorization` rather than `update middleware.ts`.
- Commit at logical checkpoints within a phase (e.g. "schema + migration," "auth endpoints," "authorization middleware," "auth tests") rather than one giant commit per phase — this makes the history useful if something needs to be traced back later.
- `.env`, `node_modules/`, `.venv/`, `uploads/`, and any build output directories are gitignored from Phase 0 onward — verify this hasn't drifted in later phases before committing.

## 9. Dependency Discipline

- Do not add a new library/package to solve a problem the existing stack already solves, without a clear reason. Adding `axios` when `fetch` is already sufficient, or adding a validation library when one is already chosen (see below), creates unnecessary surface area.
- Pick one request-validation library for `backend/` (e.g. `zod`) at the point it's first needed and use it consistently for all endpoints in every later phase — do not let different phases introduce different validation approaches.
- Before adding any new dependency, prefer a well-maintained, widely-used package over a niche one, and avoid adding a dependency for something that's a handful of lines to implement directly (matches the project's existing preference — e.g. the hand-written chunking splitter instead of pulling in LangChain).
