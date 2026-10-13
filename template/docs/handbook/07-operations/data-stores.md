---
title: Data stores
section: 07-operations
---

{{display}} depends on three stores: Neo4j for everything the graph model holds,
Redis for queues and cache, and an S3-compatible bucket or Azure Blob container
for files.

**None of the three is provisioned by this repository.** No compose file defines
them, no script installs them, no volume is declared for any of them. Every
environment — local, end-to-end and production alike — points at something that
is already running. Provisioning, sizing and backing them up is work the app
author owns; the backup page in this section describes the shape of that work.

## Neo4j

### Connection

`Neo4jService` in
`packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` is the
only thing in the stack that opens a Neo4j driver. It reads the `neo4j` block
from the injected, merged config — so an app may override it in
`apps/api/src/config/config.ts` — and falls back to `baseConfig.neo4j`, which is
the raw environment. Its constructor throws if `NEO4J_URI` is empty, so a
misconfigured process dies at boot rather than at the first query.

| Key | Variable | `.env.example` default |
|---|---|---|
| `uri` | `NEO4J_URI` | `bolt://localhost:7687` |
| `username` | `NEO4J_USER` | `neo4j` |
| `password` | `NEO4J_PASSWORD` | `password` |
| `database` | `NEO4J_DATABASE` | `{{name}}` |

The database is named per environment. The e2e stack overrides it to
`{{name}}test`, which `apps/web/tests/scripts/e2e-db.mjs` drops and recreates on
every run.

### Driver settings

The driver is constructed once, in the service's constructor, with four explicit
options:

| Option | Value | Meaning |
|---|---|---|
| `maxConnectionPoolSize` | 500 | Upper bound on concurrent sessions per process. |
| `connectionAcquisitionTimeout` | 20 000 ms | How long a query waits for a free pool slot. |
| `connectionTimeout` | 20 000 ms | TCP/handshake timeout. |
| `maxTransactionRetryTime` | 15 000 ms | How long the driver retries a retriable transaction. |

Driver log output at `info` level is routed into `AppLoggingService`, so it
appears in the same stream as the application's own logs.

The service also carries `computePaginationTotal`. When an app sets it to
`false`, `readMany` skips the extra `COUNT` query that `{CURSOR}` pagination
otherwise issues — that count query has no `LIMIT`, so it walks every
`OPTIONAL MATCH` across all rows. It defaults to true.

The api and the worker each open their own driver and their own pool. Two
processes means two pools of up to 500 connections; that number is the one to
revisit before adding worker replicas.

### What lives in it

Everything the application knows. The graph carries the tenancy spine —
`:Company`, `:User`, `:Role`, membership edges — and one labelled node type per
entity declared by the 43 foundation modules the framework packages ship, plus
whatever the app declares itself. There is no second database, no relational
store and no document store.

Two structural details shape every query:

- **Company scoping is injected, not written by hand.** `initQuery()` reads
  `companyId` and `userId` out of the CLS context and prepends the `MATCH`
  clauses that bind them. A repository that builds its own `MATCH` without
  `buildDefaultMatch()` has no tenant filter.
- **Pagination is cursor-based.** Queries use the `{CURSOR}` placeholder rather
  than `SKIP`/`LIMIT`.

### Constraints and indexes

They are created in two places, both at boot.

