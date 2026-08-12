# Invariants by boundary

Canonical source of accepted invariants. Read **the section for the boundary you
touch**, never the whole file.

Cap: **300 lines**. A new invariant replaces or condenses another.

## Section index — jump straight to yours

| You are touching | Section |
| --- | --- |
| schema, migrations, RLS | [Data and persistence](#data-and-persistence) |
| RPCs, edge functions, ledger | [Authoritative service](#authoritative-service) |
| `sim-bridge/Program.cs`, session, SignalR | [Bridge local API](#bridge-local-api) |
| `sim-bridge/SimConnect/`, telemetry | [SimConnect and MSFS](#simconnect-and-msfs) |
| SimBrief, weather, map tiles | [Third-party egress](#third-party-egress) |
| `app/src-tauri/`, CSP, capabilities | [Desktop shell](#desktop-shell) |
| packaging, installer, versions | [Distribution](#distribution) |
| dependencies, lockfiles, CI config | [CI and supply chain](#ci-and-supply-chain) |
| telemetry, personal data, logs | [Privacy](#privacy) |
| tooling that already bit us once | [Known traps](#rules-from-defects-already-encountered) |

## How to write a line

One line per invariant. Four columns: stable `#` never reused; the invariant as
a **refusal**; the `Check` that enforces it (`manual` is a debt, not a pass); and
`Proven by` as a **citation**, not a narrative.

An invariant with no automated check that could have one is unfinished: open a
bounded unit for the script or test rather than keeping a manual instruction.

An agent never creates an exception alone. Every exception is approved by
`PacoRCS`, bounded to one unit and one surface, and carries a residual risk and
a deadline. An exception with no deadline is an abandoned rule.

---

## Data and persistence

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| D1 | Migrations are append-only; never edit or delete an applied migration. | `manual` | `AGENTS.md`, ADR-0002 |
| D2 | An account owns at most one company and is its only human; `owner` is the only role. | `manual` | ADR-0001 |
| D3 | Never expose a row across owners: every table reachable by a client carries an RLS policy keyed on the JWT identity. | `manual` | `20260721190000_security_hardening.sql` |
| D4 | Never merge a schema change without proving isolation for owner A, owner B and anonymous. | `manual` — no suite exists (`KI-002`) | ADR-0001 |
| D5 | Never widen a `SECURITY DEFINER` function without re-reading its search_path and its caller check. | `manual` | `20260721201000_require_auth_passive_rpc.sql` |

## Authoritative service

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| S1 | Caller identity comes from the JWT, never from the request body. | `manual` | ADR-0001 |
| S2 | Never accept money, ownership, reputation, progression or a flight outcome as a client-supplied value; the server computes it. | `manual` | `AGENTS.md` |
| S3 | Never let the client supply the server clock. | `./scripts/security-check.ps1` | `security-check.ps1` (`p_now`) |
| S4 | Never return a privileged Supabase credential to the sidecar or the app. | `./scripts/security-check.ps1` | `security-check.ps1` (`ServiceRoleKey`) |
| S5 | Every sensitive mutation is transactional and idempotent; a retry never double-writes the ledger. | `manual` | `AGENTS.md`, ADR-0001 |

## Bridge local API

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| B1 | Kestrel binds loopback only; never bind `0.0.0.0` or a routable interface. | `manual` | `sim-bridge/Program.cs:23` |
| B2 | Never allow any origin: CORS stays an explicit allow-list. | `./scripts/security-check.ps1` | `security-check.ps1` (`AllowAnyOrigin`) |
| B3 | Never store a session from an unverified token: `POST /session` verifies against `/auth/v1/user` first. | `manual` | `sim-bridge/Program.cs:116` |
| B4 | Never accept an arbitrary `supabaseUrl`: HTTPS and `.supabase.co`, or loopback. | `manual` | `sim-bridge/Program.cs:125` |
| B5 | Validate every input before any side effect, including route parameters. | `manual` | `sim-bridge/Program.cs:184` |

## SimConnect and MSFS

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| M1 | The domain talks to `ISimClient`, never to a SimConnect type directly. | `manual` | ADR-0004, `sim-bridge/SimConnect/ISimClient.cs` |
| M2 | Never treat simulator telemetry as trusted: a modified sim can report anything. | `manual` | `AGENTS.md` |
| M3 | Never merge a SimConnect change without a replayed trace or a documented manual MSFS test. | `manual` — no replay corpus exists (`KI-009`) | `AGENTS.md`, ADR-0002 |
| M4 | Never require a modification to the simulator, or bypass an ACL, DRM or session boundary. | `manual` | ADR-0003 |

## Third-party egress

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| T1 | Never add an outbound host without adding it to the Tauri CSP in the same change. | `manual` | `app/src-tauri/tauri.conf.json:26` |
| T2 | Never trust a third-party response shape: parse defensively, fail closed. | `manual` | `app/src/lib/simbrief.ts:75` |
| T3 | Never send a Thrustline credential, JWT or personal datum to a third party. | `manual` | `AGENTS.md` |
| T4 | Reuse pooled clients: never construct a long-lived static `HttpClient` where `IHttpClientFactory` is registered. | `manual` | `KI-018` |

## Desktop shell

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| W1 | Never set the Tauri CSP to `null`. | `./scripts/security-check.ps1` | `security-check.ps1` |
| W2 | Never grant the WebView process-execution permissions (`shell:allow-execute`, `shell:allow-spawn`). | `./scripts/security-check.ps1` | `security-check.ps1` |
| W3 | Capabilities stay minimal: adding one is a reviewed change, never incidental. | `manual` | `app/src-tauri/capabilities/default.json` |
| W4 | No business rule and no authority decision lives in a React component. | `manual` | `AGENTS.md`, `KI-005` |

## Distribution

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| P1 | Versions are semver from a single source; never publish an opaque version, reuse a number, or move a tag. | `manual` | bootstrap 2026-08-12 |
| P2 | The bridge ships self-contained `win-x64`; never require a .NET SDK or runtime on the user machine. | `./scripts/build-sidecar.ps1` | ADR-0003, ADR-0004 |
| P3 | Never publish an artifact without verifiable provenance and checksums. | `manual` — no release pipeline exists (`KI-003`) | ADR-0004 |

## CI and supply chain

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| I1 | Exact versions and committed lockfiles; CI restores frozen (`npm ci`, never `npm install`). | `.github/workflows/security.yml` | ADR-0004 |
| I2 | Never merge with a known high-severity vulnerability in a production dependency. | `npm audit --omit=dev --audit-level=high` | `security.yml:41` |
| I3 | Never let a direct dependency fall a major version behind without a recorded decision — 19 are currently outdated, 8 by a major. | `npm outdated` | owner, 2026-08-12 |
| I4 | Never add a dependency where the pinned toolchain already suffices. | `manual` | `AGENTS.md` |
| I5 | Never commit a secret, token, personal datum or environment file. Never execute a remote script. | `gitleaks` | `security.yml:56` |

## Privacy

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| V1 | Never log a secret, JWT, authentication header or personal datum; technical detail goes to redacted logs. | `manual` | `AGENTS.md` |
| V2 | Errors shown to the user are actionable and carry no internal detail. | `manual` | `AGENTS.md` |

## Rules from defects already encountered

A tooling trap, promoted from `LEARNINGS.md` after two independent occurrences
or one deterministic reproduction. A line here is **removed** as soon as a check
makes the trap impossible.

| # | Trap | What to do instead | Promoted from |
| --- | --- | --- | --- |
| L1 | `dotnet test` exits `0` having discovered no tests, and reads as a pass. | Check the discovered count against `docs/validation-baselines.json` before concluding. No .NET test project exists yet (`KI-004`). | LC-2026-001 |
| L2 | An installer extracted at the repository root deleted the whole documentation set and left a stale duplicate of the method kit. | Never run an unreviewed install script in the worktree; extract to a scratch directory and copy in deliberately. | LC-2026-002 |
