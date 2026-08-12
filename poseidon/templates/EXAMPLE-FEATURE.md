# F0001 — A signed-in user exports their own data as a CSV file

Status: In progress
Branch: `feature/f0001-self-serve-export`
Risk: High
Security-sensitive: Yes

> Worked example. Copy the *shape*, not the content. It exists because agents
> reproduce a filled example far more reliably than they apply a written rule.
> Note what it does **not** contain: no narrative in the rules documents, no
> milestone that cannot be committed alone, no validation reported without its
> real output.

## Goal

A signed-in user requests an export and receives a CSV containing their own
records, and only their own.

## Context

On `main` today: `users` and `records` tables exist; the authenticated boundary
exists at `api/handlers/`; there is no export path of any kind, and no
background job runner. Verified by reading `api/handlers/__init__.py` and
`db/migrations/` at `a4f21c9`, not from `CURRENT_STATE.md`.

## Dependencies

- ADR-0007 (accepted) — exports are generated synchronously until p95 exceeds
  2 s; no job runner is introduced by this unit.
- None outstanding. No `<Owner>` decision, hardware, or human verification is
  missing — this unit could enter `Ready`.

## Allowed areas

- `db/migrations/`
- `api/exports/`
- `api/handlers/exports.py`
- `web/src/features/export/`
- `tests/exports/`

## Do not touch

- `api/auth/` — identity derivation is out of scope; use the existing helper.
- `db/migrations/0001_*` … `0018_*` — append-only.
- `web/src/features/billing/` — shares the download component; changing it is
  its own unit.

## Non-goals

- Export formats other than CSV — F0004.
- Scheduled or emailed exports — needs a job runner, blocked by ADR-0007.
- Admin export of another user's data — a different trust boundary entirely.

## Milestones

### J1 — the export row exists and is isolated per user

Status: Done
Risk: High
Security-sensitive: Yes

- result: an `exports` row can be created and read back, and a query issued as
  user B cannot see user A's row.
- boundary: data and persistence
- validations: `make migrate-check` -> `make db-reset` -> `pytest tests/exports/test_isolation.py` -> `mypy db api`
- review: the isolation predicate — is it enforced in the schema or only in the
  query the tests happen to use?
- manual check: reset the database, insert two users, query as each, confirm
  each sees one row. ~6 min.

### J2 — the authenticated endpoint returns the caller's CSV

Status: Review
Risk: High
Security-sensitive: Yes

- result: `GET /api/exports/me.csv` returns only the caller's records; an
  unauthenticated call returns 401 and no body.
- boundary: authenticated boundary
- validations: `pytest tests/exports/test_handler.py` -> `make run-local` + `scripts/smoke-export.sh`
- review: is the identity taken from the token, or anywhere from the request?
- manual check: call the endpoint with user A's token, then with user B's, then
  with none. ~8 min.

### J3 — the user can trigger the download from the UI

Status: Draft
Risk: Low
Security-sensitive: No

- result: an "Export my data" button downloads the file with a stable filename.
- boundary: client
- validations: `npm run typecheck` -> `npm test -- export` -> `npm run build`
- review: no business rule and no authority decision added on the client.
- manual check: click the button as a real signed-in user, open the file. ~5 min.

## Acceptance criteria

- [ ] A signed-in user downloads a CSV of their own records.
- [ ] A request without a valid token returns 401 with no body.
- [ ] A user with zero records receives a valid CSV with headers only.
- [ ] `docs/CURRENT_STATE.md` lists the capability with its evidence.

## Review

J1 and J2 are `Security-sensitive: Yes`.

- asset protected, boundary, abuse refused: users' own records; authenticated
  boundary; reading another user's export.
- validation, authorisation, atomicity, idempotence, logs: identity derived from
  the token only; export generation is read-only, so idempotent; the export id
  is logged, never the row contents.
- debt created, manual check to automate: the cross-user smoke test is manual at
  J2 — F0011 turns it into a check.
- residual risk or approved exception: synchronous generation blocks a worker on
  very large accounts. Accepted per ADR-0007, revisit when p95 > 2 s.

## Rollback

Drop the endpoint and the UI at any point; `0019_add_exports` is additive and
can be left in place. Rolling back after J3 loses nothing — no data is written
by the export path.

## Completion Report

### J1

- result obtained: `exports` table added; isolation enforced by a row-level
  predicate on `owner_id`, not by the query.
- files changed: `db/migrations/0019_add_exports.sql`, `api/exports/model.py`,
  `tests/exports/test_isolation.py`
- commands and real results:
  - `make migrate-check` -> passed
  - `make db-reset` -> passed
  - `pytest tests/exports/test_isolation.py` -> passed, 7 tests discovered
    (baseline 6, raised in this unit because it adds the tests)
  - `mypy db api` -> passed, 0 errors
- commit: `7c1d4e0` (pushed) — `/review` used `git merge-base origin/main HEAD`
  as its base for J1; J2 uses `7c1d4e0`.
- manual verification: passed — two users inserted, each query returned exactly
  its own row; the cross-user query returned 0 rows, not an error.
- review findings addressed: reviewer noted isolation was initially enforced in
  the query only. Moved into the schema predicate; the test that passed before
  the fix now fails when the predicate is removed.

### J2

- result obtained: <in review>
- files changed: `api/handlers/exports.py`, `tests/exports/test_handler.py`
- commands and real results:
  - `pytest tests/exports/test_handler.py` -> passed, 11 tests discovered
  - `scripts/smoke-export.sh` -> **blocked by environment** — needs the staging
    token issuer, unavailable locally. `<Owner>` to run it on staging. Local
    handler tests do **not** prove token issuance or the 401 path end to end.
- commit: `b93a115` (pushed)
- manual verification: pending
- review findings addressed: pending

### Summary

- risks and limits: to fill at close.
- follow-ups recorded: KI-014 (large-account timeout), F0011 (automate the
  cross-user smoke test).
- documentation updated: to fill at close.
