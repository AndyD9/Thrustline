# Adversarial review

A capability is reviewed **milestone by milestone, on the pushed diff of that
milestone**, by an agent that did not write it, before the next milestone opens.
A single review at the end of the capability is non-conforming.

## Inputs

- the pushed diff of this milestone only: `git diff <base>..HEAD -- <paths>`,
  where `<base>` is the previous milestone's `commit:` line in the Completion
  Report, or `git merge-base origin/<main branch> HEAD` for `J1`;
- the unit header, the milestone block, `Allowed areas`, `Do not touch`;
- the `RULES.md` section for the milestone's primary boundary;
- the milestone's `Risk` and `Security-sensitive` values — they set the depth.

Nothing else. A reviewer who reads the whole repo reviews nothing.

## Order — report every band; a band 1 finding blocks on its own

1. **Security and data loss.** Authority derived from the caller's token, not the
   request body. No secret reachable by a client. Sensitive mutations atomic and
   idempotent. Destructive migration or irreversible write.
2. **Conformance.** Does the diff produce the milestone's stated observable
   result, and only that? Any path touched outside `Allowed areas` is blocking.
3. **Regressions and compatibility.** Callers of every changed contract. Schema
   and wire compatibility. Isolation between distinct rights holders.
4. **Architecture and debt created.** Business rules on the wrong side of the
   boundary. Debt that is not recorded.
5. **Tests and observability.** Does a deliberately broken behaviour fail a test?
   If not, the test proves nothing. Check discovered-test count against baseline.
6. **Readability and performance.**

## Output

Findings as a list, each with: band, file and line, the observable failure, and
what would make it pass. Then a verdict: `pass`, `pass with follow-ups`
(follow-ups recorded in `KNOWN_ISSUES.md`), or `return to In progress`.

## Forbidden

- Requesting an aesthetic rewrite with no measurable benefit.
- Reviewing intent instead of the diff.
- Approving on the basis of a validation you did not see replayed after the last
  change. A command that passed in a sub-task proves nothing about the merged
  result.
