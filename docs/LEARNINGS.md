# Operational learnings

A repository's learning is about **observable facts**, never an agent's implicit
memory. This register exists so a difficulty paid once is not paid twice, and so
an instruction does not outlive its cause.

## States

| State | Definition |
| --- | --- |
| `Observed` | Seen once, in a single context. |
| `Reproduced` | Reconstructed in a second independent context, or deterministically. |
| `Codified` | Written at its canonical destination. |
| `Enforced` | Applied by an automated check. This is the goal. |
| `Stale` | No longer applies — tool, version, or context changed. Kept, never erased. |

## Evidence and promotion

- **Capture** a first occurrence immediately: symptom, context, the wrong
  conclusion to avoid, the non-destructive diagnostics run.
- **Promotion** requires two independent occurrences or one deterministic
  reproduction. One reproducible occurrence suffices where there is high risk of
  a security failure, data loss, or a false success — after explicit review.
- A counter-example beats a third occurrence: what bounds a rule is worth more
  than what repeats it.
- A promotion never justifies exceeding a unit's `Allowed areas`.

## Canonical destination

Choose the **narrowest** that works. Writing higher than necessary is the most
common way documentation becomes unreadable.

| Nature | Destination |
| --- | --- |
| One-off fact about a unit | its Completion Report |
| Real defect out of scope | `KNOWN_ISSUES.md` |
| Recurring tooling trap | `RULES.md`, "defects already encountered" |
| Invariant of a boundary | `RULES.md`, that boundary's section |
| Command or execution order | `VALIDATION.md` |
| Constraint of a code zone | `<zone>/AGENTS.md` |
| Global project invariant | `AGENTS.md` — replacing an existing rule |

As soon as a deterministic check is possible, open a bounded unit for the script
or test **instead of** keeping a manual instruction. A manual instruction is a
debt, not an asset.

## Candidate template

### LC-YYYY-NNN — <title>

- **State**: `Observed`
- **Symptom**: <what was observed, literally>
- **Context**: <tool, version, system, command>
- **Wrong conclusion to avoid**: <what we believed that was false>
- **Diagnostics run**: <non-destructive commands and their output>
- **Occurrences**: <unit, date>; <unit, date>
- **Proposed destination**: <per the table above>
- **Revalidate on**: <date or condition — version or tool change>

## Register

| ID | Title | State | Destination | Revalidate |
| --- | --- | --- | --- | --- |
| LC-2026-001 | `dotnet test` exits `0` having discovered nothing | Codified | `RULES.md` L1 | when a .NET test project exists (`KI-004`) |
| LC-2026-002 | An install script extracted at the repo root deleted the documentation set | Codified | `RULES.md` L2 | never — the script is gone |

### LC-2026-001 — `dotnet test` reports success on an empty discovery

- **State**: `Codified`
- **Symptom**: `cd sim-bridge; dotnet test` exits `0`. Read as a passing suite.
- **Context**: `Thrustline.Bridge.csproj`, .NET 8, 2026-08-12.
- **Wrong conclusion to avoid**: that the bridge has passing tests. It has none:
  no `.csproj` in the repository references xunit, NUnit or MSTest.
- **Diagnostics run**: `grep -rl 'xunit\|NUnit\|MSTest' --include=*.csproj .`
  → no match outside `legacy/`.
- **Occurrences**: bootstrap, 2026-08-12. Deterministic — one occurrence
  suffices, since the failure mode is a false success.
- **Revalidate on**: creation of a .NET test project, which turns this into a
  real baseline in `docs/validation-baselines.json`.

### LC-2026-002 — An unreviewed install script deleted the documentation set

- **State**: `Codified`
- **Symptom**: after running `install.sh` at the repository root, 25 tracked
  documents were deleted from the worktree — the roadmap, four ADRs, five
  tickets and three templates — and a stale duplicate of the method kit was left
  at the root as `checks/ commands/ examples/ repo/ skill/`.
- **Context**: POSEIDON 1.0.0 install, 2026-08-12.
- **Wrong conclusion to avoid**: that the spilled directories were duplicates of
  `poseidon/` and safe to delete without checking. They were an **older**
  packaging: their `locate.md` referenced a `method` skill, and their
  `check.py` was 3.8 KB smaller.
- **Diagnostics run**: `git status --porcelain=v1`; `diff -rq checks poseidon/checks`;
  `unzip -l docs/poseidon-dist/poseidon.zip`. All deletions were uncommitted and
  recovered with `git restore --source=HEAD`.
- **Occurrences**: bootstrap, 2026-08-12. Deterministic, and the risk is data
  loss — one occurrence suffices.
- **Revalidate on**: never. Extract an archive to a scratch directory and copy
  in deliberately; never run an unreviewed installer inside the worktree.

## Revalidation and retirement

At the deadline, or on a version change: confirm, replace, or mark `Stale` —
without erasing history. An `Enforced` entry whose check has been removed drops
back to `Codified`: that is a regression of guarantee, and it must be visible.