**By every repository, in `onModuleInit`.** `AbstractRepository` in
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts`
reads its entity descriptor and issues, for each declared constraint,
`CREATE CONSTRAINT <nodeName>_<property> IF NOT EXISTS FOR (n:<Label>) REQUIRE
n.<property> IS UNIQUE`. For each declared `FULLTEXT` index it first runs
`SHOW INDEXES` and compares the existing labels and properties, creating the
index only when it is absent or does not match. That check-then-create is a
time-of-check/time-of-use race: if the api and the worker bootstrap
simultaneously against a fresh database, both see no index and both create it,
and one process dies with "An equivalent index already exists". This is exactly
why `scripts/e2e.sh` boots the worker alone first and waits.

**By the migrator, worker-only.** `MigratorService` creates two constraints of
its own before anything else — uniqueness on `:Migration.version`, and a
composite uniqueness on `(:Migration.versionDate, :Migration.versionIncrement)`
— then discovers the migration files, compares them against the newest applied
`:Migration` node, and runs what is missing. `apps/api/src/neo4j.migrations`
ships four files, seeding roles, features, permission grants and the
administrator account. Each applied migration leaves a `:Migration` node behind;
that node set *is* the schema version.

The migrator is registered through `createWorkerProvider`, so only
`--mode=worker` ever runs it.

### Inspecting it

Neo4j Browser or `cypher-shell` against `NEO4J_URI`, using the database named by
`NEO4J_DATABASE`. Useful starting points:

```cypher
SHOW CONSTRAINTS;
SHOW INDEXES;
MATCH (m:Migration) RETURN m.version ORDER BY m.versionDate DESC, m.versionIncrement DESC;
CALL db.labels();
CALL db.relationshipTypes();
```

The migration count is the same signal `apps/web/tests/scripts/e2e-db.mjs check`
uses to decide whether the e2e worker has finished.

### Health

`Neo4jHealthIndicator` runs `RETURN 1` with a 3-second timeout. It backs both
`GET /health` and `GET /health/ready`, so a Neo4j outage takes the api out of the
load balancer's rotation.

## Redis

### Connection

Three separate `ioredis` clients are opened in an api process, all from the same
four configuration values: `RedisClientStorageService` (websocket presence and
distributed locks), `CacheService`, and BullMQ through `QueueModule`.

| Key | Variable | `.env.example` default |
|---|---|---|
| `host` | `REDIS_HOST` | `localhost` |
| `port` | `REDIS_PORT` | `6379` |
| `username` | `REDIS_USERNAME` | empty |
| `password` | `REDIS_PASSWORD` | empty |
| `queue` | `REDIS_QUEUE` | `{{name}}` |

### The queue prefix

`REDIS_QUEUE` is not only BullMQ's key prefix. It namespaces three key spaces:

| Key space | Owner | Shape |
|---|---|---|
| BullMQ jobs | `QueueModule` | `prefix: <REDIS_QUEUE>` |
| Response cache | `CacheService` | `<REDIS_QUEUE>:api_cache:…` |
| Element cache | `CacheService` | `<REDIS_QUEUE>:element:…` |
| Websocket presence and locks | `RedisClientStorageService` | `<REDIS_QUEUE>:ws_client:`, `:user_clients:`, `:company_users:` |

`CacheService` falls back to the bare `api_cache:` and `element:` prefixes when
`REDIS_QUEUE` is unset, so an app that never set it keeps its old key layout.
`baseConfig` defaults the value to `default`, which is shared with anything else
on the instance that did the same.

**Two environments must never share a prefix.** The consequences are concrete
and all silent:

- Two stacks' workers consume the *same* BullMQ queues. A job enqueued by one is
  executed by the other, against the other's Neo4j database. The enqueuing
  endpoint returns 2xx immediately, so the failure surfaces later and looks like
  a bug in the code under test.
- Cached responses are keyed by user id. On a seeded e2e stack the ids collide
  with the dev stack by construction, so one stack reads the other's cached
  bodies.
- The pattern invalidators call `redis.keys("element:*")` and
  `keys("api_cache:*")`. Unprefixed, one stack's invalidation deletes another's
  entries.

`scripts/e2e.sh` and `.env.e2e.example` both carry this warning; the e2e stack
uses `{{name}}e2e`.

### Queues

`QueueId` in `packages/nestjs-neo4jsonapi/src/config/enums/queue.id.ts` declares
nine ids — `chunk`, `company`, `company-deletion`, `community-summariser`,
`billing-webhook`, `email`, `howto`, `trial`, `user-activity`. `QueueModule`
always registers `chunk`, `company`, `howto` and `trial`, plus anything an app
adds through `baseConfig.chunkQueues`. Both modes load the module: api mode
needs it to *add* jobs, worker mode to *process* them.

### Cache

`CacheService` sits behind `CacheInterceptor`, which `bootstrap()` installs
globally between the tracing and logging interceptors.

| Variable | Default | Effect |
|---|---|---|
| `CACHE_ENABLED` | `true` in `baseConfig`, `false` in `.env.example` | Master switch. |
| `CACHE_DEFAULT_TTL` | 600 s | Entry lifetime. |
| `CACHE_SKIP_PATTERNS` | `/access,/auth,/notifications,/websocket,/version` | Paths never cached. |
| `CACHE_VERSION` | `v1` | Bumping it invalidates everything without a flush. |

Losing the cache is harmless: every entry is a recomputable response.

### Health

`RedisHealthIndicator` checks the client's status, then `PING`s with a 3-second
timeout and requires `PONG`. Like Neo4j, it backs both `/health` and
`/health/ready`.

## Object storage

### Connection

`S3Service` in `packages/nestjs-neo4jsonapi/src/foundations/s3/services/s3.service.ts`
switches on `S3_TYPE` and supports five values:

| `S3_TYPE` | Client | Endpoint it builds |
|---|---|---|
| `s3` | `S3Client` | `https://<bucket>.s3.amazonaws.com/` |
| `digitalocean` | `S3Client` with `endpoint` | `https://<bucket>.<host from S3_ENDPOINT>/` |
| `hetzner` | as above | as above |
| `minio` | `S3Client`, `forcePathStyle: true`, region `local` | `<S3_ENDPOINT><bucket>/` |
| `azure` | `BlobServiceClient` | the container named by `S3_BUCKET` |

