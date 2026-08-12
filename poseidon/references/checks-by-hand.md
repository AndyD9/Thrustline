# Checks without python3 — agent mode

`poseidon/checks/check.py` is stdlib-only Python. When `python3` is unavailable,
POSEIDON still runs, but the checks degrade — and the degradation must be
**stated, never hidden**. Every report in agent mode carries:

```
checks: agent mode — not deterministic, no CI gate
```

## What you lose, precisely

Say this out loud once, at install, and do not let it be forgotten:

1. **No CI gate.** CI has no agent. Nothing blocks a merge that violates the
   method. The checks become advice.
2. **No negative mutations.** `--self-test` proves the checks still catch what
   they claim to. Reading files proves nothing about your own reliability, and
   you cannot self-test by introspection.
3. **Not reproducible.** Two runs may disagree. A check that sometimes fires is
   worse than no check, because it teaches people to re-run until green.

This is why the script exists. If `python3` can be made available — it ships with
macOS and every Linux, and Claude Code's Bash tool can install it — do that
instead of reading this file. `git` is not optional for this method; `python3` is
the one dependency worth removing, and this is the price.

## What you can verify by reading, and how

Do these at `/close`, in this order. Report each as `passed` / `failed` /
`not run` — never guess.

**Tracking coherence.** Open the unit file. Exactly one `Status:` before
`## Milestones`. Exactly one per `### Jn` block. Milestones numbered `J1`,
`J2`, … with no gap. No milestone `Done` after one that is not. Unit `Done` only
if every milestone is. Every `F####` under `## Dependencies` has a file in
`docs/features/`. **This is the most valuable one, and the one you do best** —
it is reading and comparing, not counting.

**Generated index.** Rebuild `docs/features/README.md` from the unit files and
compare to what is there. Same columns, same order (sorted by filename). If they
differ, rewrite it — never hand-patch a row.

**Identifiers in headings.** Grep for `^#.*\b(F[0-9]{4}|KI-[0-9]+|LC-)` in
`AGENTS.md` and `docs/*.md`. Any hit is a failure: move the identifier into the
`Proven by` / `Promoted from` column and delete the narrative.

**Registers.** In `docs/KNOWN_ISSUES.md`: severities in
`Critical|High|Medium|Low`, statuses in `Open|Accepted|Scheduled|Resolved|Invalid`,
no duplicate id, and **no `Resolved` row with an empty Evidence cell**. In
`docs/LEARNINGS.md`: states in the closed list, a revalidation date on anything
`Codified` or `Enforced`.

**Boundaries.** Every row of the `Boundaries` table in `docs/ARCHITECTURE.md`
has a `## <same name>` section in `docs/RULES.md`.

**Line caps.** `wc -l` if you have a shell; otherwise read the file and count.
Caps are in `poseidon/checks/limits.json`. Treat a result within 5 lines of a cap
as **unverified**, not as passed — say so.

**Markers.** Grep `TODO|FIXME|HACK|XXX` across source files. Compare against
`docs/adoption.json` if it exists. Without it you cannot tell new debt from old,
so report the raw count and say that is what you are reporting.

## The rule that does not degrade

Never report `passed` for something you did not actually check. In agent mode
`not run` is a frequent, legitimate, and honest answer. A green report you
produced by pattern-matching is exactly the false success the whole method is
built to prevent.
