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
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Building for Distribution](#building-for-distribution)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
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

## Project Structure

```
Thurstline/
├── src/                          # React frontend
│   ├── pages/                    # Dashboard, Flights, Fleet, Crew, Routes,
│   │                             # Dispatch, Finances, Settings, Onboarding, Auth
│   ├── components/               # LiveMap, WorldMap, KpiCard, BarChart,
│   │                             # LineChart, LiveFlightBar, SimStatus, Layout
│   ├── contexts/                 # AuthContext, SimContext, SyncContext
│   ├── hooks/                    # useCompany, useFlights, useTransactions
│   ├── lib/                      # api.ts (HTTP client), supabase.ts
│   ├── data/                     # airports.ts (ICAO lookup)
│   └── types/                    # thrustline.d.ts
│
├── electron/                     # Electron main process
│   ├── main.ts                   # Window, IPC handlers, flight processing, intervals
│   ├── preload.ts                # Context bridge (window.thrustline API)
│   ├── simconnect/               # SimConnect bridge, flight detector, variables
│   ├── sync/                     # Cloud sync engine
│   └── supabase.ts
│
├── server/                       # Fastify API (embedded)
│   ├── routes/                   # flights, company, routes, dispatch, crew, events, airports
│   ├── services/                 # Business logic: yield, cashflow, maintenance,
│   │                             # reputation, events, crew, dispatch, flights
│   └── middleware/               # Bearer token auth
│
├── prisma/
│   ├── schema.prisma             # 11 data models
│   └── migrations/
│
├── scripts/
│   └── fetch-airports.mjs        # Airport database seeder
│
└── supabase/                     # Cloud deployment config
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Microsoft Flight Simulator 2024** (Windows, for real SimConnect — macOS/Linux uses mock mode)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/thrustline.git
cd thrustline

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed airport database (optional but recommended)
npm run airports:fetch
```

### Development

```bash
# Start Vite dev server only (frontend)
npm run dev

# Start Electron + Vite together
npm run electron:dev

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Building for Distribution

```bash
# Windows (NSIS installer)
npm run build:win

# macOS (DMG)
npm run build:mac

# Linux (AppImage)
npm run build:linux
```

---

## Database Schema

Thrustline uses 11 Prisma models backed by SQLite locally and Supabase PostgreSQL for cloud sync:

| Model | Purpose |
|-------|---------|
| **Company** | Virtual airline — name, capital, hub ICAO, airline code, userId |
| **Aircraft** | Fleet entries — type, health, ownership (leased/owned), hours, cycles |
| **Flight** | Completed flight logs — route, duration, fuel, landing VS, revenue, costs |
| **Dispatch** | SimBrief flight plans — status workflow, OFP data, pax/cargo config |
| **Route** | Saved bookmarked routes — origin, destination, distance, base price |
| **CrewMember** | Pilots — rank, experience, salary, duty hours, assignment |
| **Loan** | Startup financing — principal, monthly payment, remaining balance |
| **GameEvent** | Active events — type, scope, modifier, duration |
| **Reputation** | Per-route reputation scores — affects load factor / demand |
| **Transaction** | Financial ledger — 10 transaction types with amounts and descriptions |
| **SyncLog** | Cloud sync tracking — table, record, action, payload |

---

## API Reference

The embedded Fastify server runs on `http://localhost:3000/api`. All endpoints require a Bearer token (Supabase auth).

### Flights
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flights?limit=50` | List flight logs |
| GET | `/api/flights/:id` | Flight details |
| POST | `/api/flights` | Create flight record |

### Company & Fleet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company` | Current company info |
| PATCH | `/api/company` | Update company settings |
| POST | `/api/company/setup` | Onboarding setup |
| POST | `/api/company/reset` | Wipe company data |
| GET | `/api/fleet` | List aircraft |
| GET | `/api/catalog` | Aircraft catalog (available to buy/lease) |
| POST | `/api/fleet` | Lease an aircraft |
| POST | `/api/fleet/buy` | Purchase an aircraft |
| POST | `/api/fleet/:id/sell` | Sell an aircraft |
| PATCH | `/api/fleet/:id/activate` | Set active aircraft |
| GET | `/api/fleet/:id/resale-value` | Get resale valuation |
| GET | `/api/fleet/:id/maintain-cost` | Maintenance cost estimate |
| POST | `/api/fleet/:id/maintain` | Perform maintenance |
| GET | `/api/transactions?limit=100` | Transaction ledger |
| GET | `/api/company/loan-options` | Available loan presets |
| GET | `/api/company/loan` | Active loan details |

### Dispatches
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatches` | List dispatches |
| POST | `/api/dispatches` | Create dispatch |
| DELETE | `/api/dispatches/:id` | Cancel dispatch |
| PATCH | `/api/dispatches/:id/status` | Update dispatch status |
| GET | `/api/dispatches/:id/simbrief-url` | Generate SimBrief URL |
| POST | `/api/dispatches/:id/fetch-ofp` | Fetch OFP from SimBrief |

### Crew
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crew` | List crew members |
| GET | `/api/crew/pool` | View hiring pool |
| POST | `/api/crew/hire` | Hire a crew member |
| DELETE | `/api/crew/:id` | Fire a crew member |
| PATCH | `/api/crew/:id/assign` | Assign to aircraft |
| PATCH | `/api/crew/:id/unassign` | Remove from aircraft |

### Routes & Reputation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routes/discovered` | Auto-discovered routes |
| GET | `/api/routes` | Saved routes |
| POST | `/api/routes` | Save a route |
| DELETE | `/api/routes/:id` | Remove saved route |
| GET | `/api/reputation` | All route reputations |
| GET | `/api/reputation/score` | Aggregate reputation score |

### Events & Airports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Active game events |
| GET | `/api/events/history?limit=20` | Past events |
| GET | `/api/airport/:icao` | Airport lookup |

---

## Environment Variables

Create a `.env` file at the project root:

```env
# Local database
DATABASE_URL="file:./dev.db"

# Fuel pricing
FUEL_PRICE_PER_GAL=3.20

# Supabase (cloud sync & auth)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

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
