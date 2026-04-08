# Thrustline

Desktop companion app for **Microsoft Flight Simulator 2024** — build and manage your own virtual airline from the ground up.

Thrustline connects directly to MSFS 2024 via SimConnect to track your flights in real time, then layers on a full airline management simulation: fleet acquisition, crew hiring, route economics, dynamic events, and cloud-synced progression.

---

## Table of Contents

- [Features](#features)
  - [Real-Time Flight Tracking](#real-time-flight-tracking)
  - [Fleet Management](#fleet-management)
  - [Crew Management](#crew-management)
  - [Route Discovery & Reputation](#route-discovery--reputation)
  - [Dispatch & SimBrief Integration](#dispatch--simbrief-integration)
  - [Financial Engine](#financial-engine)
  - [Dynamic Game Events](#dynamic-game-events)
  - [Live Map & Dashboard](#live-map--dashboard)
  - [Authentication & Cloud Sync](#authentication--cloud-sync)
  - [Data Export](#data-export)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Real-Time Flight Tracking

Thrustline hooks into MSFS 2024 through the SimConnect SDK to capture live telemetry data every second:

- **Telemetry captured:** latitude, longitude, altitude, ground speed, vertical speed, heading, ground track, fuel quantity, on-ground state, aircraft ICAO type
- **Automatic takeoff/landing detection** using a state machine with 5-second debounce to filter out sim jitter
- **Departure/arrival ICAO resolution** via nearest-airport lookup at the moment of takeoff and landing
- **Haversine distance calculation** between departure and arrival
- **Landing quality tracking** — vertical speed at touchdown (fpm) recorded for every flight
- **Mock flight mode** on macOS/Linux — simulates a CDG-to-JFK cycle (~60s) for development and testing without MSFS

### Fleet Management

Build your airline's fleet by leasing or purchasing aircraft from a catalog of 20+ types spanning regional, narrowbody, and widebody categories.

- **Lease or buy:** leased aircraft have a monthly cost with no ownership; purchased aircraft are yours to keep or sell
- **Aircraft health system:** every aircraft tracks a health percentage (0–100%)
  - Health degrades by 0.1% per flight hour
  - Hard landings (vertical speed worse than -600 fpm) apply additional damage
  - Health below 80% triggers light maintenance ($5,000)
  - Health below 50% triggers heavy maintenance ($40,000) and grounds the aircraft
- **Auto-detection:** Thrustline reads your in-sim aircraft ICAO type and automatically selects the matching fleet aircraft
- **Resale:** sell owned aircraft at a depreciated value based on flight hours and cycles
- **Status badges:** Airworthy (>=80%), Degraded (50–79%), Grounded (<50%)

### Crew Management

Hire and manage pilots to staff your fleet.

- **Hiring pool:** randomly generated candidates with varying rank (Captain / First Officer), experience (1–10), and salary
- **Aircraft assignment:** assign crew members to specific aircraft in your fleet
- **Duty hour tracking:** each crew member logs flight hours per month against an 80-hour cap, with visual progress bars and warnings when approaching the limit
- **Status tracking:** available, flying, or resting
- **Monthly payroll:** salaries are automatically deducted from your capital on a recurring basis

### Route Discovery & Reputation

Every flight you complete automatically discovers and logs the route.

- **Discovered routes view:** aggregated statistics per origin-destination pair — flight count, total and average revenue, distance, average landing quality
- **Reputation score** (0–100) per route, starting at a neutral 50
  - Smooth landings, high load factors, and healthy aircraft improve reputation
  - Poor performance degrades it
  - Reputation directly affects passenger demand (load factor modifier from 0.85x to 1.15x)
- **Saved routes:** bookmark your most profitable routes for quick reference
- **Sorting and filtering:** by revenue, net profit, flight count, distance, or reputation

### Dispatch & SimBrief Integration

Plan your flights with a built-in dispatch system that integrates with SimBrief.

- **Create dispatches:** select origin, destination, aircraft type, and passenger/cargo configuration
- **SimBrief link:** one-click opens SimBrief pre-filled with your flight parameters (origin, destination, aircraft, pax count, cargo)
- **OFP fetch:** after planning in SimBrief, fetch the generated Operational Flight Plan back into Thrustline — fuel plan, route, block time, cruise altitude
- **Status workflow:** pending -> dispatched (SimBrief opened) -> flying (takeoff detected) -> completed (landing processed)
- **Auto-linking:** when you land, Thrustline automatically matches the flight to your pending dispatch and closes it out

### Financial Engine

A complete economic simulation tracks every dollar flowing through your airline.

**Revenue:**
- Flight ticket revenue calculated per flight using a yield model:
  - Base rate: $0.12/nm (economy), $0.35/nm (business)
  - Load factor: randomized 60–95%, modified by route reputation
  - Event bonuses: tourism booms and other demand events add multipliers

**Expenses:**
- **Fuel costs:** ~$3.20/gal, modified by global fuel events (spikes or drops)
- **Landing fees:** variable by airport
- **Aircraft leases:** monthly recurring
- **Crew salaries:** monthly recurring
- **Maintenance:** light ($5K) or heavy ($40K) triggered by aircraft health
- **Loan payments:** monthly installments with interest

**Tracking:**
- Full transaction ledger with 10 categories: revenue, fuel, landing_fee, lease, maintenance, salary, purchase, sale, loan_payment
- Capital-over-time line chart
- Revenue/cost breakdown bar chart
- Filtering by transaction type and date range

### Dynamic Game Events

Random events keep your airline on its toes.

| Event | Scope | Effect | Duration |
|-------|-------|--------|----------|
| Fuel Price Surge | Global | Fuel costs x1.30 | 12–48h |
| Fuel Prices Drop | Global | Fuel costs x0.75 | 12–36h |
| Severe Weather | Route | Route blocked (modifier=0) | 4–12h |
| Tourism Boom | Route | Demand increase (modifier=1.20) | 24–72h |
| Airport Strike | Route | Route blocked (modifier=0) | 6–24h |
| Mechanical Issue | Aircraft | Aircraft grounded (modifier=0) | 6–24h |

- **15% trigger chance** per 60-second tick, max 3 concurrent events per company
- Desktop notifications when events start and expire
- Events display on the dashboard with countdown timers

### Live Map & Dashboard

- **MapLibre GL live map:** real-time aircraft position, flight trail breadcrumbs (every 30s), active dispatch route line, all discovered routes overlay
- **Dashboard KPIs:** capital, total flights, hard landings, net profit/loss, total revenue
- **Charts:** revenue breakdown bar chart, capital-over-time line chart
- **Live flight bar:** current flight status (departure, destination, altitude, speed, duration)
- **SimConnect status indicator:** connected/disconnected/mock mode

### Authentication & Cloud Sync

- **Multi-provider auth:** email/password, Discord OAuth, Google OAuth — all via Supabase
- **Deep linking:** OAuth callbacks handled via `thrustline://auth/callback` protocol
- **Multi-tenant isolation:** all data scoped to `userId` — your airline is yours alone
- **Bi-directional cloud sync:**
  - Pull from Supabase on startup
  - Push changes every 5 seconds via SyncLog tracking (create/update/delete)
  - Batch upsert (50 records per call) for efficiency
  - Offline detection with automatic resume
  - Sync status indicator in the UI (syncing, idle, error, offline)

### Data Export

- **Flight log CSV export:** date, departure, arrival, aircraft, distance, duration, fuel, vertical speed, revenue, costs, net result
- **Transaction CSV export:** date, type, description, amount
- Exports via native system file picker dialog

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 |
| Frontend | React 19, TypeScript 6, Tailwind CSS 4 |
| Bundler | Vite 6 with vite-plugin-electron |
| Maps | MapLibre GL + React Map GL |
| Backend | Fastify 5 (embedded, localhost:3000) |
| ORM | Prisma 6 with SQLite |
| Cloud | Supabase (PostgreSQL + Auth) |
| Validation | Zod 4 |
| Sim Integration | node-simconnect (Windows) / mock (macOS/Linux) |
| Packaging | electron-builder (NSIS / DMG / AppImage) |

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 1–5 | Core simulation, fleet, crew, routes, dispatch, events, finances | Done |
| 6a | Authentication + cloud sync | Done |
| 6b | Virtual Airlines (multiplayer alliances) | Planned |
| 7 | Freemium model (Stripe integration) | Planned |

---

## License

All rights reserved.
