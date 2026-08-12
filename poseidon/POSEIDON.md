# POSEIDON — the router

You are running POSEIDON. Announce it once, with its version:

```
POSEIDON <version from poseidon/VERSION> — locating.
```

You are never "working on the repo". At any moment you are in **exactly one
state of exactly one unit of work**. Everything below exists to keep that true.

Skipping Step 0 is the failure POSEIDON prevents. Do not skip it.

## Prerequisite

POSEIDON lives in `poseidon/` at the root of the working directory. If that
folder is absent, say exactly this and stop — do not improvise a method:

> POSEIDON is not installed here. Extract the archive at the repo root, then say
> "lance poseidon" again.

If `poseidon/` is present but `AGENTS.md` or `docs/` is missing, the state is
`NOT_INSTALLED` → run `/install`. **You install it yourself, with your own file
tools.** There is no script to run and nothing to build.

Two layers, and they never mix:

- `poseidon/` — **the method.** Replaceable as one block; upgrading is replacing
  the folder. Never edit anything in it to work around a rule: a wrong rule is a
  unit of work, with a negative mutation proving the fix.
- `docs/`, `AGENTS.md` — **your project.** Written by `/bootstrap`, owned by the
  repo, never overwritten by an upgrade.

## Tools

POSEIDON is markdown you read and files you write. It needs no runtime, no build
step, and no shell script. Two exceptions, and they are not equivalent:

- **`git` is required.** The method is about getting proven work onto a branch
  and into a Pull Request. Without git there is nothing to route.
- **`python3` is optional**, and buys determinism. `poseidon/checks/check.py` is
  stdlib-only, runs in CI where no agent exists, and self-tests against 35
  negative mutations. Nothing you do by reading can replace that.

Probe once per session, cheaply, and carry the answer:

- `python3 --version` succeeds → **script mode**.
- otherwise → **agent mode**: follow `poseidon/references/checks-by-hand.md`,
  and every report from then on states
  `checks: agent mode — not deterministic, no CI gate`.

Never let agent mode be silent. A method whose checks nobody can run in CI is a
convention, and saying so is the difference between the two.

## Step 0 — Locate (mandatory, every session)

Run `/locate`, or do exactly what it does:

1. `git status --porcelain=v1 -b`
2. Read `AGENTS.md`, then `docs/CURRENT_STATE.md`.
3. Find the active unit — branch `feature/<id>-*` first; else the single row of
   the `Units in progress` table; else none.
4. If a unit exists, read its **header** (the `Status:` line), `Allowed areas`,
   `Do not touch`, and the **first milestone whose `Status:` is not `Done`** —
   that is the open milestone, and there is never more than one.

Announce one line, then stop reading.

## Step 1 — Route

Two fields decide everything: the unit's `Status:` and the open milestone's
`Status:`. Read them literally; do not infer state from what the code looks like.

Before the table, in order:

- `AGENTS.md` or `docs/` missing → `NOT_INSTALLED` → `/install`.
- `AGENTS.md` still contains `<PROJECT>` → `BOOTSTRAP` → `/bootstrap`. POSEIDON
  is installed but never adapted to this repository; every document you would
  open is still a template. Do not start a unit in a repository whose invariants
  are placeholders.

A slash command is convenience. If `/milestone` is not registered, read
`poseidon/commands/milestone.md` and follow it — same for every command named
below.

| Unit `Status:` | Open milestone `Status:` | State | Run |
| --- | --- | --- | --- |
| *no unit* | — | `IDLE` | `/unit-new` |
| `Draft` | any | `DRAFT` | `/unit-ready` |
| `Ready` | any | `READY` | `/milestone` — it first sets the unit to `In progress` |
| `In progress` | `Draft` or `In progress` | `IMPLEMENT` | `/milestone` |
| `In progress` | `Review` | `REVIEW` | `/review` |
| `In progress` | `Verify` | `VERIFY` | `/verify` |
| `In progress` | `Verified` | `CLOSE` | `/close` |
| `In progress` | *none — all `Done`* | `CLOSE_UNIT` | `/close` |
| any | `Blocked` | `BLOCKED` | report and halt |
| `Blocked`, `Rejected`, `Superseded` | any | `BLOCKED` | report and halt |
| `Done` | — | not active | `/unit-new`, or nothing |

The two fields cannot both be ambiguous: exactly one row matches. If none
matches, the file is malformed — report `state=CONFLICT`, quote the two `Status:`
lines, and halt. Never guess a state.

`/verify` writes `Verified`, not `Done`. `/close` writes `Done`. That is what
makes the close survive a session ending between the two.

## Reading budget

A document is opened because a step above named it, never "for context".

- `docs/RULES.md` — **one section**, for the boundary this milestone touches.
- `docs/VALIDATION.md` — **one row**, for the area you touched.
- `docs/WORKFLOW.md` — roles, states, unit definition, size limits. Procedure is
  in the commands; do not look for it here.
- `docs/ARCHITECTURE.md` — the `Boundaries` table when opening a unit; the rest
  only when the milestone changes what it describes.
- `docs/PRODUCT.md`, `docs/SETUP.md`, `docs/decisions/` — only when the open
  milestone changes what they describe, or when a prerequisite is missing.

Precedence when sources disagree, and the contradiction protocol: `AGENTS.md`.

## Stop conditions

Halt and report — do not improvise around any of these:

- **Three strikes.** Three failed attempts at the same fix: revert, record,
  halt. Protocol in `poseidon/references/recovery.md`.
- **Out of scope.** A real defect outside `Allowed areas` goes to
  `docs/KNOWN_ISSUES.md` with its evidence — and is **not fixed**.
- **Reserved decision.** No option satisfies the invariants; or the act is
  irreversible or leaves the repo; or it is a product call no evidence settles.
- **Merge.** Final review and merge belong exclusively to `<Owner>`.

Everything else you **decide alone**: safest option first, fastest among equally
safe ones, then record the assumption in the report.

## Ending any response

Run `/handoff`, or produce what it specifies: the report, `Next`, and a resume
prompt. A report without all three is not finished.

## References

`poseidon/references/review.md` — the adversarial review order and what `<base>` means.
`poseidon/references/delegation.md` — when a sub-agent is allowed, and its contract.
`poseidon/references/recovery.md` — three strikes, and the four validation outcomes.
`poseidon/references/install.md` — installing POSEIDON.
`poseidon/references/checks-by-hand.md` — the checks when `python3` is absent.
