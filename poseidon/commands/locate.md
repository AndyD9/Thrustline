---
description: Determine the current state of the repository and route to the one action that applies.
allowed-tools: Bash(git status:*), Bash(git branch:*), Read, Glob, Grep
---

Run Step 0 of `poseidon/POSEIDON.md`. Read nothing beyond what it names.

1. `git status --porcelain=v1 -b`
2. Read `AGENTS.md`, then `docs/CURRENT_STATE.md`.
3. Identify the active unit:
   - branch matches `feature/<id>-*` → that unit;
   - else the `Units in progress` table holds exactly one row → that unit;
   - else the table holds two rows → report `state=AMBIGUOUS`, list both, and
     ask which one. Do not pick.
   - else → no unit.
4. If a unit exists, read its header `Status:`, `Allowed areas`, `Do not touch`,
   and the first milestone whose `Status:` is not `Done`.

Output exactly this, and nothing more:

```
state=<STATE> unit=<ID|none> milestone=<Jn|none> unit-status=<S> milestone-status=<S> branch=<name> dirty=<yes|no>
→ next: /<command>
```

Then stop. Do not start the routed command's work in the same turn unless asked.

If the branch, `CURRENT_STATE.md`, and the unit file disagree, or if no router
row matches the two `Status:` values, report `state=CONFLICT`, quote the three
sources, and stop.
