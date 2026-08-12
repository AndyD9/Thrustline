# Product

What this system is, for whom, and what it refuses to be.

Cap: **120 lines**. Read when the open milestone changes what is described here —
and once, in full, at the first session of anyone new to the repo.

**Nothing in this file can be derived from the code.** A codebase can tell you
what it does; it cannot tell you who it is for, what it is allowed to become, or
which trade-off wins. Every line here was **asked** and answered by `<Owner>`, or
it is a guess wearing the costume of a fact. `/bootstrap` asks; it never infers.

---

## One sentence

<What it is, for whom, on which platform. If this needs two sentences, the
product is two products or the sentence is not finished.>

## Who uses it

| User | What they are trying to do | What failure costs them |
| --- | --- | --- |
| <role> | <the job they hired this for> | <time, money, trust, data> |

The third column decides review depth downstream. A user whose failure costs
data or money makes every boundary they touch `maximum evidence` in
`VALIDATION.md`.

## Priorities, in order

<The same ordered list as `AGENTS.md`. It lives there for the agent; here is
where the reasoning for the order is written.>

1. <priority 1> — <why it outranks the next one>
2. <priority 2> — <…>
3. <priority 3>
4. <priority 4>
5. maintainability

Given two equally correct options, the one serving the higher priority wins,
even if it costs more. This ordering is the single most-used line of the whole
kit: it settles arbitrations that would otherwise become questions.

## What it is not

<The neighbouring products this is deliberately not. Each line prevents a class
of feature request and a class of accidental architecture.>

- <not a …>
- <not a …>

## Constraints that are not technical

<Regulation, contract, deadline, platform policy, an agreement with a customer.
The things that make an otherwise correct solution unacceptable — and that no
amount of reading the code will reveal.>

## What "working" looks like

<The observable signals that the product is doing its job. Not metrics to
optimise — signals that would tell you it stopped working.>

## Open product questions

<Decisions `<Owner>` has not made yet, and which units they block. A question
listed here is a legitimate reason for a unit to sit in `Draft`.>

| Question | Blocks | Asked on |
| --- | --- | --- |
| <question> | <unit or roadmap phase> | <date> |
