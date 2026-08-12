---
description: Close a milestone — or the whole unit — and hand off to the Owner.
argument-hint: <unit id> [milestone]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Close $ARGUMENTS.

The code for this milestone is already committed and pushed by `/milestone`.
`/close` commits **documentation only**. If you find yourself changing code here,
you are in the wrong command.

## 1. Completion Report

Complete the block for this milestone — `/milestone` and `/review` and `/verify`
each filled part of it. Confirm every line is present: result obtained, files
changed, commands and **real** results, `commit:`, manual verification, review
findings addressed.

This block is the project's evidence. Rules documents **cite** it; they never
restate it. If you are about to paste a narrative into `RULES.md`, stop — write
a citation in the `Proven by` column instead.

## 2. State

- `docs/CURRENT_STATE.md` — only if the **proven** reality changed. A capability
  enters only when merged into the main branch, with its evidence. An entry that
  is no longer true is **replaced**, not appended. Never list a commit, a branch,
  or an unmerged Pull Request as a delivered capability.
- `docs/KNOWN_ISSUES.md` — deferred findings and debt created, each with
  evidence, severity, and a target unit.
- `docs/LEARNINGS.md` — capture a first occurrence immediately. Promote only on
  two independent occurrences or one deterministic reproduction. Route to the
  **narrowest** destination that works; writing higher than necessary is the
  most common way documentation becomes unreadable. Where a deterministic check
  is possible, open a bounded unit for it instead of keeping a manual
  instruction — a manual instruction is a debt, not an asset.

## 3. Checks

```
python3 poseidon/checks/check.py --all
```

Must exit `0`. If it does not, fix the cause; never widen a cap to pass.

No `python3`? Agent mode — `poseidon/references/checks-by-hand.md` — and the
report says so. Never write `checks passed` for checks you could not run.

## 4. Set the states — in this order

1. Milestone `Status: Verified` → `Done`.
2. Commit the documentation changes (explicit path list, re-read
   `git diff --cached`), push, and update the Pull Request.
3. **Milestones remain** → the next one is now the open milestone; update the
   `Units in progress` row. `Next: /milestone`.
4. **That was the last milestone** → fill the unit `Summary`, set the **unit**
   `Status: Done`, remove its row from `Units in progress`, add the capability
   to `Capabilities shipped` only once `<Owner>` has merged — not before — and
   hand the Pull Request over.

A unit left at `In progress` with every milestone `Done` fails the tracking
check. So does a unit set to `Done` with a milestone still open. Both are caught
by `check.py`; run it again after this step.

**`<Owner>` alone reviews and merges. Never merge.**

## 5. Hand off

End with `Next` and a resume prompt — run `/handoff`.
