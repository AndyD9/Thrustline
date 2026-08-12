---
description: Run the method's automated checks and explain any failure in terms of the rule it protects.
argument-hint: [--all | --caps | --tracking | --registries | --strict-placeholders]
allowed-tools: Bash(python:*), Bash(python3:*), Read, Edit, Glob, Grep
---

Run `python3 poseidon/checks/check.py $ARGUMENTS` (default `--all`).

If `python3` is unavailable, do **not** silently skip: switch to agent mode,
follow `poseidon/references/checks-by-hand.md`, and label the result
`checks: agent mode — not deterministic, no CI gate`.

For each failure, report three things: the check that fired, the exact file and
line, and **the rule it protects**. A failure is never a warning to acknowledge —
it blocks integration.

## Fixing — the only legitimate direction

| Failure | The fix |
| --- | --- |
| Line cap exceeded | Remove or condense content. **Never raise the cap.** A new global rule replaces or condenses an existing one. |
| Index out of date | `check.py --fix-index`. Never hand-edit the generated index. |
| Unit ID in a heading | Move the identifier into the `Proven by` / `Promoted from` column and delete the narrative. |
| Status invalid, duplicated, or missing | One `Status` field per unit and per milestone, from the closed list. |
| Milestone sequence broken | Milestones are numbered `J1`, `J2`, … with no gaps. |
| Phantom dependency | The cited unit does not exist — fix the reference, do not delete the dependency. |
| Milestone closed out of order | A later milestone is `Done` while an earlier one is not. Milestones close in sequence; reopen the later one. |
| Unit `Done` with a milestone open | The unit closes only when every milestone has. |
| Unit active with every milestone `Done` | Run `/close`; the unit is finished and nobody said so. |
| `CURRENT_STATE.md` drifted | The `Units in progress` table disagrees with the unit files. The **unit file wins** — fix the table. |
| Boundary with no `RULES.md` section | `ARCHITECTURE.md` declares a boundary that `RULES.md` does not cover. Add the section (empty is fine), or drop the boundary — it was never one. |
| Registry entry malformed | Closed lists for severity and status; evidence is mandatory on anything `Resolved`. |
| Orphan `TODO`/`FIXME`/`HACK`/`XXX` | Open a `KNOWN_ISSUES.md` entry, or delete the marker. |
| Baselines file malformed or missing | Counters live in data, not prose. Fix the shape; `--record-baseline NAME=N --raised-by FNNNN` writes it. Never lower a baseline — a baseline rises only in the unit that adds the tests. |

If a check itself is wrong, that is a unit of work — with a negative mutation
proving the fix. Never disable a check to get green.

Also run `python3 poseidon/checks/check.py --self-test` after touching the checks
themselves. It mutates a fixture tree and asserts each mutation is caught. A
check with no negative mutation may have stopped checking anything while staying
green.
