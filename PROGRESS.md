# Thrustline — État d'avancement

> Ce fichier est mis à jour à chaque session. Lire en premier avant tout travail.

---

## Phase actuelle : Phase 6 — Auth Supabase + multi / VA

---

## Ce qui est fait

### ✅ Phase 0 — Setup
- Structure dossiers, `package.json`, `vite.config.ts`, `tsconfig.json`
- Dépendances installées : Electron, React, Fastify, Prisma, Zod, Tailwind

### ✅ Phase 1 — SimConnect + détection de vol + log BDD
- `electron/simconnect/` : bridge (mock Mac / real Windows), flightDetector, types, vars
- `server/` : Fastify, routes flights, service flights
- `electron/main.ts` + `electron/preload.cjs` (CJS statique)
- React : SimContext, SimStatus, LiveFlightBar, Dashboard basique

### ✅ Phase 2 — Moteurs métier
- **`server/services/yield.ts`** — YieldEngine : prix siège/nm par classe, load factor 60–95%, configs par icaoType
- **`server/services/cashflow.ts`** — CashflowEngine : fuelCost, landingFee par catégorie aéroport, Transactions Prisma, maj Company.capital
- **`server/services/maintenance.ts`** — MaintenanceEngine : usure 0.1%/h, hard landing -2%, seuils 80% (léger) et 50% (lourd + grounded)
- **`server/services/company.ts`** + **`server/routes/company.ts`** — GET /api/company, /api/fleet, /api/transactions
- **`electron/main.ts`** — processLanding() réécrit avec les 3 moteurs, logs debug retirés

#### Points de vigilance (ne pas oublier)
- `"type": "module"` dans `package.json` → nécessaire pour Vite/Tailwind ESM
- Main Electron tourne en ESM → `__dirname` via `fileURLToPath(import.meta.url)`
- `require('node-simconnect')` → `createRequire(import.meta.url)` dans bridge.ts
- `electron/preload.cjs` — CJS pur `require('electron')`, pas compilé par Vite, référencé via `process.cwd()` en dev
- Port 3000 peut rester bloqué → `lsof -ti:3000 | xargs kill -9`

---

## Phase 3 — À implémenter

### Objectif : Dashboard UI complet
Enrichir l'UI avec des vraies données financières et opérationnelles.

### Pages / composants à créer ou enrichir

**`src/pages/Dashboard.tsx`** (refonte) — vue Overview :
- Carte KPIs : capital actuel, nb vols total, revenu total, meilleure route
- Graphe mini cashflow des 10 derniers vols (barres revenus vs coûts)
- Table vols récents (déjà existante, à garder)

**`src/pages/Finances.tsx`** (nouveau) :
- Graphe courbe capital dans le temps
- Table transactions (revenus / fuel / landing / maintenance) avec filtres par type
- Totaux par catégorie

**`src/pages/Flights.tsx`** (nouveau) :
- Historique complet vols avec pagination
- Détail par vol : revenus détaillés, coûts, load factor, VS atterrissage

**Navigation** :
- Ajouter sidebar / nav entre Dashboard, Flights, Finances

### Nouveaux endpoints déjà disponibles
- `GET /api/company` — capital, flotte, nb vols
- `GET /api/fleet` — état avions (health, heures, cycles)
- `GET /api/transactions` — historique transactions

---

### ✅ Phase 4 — Flotte & Maintenance
- **`server/services/company.ts`** — `AIRCRAFT_CATALOG`, `maintenanceCost`, `maintainAircraft`, `leaseAircraft`, `deductMonthlyLeases`
- **`server/routes/company.ts`** — `GET /api/catalog`, `POST /api/fleet`, `POST /api/fleet/:id/maintain`, `GET /api/fleet/:id/maintain-cost`
- **`electron/main.ts`** — `setInterval` every 30s → `deductMonthlyLeases`, `clearInterval` on quit, IPC `lease:deducted`
- **`electron/preload.cjs`** — `onLeaseDeducted` bridge + `offAll` cleanup
- **`src/contexts/SimContext.tsx`** — `leaseCount` counter (increments on `lease:deducted`)
- **`src/lib/api.ts`** — `leaseAircraft`, `maintainAircraft`, `maintainCost`, `catalog` shortcuts
- **`src/pages/Fleet.tsx`** — full rewrite: maintain button (cost preview, insufficient capital guard), add aircraft form (catalog dropdown + cost preview + confirm lease)

### ✅ Phase 5 — Routes + carte
- **`server/services/routes.ts`** — `getDiscoveredRoutes` (groupBy flights), `getSavedRoutes`, `createRoute` (upsert), `deleteRoute` (soft)
- **`server/routes/routes.ts`** — `GET /api/routes/discovered`, `GET /api/routes`, `POST /api/routes`, `DELETE /api/routes/:id`
- **`server/index.ts`** — registered `routeRoutes`
- **`src/data/airports.ts`** — 80 major airports with lat/lon, `getAirport()`, `toSVG()` projection helper
- **`src/components/WorldMap.tsx`** — pure SVG equirectangular map: grid, quadratic bezier arcs (colored profit/loss, width ∝ flight count), airport dots, hover tooltip
- **`src/types/thrustline.d.ts`** — `DiscoveredRoute`, `SavedRoute`
- **`src/lib/api.ts`** — `discoveredRoutes`, `savedRoutes`, `saveRoute`, `deleteRoute`
- **`src/pages/Routes.tsx`** — map + sortable stats table + plan route form + bookmark toggle (★)
- **`src/components/Layout.tsx`** + **`src/App.tsx`** — Routes nav entry + router registration

## Phases suivantes
- **Phase 6** — Auth Supabase + multi / VA
- **Phase 6** — Auth Supabase + multi / VA
- **Phase 7** — Stripe freemium → Pro

---

## Commandes utiles

```bash
npm run dev                              # Lance Vite + Electron
npx prisma studio                        # UI base de données
npx prisma migrate dev --name xxx        # Nouvelle migration
lsof -ti:3000 | xargs kill -9            # Kill port 3000 si bloqué
npx tsc --noEmit                         # Type-check renderer
npx tsc --noEmit -p tsconfig.node.json   # Type-check electron + server
```
