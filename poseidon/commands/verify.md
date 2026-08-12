---
description: Run the milestone's manual verification and replay its validations after the last change.
argument-hint: <unit id> <milestone, e.g. J2>
allowed-tools: Read, Edit, Bash, Glob, Grep
---

Verify milestone $ARGUMENTS.

## 1. Replay

Re-run the milestone's validations **after the last modification**, in the order
`docs/VALIDATION.md` gives for the touched area. A result obtained before the
last change is not evidence. A result obtained inside a sub-task is not evidence.

Record each as `passed` / `failed` / `not run` / `blocked by environment`, with
the exact command and its real output.

Compare each suite's **discovered count** against `docs/validation-baselines.json`
before concluding. Below baseline is `failed`, whatever the exit code — something
stopped running. If this milestone adds tests, raise the baseline here and only
here: `python3 poseidon/checks/check.py --record-baseline <suite>=<n> --raised-by <ID>`.
The tool refuses a value below the existing one.

## 2. Manual verification

Run the milestone's 5–10 minute manual check as written. Report what you
actually observed, not what the check expects to happen.

- It fails → set the **milestone** `Status: In progress` and name the exact
  failing step. The unit `Status:` stays `In progress` throughout.
- It cannot be run here → the milestone **stays at `Verify`**. Name the check, why it
  is unavailable, who must run it and on which environment, what was done
  instead, and what that substitute **does not prove**.

A local proof never replaces a real device, a remote scheduler, or a real user.

## 3. Depth

`Maximum evidence` for anything touching money, data, server authority, or
security: full checks, negative mutations, real runtime, dedicated manual check.
`Fast` for client composition: types, tests, build — and the manual check is the
real journey through the application, not a separate checklist.

The **boundary touched** decides the depth, never the size of the diff.

## 4. Hand to close

Write what you observed into the milestone's `manual verification:` line.

On success set the milestone `Status: Verified` — **not `Done`**. `Done` is
written by `/close`, after the report, the registries, and the state file are
updated. That gap is deliberate: if the session ends here, the router still
routes the next one to `/close` instead of skipping it forever.

Then `Next: /close <ID> <Jn>`.
