# Current state

**The proven present, never the intent.** A capability enters here only once
merged into the main branch, with the evidence that establishes it. The future
belongs to the roadmap, defects to `KNOWN_ISSUES.md`.

Cap: **200 lines**, enforced by a check. This is the file every agent reads on
every task: each line here is paid for at every session.

Update at the close of any unit that changes the proven reality. An entry that is
no longer true is **replaced**, not appended. As the file approaches its cap,
older material moves to `docs/archive/`.

---

## Current milestone: <name>

<Three to six lines: what is targeted, the observable definition of "reached",
and who decides that it is.>

## Capabilities shipped in `<main branch>`

One line per genuinely usable capability, with its evidence. No commits, no
branches, no unmerged Pull Requests.

| Capability | Evidence | Since |
| --- | --- | --- |
| <what a user can do> | <command, test, or verification that establishes it> | <date> |

## Units in progress

At most two. One line each, with the open milestone and what blocks it.

| Unit | Open milestone | Branch | Blocked by |
| --- | --- | --- | --- |
| <F0001> | <J2 — authenticated boundary> | <feature/f0001-slug> | <nothing / decision / environment> |

## Missing for the current milestone

Short, ordered list. Each line is either an existing unit, or a gap that must
become one.

## Outside the milestone, tracked elsewhere

<What is known, real, and deliberately deferred. Point at `KNOWN_ISSUES.md` or
the roadmap rather than describing it here.>

## Steering

Steering decisions, **dated**, with their author. They live here — not in
`AGENTS.md`, which carries only timeless invariants. A stale decision is removed,
not stacked.

- **<Decision> — <author>, <date>.** <What it concretely changes.>

## Reproduce and verify

<The two or three commands that let anyone confirm the state described here is
real. Detail in `docs/VALIDATION.md`.>
