# Installing POSEIDON

No script, no build step, no package manager. Extract, then ask.

## 1. Extract at the repo root

```
tar xzf poseidon.tar.gz -C /path/to/repo
```

That places two things:

```
poseidon/                              the method — replaceable as one block
.claude/skills/poseidon/SKILL.md       the trigger
.claude/commands/poseidon.md           /poseidon
```

Extraction merges into an existing `.claude/`; it touches only these two names.
On Windows, any archive tool does the same job — nothing here needs a shell.

## 2. Say "lance poseidon"

The router sees `AGENTS.md` and `docs/` missing, reports `NOT_INSTALLED`, and
runs `/install`. **The agent installs POSEIDON with its own file tools**, which
is strictly better than a script could: it merges an existing `AGENTS.md` with
judgement instead of refusing or clobbering, and it works the same on every OS.

`/install` writes the project's own layer:

```
AGENTS.md            docs/*.md          docs/features/
CLAUDE.md            docs/decisions/    docs/validation-baselines.json
.claude/commands/*   stubs, only where no name collides
```

Anything that already exists is kept and merged, never overwritten.

## 3. `/bootstrap`

Audits the codebase for what it can prove, asks in one batch for what it cannot,
writes `ARCHITECTURE.md` → `RULES.md` → `VALIDATION.md` → `SETUP.md` →
`PRODUCT.md` → `AGENTS.md` → `CURRENT_STATE.md`, in that order, because each
feeds the next. One rule: **derive, or ask — never invent.**

## 4. The checks

`python3` is the one optional dependency, and the one worth having:

```
python3 poseidon/checks/check.py --self-test   # the checks still check something
python3 poseidon/checks/check.py --all         # the repo conforms
```

Put `--all` in CI, blocking. Without `python3` POSEIDON still runs — see
`checks-by-hand.md` — but there is no CI gate and no determinism, and every
report has to say so.

## Upgrading

Replace `poseidon/`. Say "lance poseidon" and ask it to refresh the command
stubs. `docs/` and `AGENTS.md` are never touched — that is the whole point of
the two-layer split. `poseidon/VERSION` says what you are on.
