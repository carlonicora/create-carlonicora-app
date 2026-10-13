---
title: Day-one checklist
section: 00-start-here
---

Ten things to do before you write any code, in order. Each one either proves a
subsystem works or shows you where it lives. Budget an afternoon.

Everything here assumes the stack is already running; if it is not, do
[Local setup](local-setup.md) first.

## 1. Boot the stack

```bash
pnpm install
pnpm dev
```

Four processes start. Watch the worker's output until it reports the Neo4j
migrations: the worker owns the migrator, and nothing else will work until the
constraints, indexes and seed data exist.

Then confirm the dependencies from the outside:

```bash
curl http://api.{{name}}.test:4050/health
```

A 200 means Neo4j, Redis, storage and disk all answered. A 503 body names the
one that did not. Do not continue past a 503 — every later step fails in a way
that blames the wrong component.

## 2. Log in

Open `http://{{name}}.test:4051` and sign in as the seeded administrator from
`apps/api/src/neo4j.migrations/20250901_004.ts`: `admin@{{name}}.com`, password
`password`.

You land on the main route group, `apps/web/src/app/[locale]/(main)`. The
administration console is a separate group,
`apps/web/src/app/[locale]/(admin)/administration`, and the seeded user is the
only one who can reach it.

## 3. Look at the module registry

A module is the unit this stack gates, routes and serialises on. There are two
registries and they must agree.

**On the frontend**, open `apps/web/src/config/Bootstrapper.ts`. One object
literal, `allModules`, builds every module through a local `moduleFactory` and
registers it twice: into `ModuleRegistry` by name, and into `DataClassRegistry`
so a {json:api} response can be rehydrated into its model class. Roughly
fifty-five of those modules come from `@carlonicora/nextjs-jsonapi`; exactly one
is the application's own, `Search`. That file is where every feature you add
gets registered.

**On the backend**, open `packages/shared/src/const/module.id.ts`. It holds the
UUIDs of the `Module` nodes seeded by
`apps/api/src/neo4j.migrations/20250901_002.ts`. Feature modules register their
descriptors against these ids rather than against names, so renaming a module in
the migration cannot silently unlink it from the catalogue.

Then look at the same data through the product: the administration console has an
RBAC page at `apps/web/src/app/[locale]/(admin)/administration/rbac/page.tsx`,
which renders the module-by-role matrix the API computes.

## 4. Create a second user

From the administration console, add a user with an ordinary role.

This is worth doing by hand because it exercises the whole identity chain in one
click: a `User` node, a membership, a role edge, an activation email rendered
from `apps/api/templates/email/en/activationEmail.hbs`, and — if no email
provider is configured — a log line where the send would have been.

Log in as that user in a private window. The administration console is now
absent from the navigation, not merely forbidden. That is the feature gate doing
its job, and it is the behaviour to imitate for anything you add.

## 5. Upload a file through the S3 foundation

The storage foundation never proxies bytes through the API. Its controller,
`packages/nestjs-neo4jsonapi/src/foundations/s3/controllers/s3.controller.ts`,
issues URLs and nothing else:

| Request | Returns |
|---|---|
| `GET /s3?key=…&contentType=…&isPublic=…` | A presigned URL to `PUT` the bytes straight at the object store |
| `GET /s3/sign?key=…&isPublic=…&filename=…` | A signed URL to read them back |
| `DELETE /s3?key=…` | Removes the object |

All three require a bearer token. Ask for a presigned URL, `PUT` a small file to
it, then ask for a signed URL and open it. If the `PUT` fails, the bucket named
in `S3_BUCKET` does not exist or the credentials are wrong — the API cannot tell
you either, because it never touched the bytes.

## 6. Watch the chunk queue in the worker

`apps/api/src/config/enums/queue.id.ts` registers exactly one queue, `chunk`,
and `apps/api/src/config/enums/job.name.ts` declares its one job name,
`process_chunk`. `apps/api/src/config/config.ts` passes both into the framework
config, and `ChunkProcessor` in
`packages/nestjs-neo4jsonapi/src/foundations/chunk/processors/chunk.processor.ts`
consumes the queue — in the worker process only.

The keys live in Redis under the prefix in `REDIS_QUEUE`:

```bash
redis-cli --scan --pattern '{{name}}*' | head
```

An empty queue on day one is the correct result: nothing in the scaffolded
application enqueues a chunk job by itself. Jobs appear once content flows
through the content foundation, and the worker's log is where you will see them.
What matters today is knowing which process consumes them, because a job that
never runs is almost always a worker that is not running.

## 7. Find the nodes in Neo4j

Open Neo4j Browser against the database named in `NEO4J_DATABASE` and run:

```cypher
MATCH (u:User) RETURN u.email, u.isActive;
MATCH (m:Module) RETURN m.name ORDER BY m.name;
MATCH (u:User)-[:HAS_MEMBERSHIP]->(ms:Membership)-[:HAS_ROLE]->(r:Role)
RETURN u.email, r.name, exists((ms)-[:IN_COMPANY]->(:Company)) AS scoped;
```

The shapes are declared in
`packages/nestjs-neo4jsonapi/src/foundations/membership/queries/membership.query.ts`:
`(user)-[:HAS_MEMBERSHIP]->(:Membership)-[:IN_COMPANY]->(:Company)` and
`(membership)-[:HAS_ROLE]->(:Role)`. A membership with no `IN_COMPANY` edge is a
platform membership.

