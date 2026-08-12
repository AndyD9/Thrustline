---
description: End the session — produce the report, the next action, and a resume prompt for a fresh session.
allowed-tools: Read, Bash(git status:*), Bash(git log:*), Bash(git branch:*), Glob
---

Close out this session. Do not start new work.

## Report

- **Status** — the state, per the router.
- **Files changed** — from `git status`, not from memory.
- **Commands and real results** — `passed` / `failed` / `not run` /
  `blocked by environment`. Never report a check you did not run.
- **Checks mode** — `script` or `agent mode — not deterministic, no CI gate`.
- **Risks and limits** — including anything a substitute validation does not
  prove.
- **Branch, commit, Pull Request** — real values, read from Git. Never invented.

## Next

One line: the next concrete action, who owns it, and what unblocks it.

## Resume prompt

Emit this verbatim, filled. Pointers and state only — never document contents:

```
Resume <PROJECT>. Read AGENTS.md, docs/CURRENT_STATE.md, then
<unit file> (header + milestone <N> + Allowed areas / Do not touch).
Branch <name>, worktree <path>, last commit <sha>, PR <url or none>.
Done: <one line>. Remaining: <the next concrete action>.
Validations passed: <command -> result>. To replay: <commands>.
Traps: <what cost time, or what can break again>.
Decide alone per AGENTS.md; do not merge.
```

A report without both `Next` and a resume prompt is not finished.
