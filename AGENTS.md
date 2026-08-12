# AGENTS.md — Thrustline

Short on purpose. It carries the invariants; detail lives in the documents it
cites, opened only when the task concerns them.

Thrustline is a distributable Windows 11 desktop application for managing a
virtual airline in Microsoft Flight Simulator 2024, for a solo owner-operator.
Priorities, in order: stability and recovery after error; security of a
distributed, modifiable client; economy and data integrity; MSFS and SimConnect
compatibility; maintainability. Never sacrifice a higher priority to speed up a
lower one. Given two equally correct options, the one serving the higher
priority wins, even if it costs more.

## Start here — every session

Say "lance poseidon", or run `/locate`. It tells you which state you are in and
which single command applies. Do not begin work without it: that is how a
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
`KNOWN_ISSUES.md`, `LEARNINGS.md`, `decisions/` (accepted ADRs).
`docs/archive/` is historical: read it for context, never as law.

## Non-negotiable invariants

- **Authority.** The server is authoritative for money, ownership, reputation,
  progression and every sensitive transition. The desktop app, the sidecar and
  MSFS are untrusted clients. Never accept an identity, a role, an amount, an
  outcome or the current time from a client. Never ship a backend secret to a
  client, and never return a privileged Supabase credential to the sidecar.
- **Data.** Migrations are append-only; never edit or delete an applied one.
  Every sensitive mutation is transactional and idempotent. No schema change
  merges without proving isolation for owner A, owner B and anonymous.
- **Secrets.** Never commit or log a secret, token, JWT, authentication header,
  personal datum, or environment file. Never execute a remote script.
- **Boundaries.** Validate every input at every boundary before any side effect:
  data and persistence, authoritative service, bridge local API, SimConnect and
  MSFS, third-party egress, desktop shell, distribution.
- **Code.** TypeScript strict, C# nullable, no new Rust warning. Business rules
  and data access stay out of React components. Shared contracts are versioned
  and their consumers updated in the same change. Exact versions and committed
  lockfiles. Never add a dependency where the pinned toolchain suffices.
- **Decisions.** No architecture or trust-boundary change without a written ADR
  accepted by `PacoRCS`; an accepted ADR changes only via one that supersedes
  it.
- **Versions.** Semver, currently resetting to `0.0.1-alpha`. Never an opaque
  version, a reused number, or a moved tag. The single source among the four
  manifests is **not yet decided** — see `PRODUCT.md`, open questions.
- **Legacy.** `legacy/` is read-only until explicitly archived.

This file stays under two pages: a new global rule **replaces or condenses** an
existing one. It never stacks.

## Scope

One unit = one user capability = one branch = one worktree. At most **two** units
`In progress`. Cycle in `docs/WORKFLOW.md`.

- Implement the unit only; respect `Allowed areas` and `Do not touch`. Do not
  anticipate future units, and do not refactor an unrelated system.
- Record any out-of-scope discovery in `docs/KNOWN_ISSUES.md` with evidence and
  severity, **without fixing it**.
- Never include, overwrite or publish a pre-existing user change unrelated to
  the unit.
- **Decide alone by default.** Facing an ambiguity, choose the safest option —
  then, among equally safe ones, the fastest — implement it, and record the
  assumption in the report. `PacoRCS` is asked only when no option satisfies the
  invariants, when the act is irreversible or leaves the repo, or when it is a
  product, security, data or architecture call no evidence settles. A question
  that can wait for the report does not interrupt the work.
- The unit file's `Status` field is authoritative; its index is generated from
  that field and is never hand-edited.

## Validation

`docs/VALIDATION.md` gives the commands per area touched: targeted tests first,
then boundary checks. Never report a check you did not run as passed: `passed`,
`not run`, `blocked by environment`, and `failed` are four distinct outcomes,
and a tool exiting `0` without discovering any test proves nothing — `dotnet
test` does exactly that in this repository.

SQL changes require a local or staging isolation test between two users.
SimConnect changes require a replayed trace or a documented manual MSFS test.

`python3` is absent here, so POSEIDON's checks run in **agent mode**: every
report must say `checks: agent mode — not deterministic, no CI gate`.

Three failed attempts at the same fix: revert to the last green commit, record
the failure with its evidence, halt. A fourth attempt is forbidden.

## Git

- Read the current branch immediately before every commit — a shared worktree's
  `HEAD` may have moved. Never invent a branch, a base, or a CI result: read
  them.
- Stage by explicit path list; never `git add .` or `git add -A`; re-read
  `git diff --cached` and run `git diff --cached --check` before committing.
- Conventional Commits. Branch, commit, push and open or update the Pull Request
  autonomously — no intermediate confirmation is needed for those.
- Never force-push, never modify a protected branch directly, never bypass a
  protection. The Pull Request stays draft until validations and dependencies
  are ready.
- Git for Windows and PowerShell for this repository, never Git under WSL on
  `/mnt/c`. Never ask for a GitHub password; recommend `gh auth login`.
- **Final review and merge belong exclusively to `PacoRCS`**, and require his
  explicit confirmation.

## Ending a task

The report gives: status, files changed, commands and real results, risks and
limits, branch, commit, Pull Request.

**Every report ends with `Next`** — the next concrete action, who owns it, what
unblocks it — **then a resume prompt** copyable into a fresh session, giving
pointers and state, never document contents. Format in `/handoff`.

A report without both is not finished.
