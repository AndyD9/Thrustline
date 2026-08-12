# Recovery

## The three-strike protocol

An *attempt* is one change made with the intent of fixing the same failing
symptom, followed by one replay of the validation that exposed it.

- **Strike 1 fails** → state the hypothesis you are now testing, in one line,
  before changing anything. If you cannot state it, you are guessing; go to the
  diagnostic step below instead of editing.
- **Strike 2 fails** → stop editing. Run non-destructive diagnostics only: read
  the actual error, read the code path, print the real values. Then one last
  attempt, targeted.
- **Strike 3 fails** → **revert to the last green commit**
  (`git restore --source=<sha> -- <paths>`, explicit paths, never a global
  reset), record the failure in `docs/KNOWN_ISSUES.md` with the exact command,
  its real output, and the file and line, then report and halt.

A fourth attempt is forbidden. Leaving the tree broken is also forbidden: the
repository is green or it is reverted.

## Never do this while failing

- Weaken or delete a test to make a suite pass.
- Add a retry, a sleep, or a broad `catch` to hide a failure.
- Widen `Allowed areas` to reach the real cause. Record it and stop.
- Report `passed` for a check you did not run to completion.

## The four validation outcomes

They never substitute for one another in a report:

| Outcome | Means |
| --- | --- |
| `passed` | ran to completion, discovered ≥ baseline items, exited 0 |
| `failed` | ran, and did not pass |
| `not run` | you did not run it |
| `blocked by environment` | it cannot run here — name who runs it and where |

A tool exiting `0` after discovering **no tests** proves nothing. Compare the
discovered count against the baseline before concluding anything.

## When a manual verification cannot be done locally

The unit stays in `Verify`. The report names: the exact check, why it is
unavailable here, who must run it and on which environment, what was done
instead, and **what that substitute does not prove**. Absence is stated, never
inferred from silence.
