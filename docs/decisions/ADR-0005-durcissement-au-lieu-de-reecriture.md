# ADR-0005 — Harden the existing application instead of rewriting it

Date: 2026-08-12
Status: Accepted — PacoRCS, 2026-08-12
Decider: PacoRCS
Supersedes: ADR-0002

## Context

ADR-0002 (accepted 2026-07) decided a complete rewrite in a **new repository
with fresh Git history**, treating the current repository as a read-only
reference, building a new Supabase project and a new schema, and discarding
current data as disposable.

Two things are true now that were not then.

**The rewrite was never executed as written.** This is still the original
repository: 171 commits, first commit `205e422`. The Electron and WPF code was
moved into `legacy/` by `fc3316d` and the Tauri app was scaffolded in place by
`9feb47c`. What happened was directory isolation inside one repository, not a
new repository with fresh history.

**The owner's assessment of the existing application has changed.** On
2026-08-12 he states that the current version works, that every feature must be
kept, and that the work he wants is correcting the code: best practices, smaller
and more readable files, better reliability, and added security.

A rewrite discards working behaviour that nobody has characterised — the risk
already recorded as `KI-008`. With the owner reporting the application as
working, that risk no longer buys anything.

## Options

| Option | What it gives | What it costs |
| --- | --- | --- |
| A — Execute ADR-0002 as written: rewrite in a new repository | A clean schema and history; no legacy compromise | Discards working, uncharacterised behaviour (`KI-008`); months before parity; contradicts the owner's stated goal |
| B — Harden the existing codebase in place | Keeps every working feature; each improvement is independently verifiable; risk is bounded per unit | Carries existing structural debt (`KI-001`, `KI-005`); no clean-slate moment |
| C — Harden the codebase, then move it to a fresh repository | Same as B, plus a clean history at the end | The move itself is work and risk; a premature move loses the history that explains the code |

## Decision

**Thrustline is hardened in place, not rewritten.** Every existing feature is
preserved; the work is code quality, file size and readability, reliability, and
security, applied boundary by boundary as bounded units.

Where two options are otherwise equivalent, the more reliable and more secure
one is taken — including for runtime and dependency versions. Outdated
dependencies are treated as a security concern, not a cosmetic one.

Whether the hardened codebase later moves to a fresh repository (option C) is
**deliberately left open** and does not block any unit. `docs/`, `AGENTS.md` and
`poseidon/` travel intact if it happens.

## Consequences

- **Makes possible.** Incremental, individually verifiable improvement with no
  parity gap and no cutover. `legacy/` stays read-only reference material.
  ADR-0001 (solo ownership), ADR-0003 (Windows 11 + MSFS 2024) and the product
  scope are unaffected.
- **Makes impossible or expensive.** No clean-slate schema. Existing structural
  debt is inherited and must be paid down unit by unit rather than skipped.
  Migrations stay append-only against the current schema — the freedom ADR-0002
  granted to start over is withdrawn.
- **ADR-0004 needs re-examination, not repeal.** Its stack pins were chosen for
  a greenfield build. Under hardening they become an **upgrade path**, and each
  step needs its own unit and evidence: .NET 8 → 10 (support ends November
  2026), React 18 → 19, TypeScript 5.9 → 7, npm → pnpm, and adding the missing
  `rust-toolchain.toml`. Whether every pin is still the right target is a
  separate decision. Tracked as `KI-017`.
- **What must change now.** `ARCHITECTURE.md` records ADR-0002 as superseded;
  `CURRENT_STATE.md` names the hardening milestone; `KI-008` and `KI-016` close
  when this ADR is accepted. No new invariant in `RULES.md` follows directly
  from this decision.

## Revalidation

Re-examine if a hardening unit shows a boundary cannot be made safe without a
structural change larger than the boundary itself — that is the evidence that
would reopen the rewrite question. Otherwise this holds until the product scope
changes.
