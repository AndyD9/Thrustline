---
description: Create a new unit of work — one user capability, one file, one branch, one Pull Request.
argument-hint: <one sentence describing the user-visible outcome>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git status:*), Bash(git branch:*), Bash(ls:*)
---

Create one unit of work for: **$ARGUMENTS**

Refuse and stop if there are already **two** units `In progress`. Say which ones.

## 1. Check it is one unit

A unit is one user capability, stated without an "and". If the goal needs an
"and" between two distinct capabilities, that is two units — say so and ask which
one to open. Governance, a fix, tooling, or a check use the **same file with a
single milestone**; there is no second format.

## 2. Allocate

- Next free ID by scanning `docs/features/` — `F0001`, `F0002`, …
- Slug from the goal. Branch name `feature/<id>-<slug>`. Do **not** create the
  branch yet; `/milestone` does that.

## 3. Write `docs/features/<ID>.md`

Copy `poseidon/templates/FEATURE.md`. Read `poseidon/templates/EXAMPLE-FEATURE.md` once
for the shape of a well-formed unit — copy its shape, never its content.

If this unit changes the architecture or a trust boundary, it needs a written
decision **first**: `poseidon/templates/ADR.md` → `docs/decisions/ADR-NNNN-<slug>.md`,
and list it under `Dependencies`. A unit that assumes an unwritten decision
cannot reach `Ready`.

Fill, in this order:

1. `Goal` — one observable user outcome.
2. `Context` — what is **actually present** on the main branch. Verify by
   reading the code, not `CURRENT_STATE.md`.
3. `Dependencies` — name any missing `<Owner>` decision, hardware, or human
   verification explicitly. That is what keeps a unit out of `Ready`.
4. `Allowed areas` / `Do not touch` — the union across all milestones. Derive
   these from the code you just read; a guess here is the most expensive error
   in the file.
5. `Milestones` — 2 to 5, ordered most-constraining first: data and authority
   before boundary, boundary before client composition. One milestone = one
   commit = one primary boundary = one review. Each carries its observable
   result, boundary, validations, review focus, and a 5–10 minute manual check.
6. `Acceptance criteria` — observable over the whole capability.

Leave `Status: Draft`. Leave the Completion Report empty.

## 4. Register

Add one row to the `Units in progress` table of `docs/CURRENT_STATE.md`.
Do **not** hand-edit any generated index.

## 5. Report

State the ID, the goal in one line, the milestone count, and the single riskiest
assumption you made. Then `Next: /unit-ready <ID>`.