Two things to notice. The administrator from step 2 has a role but no company —
that is the platform-administrator shape, and
`apps/api/src/neo4j.migrations/20250901_004.ts` explains why it must stay that
way. And the labels you see were not written by hand: entity descriptors derive
them, along with their constraints and full-text indexes.

Reading the graph directly is the fastest debugging tool this stack has. When an
endpoint returns the wrong thing, look at the nodes before you look at the code.

## 8. Run the unit suites

```bash
pnpm test
```

Three Vitest projects run and all three pass. Be clear about what that proves:
very little. The API and the shared package ship no spec at all. The web app
ships eight, all for the application shell — the proxy, the layouts, `AppShell`,
`requireAdministrator`, the skeletons, `TrialBlockingWrapper`, the locale
resolution in `apps/web/src/i18n/request.ts` and the metadata helper — and none
for a feature. `apps/api/vitest.config.ts`,
`apps/web/vitest.config.ts` and `packages/shared/vitest.config.ts` all set
`passWithNoTests: true`, which exists because Vitest otherwise exits non-zero on
"no test files found" and would fail `pnpm test` in a brand-new application
before a line was written.

So two suites are green and empty, and the third covers only the shell. What the
configuration does give you is a working harness:

| Project | Environment | Picks up |
|---|---|---|
| `apps/api` | `node`, transformed by SWC | `src/**/*.{test,spec}.ts` |
| `apps/web` | `jsdom`, with React Testing Library | `src/**/*.{test,spec}.{ts,tsx}` and `__tests__` |
| `packages/shared` | `node` | `src/**/*.test.ts` |

Write one spec in the API today, even a trivial one, and one for a web feature.
An empty suite that has never had a passing test in it is a harness nobody has
verified.

`apps/api/vitest.config.ts` sets `oxc: false` on purpose: Vitest 4's built-in
transformer would strip the decorator metadata NestJS resolves its dependencies
from, and every dependency-injection test would fail with an unhelpful error.
Leave it alone.

## 9. Run the end-to-end suite

This is the suite that does exist — Playwright specs under `apps/web/tests`
covering login, auth guards, the API contract, user management, the smoke paths
and the service worker.

```bash
cp .env.e2e.example .env.e2e
pnpm test:e2e
```

`scripts/e2e.sh` drops and recreates the test database empty, boots a worker, an
API and a web build on ports 4080 to 4082 with their own Redis queue prefix and
their own Next.js build directory, waits for the migrations, then runs
Playwright. The development stack is untouched and can keep running.

Then watch it instead of reading its output:

```bash
pnpm e2e:dash
```

The dashboard on `http://127.0.0.1:4084` lists every spec, runs and stops the
suite, and serves the HTML report. `apps/web/tests/README.md` documents the
suite, its fixtures and its personas.

## 10. Read the rules before you write code

In this order:

1. `CLAUDE.md` — the guardrails. Every one of them is non-negotiable and every
   one of them exists because violating it produced broken or insecure code.
2. [Rulebook](../02-framework/rulebook/README.md) — the routing table from the
   file you are about to edit to the reference that governs it.
3. [Foundations overview](../05-foundations/README.md) — the forty-three modules
   the application already owns. The most expensive mistake available to you
   this week is rebuilding one of them.

Then pick a route from [Reading order](reading-order.md), or go straight to
[Task index](task-index.md) if you already know what you are building.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/config/Bootstrapper.ts` | Every frontend module, registered in one object |
| `packages/shared/src/const/module.id.ts` | Every backend module id |
| `apps/api/src/neo4j.migrations/20250901_004.ts` | The seeded administrator and why it has no company |
| `apps/api/src/config/enums/queue.id.ts` | The one queue the application registers |
| `packages/nestjs-neo4jsonapi/src/foundations/s3/controllers/s3.controller.ts` | The three storage endpoints |
| `apps/api/vitest.config.ts` | The API harness, and why `oxc` is off |
| `apps/web/vitest.config.ts` | The jsdom harness |
| `apps/web/tests/README.md` | The end-to-end suite |
| `scripts/e2e.sh` | What the e2e run boots, and how it stays clear of the dev stack |
| `CLAUDE.md` | The rules, unabridged |

## Gaps and drift

- Step 6 was verified by reading the queue enumeration, the config wiring and the
  processor. No chunk job was actually observed running, because nothing in the
  scaffolded application enqueues one without content being created first.
- Step 5 describes the storage endpoints from the controller. The upload was not
  performed against a live MinIO instance while writing this page.
- Step 4 assumes an email provider is unconfigured, which is the shipped state.
  With `EMAIL_PROVIDER` set, the activation mail is really sent, and the address
  you invent had better exist.
- The API and the shared package ship no spec; their suites pass only because
  of `passWithNoTests`. The web app's nine specs cover the shell, not any
  feature.
- The Cypher in step 7 was written from the membership queries, not run against
  a live database. The `Module` query in particular assumes the seed migration
  has completed.
- Step 3's count of roughly fifty-five framework modules is the size of the
  `allModules` object literal, not a verified total; it moves whenever the
  frontend package adds or removes one.
