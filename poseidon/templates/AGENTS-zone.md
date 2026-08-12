# AGENTS.md — zone `<path/to/zone>`

Place at the root of the zone, not in `docs/`. Agents read the file nearest the
code they touch. This file **completes** the root `AGENTS.md`; it never repeats
it and never contradicts it.

Cap: **50 lines**, enforced by a check. Beyond that, either the zone must be
split, or a rule actually belongs in `docs/RULES.md`.

Create a zone only when all three hold: it is worked regularly, it has rules that
apply to it alone, and an agent ignoring them produces a real defect. Three to
six zones are enough for a large repository.

---

## What this zone does

<Two lines. Its role, and the trust boundary it lives in — authoritative server
side, untrusted client side, isolated process.>

## Never do this here

<The refusals specific to this zone — the ones a competent but new agent would
break. Three to six lines.>

- <e.g. no business rule in a page component; it lives in <layer>>
- <e.g. no direct network call; go through <adapter>>
- <e.g. no filesystem access outside <directory>>

## Local conventions

<Naming, file splitting, test locations, generators to use. Only what cannot be
inferred by reading two neighbouring files.>

## Validate this zone

```
<type-check command>
<targeted test command>
<build command>
```

Boundary checks are in `docs/VALIDATION.md`.

## Known traps

<What has already cost time here. One trap per line, with its observable
symptom. Delete a line as soon as a check makes the trap impossible — that is
the point.>
