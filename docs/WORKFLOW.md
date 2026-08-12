# Workflow

The **procedure** for each phase lives in the slash commands. This file defines
what the phases operate on: roles, states, the unit, and the size limits. Read
the section the router names, not the file.

Cap: **165 lines**.

## Roles

- **`<Owner>`** — settles vision, scope, trade-offs, and merges. The only role
  never held by an agent.
- **Coordinator** — carries one unit end to end: plan, code, evidence.
- **Reviewer** — hunts regressions, flaws, drift, and missing tests.

One agent may hold the last two roles, never on the same milestone.

## States

Two independent fields, two closed lists. A check enforces both.

- **Unit** `Status:` — `Draft` → `Ready` → `In progress` → `Done`.
  Alternates: `Blocked`, `Rejected`, `Superseded`. (`Review` and `Verify` are
  legal but describe a whole unit awaiting `<Owner>`, not a milestone.)
- **Milestone** `Status:` — `Draft` → `In progress` → `Review` → `Verify` →
  `Verified` → `Done`. Alternate: `Blocked`.

`Verified` and `Done` are distinct on purpose: `/verify` writes the first,
`/close` writes the second, and the gap is what makes a close survive a session
ending between them.

Which command a given pair routes to is defined **only** in POSEIDON's router
table, `poseidon/POSEIDON.md`. It is not repeated here.

## The unit of work

The unit of tracking, of branching, and of integration is the **user
capability**: one file in `docs/features/`, one branch, one Pull Request.

A capability is a complete vertical slice. Data schema, authoritative service,
authenticated boundary, validation on a real runtime, and client composition
live together in it, split into ordered **milestones**: one commit per milestone,
one review per milestone, one manual verification per milestone.

Work that is not a user capability — governance, a fix, tooling, a check — uses
**the same file with a single milestone**. There is no second format to maintain.

Why the vertical slice: splitting a capability into four to six technical units
produces as many branches, bases, and index lines to keep consistent — for user
value that only exists at the last one. The cost is paid in reconciliation units
that ship nothing.

## 1. Prepare

1. Define the user outcome.
2. Write or confirm the structuring decisions.
3. Identify dependencies and risks.
4. Split into capabilities, each a complete vertical slice.
5. Order milestones from most-constraining to most-dependent: data and authority
   before boundary, boundary before client composition.
6. Detail only the **next one to three** capabilities; keep the rest at roadmap
   level, so the plan does not go stale.

Before launching a wave: map the shared paths, ask for every `<Owner>` decision
in **one batch**, assign disjoint paths and the integration order, reserve the
verification environments, and confirm no approved Pull Request is waiting only
on propagation.

Daily priority order: a Pull Request ready to integrate, a blocking CI, a
critical-path dependency, then a new unit. Code volume does not measure progress;
only a proven capability present on the main branch reduces what is left.

## 2. Ready

A `Ready` capability has: one user goal; dependencies genuinely satisfied; the
union of `Allowed areas` and `Do not touch`; ordered milestones, each with its
observable result, primary boundary, and validations; acceptance criteria
observable over the whole capability; and one 5–10 minute manual verification per
milestone.

The reviewer challenges the unit **before any code**. Double goal, unobservable
milestone, wrong boundary, or missing evidence sends it back to `Draft`. A
milestone that cannot be committed alone is not a milestone: it belongs to the
previous one.

## 3 to 6. Implement, review, verify, close

Procedure in `/milestone`, `/review`, `/verify`, `/close`. Not restated here.

One principle governs all four and is stated only here: **a capability is
reviewed milestone by milestone, on the pushed diff, by an agent that did not
write it, before the next milestone opens.** This is the counterpart of the
vertical slice. Without it a sensitive-data change and a read-only panel go
through the same review, and the first loses the attention it deserves. A single
review at the end of a capability is non-conforming.

## Size limits

A good capability targets a single outcome, statable without an "and", carries
two to five milestones, and can be abandoned without invalidating more than a few
days of work.

A good milestone targets an observable result, changes **one** primary boundary
and not three, produces a diff reviewable in one pass, is manually verifiable in
5–10 minutes, and **is committable alone** even if the capability is incomplete.

The milestone carries the size limit, not the capability. A milestone combining a
data change, a new protocol, and a large screen must be split. A capability
needing more than five milestones, or two goals, must be split.

## Side loops

Learning: `docs/LEARNINGS.md`. Debt and out-of-scope discoveries:
`docs/KNOWN_ISSUES.md`. Accepted invariants: `docs/RULES.md`. None of these is
restated here — that is the single-source rule.
