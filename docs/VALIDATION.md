# Validation

This file answers one question: **I touched this — what do I run?**

Cap: **130 lines**. Read the **one row** for the area you touched.

Every command is copied from `.github/workflows/ci.yml`, `security.yml` or
`app/package.json`. Run them from the repository root unless a row says
otherwise.

## What to run

Order: targeted tests for the zone first, then the boundary checks.

| You touched | Commands, in order | Prerequisite | Depth |
| --- | --- | --- | --- |
| Data and persistence | `manual` — no automated RLS suite exists (`KI-002`); prove owner A / owner B / anonymous by hand on a disposable project | Supabase CLI + Docker | maximum |
| Authoritative service | `manual` — no edge-function tests exist; exercise `complete-flight` against a disposable project | Supabase CLI + Docker | maximum |
| Bridge local API | `cd sim-bridge; dotnet build --configuration Release` -> `manual` request-by-request check | .NET 8 SDK | maximum |
| SimConnect and MSFS | `cd sim-bridge; dotnet build --configuration Release` -> `manual` MSFS 2024 session, documented | MSFS 2024 on Windows 11 | maximum |
| Third-party egress | `cd app; npm test` -> `npm run build` -> `manual` offline and error-path check | — | maximum |
| Desktop shell | `cd app/src-tauri; cargo check` -> `cd app; npm run build` -> `.\scripts\security-check.ps1` | Rust stable | maximum |
| Distribution | `.\scripts\build-sidecar.ps1` -> `cd app; npm run tauri:build -- --no-bundle` | Rust + .NET 8 SDK | maximum |
| Client / UI | `cd app; npm test` -> `npm run build` | — | fast + real journey |
| Dependencies | `cd app; npm audit --omit=dev --audit-level=high` -> `npm outdated` -> `cd sim-bridge; dotnet list package --vulnerable --include-transitive` | network | maximum |
| CI config | push the branch and read the run; never assume a workflow edit is inert | — | maximum |
| Method documents | `python3 poseidon/checks/check.py --all` — **unavailable, see below** | python3 | fast |

`npm run build` is `tsc -b && vite build`: it is the type check as well as the
build. There is no separate lint step in this repository.

## Checks mode — agent mode

`python3` is **not installed on this machine**. `poseidon/checks/check.py`
cannot run here or in CI, so the method documents have no deterministic gate:
their caps, the boundary-to-section correspondence, placeholder detection and
the 35 negative mutations are all unverified.

Until python3 is installed, every report must state
`checks: agent mode — not deterministic, no CI gate`, and the substitute is
`poseidon/references/checks-by-hand.md`. Reading a file is not equivalent to a
check that fails a build.

## Two speeds

- **Maximum evidence** for anything touching money, data, server authority,
  security or the simulator: full checks, real runtime, a dedicated manual
  verification.
- **Fast** for client composition: types, tests, build — and the manual
  verification is the real journey through the application.

The **boundary touched** decides, never the size of the diff.

## Four outcomes, never interchangeable

`passed`, `failed`, `not run`, `blocked by environment`.

A tool exiting `0` without discovering any test proves nothing: check the
**number of items discovered** against the baseline before concluding. This is
not hypothetical here — `dotnet test` discovers zero tests in this repository
and exits `0` (`KI-004`, `L1`).

## Cross-cutting checks

Run before any Pull Request, whatever the area touched.

```
.\scripts\security-check.ps1
```

CI additionally runs `gitleaks` and `rustsec/audit-check` on every pull request
(`.github/workflows/security.yml`). Neither has a local equivalent here.

## Baselines

Guardrail counters live in `docs/validation-baselines.json`, one entry per
suite. A run discovering less than its baseline is `failed`, whatever its exit
code.

Measured on 2026-08-12 by running the suite, not by counting files:

| Suite | Command | Discovered | Result |
| --- | --- | --- | --- |
| frontend | `cd app; npm test` | 11 tests in 4 files | passed |
| bridge | `cd sim-bridge; dotnet test` | **0 — no test project exists** | proves nothing |

A baseline rises only in the unit that adds the corresponding tests, through
`python3 poseidon/checks/check.py --record-baseline <suite>=<n> --raised-by <ID>`,
which refuses any value below the current one. That command is unavailable in
agent mode; the current entry was written by hand and carries no such guard.

## Checks blocked by the environment

| Check | Why unavailable | Who runs it, where | What the substitute does not prove |
| --- | --- | --- | --- |
| `check.py --all` | python3 absent | anyone, once python3 is installed | reading the documents does not enforce caps or fail a build |
| MSFS golden path | MSFS 2024 required | `PacoRCS`, Windows 11 + MSFS 2024 | a build proves nothing about SimConnect behaviour |
| RLS isolation | no suite, no disposable project wired | `PacoRCS`, Supabase project | a passing frontend suite says nothing about cross-owner leakage |
| Signed installer | no release pipeline (`KI-003`) | `PacoRCS`, Windows 11 VM | `--no-bundle` does not prove installation or upgrade |

Absence is stated explicitly, never inferred from silence.
