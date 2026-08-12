# Known issues and follow-ups

Register of **real discoveries outside the scope** of a unit of work. Planned
work belongs to the roadmap; accepted invariants to `RULES.md`; tooling traps to
`LEARNINGS.md`.

A discovery enters at the moment it is made, with its evidence, and is **not
fixed in passing**. That is the rule protecting a unit's scope: without the
register, every discovery becomes either scope drift or an omission.

## Format

- **Severity**: `Critical`, `High`, `Medium`, `Low`. Closed list.
- **Status**: `Open`, `Accepted`, `Scheduled`, `Resolved`, `Invalid`. Closed list.
- **Evidence**: what establishes the defect — command, output, file and line.
  Mandatory to reach `Resolved`. A resolved entry with no evidence is a false
  success, not a success.
- **Target**: the unit that will handle it, or the roadmap phase.

A `Critical` or `High` found when opening a unit may block it. The coordinator
says so explicitly rather than ignoring it.

## What does not belong here

- A future capability — that is roadmap.
- An accepted, bounded risk — that is an exception in `RULES.md`, with a deadline.
- Evidence missing for lack of an environment — that is a report limit, not a
  defect.
- An intuition with no reproducible evidence.

A candidate is not a known issue by default. It joins this register only if it
describes a **real** defect, out of scope, worth tracking.

## Remediation

Fixing an entry goes through a separate unit, whose acceptance includes a
relevant negative test and an explicit residual risk. Closing an entry without a
negative test is preparing to reopen it.

## Entries

| ID | Severity | Area | Summary | Evidence | Target | Status |
| --- | --- | --- | --- | --- | --- | --- |
| KI-001 | <Medium> | <area> | <one line> | <command -> output> | <unit> | Open |
