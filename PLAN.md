# Thrustline — Plan d'implementation

> Plan de reference pour le rework complet. Branche `rework`.
> Voir `PROGRESS.md` pour l'etat d'avancement.

---

## Stack cible

| Couche | Techno |
|---|---|
| Shell desktop | **Tauri v2** (Rust) — sidecar pour le sim-bridge |
| Frontend | **React 18 + TypeScript + Vite + Tailwind v4** |
| Sim Bridge | **C# .NET 8** — ASP.NET Minimal API + SignalR + SimConnect SDK |
| Auth + DB | **Supabase** (Postgres + RLS + Auth + Realtime) — single source of truth |
| IPC | **HTTP REST** (CRUD) + **SignalR** (real-time sim data) |

### Schema d'execution

```
Tauri shell (Rust)
  └─ React + Vite (UI) ◄── REST + SignalR (localhost:5055) ──► sim-bridge.exe (C# .NET)
                                                                   ├─ SimConnect thread ──► MSFS 2024
                                                                   ├─ ASP.NET Minimal API
                                                                   ├─ SignalR Hub
                                                                   └─ Supabase client ──► Supabase (cloud)
```

---

## Phase 1 — Fondations (TERMINE)

### 1.1 Nettoyage
- [x] Wipe legacy stack (Electron, Fastify, Prisma, node-simconnect)
- [x] Branche `rework` depuis main

### 1.2 Sim-bridge C# .NET 8
- [x] Scaffold projet ASP.NET Minimal API (`sim-bridge/`)
- [x] SimConnect abstraction : `ISimClient`, `SimData`, `FlightDetector`
- [x] `MockSimClient` — vol CDG→JFK en boucle 100s
- [x] `SimConnectWorker` — BackgroundService, SignalR broadcast
- [x] Services metier : `YieldService`, `CashflowService`, `MaintenanceService`
- [x] `LandingProcessor` — pipeline complète landing → Supabase writes
- [x] Cloud models (DTOs Supabase) : Company, Aircraft, Dispatch, Flight, Transaction, Reputation
- [x] `SupabaseClientProvider` — singleton lazy-init avec service_role key
- [x] Session store (userId reçu du front via POST /session)
- [x] Endpoints REST : GET /health, POST /session, DELETE /session
- [x] SignalR hub `/hubs/sim`

### 1.3 Schema Supabase
- [x] Migration `20260405120000_init.sql` — 10 tables, 7 enums, RLS policies, triggers

### 1.4 Frontend Tauri + React
- [x] Scaffold Tauri v2 + React 18 + TS + Vite + Tailwind v4
- [x] Auth Supabase (AuthContext, page Auth email/password)
- [x] Onboarding (creation compagnie)
- [x] CompanyContext (state partage + Supabase Realtime)
- [x] SimContext + useSimStream (client SignalR)
- [x] Layout + Sidebar + SimStatusBadge + LiveFlightBar
- [x] Sidecar spawn dans lib.rs (Tauri)

---

## Phase 2 — Pages UI (TERMINE)

- [x] **Dashboard** — KPIs (capital, sim status, last landing), flight in progress
- [x] **Flights** — historique complet avec table (route, distance, duration, fuel, revenue, net)
- [x] **Fleet** — cards avions avec health bar, cycles/hours, add form, set active
- [x] **Dispatch** — liste missions avec badges status, actions (dispatch → flying → completed), new dispatch form
- [x] **Crew** — table avec rank/status, aircraft assignment, hire form avec random names
- [x] **Finances** — summary cards, cashflow chart (recharts), loans, transaction ledger
- [x] **Settings** — health check sim-bridge

---

## Phase 3 — Infra technique (TERMINE)

- [x] **NativeSimConnectClient** — `#if HAS_SIMCONNECT`, thread Win32 message pump, 10 SimVars, retry auto 5s
- [x] **Sidecar auto-spawn** — `scripts/build-sidecar.ps1`, lib.rs avec child management + kill on close
- [x] **Supabase Realtime** — CompanyContext subscribe aux UPDATE sur companies, capital live
- [x] **useRealtimeTable** — hook generique INSERT/UPDATE/DELETE
- [x] **waitForBridge()** — retry helper pour attendre le sidecar au demarrage

---

## Phase 4 — Features majeures (EN COURS)

### 4.1 Base aeroports (ICAO)
- [ ] Fichier statique `airports.ts` (~2500 aeroports large+medium)
  - Source : OurAirports (type `large_airport` + `medium_airport`, `scheduled_service=yes`)
  - Champs : `icao, iata, name, city, country, lat, lon, elevation_ft`
- [ ] Composant `AirportPicker.tsx` — input autocomplete (recherche ICAO, IATA, nom, ville)
- [ ] Branche dans Dispatch (origin/dest) et Onboarding (hub)
- [ ] Validation : affichage nom + ville a côte du code ICAO

### 4.2 Base avions (types + contraintes)
- [ ] Fichier statique `aircraftTypes.ts` (~30-40 types MSFS courants)
  - Champs : `icaoType, name, manufacturer, range_nm, maxPaxEco, maxPaxBiz, fuelCapacityGal, ceilingFt, cruiseSpeedKts`
- [ ] Composant `AircraftTypePicker.tsx` — dropdown avec specs affichées
- [ ] Validation Dispatch : bloque si distance route > range avion
- [ ] Auto-fill pax eco/biz depuis le type selectionne

### 4.3 Carte live (Flight Map)
- [ ] Package `react-leaflet` + tiles OpenStreetMap (dark theme)
- [ ] Composant `FlightMap.tsx` reutilisable
  - Marqueur avion anime (lat/lon depuis `useSim().latest`)
  - Polyline route origin → waypoints → dest
  - Marqueurs aeroports origin/dest avec labels ICAO
- [ ] Integration Dashboard (carte miniature)
- [ ] Integration Dispatch (carte plein ecran / modal)
- [ ] Dark map tiles (CartoDB dark_matter ou Stadia dark)

### 4.4 Integration SimBrief
- [ ] Champ `simbrief_username` dans Settings (stocke dans `companies.simbrief_username`)
- [ ] Bouton "Generate on SimBrief" dans Dispatch
  - Ouvre popup SimBrief dispatch pre-remplie (origin, dest, aircraft type)
  - URL : `https://dispatch.simbrief.com/options/custom?orig=XXXX&dest=XXXX&type=XXXX`
- [ ] Poll `xml.fetcher.php?username=XXX&json=1` toutes les 5s (max 60s)
- [ ] Parse OFP : route, fuel breakdown, temps, navlog (waypoints)
- [ ] Stocke dans `dispatch.ofp_data` (JSON)
- [ ] Modal OFP avec infos du vol (fuel, route, timings, weights)
- [ ] Trace route waypoints sur la carte
- [ ] Position avion sur le point de depart

**API SimBrief** :
- Endpoint : `https://www.simbrief.com/api/xml.fetcher.php?username=XXX&json=1`
- Auth : username uniquement (pas de cle API)
- Retourne : origin/dest, route, navlog (waypoints lat/lon), fuel breakdown, times, weights
- Pas d'API de generation server-side → on redirige vers l'UI SimBrief

---

## Phase 5 — Game Mechanics (A VENIR)

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

## Phase 6 — Polish & Deploy (A VENIR)

- [ ] CI/CD (GitHub Actions : build + test)
- [ ] `supabase gen types typescript` — types auto-generes
- [ ] Installeur Windows (NSIS/MSI via Tauri)
- [ ] Virtual Airlines (compagnie partagee, invitations, roles)
- [ ] Stripe freemium → Pro
