---
description: Install POSEIDON into this repository — done by you, with your own tools. No shell script, no build step.
argument-hint: [--force] to overwrite files that already exist
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Install POSEIDON here. **You do this yourself, with Read/Write/Glob/Grep.** There
is no installer to run: a shell script cannot merge an existing `AGENTS.md` with
judgement, and it fails outright on Windows without a POSIX shell. You can do
both.

Run this only when `AGENTS.md` or `docs/` is missing. If they exist and still
contain `<PROJECT>`, the install is done — run `/bootstrap` instead.

## 1. Report the ground you are standing on

```
poseidon/VERSION
```

State the version, the OS, and whether `python3 --version` succeeds. That last
one decides the checks mode for every session after this — see step 5.

## 2. Copy the project's own files

Never overwrite. For each, if the destination exists, **leave it** and note it
for step 4.

| From | To |
| --- | --- |
| `poseidon/skeletons/AGENTS.md` | `AGENTS.md` |
| `poseidon/skeletons/docs/*.md` | `docs/` |

Create empty: `docs/features/`, `docs/decisions/`.
Create `docs/validation-baselines.json` containing `{}`.

## 3. Wire the trigger

`.claude/skills/poseidon/SKILL.md` and `.claude/commands/poseidon.md` shipped in
the archive — confirm both exist; that is what makes "lance poseidon" fire.

Then, for ergonomics only, create a stub in `.claude/commands/` for each file in
`poseidon/commands/`:

```
---
description: POSEIDON /<name> — see poseidon/commands/<name>.md
---

Read `poseidon/commands/<name>.md` and follow it exactly, with $ARGUMENTS as its
arguments. If the file is missing, say so and stop.
```

**Check for a name collision first.** If `.claude/commands/review.md` already
exists and is not a POSEIDON stub, do not touch it — name yours
`poseidon-review.md` and say so. These stubs are convenience, not mechanism: the
router works by reading `poseidon/commands/<name>.md` directly.

`CLAUDE.md`: if absent, write `@AGENTS.md` and the trigger line. If present and
it does not mention `poseidon/POSEIDON.md`, append both — never rewrite it.

## 4. Merge, do not clobber

For every file you left in place at step 2, read both versions and merge **into**
POSEIDON's structure: keep every existing rule, place it under POSEIDON's
headings, delete nothing without saying so. Show the user what you kept, moved,
and dropped before writing.

`AGENTS.md` matters most. Until it carries POSEIDON's content the router never
sees `<PROJECT>`, never routes to `/bootstrap`, and POSEIDON does nothing at all
— silently. Do not finish this command with that unresolved.

## 5. Freeze what the repo already carries

If the repo has history (`git log -1` succeeds), it has `TODO`/`FIXME` debt.
Failing all of it on day one turns CI red and someone switches the checks off,
which costs more than the debt did.

- **python3 available** → `python3 poseidon/checks/check.py --adopt`, then
  `--fix-index`, then `--all`. Report the totals.
- **python3 absent** → say so plainly, and record in `docs/CURRENT_STATE.md`
  under Steering: `checks: agent mode — not deterministic, no CI gate`. Then
  follow `poseidon/references/checks-by-hand.md`. Do not pretend the gap is not
  there; a check nobody can run in CI is not a check.

## 6. Report

Version, files written, files left for merge, checks mode, and what is still
`<placeholder>`. Then `Next: /bootstrap`.
