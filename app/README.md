# Thrustline — desktop app

Tauri v2 shell + React 18 + TypeScript + Vite + Tailwind v4 front-end, talking to:

- **Supabase** (auth + database) via `@supabase/supabase-js` — all CRUD reads/writes
  are done directly from the front, protected by RLS.
- **sim-bridge** (the C# .NET 8 sidecar in `../sim-bridge/`) via:
  - `POST/DELETE /session` — to relay the logged-in `userId`
  - `GET /health` — to surface status on the Settings page
  - **SignalR hub `/hubs/sim`** — for real-time SimVars, takeoff and landing events

## Prerequisites

- Node 20+ and npm
- Rust toolchain (`rustup`) + [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/)
- A Supabase project (cloud or local CLI) with the migration in `../supabase/migrations/` applied
- A built `sim-bridge` executable (see `../sim-bridge/README.md` when it's written;
  for now: `cd ../sim-bridge && dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true`)

## First-time setup

```bash
cd app
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm install
```

Drop the published `sim-bridge.exe` (or equivalent on macOS/Linux) into
`app/src-tauri/binaries/sim-bridge-<target-triple>.exe`. Target triples:

| Platform  | Triple suffix               |
|-----------|-----------------------------|
| Windows   | `x86_64-pc-windows-msvc.exe` |
| macOS x64 | `x86_64-apple-darwin`       |
| macOS ARM | `aarch64-apple-darwin`      |
| Linux x64 | `x86_64-unknown-linux-gnu`  |

Generate the app icons once (any square PNG is fine for dev):

```bash
cd app
npx @tauri-apps/cli icon path/to/logo.png
```

## Dev loop

```bash
npm run tauri:dev
```

That runs Vite on `localhost:1420`, launches the Tauri window pointing at it, and
spawns the `sim-bridge` sidecar — its stdout/stderr is prefixed with `[sim-bridge]`
in the terminal.

## Folder layout

```
app/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── src/
│   ├── main.tsx                 React entry
│   ├── App.tsx                  Router + auth/company gates
│   ├── index.css                Tailwind v4 + design tokens
│   ├── lib/
│   │   ├── supabase.ts          JS SDK client
│   │   ├── simBridge.ts         fetch wrapper + /session + /health
│   │   └── database.types.ts    hand-written types (regen later via supabase gen types)
│   ├── hooks/
│   │   ├── useSimStream.ts      SignalR client → SimData / takeoff / landing
│   │   └── useCompany.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx      session + auto /session sync with sim-bridge
│   │   └── SimContext.tsx       single SignalR hub for the whole app
│   ├── components/              Layout, Sidebar, SimStatusBadge, LiveFlightBar, StubPage
│   └── pages/                   Auth, Onboarding, Dashboard, Flights, Fleet,
│                                Dispatch, Crew, Finances, Settings
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json          includes "externalBin": ["binaries/sim-bridge"]
    ├── capabilities/default.json
    └── src/
        ├── main.rs
        └── lib.rs               spawns sim-bridge sidecar at startup
```

## Gate flow

1. Auth loading → full-screen spinner
2. No user → `/auth` (sign in / sign up)
3. User logged in, company loading → spinner
4. User logged in, no company → `/onboarding` (create airline)
5. User + company → `/dashboard` with sidebar layout

On sign-in, `AuthContext` automatically calls `POST /session { userId }` on the
sim-bridge so that landing events can be attributed to the right user.

On sign-out, it calls `DELETE /session`.
