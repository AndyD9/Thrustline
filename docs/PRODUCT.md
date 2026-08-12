# Product

What this system is, for whom, and what it refuses to be.

Cap: **120 lines**. Read when the open milestone changes what is described here —
and once, in full, at the first session of anyone new to the repo.

**Nothing in this file can be derived from the code.** Every line was asked and
answered by `PacoRCS`, on 2026-08-12 unless another date is given, or carries the
ADR in which he answered it earlier.

---

## One sentence

Thrustline is a distributable Windows 11 desktop application for managing a
virtual airline in Microsoft Flight Simulator 2024, for a solo owner-operator.

## Who uses it

| User | What they are trying to do | What failure costs them |
| --- | --- | --- |
| Company owner | run one virtual airline — fleet, schedules, dispatch, finances — and fly its flights in MSFS 2024 | **data and money.** The ledger, fleet and flight history exist only server-side; there is no local copy and no export. A corrupted balance or a lost flight report is unrecoverable for them |

The single owner is the only human on a company (ADR-0001). Their failure costs
data, so **every boundary they touch is `maximum evidence`** in `VALIDATION.md`.
That is the whole reason the depth column reads the way it does.

## Priorities, in order

1. **Stability and recovery after error** — a simulator session is long and
   cannot be replayed. A crash that loses a flight in progress costs the user
   hours they cannot get back, which no later correctness makes up for.
2. **Security of a distributed, modifiable client** — the app, the sidecar and
   MSFS all run on the user's machine and can all be edited. Anything the client
   is trusted with is effectively public.
3. **Economy and data integrity** — money, ownership and progression are the
   product. A wrong balance is worse than a missing feature, and unlike a crash
   it can go unnoticed for weeks.
4. **MSFS and SimConnect compatibility** — the simulator is a moving target the
   project does not control; breaking with it makes the product useless even
   when every test passes.
5. **Maintainability.**

Given two equally correct options, the one serving the higher priority wins,
even if it costs more. Where an option is more reliable *and* more secure than
the alternative, take it — that is the owner's standing instruction, and it is
what settles version and dependency arbitrations.

## What it is not

Each line prevents a class of feature request and a class of accidental
architecture.

- **Not a multi-pilot virtual airline.** No members, roles beyond `owner`,
  invitations, membership requests, exclusion, suspension, or ownership
  transfer. No user belongs to more than one company — ADR-0001.
- **Not a shared or real-time collaborative workspace.** No second human may
  prepare or fly for a company — ADR-0001.
- **Not cross-platform.** Windows 11 x64 only: no Windows 10, no ARM64, no
  Windows Server, no Wine or Proton — ADR-0003.
- **Not compatible with older or console simulators.** MSFS 2024 only: no MSFS
  2020, no Xbox, Cloud or PlayStation — SimConnect is not reachable there —
  ADR-0003.
- **Not an Electron application.** No embedded Chromium or Node runtime —
  ADR-0004.
- **Not a simulator modification.** It never patches MSFS, and never bypasses an
  ACL, DRM or session boundary — ADR-0003.

## Constraints that are not technical

None recorded. Asked 2026-08-12: no regulation, contract, deadline or platform
policy constrains the work. Revisit before any public distribution — store
policy and code-signing obligations arrive with it.

## What "working" looks like

The owner can complete the full path, unattended, without losing state:
sign in → own one company → acquire and view a fleet → create a dispatch and
prepare the flight → connect to MSFS and have phases tracked deterministically →
survive a disconnection or crash mid-flight → get a report and close the flight
exactly once → see an authoritative ledger entry that matches it.

Signals it has stopped working: a flight that cannot be closed, a balance that
disagrees with its flight history, a session that loses telemetry silently
rather than reporting the loss, or an update that resets user data.

## Open product questions

A question listed here is a legitimate reason for a unit to sit in `Draft`.

| Question | Blocks | Asked on |
| --- | --- | --- |
| Which capabilities are genuinely shipped and merged, and by what evidence? Nothing user-facing is currently proven. | `CURRENT_STATE.md`, every unit that assumes a working baseline | 2026-08-12 |
| Does the hardening happen in this repository, or in a new one seeded from this codebase? The owner is undecided. | repository strategy, ADR-0005 | 2026-08-12 |
| Which of the four manifests is the single source of the version number? | the version reset to `0.0.1-alpha` | 2026-08-12 |
| What is the account-deletion and data-retention policy? No irreversible deletion may be implemented before it exists. | any account-deletion unit | ADR-0001, 2026-07-24 |
| Which MSFS 2024 channel — Microsoft Store or Steam — gets validated first? Only one machine is available, and a proof on one channel does not carry to the other. | `KI-011`, the SimConnect slice | ADR-0003, 2026-07-26 |
