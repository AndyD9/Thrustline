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

## Phase 4 — Features majeures (TERMINE)

### 4.1 Base aeroports (ICAO)
- [x] Fichier statique `airports.ts` (3232 aeroports, ICAO 4-lettres, large+medium, scheduled_service)
  - Source : OurAirports CSV auto-parse
  - Champs : `icao, iata, name, city, country, lat, lon, elevation_ft`
  - Index `airportByIcao` pour lookup O(1)
- [x] Composant `AirportPicker.tsx` — input autocomplete (recherche ICAO, IATA, nom, ville)
  - Max 8 resultats, priorite exact > startsWith > contains
  - Keyboard navigation (Arrow, Enter, Escape)
  - Affiche nom + ville sous le code selectionne
- [x] Branche dans Dispatch (origin/dest) et Onboarding (hub)

### 4.2 Base avions (types + contraintes)
- [x] Fichier statique `aircraftTypes.ts` (36 types MSFS courants)
  - Airbus (A319→A388), Boeing (B737→B78X), Regional (CRJ, Embraer), Turboprops (ATR, Dash8), GA (C172, TBM9, PC12)
  - Champs : `icaoType, name, manufacturer, rangeNm, maxPaxEco, maxPaxBiz, fuelCapacityGal, ceilingFt, cruiseSpeedKts`
- [x] Composant `AircraftTypePicker.tsx` — dropdown searchable avec specs
- [x] Validation Dispatch : warning si distance route > range avion (haversine)
- [x] Auto-fill pax eco/biz depuis le type selectionne
- [x] Integration Fleet : remplacement input icao_type

### 4.3 Carte live (Flight Map)
- [x] Package `react-leaflet@4` + `leaflet@1` (compatible React 18)
- [x] Composant `FlightMap.tsx` reutilisable (props: origin, dest, waypoints, aircraft)
  - Marqueur avion anime avec rotation heading (SVG)
  - Polyline route (dashed, couleur brand cyan)
  - Marqueurs aeroports avec labels ICAO permanents
  - Auto-fit bounds sur origin+dest
- [x] Integration Dashboard (carte 260px, non-interactive, hub + avion live)
- [x] Integration Dispatch (carte 180px dans le formulaire, route quand origin+dest)
- [x] Dark map tiles CartoDB dark_matter + Leaflet CSS overrides

### 4.4 Integration SimBrief
- [x] Champ `simbrief_username` dans Settings (sauvegarde Supabase)
- [x] Bouton "Generate on SimBrief" dans Dispatch (ouvre URL pre-remplie)
- [x] Bouton "Import OFP" — poll API toutes les 5s (max 60s)
- [x] Lib `simbrief.ts` — fetch + parse OFP (route, fuel, weights, times, navlog)
- [x] Modal OFP glassmorphism avec sections (Route, Fuel, Weights, Times, Aircraft)
- [x] Bouton "Apply to dispatch" dans OFP Modal → pre-remplit le formulaire
- [x] Trace route waypoints navlog sur la carte
- [x] Helper `geo.ts` — haversine distance en nautical miles

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
