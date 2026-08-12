# POSEIDON — agent-driven development method

Extract at the root of a repository — empty or already large — then say
**`lance poseidon`** in Claude Code. That is the whole installation.

Two layers, and they never mix:

- **`poseidon/` is the method.** Replaceable as one block; upgrading is
  replacing the folder. Nothing in it is project-specific.
- **`docs/` and `AGENTS.md` are your project.** Written once by `/bootstrap`,
  owned by the repo, never touched by an upgrade.

Extraction places `poseidon/` and two files under `.claude/` — nothing else, so
it cannot touch your `README.md`, your commands, or anything you already have.
Everything after that, the agent does with its own file tools: there is no
script, no build step, and nothing to install.

This README is the only file written for a **human**. Everything else is written
for an **agent**, in the imperative, and is kept as short as the rule allows.
That separation is the point: an agent reading three paragraphs of justification
has to infer the action, and a fraction of the time it infers the wrong one.

## The principle, in one sentence

> **Documentation is indexed by durable boundary — never by ticket. A ticket's
> identifier is a citation, never a title.**

A system's boundaries are bounded and knowable: database, authenticated API,
client, side processes, CI, distribution. Its tickets are not. Documentation
indexed by ticket grows without limit and nobody ever dares remove a line,
because a section titled `## Evidence T0032` looks like the evidence itself.

It is not. The evidence lives in the ticket's Completion Report — already
written, already versioned, already dated. Rules documents **cite** it. That one
change divides the volume by four and loses nothing.

## The second principle: one state, one command

Everything above governs what is *written*. This governs what an agent *does*.

At any moment the agent is in exactly one state of exactly one unit of work, and
that state is **two literal fields**: the unit's `Status:` and the open
milestone's `Status:`. `poseidon/POSEIDON.md` reads those two fields at
the start of every session and routes to the single command that applies.
Nothing is inferred from what the code looks like, and exactly one router row
ever matches — if none does, the agent halts instead of guessing.

That is what stops a session from touching four unrelated things. A set of
excellent principles, with no trigger and no router, will not.

One detail carries more weight than its size suggests: `/verify` writes
`Verified`, and only `/close` writes `Done`. If the two were merged, a session
ending between verification and closing would leave the milestone `Done` — and
the next session's router would skip straight past the Completion Report, the
state update, and the registries, silently, forever.

## Target tree

Every file carries a line cap enforced by an automated check, and a moment at
which it is read. An agent never opens a document "for context".

| In the target repo | Cap | When it is read |
| --- | --- | --- |
| `AGENTS.md` | 115 | always |
| `<zone>/AGENTS.md` | 50 | if the task touches the zone |
| `docs/CURRENT_STATE.md` | 200 | always |
| `docs/WORKFLOW.md` | 165 | at a unit's first milestone |
| `docs/RULES.md` | 300 | **one section**, per boundary touched |
| `docs/VALIDATION.md` | 130 | **one row**, before validating |
| `docs/KNOWN_ISSUES.md` | — | opening and closing a unit |
| `docs/LEARNINGS.md` | — | when a learning is a candidate |
| `docs/features/README.md` | **generated** | never in full |
| `poseidon/templates/FEATURE.md` | 105 | when creating a unit |
| `poseidon/templates/ADR.md` | 45 | for a structuring decision |
| `docs/ARCHITECTURE.md` | 150 | the `Boundaries` table, opening a unit |
| `docs/PRODUCT.md` | 120 | when the milestone changes what it describes |
| `docs/SETUP.md` | 100 | when a prerequisite is missing |
| `poseidon/` | — | routed, every session |
| `.claude/commands/*.md` | — | one per phase, on invocation |
| `poseidon/checks/check.py` | — | in CI, blocking |

**One unit format.** A user capability, a fix, a tool, or a check all use the
same file; what distinguishes them is the number of milestones, not the
template. A second format would mean a second index, a second set of rules, and
one more question at every creation.

`docs/decisions/` holds ADRs; it has no cap, because a superseded decision is
kept rather than condensed.

## What POSEIDON refuses

These choices are the method. Dropping them brings the complexity back within
weeks.

- **No document is titled by a ticket identifier.** Not `## Evidence T0032`, not
  `## Boundary T0023`. A check enforces this.
- **No evidence is written twice.** The Completion Report is the trace; rules
  cite it in a `Proven by` column.
- **No index is maintained by hand** where a script can produce it from the
  files themselves.
- **No global rule stacks.** A new rule in `AGENTS.md` replaces or condenses
  another. The cap is the mechanism.
