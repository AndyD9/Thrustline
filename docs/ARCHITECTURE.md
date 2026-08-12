# Architecture

The shape of the system, and **where trust changes**.

Cap: **150 lines**. Read the `Boundaries` table when opening a unit; read the
rest only when the open milestone changes what it describes.

Every row carries the file it was read from. A row with no evidence is a belief.

---

## Boundaries

**This table is the spine of the repository.** Each row here is a section of
`docs/RULES.md` and a row of `docs/VALIDATION.md`.

| Boundary | Trust changes how | Enforced in | Read from |
| --- | --- | --- | --- |
| Data and persistence | an authenticated identity becomes durable rows filtered by RLS | `supabase/migrations/` | `20260721190000_security_hardening.sql` |
| Authoritative service | a client-reported flight becomes an irreversible ledger write | `supabase/functions/`, SQL RPCs | `supabase/functions/complete-flight/index.ts` |
| Bridge local API | a loopback HTTP caller becomes the holder of a live user JWT | `sim-bridge/Program.cs` | `sim-bridge/Program.cs:116` |
| SimConnect and MSFS | simulator telemetry becomes domain flight events | `sim-bridge/SimConnect/` | `sim-bridge/SimConnect/ISimClient.cs` |
| Third-party egress | an outside response becomes a domain object | `app/src/lib/simbrief.ts`, `sim-bridge/Program.cs` | `app/src/lib/simbrief.ts:3`, `sim-bridge/Program.cs:188` |
| Desktop shell | web content becomes operating-system reach | `app/src-tauri/` | `app/src-tauri/capabilities/default.json` |
| Distribution | source becomes a signed artifact on a user machine | `scripts/build-sidecar.ps1` | `.github/workflows/ci.yml:66` |

The React client is not a boundary. It is the untrusted side of four of them.

## Components

| Component | Responsibility | Depends on | Read from |
| --- | --- | --- | --- |
| `app/` | UI, client orchestration, session handling | Supabase, bridge, SimBrief | `app/package.json` |
| `app/src-tauri/` | desktop shell, WebView2 host, sidecar launch | `app/`, sidecar | `app/src-tauri/Cargo.toml` |
| `sim-bridge/` | SimConnect telemetry, flight detection, local REST/SignalR | MSFS, Supabase | `sim-bridge/Thrustline.Bridge.csproj` |
| `supabase/` | schema, RLS, RPCs, edge function | — | `supabase/config.toml` |
| `legacy/` | read-only Electron + WPF reference | — | `legacy/package.json` |

## What is authoritative over what

**The server is authoritative for money, ownership, reputation, progression and
every sensitive transition.** The desktop app, the sidecar and MSFS are all
untrusted clients — a modifiable client on a user's machine can send anything.

Never trusted from a client: money amounts, ownership claims, role claims, the
current time, flight outcomes, or any identity supplied in a request body.
Caller identity is derived from the JWT alone. `scripts/security-check.ps1`
enforces two consequences of this mechanically: no `p_now` in `app/src` (a
client-controlled server clock) and no service-role credential in the sidecar.

The sidecar is trusted with *less* than the app: it holds a user access token in
memory (`sim-bridge/Session/SessionStore.cs`) but is never given a privileged
key.

## Data flow of the main path

1. User authenticates against Supabase Auth — crosses **Data and persistence**.
2. App posts `accessToken` + `supabaseUrl` + `anonKey` to `POST /session` on
   `127.0.0.1:5055`; the bridge verifies the token against `/auth/v1/user`
   before storing a session — crosses **Bridge local API**.
3. Bridge subscribes to MSFS via `NativeSimConnectClient` and detects phases —
   crosses **SimConnect and MSFS**.
4. Telemetry is pushed to the app over SignalR `/hubs/sim` — crosses
   **Bridge local API**.
5. Flight completion is submitted to the `complete-flight` edge function, which
   computes and writes the ledger — crosses **Authoritative service**.
6. Rows are read back under RLS — crosses **Data and persistence**.

## State that outlives a request

| Store | Written by | Read by | If lost |
| --- | --- | --- | --- |
| Supabase PostgreSQL | edge function, RPCs | app under RLS | company, fleet, finances and history are gone; no local copy exists |
| Bridge session (in memory) | `POST /session` | bridge services | user re-authenticates; no data loss |
| WebView2 local storage | `@supabase/supabase-js` (`persistSession: true`) | app | user signs in again |
| Build artifacts | `scripts/build-sidecar.ps1` | installer | rebuild from source |

## Deliberate architectural constraints

A unit may not quietly undo these. Changing one requires a superseding ADR.

- Solo ownership: one account owns at most one company and is its only human;
  `owner` is the only role — ADR-0001.
- Windows 11 x64 + MSFS 2024 only; no Windows 10, ARM64, MSFS 2020, or
  Xbox/Cloud — ADR-0003.
- Tauri + WebView2, not Electron; Supabase/PostgreSQL, not Firestore;
  SimConnect behind an internal replayable abstraction — ADR-0004.
- `legacy/` is read-only until explicitly archived — `AGENTS.md`.

## Known structural debt

Where the real structure disagrees with the documents above.

- **ADR-0002 is contradicted by reality and by the owner's current decision.**
  It mandates a full rewrite in a new repository with fresh history; this is the
  original repository with `legacy/` carved out in place by `fc3316d`, and the
  owner has since chosen to harden the existing code rather than rewrite it.
  Superseded by ADR-0005 (proposed) — `KI-016`.
- **ADR-0004 pins a stack the repository does not have**: .NET 10, pnpm 11,
  TypeScript 6, React 19, Tauri 2.11, `rust-toolchain.toml`. Actual: `net8.0`,
  npm, TypeScript 5.9, React 18.3, no `rust-toolchain.toml` — `KI-017`.
- **No .NET test project exists**, so `dotnet test` discovers nothing and exits
  `0` — `KI-004`.
- **No automated RLS isolation suite** covering owner A / owner B / anonymous —
  `KI-002`.
- The bridge weather routes use a static `new HttpClient()`
  (`sim-bridge/Program.cs:178`) while `IHttpClientFactory` is registered at
  line 57 and used correctly at line 119 — `KI-018`.
