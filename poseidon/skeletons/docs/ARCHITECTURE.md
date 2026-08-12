# Architecture

The shape of the system, and **where trust changes**.

Cap: **150 lines**. Read the `Boundaries` table when opening a unit; read the
rest only when the open milestone changes what it describes.

Unlike `PRODUCT.md`, almost everything here **is** derivable from the code, and
therefore must be: every row carries the file it was read from. A row with no
evidence is a belief, and beliefs are what this kit exists to remove.

---

## Boundaries

**This table is the spine of the repository.** Each row here is a section of
`docs/RULES.md` and a row of `docs/VALIDATION.md`. A boundary is a place where
trust changes — not a folder, not a layer, not a team.

A check enforces the correspondence: a boundary listed here with no matching
section in `RULES.md` fails.

| Boundary | Trust changes how | Enforced in | Read from |
| --- | --- | --- | --- |
| <Data and persistence> | <untrusted input becomes durable state> | <path> | <file that proves it> |
| <Authoritative service> | <a request becomes an authorised decision> | <path> | <file> |
| <Authenticated boundary> | <an anonymous caller becomes an identified one> | <path> | <file> |
| <Client> | <server truth becomes untrusted display> | <path> | <file> |

If two rows are enforced in the same place, they are one boundary. If one row is
enforced in four places, it is not yet a boundary — it is a convention, and it
will be broken.

## Components

| Component | Responsibility | Depends on | Read from |
| --- | --- | --- | --- |
| <name> | <one line> | <components, not libraries> | <manifest or entry point> |

## What is authoritative over what

<The single most important paragraph for an agent. Which component decides, and
which components merely display or cache. Name what must never be trusted from
the client, and what the server never derives from a request body.>

## Data flow of the main path

<Three to eight steps, the request that matters most, from entry to durable
state and back. Name the boundary crossed at each step, using the names in the
table above — not new ones.>

1. <step> — crosses <boundary>
2. <step>

## State that outlives a request

<Database, cache, queue, filesystem, third-party store. For each: who writes it,
who may read it, and what happens when it is lost. The last column is the one
people skip and then regret.>

| Store | Written by | Read by | If lost |
| --- | --- | --- | --- |
| <name> | <component> | <components> | <consequence> |

## Deliberate architectural constraints

<Decisions already made that a unit may not quietly undo, each pointing at its
record in `docs/decisions/`. Changing one of these requires a superseding ADR,
never a pull request that happens to include it.>

- <constraint> — ADR-NNNN

## Known structural debt

<Where the real structure disagrees with this document, with the entry in
`KNOWN_ISSUES.md` that tracks it. Writing the aspiration here instead of the
reality is how an architecture document becomes fiction.>
