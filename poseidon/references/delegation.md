# Delegating to a sub-agent

## Allowed only when

At least two sub-tasks each produce a **useful result independently**. In
practice: inspecting different zones, read-only research, adversarial review, or
disjoint paths behind a stable contract.

## Sequential otherwise — no exceptions

- dependent sub-tasks;
- the same file, or the same persistent state;
- changing a contract together with its callers;
- any Git operation.

## The brief

A delegation that omits any line below will drift. Include all of them:

- the expected result, and the precise question being answered;
- the sources to read — named files, not "the codebase";
- allowed paths, and forbidden paths;
- either `read-only`, or the exhaustive list of paths it may write;
- the validations expected, and the shape of the report back;
- stop conditions: contradiction, unmet dependency, secret encountered,
  unexpected modification, reserved decision.

In a shared worktree, `read-only` is the default and a sub-agent never switches
the branch.

## On return

The coordinator, in this order:

1. separates findings, assumptions, and modifications actually present on disk;
2. rejects any change outside the assigned paths — reverts it, does not adopt it;
3. runs the review on the **combined diff**, not on each report;
4. replays the validations after the last modification.

A command that succeeded inside a sub-task is not evidence about the integrated
result. Only validations replayed after the final change count.
