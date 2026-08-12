# Validation

This file answers one question: **I touched this — what do I run?**

No narrative, no evidence, no description of what a check covers. Those live in
the Completion Report of the unit that wrote it.

Cap: **130 lines**. Read the **one row** for the area you touched.

## What to run

Order: targeted tests for the zone first, then the boundary checks.

| You touched | Commands, in order | Prerequisite | Depth |
| --- | --- | --- | --- |
| <schema / migrations> | `<static check>` -> `<start>` -> `<reset>` -> `<tests>` -> `<types>` | <container runtime> | maximum |
| <authoritative service> | `<static check>` -> `<unit tests>` | — | maximum |
| <authenticated boundary> | `<handler tests>` -> `<real-runtime validation>` | <local runtime> | maximum |
| <client / UI> | `<type check>` -> `<tests>` -> `<build>` | — | fast + real journey |
| <side process> | `<build>` -> `<tests>` | — | per boundary |
| <CI config> | `<CI check>` | — | maximum |
| <dependencies> | `<audit>` -> `<licence report>` | network | maximum |
| <method documents> | `python3 poseidon/checks/check.py --all` | — | fast |

## Two speeds

Not every validation is worth the same, and pretending otherwise makes the UI pay
the price of the database.

- **Maximum evidence** for anything touching money, data, server authority, or
  security: full checks, negative mutations, real runtime, a dedicated manual
  verification.
- **Fast** for client composition: types, tests, build — and the manual
  verification is the real journey through the application, not a separate
  checklist.

The **boundary touched** decides, never the size of the diff.

## Four outcomes, never interchangeable

`passed`, `failed`, `not run`, `blocked by environment`.

A tool exiting `0` without discovering any test proves nothing: check the
**number of items discovered** against the baseline before concluding.

## Cross-cutting checks

Run before any Pull Request, whatever the area touched.

```
python3 poseidon/checks/check.py --all
<authority invariant check>
```

## Baselines

Guardrail counters — tests discovered, assertions, performance budgets — are
**not prose**. They live in `docs/validation-baselines.json`, one entry per suite:

```json
{ "handlers": { "discovered": 11, "raised_by": "F0001" } }
```

A run discovering less than its baseline is `failed`, whatever its exit code —
instead of depending on a paragraph someone must remember to re-read. A baseline
rises only in the unit that adds the corresponding tests, and only through
`python3 poseidon/checks/check.py --record-baseline <suite>=<n> --raised-by <ID>`,
which refuses any value below the current one.

## Checks blocked by the environment

When a check requires an absent environment — hardware, operating system, third
party service, a physical person — the report names:

1. the exact check, and why it is unavailable;
2. who must run it, and on which environment;
3. what was done instead, and what that substitute **does not prove**.

A local proof never replaces a remote scheduler, a real device, or a real user.
Absence is stated explicitly, never inferred from silence.
