# Thrustline — Plan d'implémentation

> Plan de référence pour toutes les phases du projet.
> Voir `PROGRESS.md` pour l'état d'avancement session par session.

---

## Roadmap globale (depuis CLAUDE.md)

- [x] **Phase 0** — Setup projet, structure, Electron boilerplate
- [ ] **Phase 1** — SimConnect bridge + détection de vol + log BDD ← *en cours*
- [ ] **Phase 2** — CashflowEngine + YieldEngine + premiers calculs
- [ ] **Phase 3** — Dashboard UI complet (Overview, Vols, Finances)
- [ ] **Phase 4** — Flotte & Maintenance
- [ ] **Phase 5** — Gestion de routes + carte
- [ ] **Phase 6** — Auth Supabase + mode multi / VA
- [ ] **Phase 7** — Stripe freemium → Pro

---

## Phase 1 — SimConnect Bridge + Flight Detection + DB Logging

### Step 1 : Database Foundation
1. **`.env`** — `DATABASE_URL="file:./dev.db"`
2. **`prisma/schema.prisma`** — modèles Company, Aircraft, Flight, Route, Transaction
3. `npx prisma migrate dev --name init`

### Step 2 : SimConnect Bridge (`electron/simconnect/`)
4. **`types.ts`** — interfaces SimData, FlightRecord, FlightState
5. **`vars.ts`** — 9 SimVars (PLANE LATITUDE, ALTITUDE, VERTICAL SPEED, etc.)
6. **`bridge.ts`** — `startSimConnect(onData)` :
   - Mac → mock (cycle CDG→JFK ~60s)
   - Windows → real `node-simconnect` via `createRequire(import.meta.url)`
7. **`flightDetector.ts`** — machine à états SIM_ON_GROUND :
   - true→false : takeoff, snapshot fuel/lat/lon
   - false→true : landing, haversine distance, VS du tick précédent
   - debounce 5s anti-rebond

### Step 3 : Serveur (`server/`)
8. **`services/flights.ts`** — Prisma CRUD + schemas Zod
9. **`routes/flights.ts`** — GET /api/flights, GET /api/flights/:id, POST /api/flights
10. **`index.ts`** — Fastify + CORS + PrismaClient décoré

### Step 4 : Electron
11. **`electron/preload.cjs`** — CJS statique (pas compilé par Vite), expose `window.thrustline` :
    - `onSimData` / `offAll`
    - `onSimStatus` / `onFlightStarted` / `onFlightEnded`
    - `getFlights(limit?)` / `getSimStatus()`
12. **`electron/main.ts`** — orchestration :
    - BrowserWindow (contextIsolation: true)
    - Fastify port 3000
    - Seed Company + Aircraft au premier lancement
    - SimConnect → IPC renderer + flightDetector
    - Landing → processLanding() → DB + notif renderer
    - IPC handlers : `flights:getAll`, `sim:getStatus`

### Step 5 : React (UI minimale Phase 1)
13. **`index.html`** — div#root
14. **`src/index.css`** — `@import "tailwindcss"`
15. **`src/main.tsx`** — createRoot
16. **`src/lib/api.ts`** — fetch wrapper (pas d'Axios)
17. **`src/types/thrustline.d.ts`** — `Window.thrustline`
18. **`src/contexts/SimContext.tsx`** — état global sim, `useSim()` hook
19. **`src/components/SimStatus.tsx`** — dot vert/rouge connexion
20. **`src/components/LiveFlightBar.tsx`** — barre altitude/speed/VS/fuel/heading
21. **`src/pages/Dashboard.tsx`** — SimStatus + LiveFlightBar + table vols récents
22. **`src/App.tsx`** — SimProvider + Router

### Décisions d'architecture Phase 1
- `main.ts` appelle les services Prisma directement (même process) — pas de round-trip HTTP pour les writes
- `prevVerticalSpeed` pour le VS d'atterrissage (le tick courant lit déjà 0)
- Tous les `node_modules` externalisés dans le build main (function `external` Rollup)
- Preload en CJS pur (`electron/preload.cjs`) pour contourner le problème ESM/sandbox Electron

### Vérification Phase 1
1. `npm run dev` → Vite + Electron s'ouvrent
2. DevTools : `window.thrustline = object` (preload OK)
3. SimStatus affiche "Mock" (vert)
4. LiveFlightBar apparaît pendant les phases vol du mock
5. Après ~60s → vol loggé, apparaît dans Recent Flights
6. `GET http://localhost:3000/api/flights` retourne les vols
7. VS < -600 → ligne en rouge (hard landing)

---

## Phase 2 — CashflowEngine + YieldEngine

### Fichiers à créer
- **`server/services/cashflow.ts`** — `CashflowEngine`
  - `fuelCost = fuelUsedGal × FUEL_PRICE_PER_GAL`
  - `landingFee` selon taille aéroport : small=50$, medium=150$, large=400$, hub=800$
  - Crée les `Transaction` correspondantes
  - Met à jour `Company.capital`
- **`server/services/yield.ts`** — `YieldEngine`
  - Prix base : 0.12$/siège/nm (éco), 0.35$ (business)
  - Sièges simulés selon `icaoType`
  - Load factor random 60–95%
  - `revenue = sièges × loadFactor × prixParSiège`
- **`server/services/maintenance.ts`** — `MaintenanceEngine`
  - `healthPct -= (durationMin / 60) * 0.1` par vol
  - Hard landing (VS < -600) → `healthPct -= 2`
  - `healthPct < 80` → Transaction maintenance légère
  - `healthPct < 50` → Transaction lourde + avion immobilisé

### Intégration
- Remplacer les calculs approximatifs dans `processLanding()` de `main.ts`
- Appeler CashflowEngine + YieldEngine + MaintenanceEngine séquentiellement

---

## Phase 3 — Dashboard UI complet

Pages à créer / enrichir :
- `Dashboard.tsx` — Overview : capital, nb vols, meilleure route, santé flotte
- `Flights.tsx` — historique complet avec filtres
- `Finances.tsx` — graphe cashflow (revenus / dépenses / net)

---

## Phase 4 — Flotte & Maintenance

- `Fleet.tsx` — liste avions, état santé, heures, cycles
- Interface maintenance (immobilisation, coûts)

---

## Phase 5 — Routes + Carte

- `Routes.tsx` — gestion routes, prix de base, activation
- Carte monde (react-simple-maps ou Leaflet)

---

## Phase 6 — Auth Supabase + Multi

- Auth Supabase (email/password)
- Virtual Airlines : partage de compagnie entre joueurs
- Realtime Supabase pour les vols en cours

---

## Phase 7 — Stripe Freemium → Pro

- Plan Free : 1 avion, 5 routes
- Plan Pro : illimité
- Stripe Checkout + webhook