| Key | Variable | `.env.example` default |
|---|---|---|
| `type` | `S3_TYPE` | `minio` |
| `endpoint` | `S3_ENDPOINT` | `http://minio.{{name}}.test:9000/` |
| `bucket` | `S3_BUCKET` | `{{name}}` |
| `key` | `S3_ACCESS_KEY_ID` | `minioadmin` |
| `secret` | `S3_SECRET_ACCESS_KEY` | `minioadmin` |
| `region` | `S3_REGION` | empty, defaulting to `us-east-1` |

Under `azure` the meaning of `S3_ACCESS_KEY_ID` changes: it carries an Azure
connection string, which the service parses for `AccountName` and `AccountKey`
to build a `StorageSharedKeyCredential`. Without shared-key credentials it can
still read and write, but SAS generation fails with an explicit error — so
presigned URLs need the full connection string.

### Presigned URLs

Nothing streams a file through the api. Both read and write go through a
time-limited signed URL:

- **S3-family:** `getSignedUrl` from `@aws-sdk/s3-request-presigner` over a
  `PutObjectCommand` or `GetObjectCommand`, with `expiresIn: 3600` — one hour.
- **Azure:** a SAS token generated from the shared-key credential, scoped to the
  container and blob, with the content type bound into the signature.

A signed URL therefore has to be regenerated per request, not cached in a
document that outlives it.

### What is stored

The bucket holds the only copy of every uploaded byte. Neo4j stores the **key**,
not the content: an entity descriptor's `injectServices: [S3Service]` turns that
key into a signed URL at serialisation time. Two shipped examples make the
pattern concrete — `:User.avatar` in
`packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.ts` (public), and
the chunk entity's source file in
`packages/nestjs-neo4jsonapi/src/foundations/chunk/entities/chunk.entity.ts`.
`ChunkerService` reads uploaded documents back out of the bucket to extract and
chunk them.

Deleting a folder is a listing plus a per-object delete, both in the S3 and the
Azure path. There is no lifecycle rule and no versioning configured by this
repository.

### Health

`S3HealthIndicator` issues `HeadBucketCommand` (or the Azure equivalent) with a
5-second timeout — but **only when a bucket is configured**. With `S3_BUCKET`
empty it returns healthy with the message "S3 not configured - skipping check".
It backs `GET /health` only, not `/health/ready`, so a storage outage does not
remove the api from rotation.

## Health endpoints at a glance

| Endpoint | Indicators |
|---|---|
| `GET /health` | Neo4j, Redis, storage, disk |
| `GET /health/live` | none — the process answered, so it is alive |
| `GET /health/ready` | Neo4j, Redis |

The fourth indicator, `DiskHealthIndicator`, is local to the container: it
requires free space of at least 1 GB or 10% of the volume, whichever is smaller.

## Where to look

| File | What it gives you |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` | Driver construction, pool settings, `initQuery()`. |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | The boot-time constraint and fulltext-index creation. |
| `packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts` | The `:Migration` node contract and the discovery order. |
| `apps/api/src/neo4j.migrations` | The four migrations a fresh database receives. |
| `packages/nestjs-neo4jsonapi/src/core/queue/queue.module.ts` | The BullMQ prefix and the always-registered queues. |
| `packages/nestjs-neo4jsonapi/src/core/cache/services/cache.service.ts` | The namespaced key layout and why it is namespaced. |
| `packages/nestjs-neo4jsonapi/src/core/redis/services/redis.client.storage.service.ts` | Presence keys and the SET NX PX lock. |
| `packages/nestjs-neo4jsonapi/src/foundations/s3/services/s3.service.ts` | The five storage types and the presigning. |
| `packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts` | The three endpoints and which indicators back each. |
| `.env.example` | Every key above, with its default. |

## Gaps and drift

- `.env.example` sets `CACHE_ENABLED=false` while `baseConfig` defaults it to
  true (`process.env.CACHE_ENABLED !== "false"`). A deployment that omits the
  variable gets caching; a developer who copied `.env.example` does not.
- `baseConfig` defaults `REDIS_QUEUE` to the literal `default`. On a shared
  Redis that is the worst possible default, and nothing warns about it at boot.
- The storage health indicator reports **healthy** when no bucket is configured.
  A deployment that forgot `S3_BUCKET` therefore passes every probe and fails
  only on the first upload.
- `QueueId` declares nine ids; `QueueModule` registers four of them plus
  whatever an app adds through `baseConfig.chunkQueues`. Where the other five
  are registered was not traced for this page.
- Not examined: Neo4j server configuration (heap, page cache, clustering), Redis
  persistence settings, bucket policies or lifecycle rules. None of them is
  declared in this repository.
