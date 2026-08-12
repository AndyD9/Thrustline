# Known issues and follow-ups

Register of **real discoveries outside the scope** of a unit of work. Planned
work belongs to the roadmap; accepted invariants to `RULES.md`; tooling traps to
`LEARNINGS.md`.

A discovery enters at the moment it is made, with its evidence, and is **not
fixed in passing**. That is the rule protecting a unit's scope: without the
register, every discovery becomes either scope drift or an omission.

## Format

- **Severity**: `Critical`, `High`, `Medium`, `Low`. Closed list.
- **Status**: `Open`, `Accepted`, `Scheduled`, `Resolved`, `Invalid`. Closed list.
- **Evidence**: what establishes the defect — command, output, file and line.
  Mandatory to reach `Resolved`. A resolved entry with no evidence is a false
  success, not a success.
- **Target**: the unit that will handle it, or the roadmap phase.

A `Critical` or `High` found when opening a unit may block it. The coordinator
says so explicitly rather than ignoring it.

## What does not belong here

- A future capability — that is roadmap.
- An accepted, bounded risk — that is an exception in `RULES.md`, with a deadline.
- Evidence missing for lack of an environment — that is a report limit, not a
  defect.
- An intuition with no reproducible evidence.

A candidate is not a known issue by default. It joins this register only if it
describes a **real** defect, out of scope, worth tracking.

## Remediation

Fixing an entry goes through a separate unit, whose acceptance includes a
relevant negative test and an explicit residual risk. Closing an entry without a
negative test is preparing to reopen it.

## Entries

KI-001 to KI-015 were carried over from the pre-POSEIDON register on
2026-08-12; their wording is condensed, their evidence unchanged. KI-016 to
KI-019 were found during the bootstrap audit.

| ID | Severity | Area | Summary | Evidence | Target | Status |
| --- | --- | --- | --- | --- | --- | --- |
| KI-001 | High | Data | Some business mutations are still performed directly by the client. | Initial audit | hardening | Open |
| KI-002 | High | Quality | No automated RLS suite for owner A / owner B / anonymous. | Initial audit | hardening | Open |
| KI-003 | High | Distribution | No complete signed-artifact and updater pipeline. | Initial audit | distribution | Open |
| KI-004 | Medium | Bridge | No .NET test project: `cd sim-bridge; dotnet test` discovers 0 tests and exits `0`. | No `.csproj` references xunit/NUnit/MSTest, verified 2026-08-12 | hardening | Open |
| KI-005 | Medium | Client | Several React pages mix UI, business rules and data access. | Initial audit | hardening | Open |
| KI-006 | Medium | Docs | Historical documentation partially out of sync. | Initial audit | bootstrap | Resolved |
| KI-007 | Medium | Product | Solo vs collaborative VA undecided. | ADR-0001: solo MVP prepared for later collaboration | T0002 | Resolved |
| KI-008 | High | Rebuild | A total rewrite could drop uncharacterised current behaviour. | ADR-0002: weak automated coverage against the existing scope. Closed by ADR-0005 (accepted 2026-08-12): no rewrite happens, so nothing is dropped. | ADR-0005 | Resolved |
| KI-009 | High | Bridge | No replayable SimConnect trace corpus exists to prove flight-engine parity. | T0001 and ADR-0002 | SimConnect slice | Open |
| KI-010 | High | Data | Once real data exists in the new schema, no return to the old product is possible. | ADR-0002: no backward compatibility | distribution | Accepted |
| KI-011 | High | Support | MSFS 2024 Store and Steam channels each need their own proof; only one test machine is available. | T0004 and ADR-0003 | platform validation | Open |
| KI-012 | Medium | Support | The minimum hardware profile is not measured; the available machine only proves the recommended profile. | ADR-0003 | later | Open |
| KI-013 | Medium | Desktop | Tauri/WebView2's real gain over a native .NET shell is unmeasured on the target profile. | ADR-0004 | later | Open |
| KI-014 | Medium | Data | Local Supabase is not identical to cloud; PostgreSQL 17 must be confirmed per project. | Supabase docs consulted in T0005 | later | Open |
| KI-015 | High | Bridge | The official managed SimConnect SDK documents .NET Framework and depends on an SDK install; self-contained publication is unproven. | MSFS 2024 SimConnect docs consulted in T0005 | SimConnect slice | Open |
| KI-016 | High | Architecture | ADR-0002 mandated a rewrite in a new repository with fresh history; this is the original repository with `legacy/` carved out in place. | `git log --diff-filter=A -- legacy` → `fc3316d`. Closed by ADR-0005 (accepted 2026-08-12), which supersedes ADR-0002 and matches the decision to reality. | ADR-0005 | Resolved |
| KI-017 | High | Supply chain | ADR-0004 pins .NET 10, pnpm 11, TypeScript 6, React 19, Tauri 2.11 and a `rust-toolchain.toml`. Actual: `net8.0`, npm, TS 5.9.3, React 18.3.1, no `rust-toolchain.toml`. .NET 8 support ends November 2026. | `Thrustline.Bridge.csproj`; `npm outdated` 2026-08-12; `ls rust-toolchain.toml` → absent | ADR-0005 then upgrade unit | Open |
| KI-018 | Medium | Bridge | The weather routes build a static `new HttpClient()` although `IHttpClientFactory` is registered and used correctly elsewhere — no DNS refresh, risk of socket exhaustion. | `sim-bridge/Program.cs:178` vs `:57` and `:119` | hardening | Open |
| KI-019 | Medium | Data | No database reset or seed command exists: recreating a schema is entirely manual, so a failed run is not diagnosable. | No Supabase CLI task, npm script or seed in the repo, verified 2026-08-12 | hardening | Open |
