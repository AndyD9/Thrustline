---
description: Adversarially challenge a Draft unit and promote it to Ready — before any code is written.
argument-hint: <unit id, e.g. F0001>
allowed-tools: Read, Edit, Glob, Grep, Bash(git log:*), Bash(ls:*)
---

Challenge unit **$ARGUMENTS** before any code exists. Act as the reviewer, not
as the author: your job is to find the reason this unit is not ready.

Read the unit file in full. Read `docs/WORKFLOW.md` §2. Read nothing else yet.

## Send back to Draft if any of these holds

- The `Goal` contains an "and" joining two distinct capabilities.
- A dependency is listed but **not actually satisfied** — verify each one in the
  code or in `CURRENT_STATE.md`; do not take the file's word for it.
- A milestone has no observable result, or its result is a code change rather
  than a behaviour ("refactor X" is not a result).
- **A milestone cannot be committed on its own.** Then it is not a milestone; it
  belongs to the previous one. This is the most common defect — check every one.
- A milestone touches more than one primary boundary.
- A milestone has no exact validation command, or no 5–10 minute manual check.
- `Allowed areas` does not cover the paths the milestones obviously need, or
  overlaps `Do not touch`.
- More than 5 milestones, or two goals → split into two units.
- `Security-sensitive: Yes` anywhere, and the `Review` section is empty.

For each finding: quote the offending line, state the observable consequence,
and give the correction. Do not rewrite the unit silently.

## If nothing holds

Set `Status: Ready`. Confirm in one line what a reader would be able to do once
this unit is `Done`, and name the milestone that carries the most risk.

Then `Next: /milestone <ID>`.
