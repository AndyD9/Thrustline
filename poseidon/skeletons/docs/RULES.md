# Invariants by boundary

Canonical source of accepted invariants. Read **the section for the boundary you
touch**, never the whole file.

Cap: **300 lines**. A new invariant replaces or condenses another. That is the
mechanism that keeps this file readable.

## Section index — jump straight to yours

| You are touching | Section |
| --- | --- |
| schema, migrations, persistence | [Data](#data-and-persistence) |
| authoritative server logic | [Authoritative service](#authoritative-service) |
| HTTP / RPC handlers, auth | [Authenticated boundary](#authenticated-boundary) |
| UI, client state, rendering | [Client](#client) |
| CI config, dependencies, lockfiles | [CI and supply chain](#ci-and-supply-chain) |
| packaging, publishing, releases | [Distribution](#distribution) |
| telemetry, personal data | [Privacy](#privacy) |
| tooling that already bit us once | [Known traps](#rules-from-defects-already-encountered) |

## How to write a line

One line per invariant, never a paragraph. Four columns:

| Column | Content |
| --- | --- |
| `#` | Stable identifier, prefixed by boundary: `D1`, `S3`, `C2`. Never reused. |
| Invariant | A **refusal**, negative or imperative. One line. |
| Check | The command or test that enforces it. `manual` if none — that is a debt. |
| Proven by | The unit that established it. **A citation, not a title.** |

Forbidden in this file: a heading containing a unit identifier; the narrative of
what a unit proved; any restatement of a Completion Report. Evidence lives in the
unit; here it is cited. A check enforces this.

An invariant with no automated check that could have one is unfinished: open a
bounded unit for the script or test rather than keeping a manual instruction.

## Lifecycle of an invariant

A new or modified invariant states the asset protected, the trust boundary, the
abuse refused, the expected check, and — if it depends on a tool or a version —
its revalidation condition.

An agent never creates an exception alone. Every exception is approved by
`<Owner>`, bounded to one unit and one surface, carries a residual risk and a
deadline. An exception with no deadline is an abandoned rule.

---

The sections below are a skeleton. Replace the boundaries with the real system's
— they are read off the architecture, not off the history. A boundary is a place
where trust changes.

## Data and persistence

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| D1 | <e.g. migrations are append-only; no destructive redefinition> | `<command>` | <unit> |
| D2 | <e.g. every sensitive command is transactional and idempotent> | `<command>` | <unit> |
| D3 | <e.g. every schema change proves isolation between distinct rights holders and anonymous> | `<command>` | <unit> |

## Authoritative service

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| S1 | <e.g. caller identity is derived from the token, never taken from the request body> | `<command>` | <unit> |
| S2 | <e.g. no server secret is readable by a client> | `<command>` | <unit> |

## Authenticated boundary

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| F1 | <e.g. request body bounded to <N> KiB> | `<command>` | <unit> |
| F2 | <e.g. response allow-listed, versioned, not cached> | `<command>` | <unit> |
| F3 | <e.g. every input validated before any side effect> | `<command>` | <unit> |

## Client

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| C1 | <e.g. no business rule and no authority decision on the client> | `<command>` | <unit> |
| C2 | <e.g. content security policy per channel, no remote source> | `<command>` | <unit> |

## CI and supply chain

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| I1 | <e.g. exact versions and lockfiles from the repo, nothing floating> | `<command>` | <unit> |
| I2 | <e.g. no secret exposed to a job triggered from an external contribution> | `<command>` | <unit> |

## Distribution

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| P1 | <e.g. no artifact published without verifiable provenance> | `<command>` | <unit> |

## Privacy

| # | Invariant | Check | Proven by |
| --- | --- | --- | --- |
| V1 | <e.g. collection off by default; explicit consent for diagnostics> | `<command>` | <unit> |
| V2 | <e.g. no real data until <condition> is lifted> | `<command>` | <unit> |

## Rules from defects already encountered

A special section: it describes not a system boundary but a tooling trap,
promoted from `LEARNINGS.md` after two independent occurrences or one
deterministic reproduction. Same format, same cap.

| # | Trap | What to do instead | Promoted from |
| --- | --- | --- | --- |
| L1 | <observable symptom> | <the behaviour that avoids it> | <LC-YYYY-NNN> |

A line here is **removed** as soon as a check makes the trap impossible. This is
the only place in the file whose goal is to shrink.
