# Thrustline project guide

## Project overview

Thrustline is a Windows-first virtual airline management desktop application for Microsoft Flight Simulator. The active implementation is split across:

- `app/`: Tauri v2 desktop shell with a React 18, TypeScript, Vite, and Tailwind CSS v4 frontend.
- `sim-bridge/`: ASP.NET Core/.NET 8 sidecar that connects to MSFS through SimConnect, exposes local REST endpoints, and streams simulator data through SignalR.
- `supabase/`: Postgres schema migrations. Supabase provides authentication, database storage, row-level security, and realtime updates.
- `scripts/`: repository-level PowerShell build helpers.
- `legacy/`: superseded Electron and WPF implementations. Treat this directory as reference-only unless a task explicitly targets it.

The normal data flow is:

`MSFS -> sim-bridge -> REST/SignalR -> React UI`, with the React app and sidecar both using Supabase for their appropriate responsibilities.

## Start every task here

1. Read `PROGRESS.md` for the current implementation state and known issues.
2. Read the relevant section of `PLAN.md` for intended behavior and remaining work.
3. Check `git status --short` and preserve unrelated user changes.
4. Inspect the relevant implementation and latest Supabase migrations before editing; do not rely on the plan alone because code may be newer than the documentation.

The current roadmap focus is Phase 5 game mechanics, but the user's request always takes precedence.

## Setup and development

Prerequisites are Node.js 20+, npm, .NET 8, Rust, the Tauri v2 platform prerequisites, and a Supabase project. Native SimConnect functionality requires Windows and an MSFS/SimConnect installation.

Frontend environment:

```powershell
Set-Location app
Copy-Item .env.example .env
npm install
```

Populate `app/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit `.env` files or service-role credentials.

Useful commands:

```powershell
# Browser-only frontend development
Set-Location app
npm run dev

# Full Tauri desktop development
Set-Location app
npm run tauri:dev

# Run the sidecar directly (localhost:5055)
Set-Location sim-bridge
dotnet run

# Build and copy the Windows sidecar into Tauri's externalBin directory
.\scripts\build-sidecar.ps1

# Production checks/builds
Set-Location app
npm run build

Set-Location sim-bridge
dotnet build
```

Configure sidecar Supabase access with .NET user secrets, never frontend variables:

```powershell
Set-Location sim-bridge
dotnet user-secrets set "Supabase:Url" "https://example.supabase.co"
dotnet user-secrets set "Supabase:ServiceRoleKey" "<service-role-key>"
```

## Architecture and conventions

### Frontend (`app/src`)

- `App.tsx` owns the auth/company routing gates.
- `pages/` contains route-level screens; shared UI belongs in `components/`.
- `contexts/` owns app-wide auth, company, simulator, and units state.
- `hooks/` contains reusable realtime subscriptions and simulator streaming behavior.
- `lib/` contains Supabase access and domain/integration helpers.
- `data/airports.ts` and `data/aircraftTypes.ts` are large static datasets; avoid broad formatting or mechanical rewrites.
- Prefer the configured `@/` alias for imports from `app/src`.
- TypeScript is strict. Keep `noUnusedLocals`, `noUnusedParameters`, and the other compiler checks passing.
- Follow the existing functional-component, hook, and Tailwind utility patterns. Reuse the design tokens in `app/src/index.css` instead of introducing isolated styling systems.

### Sidecar (`sim-bridge`)

- `Program.cs` configures dependency injection, localhost REST endpoints, CORS, SignalR, and service startup.
- `SimConnect/` owns simulator clients, polling, flight detection, and the SignalR hub.
- `Services/` owns business rules and landing-processing behavior.
- `Cloud/Models/` contains Supabase transport models; keep these aligned with migrations and frontend database types.
- `Session/` tracks the logged-in user relayed from the frontend.
- Keep the bridge bound to localhost unless a task explicitly changes the security model.
- Preserve cross-platform compilation. Native SimConnect behavior is Windows-specific and should remain isolated behind the existing abstraction.

### Supabase (`supabase/migrations`)

- Treat migrations as append-only history. Add a new timestamped migration rather than rewriting an applied migration.
- Include appropriate RLS policies, constraints, indexes, triggers, and grants when adding data structures.
- Keep `app/src/lib/database.types.ts` and affected C# models synchronized with schema changes.
- The frontend may use only the anon key under RLS. The service-role key belongs exclusively in the sidecar's secrets/configuration and must never be logged or committed.

### Tauri (`app/src-tauri`)

- `tauri.conf.json` declares the sidecar as an external binary.
- `src/lib.rs` manages sidecar startup and shutdown.
- `capabilities/default.json` controls permissions. Add only the narrow permissions a feature needs.
- Sidecar binaries and Rust build output are generated artifacts and should not be committed.

## Change guidelines

- Keep changes scoped to the active stack; do not modify `legacy/` unless explicitly requested.
- Preserve the separation of responsibilities: UI and RLS-protected CRUD in React, simulator/native integration and privileged landing processing in the sidecar.
- When changing a shared payload or database entity, trace every consumer across TypeScript, C#, SQL, REST, and SignalR.
- Avoid embedding ports or URLs in new call sites. Reuse the existing bridge and Supabase configuration helpers.
- Do not commit secrets, generated build directories, logs, published executables, or dependency folders.
- Update `PROGRESS.md` when a task materially changes roadmap status, architecture, commands, or known bugs. Update `PLAN.md` only when the intended roadmap itself changes.

## Validation

Run the narrowest checks that cover the change, then expand for cross-layer work:

- Frontend changes: `npm run build` from `app/`.
- Sidecar changes: `dotnet build` from `sim-bridge/`.
- Rust/Tauri changes: `npm run tauri:build` from `app/` when practical; at minimum run the frontend build and `cargo check` from `app/src-tauri/`.
- Schema changes: review migration ordering and validate against a disposable/local Supabase instance when available.
- Cross-layer changes: build every affected layer and manually verify the relevant REST/SignalR flow.

There is currently no automated test script in `app/package.json` and no dedicated .NET test project. Do not claim tests passed unless a test suite exists and was run. Report which build or manual checks were performed and any checks that could not run because MSFS, SimConnect, Supabase credentials, or platform tooling was unavailable.
