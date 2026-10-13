---
title: Backup and recovery
section: 07-operations
---

**This is a seed page.** It states what {{display}} holds, the constraints any
procedure has to respect, and the order a recovery must follow — all of which are
true on day zero and readable from the code. It does not contain a backup
procedure, because the template ships none.

What the app author adds, once the app has data worth losing:

- A backup schedule per store, with the retention each one needs.
- The recovery-point and recovery-time objectives the business will accept.
- Where dumps are written, how they are encrypted, and who can read them.
- Who is allowed to restore, and how a restore is authorised.
- A restore rehearsal, dated, with the elapsed time recorded.

Write each of those as a runbook in the runbooks page of this section, with a
trigger, numbered steps and a verification step, so the procedure can be
followed under pressure by someone who did not write it.

## What the template ships

Nothing. There is no backup script under `scripts/`, no scheduled workflow in
`.github/workflows/`, no volume declaration in any of the four compose files, and
no Neo4j, Redis or object-storage service to attach one to. Every store is
external in every environment. If a generated app is backed up today, something
outside this repository is doing it.

The one data-lifecycle script the repository does ship —
`apps/web/tests/scripts/e2e-db.mjs` — does the opposite: its `recreate` command
runs `DROP DATABASE ... IF EXISTS` followed by `CREATE DATABASE`. It is pointed
at `E2E_NEO4J_DATABASE`, and `.env.e2e.example` says in so many words never to
point that at a database you care about.

## What each store holds

| Store | Holds | If it is lost |
|---|---|---|
| Neo4j | Every entity, every relationship, every permission grant, the tenancy spine, and the `:Migration` nodes that record the schema version | Total loss. Nothing else can reconstruct it. |
| Object storage | The bytes of every uploaded file. Neo4j holds only the key | Total loss of file content. The graph still references keys that resolve to nothing. |
| Redis | BullMQ queue state, the response and element caches, websocket presence, distributed locks | Recoverable, with caveats — see below. |

The division matters because it sets three different backup requirements from
one application.

### Neo4j must be backed up

It is the system of record. A dump is the only artefact from which the
application can be rebuilt.

### Object storage must be backed up separately

The bucket holds the **only** copy of every uploaded byte. `S3Service` stores a
key in the graph and hands out a one-hour presigned URL at read time; it never
copies content into Neo4j. A Neo4j dump restored beside an empty bucket produces
an application whose every attachment, avatar and source document 404s — and the
graph gives no hint that anything is missing, because the keys are still there.

Nothing in this repository configures versioning, replication or a lifecycle
rule on the bucket. Whatever the provider does by default is what happens.

### Redis is safe to lose, but not free to lose

Caches are recomputable by definition; `CacheService` entries are responses that
can be produced again. Presence keys rebuild as clients reconnect.

Queue state is different. Redis holds the jobs BullMQ has accepted but not yet
finished. Losing it **drops every in-flight and queued job** — a document
enqueued for chunking, a queued email, a billing webhook waiting to be replayed.
The api that enqueued them already returned 2xx, so nothing retries and nothing
reports an error. Whether that is acceptable is an application decision, and it
is the decision that determines whether Redis needs persistence at all.

One related hazard belongs in the same paragraph: restoring a Redis dump into an
instance that another environment is already using, under the same
`REDIS_QUEUE` prefix, hands that environment's workers a foreign backlog. The
data-stores page explains the prefix; a restore must preserve it exactly.

## The constraint that shapes a Neo4j procedure

**A Neo4j store file never shrinks when data is deleted.** Deleting nodes frees
space inside the store for reuse, but the file on disk stays the size it reached
at its high-water mark. An application that ingests and prunes in cycles — the
chunk pipeline is one — grows a store far larger than its live data.

The only way to reclaim that space is a **dump and load**: dump the database,
drop it, and load the dump back into a fresh store. The dump reads live data
only, so the reloaded store is sized to what is actually there. This is the same
operation as a backup and a restore, which is why compaction and disaster
recovery end up being one procedure with two motivations — and why the
procedure's cost is worth measuring before it is needed.

Two operational notes follow from it, both for the app author to confirm against
their own Neo4j edition and deployment:

- The dump-and-load window is downtime for that database, so the procedure needs
  a maintenance slot, not just a cron entry.
- Whether the server can dump a running database, and what the tooling is
  called, differs between Neo4j editions and distributions. Verify it against
  the server actually deployed rather than against a general guide.

## Recovery order

Bring the stores up first, then the application — and within the application,
**the worker before the api**.

1. **Neo4j**, restored and reachable at `NEO4J_URI`, with the database named by
   `NEO4J_DATABASE` present.
2. **Object storage**, restored and reachable, with the bucket named by
   `S3_BUCKET` present. Restore it before the app serves traffic, or users see
   broken files and may re-upload duplicates.
3. **Redis**, reachable. It does not have to be restored — an empty Redis is a
   valid starting state — but it must exist, because `RedisHealthIndicator`
   backs `/health/ready`.
4. **The worker**, alone. Wait for it.
5. **The api** and **the web app**.

### Why the worker first

Two reasons, both of which only bite on a database that is not already at the
current schema — which is exactly the situation a restore creates.

- **The worker owns the migrator.** `MigratorService` is registered through
  `createWorkerProvider`, so only `--mode=worker` applies
  `apps/api/src/neo4j.migrations`. An api started first against a restored-but-
  stale database runs against a schema nobody has brought forward.
