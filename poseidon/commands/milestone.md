---
description: Open or resume the current milestone — implement it, validate it, commit it, push it.
argument-hint: [unit id] — defaults to the active unit
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Work the **open milestone** — the first one whose `Status` is not `Done` — of
unit $ARGUMENTS (default: the active unit). One milestone per invocation. Never
open the next one here.

## 1. Load, and only this

- the unit header, the open milestone block, `Allowed areas`, `Do not touch`;
- `<zone>/AGENTS.md` for each zone the milestone touches;
- the **one section** of `docs/RULES.md` for this milestone's primary boundary;
- the **one row** of `docs/VALIDATION.md` for the area you are about to touch.

Announce the boundary and the paths you are allowed to write. That list is
binding for the rest of this command.

## 2. Branch and state

Report the current branch **immediately before touching anything** — a shared
worktree may have moved. Preserve existing uncommitted work; never discard it.
Create the unit branch, or join it if it already exists. Never recreate an
active branch.

If the unit `Status:` is `Ready`, set it to `In progress` now, and add its row to
the `Units in progress` table of `docs/CURRENT_STATE.md`. The router keys off
that field; leaving it at `Ready` makes the next session re-enter this command.
Set the open milestone `Status:` to `In progress`.

## 3. Implement

Read the real code before writing any. Implement this milestone only.

A real defect found outside `Allowed areas` goes into `docs/KNOWN_ISSUES.md`
with its evidence and severity, and is **not fixed**. This is the rule that
protects the scope; breaking it is how a two-day unit becomes a two-week one.

On repeated failure, apply `poseidon/references/recovery.md` — three strikes, then revert
and halt.

## 4. Validate

Targeted tests for the zone first, then the boundary checks, in the order
`VALIDATION.md` gives. Record each command with its **real output**. Use
`passed` / `failed` / `not run` / `blocked by environment` — never a substitute.
A suite exiting `0` with no tests discovered is `failed`, not `passed`.

## 5. Commit and push

- Stage by **explicit path list**. Never `git add .`, never `git add -A`.
- Read `git diff --cached` before committing. Files modified outside the unit are
  listed separately in the report and left unstaged.
- Commit, push, open or update the Pull Request as **draft** while validations or
  dependencies are pending.
- Never force-push. Never bypass a protection. Never invent a branch, a base, or
  a CI result. **Never merge.**

## 6. Record

Fill this milestone's Completion Report block: result obtained, files changed,
commands and real results, and — required — `commit:` with the **pushed SHA**.
`/review` computes the diff under review from the previous milestone's `commit:`;
without it the reviewer has to guess what to look at.

Leave `manual verification:` and `review findings addressed:` empty — `/verify`
and `/review` fill them.

Set the milestone `Status: Review`. Do not touch the unit `Status:`; it stays
`In progress` until `/close`.

Then `Next: /review <ID> <Jn>`.
