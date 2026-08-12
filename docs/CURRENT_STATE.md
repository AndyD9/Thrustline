# Current state

**The proven present, never the intent.** A capability enters here only once
merged into the main branch, with the evidence that establishes it. The future
belongs to the roadmap, defects to `KNOWN_ISSUES.md`.

Cap: **200 lines**, enforced by a check. Update at the close of any unit that
changes the proven reality. An entry that is no longer true is **replaced**, not
appended.

---

## Current milestone: hardening the working application

The application already does what it is meant to do; the owner's instruction is
to keep every feature and improve the code underneath it — best practices,
smaller and more readable files, reliability, security, and dependencies that
are not years behind. Reached when the code has been hardened boundary by
boundary without a single user-visible feature being lost. `PacoRCS` decides
that it is reached.

This replaces the full-rewrite direction of ADR-0002. That reversal needs
ADR-0005 before any unit relies on it.

## Capabilities shipped in `main`

`<unanswered — asked 2026-08-12>`

**Nothing user-facing is currently proven, and that is the honest state, not an
oversight.** The owner says the application works; the repository cannot yet
demonstrate it. The only automated coverage is 11 tests across four pure-logic
files (`boarding`, `geo`, `scheduleGenerator`, `units`) — no UI test, no
integration test, no bridge test, no RLS test, no end-to-end path.

| Capability | Evidence | Since |
| --- | --- | --- |
| Frontend logic suite passes | `cd app; npm test` → 4 files, 11 tests, run 2026-08-12 | 2026-08-12 |

Filling this table is the first real question the owner still owes the
repository. Until then, no unit may assume a working baseline it has not itself
established.

## Units in progress

None. POSEIDON was bootstrapped on 2026-08-12; no unit has been opened yet.

| Unit | Open milestone | Branch | Blocked by |
| --- | --- | --- | --- |
| — | — | — | — |

## Missing for the current milestone

1. **ADR-0005** superseding ADR-0002 — the rewrite decision is reversed but not
   recorded. Everything below inherits from it.
2. **The capability inventory** — which features are real, and how each is
   demonstrated. Without it "keep every feature" has no referent.
3. **A version reset** to `0.0.1-alpha` across the four manifests, and a
   decision on which one is the single source.
4. **A dependency upgrade pass** — 19 direct dependencies are outdated, 8 by a
   major version.
5. **A .NET test project**, so `dotnet test` stops exiting `0` on nothing.
6. **An RLS isolation suite** for owner A / owner B / anonymous.
7. **python3**, to take the method checks out of agent mode.

## Outside the milestone, tracked elsewhere

Nineteen entries in `docs/KNOWN_ISSUES.md`, including the three contradictions
between the accepted ADRs and reality (`KI-016`, `KI-017`) and the absent
release pipeline (`KI-003`). Historical tickets T0001–T0005 and the superseded
documentation set are in `docs/archive/`; they are context, never law.

## Steering

- **Keep the application, harden the code — `PacoRCS`, 2026-08-12.** No rewrite.
  Every existing feature is preserved; the work is best practices, smaller
  files, reliability and security. Reverses ADR-0002; pending ADR-0005.
- **Reliability and security win arbitrations — `PacoRCS`, 2026-08-12.** Where
  one option is more reliable and more secure, take it, including for runtime
  and dependency versions.
- **Semver from `0.0.1-alpha` — `PacoRCS`, 2026-08-12.** The four manifests
  currently read `0.2.0` independently; the single source is undecided.
- **POSEIDON adopted, prior docs archived — `PacoRCS`, 2026-08-12.** The four
  ADRs stay live in `docs/decisions/`; tickets, roadmap and the superseded
  document set moved to `docs/archive/` with history preserved.
- **`checks: agent mode` — bootstrap, 2026-08-12.** `python3` is absent, so
  `poseidon/checks/check.py` runs nowhere, including CI. Method-document caps,
  boundary-to-section correspondence and placeholder detection are unverified.
  Every report must say so.
- **A new repository is under consideration — `PacoRCS`, 2026-08-12.** Possibly
  a fresh start seeded from this codebase. Undecided; `docs/`, `AGENTS.md` and
  `poseidon/` travel intact if it happens.

## Reproduce and verify

```
cd app
npm test
```

Expect `4 passed (4)` files and `11 passed (11)` tests. That is the only claim
on this page that has been executed. Everything else in `docs/VALIDATION.md` is
`not run` or `blocked by environment` as of 2026-08-12.