- **Both processes race on index creation.** Every repository creates its
  constraints and fulltext indexes in `onModuleInit`, and
  `AbstractRepository` does it with a check-then-create: `SHOW INDEXES`, compare,
  create if absent. Start the api and the worker together against a database
  missing an index and both see it missing, both issue the create, and one dies
  with "An equivalent index already exists". The failure is intermittent.

`scripts/e2e.sh` encodes exactly this ordering for the same reason, and is the
closest thing in the repository to a worked example: it starts the worker alone,
polls `apps/web/tests/scripts/e2e-db.mjs check` until every migration has landed,
and only then starts the api and the web app.

Readiness signal: with no worker health port opened by the template, the
migration count is the signal. `e2e-db.mjs check` compares `:Migration` node
count against the number of files in `apps/api/src/neo4j.migrations`.

## What a restore must do about the `:Migration` nodes

The `:Migration` nodes are inside the dump. Restoring a database restores its
schema version along with its data, and `MigratorService` reads that version on
the next worker boot:

- `getLastAppliedMigration()` takes the newest `:Migration` node, ordered by
  `versionDate` then `versionIncrement`.
- `filterMigrationsToRun()` keeps only files whose version compares greater.
- Each applied file gets a new `:Migration` node with `version`, `versionDate`
  and `versionIncrement`.

Three cases, and what each requires of the operator:

| Situation | What the migrator does | What you must do |
|---|---|---|
| Dump is **older** than the deployed code | Applies the missing migrations on the next worker boot | Nothing. Let the worker finish before starting the api. |
| Dump is **newer** than the deployed code (a rollback) | Nothing — every file compares less than the recorded version | Decide deliberately. The schema is ahead of the code, and the migrator will not walk it back. There is no down-migration in this framework. |
| `:Migration` nodes **missing** from the restore | Re-runs every migration from the beginning | Usually safe: the four shipped migrations are all `MERGE` on fixed ids with `ON CREATE`/`ON MATCH` branches, so re-running them converges rather than duplicating. Confirm the same is true of every migration the app has added — a migration that `CREATE`s rather than `MERGE`s will duplicate. |

Two constraints protect the bookkeeping itself: `:Migration.version` is unique,
and `(versionDate, versionIncrement)` is unique as a pair. Both are created by
the migrator before it does anything else. A partial restore that leaves
duplicate `:Migration` nodes behind will fail against them.

The practical rule: **never restore a Neo4j dump into a database that another
environment's worker is pointed at.** Two workers reconciling two schema states
against one database is not a situation the version comparison can resolve.

## A shape for the app's own procedure

Write one document per store. Each needs to answer these, and the answers belong
in the document rather than in someone's memory:

**Scope**
- Which store, which environment, which database or bucket name.

**Objectives**
- Recovery point: how much data may be lost, in minutes or hours. This sets the
  backup frequency.
- Recovery time: how long a full restore may take. This is measured, not
  estimated — measure it in a rehearsal.

**Backup**
- What produces the artefact, on what schedule, triggered by what.
- Where it is written, and whether that location survives the loss of the
  primary.
- How long copies are kept, and what deletes the old ones.
- Whether the artefact is encrypted at rest, and where that key lives — the
  secrets page in this section covers key handling.

**Restore**
- The numbered steps, ending with the recovery order above.
- Who is authorised to run them, and how that authorisation is obtained.
- The verification step: what query, request or file listing proves the restore
  worked. For Neo4j, the `:Migration` count and a known-entity lookup; for the
  bucket, fetching one known key through the application rather than through the
  provider console.

**Rehearsal**
- Date of the last full restore into a scratch environment, and the elapsed
  time. An untested backup is an assumption.

## Where to look

| File | What it gives you |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts` | The `:Migration` contract, the version comparison, and the two uniqueness constraints. |
| `apps/api/src/neo4j.migrations` | The four migrations a restored-empty database receives. |
| `apps/api/src/neo4j.migrations/queries/migration.queries.ts` | The `MERGE`-on-fixed-id shape that makes a re-run idempotent. |
| `scripts/e2e.sh` | A worked example of worker-first startup, and why. |
| `apps/web/tests/scripts/e2e-db.mjs` | `recreate` (destructive) and `check` (the readiness signal). |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | The check-then-create that makes concurrent boot unsafe. |
| `packages/nestjs-neo4jsonapi/src/foundations/s3/services/s3.service.ts` | Why the bucket holds the only copy. |
| `packages/nestjs-neo4jsonapi/src/core/cache/services/cache.service.ts` | Which Redis keys are disposable and how they are namespaced. |
| `packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts` | What `/health/ready` requires before traffic is routed. |
| `.env.example` | The connection variables a restored environment must be given. |

## Gaps and drift

- The template ships no backup script, no scheduled backup workflow and no
  volume declaration. This page states the constraints; it does not document a
  procedure, because there is none to document.
- The worker exposes no health endpoint, because `apps/api/src/main.ts` does not
  pass `worker.healthCheckPort`. During a recovery the only readiness signal for
  step 4 is the `:Migration` node count.
- This framework has no down-migration mechanism. Rolling the code back behind a
  restored schema is a decision with no automated support.
- Not examined: the Neo4j edition, server version or deployment topology any
  given app runs, and therefore the exact dump and load commands available to
  it. Verify those against the running server.
- Not examined: object-storage provider features — versioning, cross-region
  replication, object lock. None is configured here, and all of them change what
  a backup procedure needs to do.