- **No method document exceeds its cap.** An overrun is not a warning — it is a
  check failure that blocks integration.
- **No fourth attempt.** Three failed attempts at the same fix: revert, record,
  halt.

## Scaling to a large codebase

Three mechanisms, and only three.

1. **Nested `AGENTS.md`.** Agents read the file nearest the code. A task in
   `<zone>/` loads ~110 + ~40 lines, never the whole map. This is the only
   mechanism that does not degrade when the repo triples: you add zones, not
   lines to the root file.
2. **`Allowed areas` / `Do not touch` on every unit.** The agent never needs to
   understand the whole system, only its boundary. That is what makes a
   several-hundred-thousand-line codebase tractable by a two-day unit.
3. **Indexing by boundary.** `RULES.md` grows with the number of boundaries, not
   with history.

## Install

```
tar xzf poseidon.tar.gz -C /path/to/repo
```

Then say **`lance poseidon`**. The router sees `AGENTS.md` and `docs/` missing,
reports `NOT_INSTALLED`, and runs `/install` — the agent writes the project layer
itself, merging an existing `AGENTS.md` with judgement rather than refusing or
clobbering, identically on every OS.

Then **`/bootstrap`**, once. It audits the codebase for everything the code can prove (boundaries, the real
commands in the task runner and CI, pinned versions), asks in **one batch** for
everything it cannot (who this is for, the priority order, which incidents have
actually happened, who merges), and then writes `ARCHITECTURE.md`, `RULES.md`,
`VALIDATION.md`, `SETUP.md`, `PRODUCT.md`, `AGENTS.md`, and `CURRENT_STATE.md` —
in that order, because each one feeds the next. The boundary table it produces
becomes the section list of `RULES.md` and the row list of `VALIDATION.md`; a
check enforces that correspondence from then on.

Its one rule is **derive, or ask — never invent.** A codebase proves what it
does; it cannot prove who it is for or which trade-off wins. An answer guessed
during bootstrap is read as established fact by every session afterwards, and
nothing ever re-checks it. Unanswered questions are written as
`<unanswered — asked YYYY-MM-DD>` and keep surfacing, which is correct.

Then wire `python3 poseidon/checks/check.py --all` into CI as blocking, and run
`/locate`. It will tell you where you are.

## Adopting into a repository that already exists

Two things break on day one, and both are handled.

**Existing `AGENTS.md` / `CLAUDE.md`.** `/install` never overwrites; it reports
what it left in place and merges it into POSEIDON's structure, keeping every
existing rule. This matters more than it looks: until `AGENTS.md` carries POSEIDON's content, the
router never sees `<PROJECT>`, never routes to `/bootstrap`, and POSEIDON does
nothing at all — silently. `/install` will not finish with that unresolved.

**Existing `TODO`/`FIXME` debt.** A real codebase has hundreds. Failing all of
them on day one turns CI red and someone switches the checks off, which costs
more than the debt did. So `/install` runs `poseidon/checks/check.py --adopt`, which records
how many unregistered markers each file already carries. The check then blocks
**new** debt without demanding the old be cleared:

```
web/legacy.py: 13 unregistered markers, 1 more than the 12 grandfathered
```

It is a ratchet, not an exemption: it only ever tightens. Re-run `--adopt` after
a cleanup unit to lower the counts. A marker citing a `KI-`/`LC-` id that does
not exist is never grandfathered — that is a wrong reference, not debt.

The same idea applies to test baselines: record what each suite **actually
discovers today**, not what it should. A baseline taken from an already-broken
suite locks in the breakage.

Expect `/bootstrap`'s `CURRENT_STATE.md` step to be uncomfortable. Writing down
only what is merged and evidenced almost always reveals capabilities everyone
believed were shipped. That discomfort is the point of adopting it.

## The checks — the one optional dependency

POSEIDON is markdown you read and files you write. It needs no runtime and no
build step. Two exceptions, and they are not equivalent:

- **`git` is required.** The method exists to get proven work onto a branch and
  into a Pull Request. Without git there is nothing to route.
- **`python3` is optional, and buys determinism.**

`poseidon/checks/check.py` is stdlib-only. Nine groups: line caps, tracking
coherence, `CURRENT_STATE.md` drift, the generated unit index, the ban on
identifiers in headings, well-formed registers, orphan
`TODO`/`FIXME`/`HACK`/`XXX` markers, validation baselines, and the boundary
correspondence — every boundary in `ARCHITECTURE.md` must have its section in
`RULES.md`, or the rules have silently stopped covering part of the system.

Two rules govern all of them:

