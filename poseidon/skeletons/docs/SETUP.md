# Setup

How to get from a fresh clone to a running system, and back to a clean one.

Cap: **100 lines**. Read when a command in `VALIDATION.md` needs a prerequisite
you do not have.

Every command here is **copied from a file in the repo** — a manifest, a
task-runner file, a CI job — never from memory and never invented. The source is
named. A command that appears only here, in no file the toolchain reads, will be
wrong within a month and nobody will notice until it blocks someone.

---

## Prerequisites

| Tool | Version | Pinned by | Why exactly this version |
| --- | --- | --- | --- |
| <runtime> | <exact> | <lockfile, tool-version file, CI image> | <or `no reason recorded` — which is itself worth knowing> |

`no reason recorded` is a legitimate entry. An invented reason is not.

## From clone to running

```
<install dependencies>
<create local configuration from the committed example>
<start dependencies — database, queue, container runtime>
<run migrations>
<start the system>
```

Source: `<the file each command was read from>`.

## Configuration

| Variable | Required | Where the local value comes from | Read from |
| --- | --- | --- | --- |
| <NAME> | yes/no | <committed example file, secret manager, `<Owner>`> | <file> |

**No secret, token, personal datum, or environment file is ever committed or
logged.** If a value cannot be obtained without `<Owner>`, say so here rather
than leaving someone to guess — and never place a real value in this file.

## Back to a clean state

```
<stop everything>
<reset the database>
<clear caches and build artifacts>
```

The reset path matters more than the setup path: it is what makes a failed run
diagnosable instead of permanent. If there is no reset command, that is debt —
record it in `KNOWN_ISSUES.md`.

## Verify the setup worked

```
<the smallest command that proves the system is actually up>
```

Not "it started with no error". A command whose output would differ if the
system were broken.

## What cannot be run locally

<Hardware, a third-party service, a remote scheduler, a real device, a real
user. For each: who can run it, on which environment, and what a local
substitute does **not** prove. `VALIDATION.md` refers here rather than
restating it.>

## Traps

<What has cost someone an hour here. One line each, with the observable symptom.
Delete a line as soon as a check or a script makes the trap impossible.>
