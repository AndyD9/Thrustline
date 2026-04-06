# Thrustline — Etat d'avancement

> Mis a jour a chaque session. Lire en premier avant tout travail.
> Voir `PLAN.md` pour le plan detaille.

---

## Branche : `rework`

## Phase actuelle : Phase 4 — Features majeures (aeroports, avions, carte, SimBrief)

---

## Historique des commits

```
748b637 fix(sim-bridge): use HAS_SIMCONNECT flag instead of WINDOWS
12fb831 feat: NativeSimConnect + sidecar auto-spawn + Supabase Realtime
f4b1895 feat(app): polish UI with lucide icons, recharts cashflow chart, and glassmorphism v2
db4fb3d feat(app): implement Crew and Finances pages
d53c2ad feat(app): implement Fleet and Dispatch pages with full CRUD
95df878 fix(app): auto-refresh company capital after landing event
92d280b fix(app): suppress StrictMode AbortError on Settings page
99918a5 fix(app): onboarding redirect loop — lift company state into CompanyContext
a5f0581 fix(sim-bridge): load user-secrets unconditionally + add launchSettings.json
4c11b29 fix(sim-bridge): switch to Supabase 1.1.1 (supabase-csharp deprecated)
9feb47c feat(app): scaffold Tauri v2 + React 18 + TS + Tailwind v4 frontend
105d0ff feat(sim-bridge): landing → Supabase write pipeline with yield/cashflow/maintenance
e64cca4 feat(supabase): initial schema — 10 tables + enums + triggers + RLS
f88a55b refactor(sim-bridge): drop local SQLite/EF Core, go Supabase-only
cb82af6 feat(sim-bridge): scaffold .NET 8 service with EF Core entities + SimConnect layer
69821c8 chore: wipe legacy stack to start rework
```

---

## Ce qui est fait

### Phase 1 — Fondations

| Composant | Status | Details |
|---|---|---|
| Sim-bridge C# .NET 8 | DONE | ASP.NET Minimal API, SignalR, SimConnect abstraction |
| MockSimClient | DONE | Vol CDG→JFK en boucle 100s |
| FlightDetector | DONE | Machine a etats takeoff/landing, debounce 5s, haversine |
| LandingProcessor | DONE | Pipeline complete : yield/cashflow/maintenance → Supabase writes |
| Services metier | DONE | YieldService, CashflowService, MaintenanceService |
| Cloud models (DTOs) | DONE | 6 models avec Supabase.Postgrest attributes |
| SupabaseClientProvider | DONE | Singleton lazy-init, service_role key |
| Schema Supabase | DONE | 10 tables, 7 enums, RLS policies, triggers |
| Frontend Tauri + React | DONE | Tauri v2, React 18, TS, Vite, Tailwind v4 |
| Auth + Onboarding | DONE | Supabase Auth, CompanyContext, email/password |
| SignalR streaming | DONE | useSimStream hook, LiveFlightBar, SimStatusBadge |

### Phase 2 — Pages UI

| Page | Status | Details |
|---|---|---|
| Dashboard | DONE | KPIs, sim status, last landing, flight in progress |
| Flights | DONE | Table historique (route, distance, duration, fuel, revenue, net) |
| Fleet | DONE | Cards avions, health bar, cycles/hours, add form, set active |
| Dispatch | DONE | Liste missions, badges status, actions, new dispatch form |
| Crew | DONE | Table rank/status, aircraft assignment, hire form, random names |
| Finances | DONE | Summary cards, cashflow chart (recharts), loans, transaction ledger |
| Settings | DONE | Health check sim-bridge |

### Phase 3 — Infra technique

| Feature | Status | Details |
|---|---|---|
| NativeSimConnectClient | DONE | `#if HAS_SIMCONNECT`, Win32 message pump, 10 SimVars, retry 5s |
| Sidecar auto-spawn | DONE | `build-sidecar.ps1`, lib.rs child management, kill on close |
| Supabase Realtime | DONE | CompanyContext subscribe, capital updates live |
| useRealtimeTable | DONE | Hook generique INSERT/UPDATE/DELETE |
| waitForBridge | DONE | Retry helper startup |
| UI Polish v2 | DONE | Lucide icons, recharts, glassmorphism v2, animations |