- **Fail closed.** An unreadable entry, a missing file, or an unknown argument
  makes a check fail, never pass.
- **Every check carries negative mutations.** `--self-test` builds a fixture
  tree, applies 35 mutations, and asserts each is caught **by the check it was
  written for** — not incidentally by a neighbour. A check with no negative
  mutation may have stopped checking anything while staying green, and that is
  invisible.

The self-test earned its keep during development. Requiring each mutation to be
caught by its *own* group immediately exposed a milestone parser counting
`### J1` headings inside the Completion Report as extra milestones — a bug a
laxer assertion had reported as passing.

### Why not have the agent do it

Because three things do not survive the substitution, and the method is built on
all three:

1. **CI has no agent.** The checks are supposed to *block integration*. Read by
   an agent, they become advice, and advice does not stop a merge.
2. **You cannot self-test by introspection.** `--self-test` proves the checks
   still catch what they claim to. Nothing an agent does about its own
   reliability is equivalent.
3. **Reproducibility.** A check that sometimes fires is worse than no check: it
   teaches people to re-run until green.

Cost matters too, in the other direction: `check.py --all` is roughly zero
tokens and under a second. Verifying nine groups by reading is thousands of
tokens at every close.

POSEIDON runs without it — `poseidon/references/checks-by-hand.md` is the agent
procedure — but then every report must state
`checks: agent mode — not deterministic, no CI gate`. Never silently.

## Deliberate variants

| Default | Alternative | What the alternative costs |
| --- | --- | --- |
| Cite the Completion Report | Archive narratives in `docs/archive/` | A safety net, at the price of files nobody re-reads |
| Generated unit index | Hand-maintained index | The ability to annotate a line, at the price of a whole class of drift and the reconciliation tickets it produces |
| Nested `AGENTS.md` | One root file | Simpler at first, untenable as soon as the repo has several active zones |
| A skill + commands | Docs alone | Nothing to install, at the price of the agent having to guess when to read what — which is the failure this version exists to fix |
| `check.py` for the checks | Agent reads and judges | No CI gate, no self-test, not reproducible — see below |

## POSEIDON keeps its own caps

Every file shipped here is within the cap it imposes. That claim is not a table
someone maintains by hand — this README refuses hand-maintained indexes above,
and a stale line-count table would be exactly one. It is checked:

```
python3 poseidon/checks/check.py --caps
```

`RULES.md`, `VALIDATION.md`, and `CURRENT_STATE.md` are skeletons: they fill up
and climb toward their caps. The rest are complete as they stand.

## What changed from the previous version

The content was not the problem; the absence of a trigger was.

| Change | Why |
| --- | --- |
| Added `poseidon/POSEIDON.md` | An entry point that locates the state and routes. Previously nothing told the agent when to read `WORKFLOW.md`. |
| Added 11 slash commands | One per phase. A phase described in prose is a phase the agent improvises. |
| Rationale moved into this README | ~60% of the old volume was justification addressed to a human. Agent-facing files are now imperative. |
| `CHECKS.md` → working `poseidon/checks/check.py` | POSEIDON itself said the method drifts within weeks without the checks. A specification is not a check. |
| Added `examples/F0001.md`, filled | Agents reproduce a worked example far more reliably than they apply a written rule. |
| Added the three-strike protocol | The old kit had no failure-recovery rule, so a stuck agent kept trying. |
| Added a section index to `RULES.md` | "Read one section" is only actionable if the agent can find the section without reading the file. |
| One language throughout | Field names were half French, half English; an agent hesitates over the name of a field it must write. |
| Split `Verified` from `Done` | So a session ending mid-close cannot skip the close forever. |
| `WORKFLOW.md` §3–6 cut to a pointer | They restated the commands. Under POSEIDON's own reading budget those lines were unreachable, and they were spending the 165-line cap. |
| Added `/bootstrap`, `PRODUCT.md`, `ARCHITECTURE.md`, `SETUP.md` | A freshly installed kit was a repo full of `<placeholders>` with nothing telling the agent to fill them — so the first session improvised, which is the exact failure POSEIDON exists to stop. |
| Added the boundary correspondence check | `ARCHITECTURE.md` naming a boundary that `RULES.md` does not cover means the rules stopped covering part of the system, silently. |
| Deleted `install.sh`, added `/install` | A shell script cannot merge an existing `AGENTS.md` with judgement, and fails outright on Windows without a POSIX shell. The agent can do both. |
| `python3` demoted to optional | POSEIDON now runs with no runtime at all — but agent mode is labelled `not deterministic, no CI gate` in every report, never silently. |
