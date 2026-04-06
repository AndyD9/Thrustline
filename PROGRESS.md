# Thrustline — Etat d'avancement

> Mis a jour a chaque session. Lire en premier avant tout travail.
> Voir `PLAN.md` pour le plan detaille.

---

## Branche : `rework`

## Phase actuelle : Phase 5 — Game Mechanics (evenements, loans, salaires, reputation)

---

## Historique des commits

```
5cadd69 feat(app): flight network map on Dashboard with curved route arcs
67bf327 feat(app): show flight number and route in LiveFlightBar
f8ee5c1 fix(app): aircraft icon rotates to match flight heading
89f9903 fix(app): aircraft follows flight plan route + trail on map
5597af6 feat(app): pass passenger count to SimBrief dispatch URL
8f72407 feat(sim-bridge): mock aircraft follows flight plan waypoints
16beace feat(app): add flight number + callsign to dispatch, pass to SimBrief
081d200 fix(app): SimBrief opens browser, fix map route color, remove cruise alt
2d91a65 refactor(app): redesign dispatch form — SimBrief-first workflow
0919e07 feat(sim-bridge): dispatch-driven mock + UserSecretsId for Supabase config
634324e feat(app): live flight tracking, unit system, UI fixes
845fa43 feat(app): Phase 4 — airports, aircraft types, flight map, SimBrief integration
02986fd docs: rewrite PLAN.md and PROGRESS.md for rework branch
748b637 fix(sim-bridge): use HAS_SIMCONNECT flag instead of WINDOWS
12fb831 feat: NativeSimConnect + sidecar auto-spawn + Supabase Realtime
```

---

## Ce qui est fait

### Phase 1 — Fondations

| Composant | Status | Details |
|---|---|---|
| Sim-bridge C# .NET 8 | DONE | ASP.NET Minimal API, SignalR, SimConnect abstraction |
| MockSimClient | DONE | Dispatch-driven (idle par defaut, vol a la demande via POST /mock/start-flight) |
| FlightDetector | DONE | Machine a etats takeoff/landing, debounce 5s, haversine |
| LandingProcessor | DONE | Pipeline complete : yield/cashflow/maintenance → Supabase writes |
| Services metier | DONE | YieldService, CashflowService, MaintenanceService |
| Cloud models (DTOs) | DONE | 6 models avec Supabase.Postgrest attributes |
| SupabaseClientProvider | DONE | Singleton lazy-init, service_role key, UserSecretsId configure |
| Schema Supabase | DONE | 10 tables, 7 enums, RLS policies, triggers |
| Frontend Tauri + React | DONE | Tauri v2, React 18, TS, Vite, Tailwind v4 |
| Auth + Onboarding | DONE | Supabase Auth, CompanyContext, AirportPicker hub |
| SignalR streaming | DONE | useSimStream hook, LiveFlightBar (flight number + route), SimStatusBadge |

### Phase 2 — Pages UI

| Page | Status | Details |
|---|---|---|
| Dashboard | DONE | KPIs, flight network map (arcs courbes), charts, recent flights |
| Flights | DONE | Table historique (route, distance, duration, fuel, revenue, net) |
| Fleet | DONE | Cards avions, health bar, AircraftTypePicker, set active |
| Dispatch | DONE | SimBrief-first workflow, OFP inline, route preview, callsign |
| Crew | DONE | Table rank/status, aircraft assignment, hire form, random names |
| Finances | DONE | Summary cards, cashflow chart (recharts), loans, transaction ledger |
| Settings | DONE | Health check, SimBrief username, unit system toggle |
| Live Flight | DONE | Carte plein ecran, avion temps reel, trail, instruments, landing recap |

### Phase 3 — Infra technique

| Feature | Status | Details |
|---|---|---|
| NativeSimConnectClient | DONE | `#if HAS_SIMCONNECT`, Win32 message pump, 10 SimVars, retry 5s |
| Sidecar auto-spawn | DONE | `build-sidecar.ps1`, lib.rs child management, kill on close |
| Supabase Realtime | DONE | CompanyContext subscribe, capital updates live |
| useRealtimeTable | DONE | Hook generique INSERT/UPDATE/DELETE |
| waitForBridge | DONE | Retry helper startup |
| UI Polish v2 | DONE | Lucide icons, recharts, glassmorphism v2, animations |

### Phase 4 — Features majeures

