---
description: Fill the kit's placeholders for this repository — by auditing the codebase for what it can prove, and asking for what it cannot.
argument-hint: [--audit-only] to report findings without writing
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Turn a freshly installed kit into this repository's kit. Run once. Until it has
run, every other command is reading `<placeholders>` as if they were rules.

**The one rule of this command: derive, or ask. Never invent.**
A codebase proves what it does. It cannot prove who it is for, which trade-off
wins, or why a version is pinned. Writing a plausible answer where you should
have asked is the most expensive thing you can do here — it will be read as
established fact by every session that follows, and nothing will ever re-check
it.

## 0. Merge what the installer refused to overwrite

`/install` never clobbers; it reports what it left in place. If any of those are
still unmerged, handle them **first** — until `AGENTS.md` carries POSEIDON's
content, the router never sees `<PROJECT>` and POSEIDON is inert.

For each: read both versions and merge **into** POSEIDON's structure. The repo's
existing rules are real knowledge; POSEIDON's structure is what makes them
findable. Keep every existing rule, place it under POSEIDON's headings, delete
nothing without saying so.

Show the user what you kept, moved, and dropped before writing.

## 1. Detect the mode

```
git log --oneline | wc -l
ls
```

- **Greenfield** — no source files, or only scaffolding. Almost everything is
  asked. Say so, and go to step 3.
- **Existing** — real code and real history. Most of `ARCHITECTURE.md` and
  `SETUP.md` is derivable. Do step 2 first.

Announce which mode, and on what evidence.

## 2. Audit — existing codebases only

Read, in this order, and note the file each finding came from:

1. **Manifests and lockfiles** — `package.json`, `pyproject.toml`, `go.mod`,
   `Cargo.toml`, `pom.xml`, `Gemfile`, `composer.json`. Gives: runtime,
   versions, scripts, test runner, entry points.
2. **Task runner and CI** — `Makefile`, `justfile`, `Taskfile`, `.github/workflows/`,
   `.gitlab-ci.yml`. **This is where the real commands live.** `SETUP.md` and
   `VALIDATION.md` are copied from here, not composed.
3. **Top-level structure** — directory names and their sizes. Where is the bulk
   of the code?
4. **Boundaries** — the whole point. Look for: schema or migration directories;
   anything reading a token, a session, or a header; anything serving HTTP or
   RPC; anything rendering or running on a client; anything publishing an
   artifact. A boundary is a place where **trust changes**, not a folder.
5. **Tests** — where they live, how they are run, how many are discovered.
6. **Configuration** — committed example env files, config schemas. Never open
   a real secret file; if you find one committed, stop and report it as a
   `Critical` entry in `KNOWN_ISSUES.md`.

Then report the audit before writing anything: the boundaries found, the real
commands found, and — most importantly — **what you could not determine**. That
last list becomes half your questions.

## 3. Ask — one batch, then wait

Everything that follows is unanswerable from code. Ask all of it in **a single
message**, numbered, with your best guess offered where you have one so the
answer can be "yes" — never as a default you proceed on.

Always ask:

1. One sentence: what is this, for whom, on which platform?
2. The four priorities, in order — the tiebreaker for every later arbitration.
3. What is this deliberately **not**? (Each answer prevents a class of feature
   request.)
4. Non-technical constraints: regulation, contract, deadline, platform policy.
5. Which user's failure costs data, money, or trust? (This sets review depth.)
6. Who is `<Owner>` — who reviews and merges?
7. The version scheme, and its single source.

Ask, in existing repos, only what the audit left open:

8. Confirm or correct the boundary list. (Show yours; ask what is missing or
   wrong. This is the highest-value question in the batch — it becomes the
   section list of `RULES.md` and the row list of `VALIDATION.md`.)
9. Which incidents have actually happened? Each one becomes a line in
   `RULES.md`. Do **not** invent preventive rules; they are never applied, and
   they spend the cap that keeps the file readable.
10. Which capabilities are genuinely **shipped and merged**, with what evidence?
11. Anything in the code that looks wrong but is deliberate.

If an answer does not come, write `<unanswered — asked YYYY-MM-DD>` in that
exact form and continue. Do not substitute a guess. `--strict-placeholders` will
keep surfacing it, which is the correct outcome.

## 4. Write, in this order

The order matters: each file feeds the next.

1. **`docs/ARCHITECTURE.md`** — the `Boundaries` table first. Every row names
   the file it was read from.
2. **`docs/RULES.md`** — one `##` section per boundary, named **identically**.
   A check enforces the correspondence. Fill lines only from real incidents
   (question 9); leave a boundary's table empty rather than inventing rows.
3. **`docs/VALIDATION.md`** — one row per boundary, commands copied from the
   task runner and CI. Where no command exists, write `manual` — that is a
   visible debt, not a gap to paper over.
4. **`docs/SETUP.md`** — from the manifests and CI, with sources named.
5. **`docs/PRODUCT.md`** — from the answers only.
6. **`AGENTS.md`** — replace every placeholder. Invariants are written as
   **refusals**, each verifiable by a check or by reading a diff. Derive them
   from the boundaries and the incidents, not from good intentions.
7. **`docs/CURRENT_STATE.md`** — the **proven** present. A capability enters
   only if merged and evidenced (question 10). On an existing repo this step
   almost always reveals capabilities believed shipped that are not. Say so
   plainly; it is the most useful output of this whole command.

Propose — do not create — `<zone>/AGENTS.md` for the 3–6 most-worked zones, and
name the evidence for each (commit frequency, size, boundary crossed). Wait for
confirmation: a zone that does not qualify is 50 lines every session pays for.

## 5. Existing repositories — seed the ratchets

Run once, before wiring CI:

```
python3 poseidon/checks/check.py --adopt          # freeze existing TODO/FIXME debt
python3 poseidon/checks/check.py --record-baseline <suite>=<n> --raised-by <ID>
```

No `python3`? Say so, record `checks: agent mode` under Steering in
`CURRENT_STATE.md`, and follow `poseidon/references/checks-by-hand.md`. Without
`--adopt` you cannot tell new marker debt from old — state that limitation
rather than reporting a clean scan.

`--adopt` records how much marker debt each file already carries, so the checks
block **new** debt without demanding the old debt be cleared first. Report the
totals to the user — that number is a real measurement of the repo, and it is
often the first time anyone has seen it. Re-run `--adopt` after a cleanup unit;
it only ever tightens.

For each test suite, record the count it **actually discovers today**. A baseline
recorded from a suite that was already broken locks in the breakage — run each
suite and read the real number first.

## 6. Verify

```
python3 poseidon/checks/check.py --all --strict-placeholders
```

Must exit `0`, except for entries you deliberately left as
`<unanswered — asked …>`. List those explicitly in the report; each one is a
real question waiting on `<Owner>`, not a formatting artifact.

Then `Next: /unit-new` — the repository is ready for its first unit.
