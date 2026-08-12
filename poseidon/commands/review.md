---
description: Adversarially review the pushed diff of one milestone, before the next one opens.
argument-hint: <unit id> <milestone, e.g. J2>
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git show:*), Task
---

Review milestone $ARGUMENTS on its **pushed diff**, following
`poseidon/references/review.md`.

You did not write this diff. If you did write it in this same session, say so and
delegate the review to a sub-agent with the brief in `poseidon/references/delegation.md`.

## Inputs — nothing else

`<base>` is the previous milestone's `commit:` from the Completion Report. For
`J1` it is `git merge-base origin/<main branch> HEAD`. Never review against
`HEAD~1`; a milestone may be several commits.

```
git log --oneline <base>..HEAD
git diff <base>..HEAD -- <the milestone's paths>
```

Plus: the unit header, the milestone block, `Allowed areas`, `Do not touch`, and
the `RULES.md` section for the milestone's primary boundary. The milestone's
`Risk` and `Security-sensitive` values set the depth — a sensitive-data change
and a read-only panel do not earn the same attention.

## Order — report every band, but band 1 is blocking on its own

1. security and data loss
2. conformance to the stated result, and **any path touched outside
   `Allowed areas`** — always blocking
3. regressions and compatibility for every changed contract
4. architecture and debt created
5. tests and observability — would a deliberately broken behaviour fail a test?
   is the discovered-test count at or above baseline?
6. readability and performance

Never request an aesthetic rewrite with no measurable benefit.

## Verdict — exactly one

- `pass`
- `pass with follow-ups` — each follow-up written into `docs/KNOWN_ISSUES.md`
  with evidence, severity, and target, before you say this
- `return to In progress` — set the **milestone** `Status: In progress` (the unit
  stays `In progress` throughout) and name the fixes

Record the findings you addressed in the milestone's Completion Report.

On `pass`, set the milestone `Status: Verify`. Then `Next: /verify <ID> <Jn>`.