---

## En cours — Phase 4

### 4.1 Base aeroports (ICAO)
- [ ] Dataset `airports.ts` (~2500 aeroports)
- [ ] Composant `AirportPicker.tsx` (autocomplete)
- [ ] Branche dans Dispatch + Onboarding

### 4.2 Base avions (types + contraintes)
- [ ] Dataset `aircraftTypes.ts` (~30-40 types)
- [ ] Composant `AircraftTypePicker.tsx`
- [ ] Validation range dans Dispatch

### 4.3 Carte live
- [ ] `FlightMap.tsx` avec react-leaflet
- [ ] Marqueur avion anime + route polyline
- [ ] Integration Dashboard + Dispatch

### 4.4 SimBrief
- [ ] Settings : champ simbrief_username
- [ ] Dispatch : bouton "Generate on SimBrief"
- [ ] Poll & parse OFP
- [ ] Modal infos vol + route sur carte

---

## Bugs connus / fixes appliques

| Bug | Cause | Fix | Commit |
|---|---|---|---|
| 187 CS0234 build errors | Package `supabase-csharp` 0.16.2 deprecie | Switch to `Supabase` 1.1.1 | `4c11b29` |
| Supabase not configured | Pas de launchSettings.json + user-secrets | launchSettings.json + AddUserSecrets() | `a5f0581` |
| Onboarding redirect loop | CompanyContext pas partage | Lift state into CompanyProvider + refetch | `99918a5` |
| Settings AbortError | React StrictMode double-render | Check ctrl.signal.aborted | `92d280b` |
| HAS_SIMCONNECT build error | Flag WINDOWS actif sans SDK | Remplace par HAS_SIMCONNECT conditionnel | `748b637` |

---

## Commandes utiles

```bash
# Frontend (dev)
cd app && npm run dev                    # Vite dev server (port 1420)
cd app && npm run tauri:dev              # Tauri + Vite (avec sidecar)

# Sim-bridge (dev)
cd sim-bridge && dotnet run              # Lance le service .NET (port 5055)

# Sidecar build (Windows)
.\scripts\build-sidecar.ps1             # Publish + copie dans Tauri binaries

# Supabase
npx supabase gen types typescript --project-id <ref> > app/src/lib/database.types.ts
```

---

## Architecture fichiers cles

```
Thurstline/
├── app/                              # Tauri + React
│   ├── src/
│   │   ├── components/               # Layout, Sidebar, LiveFlightBar, SimStatusBadge
│   │   ├── contexts/                 # AuthContext, CompanyContext, SimContext
│   │   ├── hooks/                    # useSimStream, useRealtimeTable
│   │   ├── lib/                      # supabase.ts, simBridge.ts, database.types.ts
│   │   └── pages/                    # Dashboard, Flights, Fleet, Dispatch, Crew, Finances, Settings, Auth, Onboarding
│   └── src-tauri/
│       ├── src/lib.rs                # Sidecar spawn + kill
│       └── tauri.conf.json           # Config Tauri, externalBin
├── sim-bridge/                       # C# .NET 8
│   ├── SimConnect/                   # ISimClient, MockSimClient, NativeSimConnectClient, FlightDetector, SimData
│   ├── Cloud/Models/                 # DTOs Supabase (CompanyRow, AircraftRow, etc.)
│   ├── Services/                     # YieldService, CashflowService, MaintenanceService, LandingProcessor
│   ├── Session/                      # SessionStore
│   └── Program.cs                    # Entry point, DI, endpoints
├── supabase/migrations/              # Schema SQL
├── scripts/build-sidecar.ps1         # Build + deploy sidecar
├── PLAN.md                           # Ce plan
└── PROGRESS.md                       # Cet etat d'avancement
```
