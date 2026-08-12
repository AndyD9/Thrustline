# Setup

How to get from a fresh clone to a running system, and back to a clean one.

Cap: **100 lines**. Read when a command in `VALIDATION.md` needs a prerequisite
you do not have. Every command is copied from a file in the repository, and the
source is named.

## Prerequisites

| Tool | Version | Pinned by | Why exactly this version |
| --- | --- | --- | --- |
| Windows | 11 x64 | ADR-0003 | the bridge, the Tauri build and MSFS are Windows-only |
| Node | 24.18.0 | `.node-version`, `.nvmrc`, `app/package.json` engines `>=24.18.0 <25`, `ci.yml:22` | pinned identically in the repo and in CI |
| npm | bundled with Node 24 | `app/package-lock.json` | ADR-0004 specifies pnpm 11; **not adopted** (`KI-017`) |
| .NET SDK | 8.0.x | `Thrustline.Bridge.csproj` (`net8.0`), `security.yml:25` | ADR-0004 targets .NET 10 LTS; **not adopted**, and .NET 8 support ends November 2026 (`KI-017`) |
| Rust | stable | `dtolnay/rust-toolchain@stable` in both workflows | no `rust-toolchain.toml` exists despite ADR-0004 requiring one (`KI-017`) |
| WebView2 | Evergreen | supplied by Windows 11 | ADR-0004: not shipped with the app |
| MSFS 2024 | current public stable | ADR-0003 | only needed for SimConnect work |
| Supabase CLI + Docker | not recorded | — | `no reason recorded` — needed for any local schema work; nothing in the repo pins a version |
| python3 | any | — | **absent on this machine**; POSEIDON checks cannot run (see `VALIDATION.md`) |

`no reason recorded` is a legitimate entry. An invented reason is not.

## From clone to running

```
cd app
npm ci
copy .env.example .env
```

Then fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `app/.env`.

```
npm run dev
```

For the full desktop app, the sidecar must be built first — `npm run tauri:dev`
will not produce it:

```
.\scripts\build-sidecar.ps1
cd app
npm run tauri:dev
```

Source: `app/package.json` scripts, `app/.env.example`, `scripts/build-sidecar.ps1`.

## Configuration

| Variable | Required | Where the local value comes from | Read from |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | the Supabase project — ask `PacoRCS` | `app/.env.example` |
| `VITE_SUPABASE_ANON_KEY` | yes | the Supabase project — ask `PacoRCS` | `app/.env.example` |
| `VITE_SIM_BRIDGE_URL` | no | defaults to `http://127.0.0.1:5055` | `app/.env.example` |

The anon key is designed to ship in the bundle; RLS is what protects the data.
That is not a licence to relax D3.

**No secret, token, personal datum or environment file is ever committed or
logged.** `.env`, `.env.local` and `.env.*.local` are git-ignored
(`.gitignore:5-7`) and `gitleaks` runs on every pull request.

## Back to a clean state

```
cd app; rmdir /s /q node_modules dist; npm ci
cd ..\sim-bridge; dotnet clean; rmdir /s /q bin obj publish
cd ..\app\src-tauri; cargo clean
```

There is **no database reset command** — no Supabase CLI task, no npm script, no
seed. Recreating a schema is entirely manual, so a failed run is not
diagnosable. That is real debt (`KI-019`).

## Verify the setup worked

```
cd app
npm test
```

Expect `4 passed (4)` files and `11 passed (11)` tests — the baseline in
`docs/validation-baselines.json`. A run discovering fewer is a failure whatever
its exit code.

## What cannot be run locally

MSFS 2024 SimConnect behaviour, cross-owner RLS isolation, and signed-installer
distribution. See the table at the end of `docs/VALIDATION.md` for who runs
each, on which environment, and what the local substitute does not prove.

## Traps

- `npm run tauri:dev` starts without the sidecar and the app looks alive while
  every sim feature is dead. Run `.\scripts\build-sidecar.ps1` first.
- `dotnet test` exits `0` in `sim-bridge/` having discovered nothing. It is not
  a passing test run (`KI-004`).
- Git for Windows only. Do not drive this repository from WSL over `/mnt/c`.