| Feature | Status | Details |
|---|---|---|
| Airport database | DONE | 3232 aeroports ICAO 4-lettres, OurAirports source |
| AirportPicker | DONE | Autocomplete ICAO/IATA/nom/ville, keyboard nav |
| Aircraft types database | DONE | 36 types MSFS (Airbus, Boeing, Regional, Turboprops, GA) |
| Dispatch refonte | DONE | SimBrief-first: route → avion (specs pills) → load (max pax) → flight ID/callsign → SimBrief → OFP inline → submit |
| FlightMap | DONE | Dark tiles, bezier route arcs, aircraft marker (heading rotation), trail, waypoints |
| Dashboard network map | DONE | Arcs courbes historiques, dots aeroports, auto-fit bounds, interactive |
| Live Flight page | DONE | Carte plein ecran, instruments overlay, trail, landing recap |
| SimBrief integration | DONE | Generate (airline/fltnum/callsign/pax), Import OFP, inline resume, ofp_data persiste |
| Unit system | DONE | Imperial/Metric toggle, UnitsContext, integre LiveFlightBar + Dashboard + LiveFlight |
| Mock dispatch-driven | DONE | Idle par defaut, vol a la demande avec waypoints OFP, heading dynamique |

---

## En cours — Phase 5

### 5.1 Evenements aleatoires
- [ ] `GameEvent` system : fuel_spike, weather, tourism_boom, strike, mechanical
- [ ] Modificateurs temporaires sur les routes/avions
- [ ] Notifications in-app

### 5.2 Systeme de loans
- [ ] Prendre un emprunt pour acheter un avion
- [ ] Remboursements mensuels automatiques
- [ ] UI dans Finances

### 5.3 Salaires & charges mensuelles
- [ ] Deduction automatique salaires crew
- [ ] Deduction lease cost avions
- [ ] Timer mensuel (ou par session)

### 5.4 Reputation avancee
- [ ] Score par route influence la demande pax
- [ ] Bonus/malus visibles dans l'UI
- [ ] Deblocage de routes premium

---

## Bugs connus / fixes appliques

| Bug | Cause | Fix | Commit |
|---|---|---|---|
| Leaflet z-index chevauche UI | Layers internes z-index 400+ | isolation:isolate + z-index:0 | `634324e` |
| OFP times raw unix timestamps | sched_out/sched_in pas formates | parseInt + formatUnixUTC() | `634324e` |
| SimBrief n'ouvre pas le navigateur | window.open() bloque dans Tauri | shell.open() + permission shell:allow-open | `081d200` |
| Polyline invisible sur carte | oklch() pas supporte par Leaflet | Couleur hex #00b4d8 | `081d200` |
| Avion en diagonale sur carte | Lerp lineaire origin→dest sans waypoints | InterpolateRoute avec waypoints + Bearing | `8f72407` |
| Icone avion ne tourne pas | SVG Lucide pointe ~315°, pas 0° | Triangle simple nord=0° + rotate(heading) | `f8ee5c1` |
| Supabase not configured | Pas de UserSecretsId dans csproj | Ajoute UserSecretsId + dotnet user-secrets | `0919e07` |
| Mock vol auto en boucle | CDG→JFK 100s loop au demarrage | Dispatch-driven, idle par defaut | `0919e07` |

---

## Commandes utiles

```bash
# Frontend (dev)
cd app && npm run dev                    # Vite dev server (port 1420)
cd app && npm run tauri:dev              # Tauri + Vite (avec sidecar)

# Sim-bridge (dev)
cd sim-bridge && dotnet run              # Lance le service .NET (port 5055)

# Sim-bridge Supabase config
cd sim-bridge && dotnet user-secrets set "Supabase:Url" "https://xxx.supabase.co"
cd sim-bridge && dotnet user-secrets set "Supabase:ServiceRoleKey" "eyJ..."

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
│   │   ├── components/               # Layout, Sidebar, LiveFlightBar, SimStatusBadge, AirportPicker, FlightMap, OFPModal
│   │   ├── contexts/                 # AuthContext, CompanyContext, SimContext, UnitsContext
│   │   ├── data/                     # airports.ts (3232), aircraftTypes.ts (36)
│   │   ├── hooks/                    # useSimStream, useRealtimeTable
│   │   ├── lib/                      # supabase.ts, simBridge.ts, simbrief.ts, geo.ts, units.ts, database.types.ts
│   │   └── pages/                    # Dashboard, Flights, Fleet, Dispatch, Crew, Finances, Settings, LiveFlight, Auth, Onboarding
│   └── src-tauri/
│       ├── src/lib.rs                # Sidecar spawn + kill
│       ├── capabilities/default.json # Permissions (shell:allow-open, execute, spawn)
│       └── tauri.conf.json           # Config Tauri, externalBin
├── sim-bridge/                       # C# .NET 8
│   ├── SimConnect/                   # ISimClient, MockSimClient (dispatch-driven), NativeSimConnectClient, FlightDetector, SimData
│   ├── Cloud/Models/                 # DTOs Supabase (CompanyRow, AircraftRow, etc.)
│   ├── Services/                     # YieldService, CashflowService, MaintenanceService, LandingProcessor
│   ├── Session/                      # SessionStore
│   └── Program.cs                    # Entry point, DI, endpoints, POST /mock/start-flight
├── supabase/migrations/              # Schema SQL
├── scripts/build-sidecar.ps1         # Build + deploy sidecar
├── PLAN.md                           # Plan detaille
└── PROGRESS.md                       # Cet etat d'avancement
```
