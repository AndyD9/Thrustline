# FXXXX — <Capability, stated from the user's point of view>

Status: Draft
Branch: `feature/fxxxx-slug`
Risk: Low
Security-sensitive: No

`Risk` and `Security-sensitive` are the **defaults for the milestones**; a
milestone that redeclares them wins. They set review depth, judged where the risk
exists — a sensitive-data change and a read-only panel do not earn the same
attention. Work with no user capability — governance, a fix, tooling — uses this
same file with **a single milestone**.

## Goal

One observable user outcome. If the goal needs an "and" between two distinct
capabilities, that is two units.

## Context

Why this capability exists, what is **actually present** on the main branch, and
the useful links.

## Dependencies

- <Units, decisions, or prerequisites required.>
- Name explicitly any missing `<Owner>` decision, hardware, or human
  verification: that is what keeps the unit out of `Ready`.

## Allowed areas

- <Union of the paths writable across all milestones.>

## Do not touch

- <Explicitly excluded areas.>

## Non-goals

- <Neighbouring capabilities deliberately excluded, and the unit that will carry
  them.>

## Milestones

Ordered. One milestone = one commit = one primary boundary = one review. The
first milestone that is not `Done` is the only open one.

### J1 — <milestone result>

Status: Draft
Risk: Low
Security-sensitive: No

- result: <observable behaviour once this milestone is committed>
- boundary: <the primary boundary touched>
- validations: <exact commands that prove this milestone>
- review: <what the adversarial review must look for first>
- manual check: <5 to 10 minutes>

### J2 — <milestone result>

Same structure. Two to five milestones; beyond that, these are two units.

## Acceptance criteria

- [ ] <Criterion observable over the whole capability.>
- [ ] <Relevant error or limit covered.>
- [ ] <Documentation synchronised if needed.>

## Review

Fill only if a milestone carries `Security-sensitive: Yes`, or if the unit
creates debt. Name the milestones concerned.

- asset protected, boundary, abuse refused:
- validation, authorisation, atomicity, idempotence, logs:
- debt created, manual check to automate:
- residual risk or approved exception, with its deadline:

## Rollback

How to abandon the capability without data loss, and up to which milestone a
partial rollback stays coherent.

## Completion Report

**This is where the project's evidence lives.** Rules documents cite it; they do
not copy it. One block per milestone, filled at the moment it is committed.

### J1

- result obtained:
- files changed:
- commands and real results:
- commit: <the pushed SHA — `/review` uses the previous milestone's as its base>
- manual verification:
- review findings addressed:

### Summary

- risks and limits:
- follow-ups recorded:
- documentation updated:
