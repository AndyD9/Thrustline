# AGENTS.md — <PROJECT>

Short on purpose. It carries the invariants; detail lives in the documents it
cites, opened only when the task concerns them.

<PROJECT> is <one sentence: what it is, for whom, on which platform>.
Priorities, in order: <priority 1>; <priority 2>; <priority 3>; <priority 4>;
maintainability. Never sacrifice a higher priority to speed up a lower one. Given
two equally correct options, the one serving the higher priority wins, even if it
costs more.

## Start here — every session

Say "lance poseidon", or run `/locate`. It tells you which state you are in
and which single command applies. Do not begin work without it: that is how a
session ends up touching four unrelated things.

## What to read, and when

1. this file;
2. `<zone>/AGENTS.md` for the zone being worked, if it exists;
3. `docs/CURRENT_STATE.md` — the proven state, held under 200 lines;
4. the unit: in full at its first milestone; afterwards the header, the open
   milestone, `Allowed areas`, `Do not touch`.

That is all. `RULES.md` is read **one section** at a time, for the boundary the
milestone touches. `VALIDATION.md` is read **one row** at a time. Never open a
document "for context".

Precedence when sources disagree: code, migrations and lockfiles on the branch >
active unit and accepted decisions > `CURRENT_STATE.md` > specialised docs >
roadmap and README. A branch or an unmerged Pull Request is never a delivered
capability — always distinguish local, pushed, in review, merged. On a
contradiction, stop, quote both passages, and have the stale source fixed.

On demand under `docs/`: `RULES.md` (invariants by boundary), `VALIDATION.md`
(commands), `ARCHITECTURE.md` (where trust changes), `WORKFLOW.md` (the cycle),
`SETUP.md` (getting it running), `PRODUCT.md` (what it is and is not),
`KNOWN_ISSUES.md`, `LEARNINGS.md`.

If this file still says `<PROJECT>`, the kit was installed but never adapted:
run `/bootstrap` before anything else.

## Non-negotiable invariants

Replace with the project's own. An invariant is written as a **refusal**, not as
an intention, and must be verifiable by a check or by reading a diff.

- **Authority.** <Who is authoritative over sensitive data; which components are
  untrusted clients; what never leaves the server.>
- **Data.** <Schema evolution rule; transactions and idempotence; the isolation
  proof required on every change.>
- **Secrets.** Never commit or log a secret, token, personal datum, or
  environment file. Never execute a remote script.
- **Boundaries.** Validate every input at every boundary: <list them>.
- **Code.** <Strict typing, warnings forbidden, thin layers, exact versions and
  lockfiles, no new dependency where the pinned toolchain suffices.>
- **Decisions.** No architecture or trust-boundary change without a written
  decision; an accepted decision changes only via a decision that supersedes it.
- **Versions.** <Scheme, single source.> Never an opaque version, a reused
  number, or a moved tag.

This file stays under two pages: a new global rule **replaces or condenses** an
existing one. It never stacks.

## Scope

One unit = one user capability = one branch = one worktree. At most **two** units
`In progress`. Cycle in `docs/WORKFLOW.md`.

- Implement the unit only; respect `Allowed areas` and `Do not touch`.
- Record any out-of-scope discovery in `docs/KNOWN_ISSUES.md` with evidence and
  severity, **without fixing it**.
- **Decide alone by default.** Facing an ambiguity, choose the safest option —
  then, among equally safe ones, the fastest — implement it, and record the
  assumption in the report. `<Owner>` is asked only when no option satisfies the
  invariants, when the act is irreversible or leaves the repo, or when it is a
  product call no evidence settles. A question that can wait for the report does
  not interrupt the work.
- The unit file's `Status` field is authoritative; its index is generated from
  that field and is never hand-edited.

## Validation

`docs/VALIDATION.md` gives the commands per area touched: targeted tests first,
then boundary checks. Never report a check you did not run as passed: `passed`,
`not run`, `blocked by environment`, and `failed` are four distinct outcomes, and
a tool exiting `0` without discovering any test proves nothing.

Three failed attempts at the same fix: revert to the last green commit, record
the failure with its evidence, halt. A fourth attempt is forbidden.

## Git

- Read the current branch immediately before every commit — a shared worktree's
  `HEAD` may have moved.
- Stage by explicit path list; never `git add .` or `git add -A`; re-read
  `git diff --cached` before committing.
- Never force-push, never bypass a protection. Pull Request stays draft until
  validations and dependencies are ready. Never invent a branch, a base, or a CI
  result.
- **Final review and merge belong exclusively to `<Owner>`.**

## Ending a task

The report gives: status, files changed, commands and real results, risks and
limits, branch, commit, Pull Request.

**Every report ends with `Next`** — the next concrete action, who owns it, what
unblocks it — **then a resume prompt** copyable into a fresh session, giving
pointers and state, never document contents. Format in `/handoff`.

A report without both is not finished.
