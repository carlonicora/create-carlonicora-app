---
title: Architecture decisions
section: 01-architecture
---

**This is a seed page.** It records the fourteen decisions that were already
made when {{display}} was scaffolded, each with the file in the repository that
proves it. They are the constraints you inherited, not proposals.

What you add: one entry per architectural decision your team takes, using the
template at the end. Append; never rewrite a past entry. When a decision is
reversed, add a new entry that supersedes it and mark the old one, so the
reasoning that led there survives.

An entry earns its place when the decision is hard to reverse, when it
constrains code someone else will write, or when a newcomer would otherwise
propose the opposite in good faith.

---

## ADR-0001 — Fastify, not Express

**Status** Accepted · baked into the framework

**Context.** NestJS supports two HTTP adapters. Express is the default and the
one most examples assume; Fastify is faster, has a stricter plugin model, and a
different reply API.

**Decision.** `bootstrap()` creates a `NestFastifyApplication` with a
`FastifyAdapter`, so every application scaffolded from this template is a
Fastify application. Controllers that need to write a response take
`@Res() reply: FastifyReply` and call `reply.send(response)`. Returning a value
from a handler that also injects `@Res()` does nothing, and `@HttpCode()` is
inert on such a handler — which is why some endpoints documented as 204 arrive
as empty 200s.

Body parsing, multipart, raw-body capture for webhooks, the
`application/vnd.api+json` content-type parser and the optional Helmet
registration are all Fastify plugin registrations inside `bootstrap()`, in a
fixed order. An application does not register them itself.

**Evidence** `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` ·
`packages/nestjs-neo4jsonapi/src/bootstrap/raw-body.config.ts` ·
`apps/api/src/features/essentials/search/controllers/search.controller.ts`

---

## ADR-0002 — Neo4j is the only store

**Status** Accepted

**Context.** The data this stack is built for is relationship-shaped: tenants,
memberships, roles, permissions, documents and the knowledge graph extracted
from them. Traversal is the common query, not the exception.

**Decision.** There is one database and it is Neo4j. No relational store, no
ORM, no migration framework beyond the four ordered Cypher files in
`apps/api/src/neo4j.migrations`. Redis holds queues, cache and socket pub/sub
but no source of truth, and an S3-compatible bucket holds blobs. All three are
external: no compose file in this repository provides them.

The consequence to accept is that the query language is Cypher and the
constraint vocabulary is Neo4j's. There are no foreign keys, so referential
integrity is whatever the repository writes —
`Neo4jService.validateExistingNodes` before a write, and the deletion invariants
that files like the membership queries state in prose.

**Evidence** `packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` ·
`apps/api/src/neo4j.migrations/queries/migration.queries.ts` ·
`packages/nestjs-neo4jsonapi/src/foundations/membership/queries/membership.query.ts`

---

## ADR-0003 — {json:api} is the only protocol between web and api

**Status** Accepted

**Context.** Two codebases exchanging JSON drift: field names diverge, related
data is fetched inconsistently, and every endpoint invents its own envelope.

**Decision.** Every request body and every response between `apps/web` and
`apps/api` is a {json:api} document, and neither side constructs one by hand.
The backend derives the document from an entity descriptor through
`JsonApiService`; the frontend builds request bodies through a model's
`createJsonApi()` and reads responses through `rehydrate()`. Every call goes through the
`callApi()` method the abstract service classes provide — never a bare `fetch`
— and `overridesJsonApiCreation` is not to be used.

The cost is real: a non-{json:api} response (a presigned URL, a client secret)
needs an explicit pass-through, which `translateResponse` provides by detecting
a body with no top-level `data` member.

**Evidence** `packages/nestjs-neo4jsonapi/src/core/jsonapi/services/jsonapi.service.ts` ·
`packages/nextjs-jsonapi/src/core/utils/translateResponse.ts` ·
`packages/nextjs-jsonapi/src/core/abstracts/ClientAbstractService.ts` · `CLAUDE.md`

---

## ADR-0004 — Entity descriptors, not the five-file entity layout

**Status** Accepted · migration in progress

**Context.** An entity used to be five coordinated files — entity type, mapper,
meta, model and serialiser. Adding a field meant four edits, and a missed one
produced a field that persisted but never serialised.

**Decision.** One file per entity. `defineEntity<T>()` takes a declarative
schema and derives the mapper, the constraints, the fulltext index, the
serialiser, the relationship tokens and the `DataModelInterface`. A CLI converts
old-style modules.

The decision is accepted but not finished: roughly a third of the shipped
foundations still use the old layout, so both patterns are visible in the
package and both work.

**Evidence** `packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts` ·
`packages/nestjs-neo4jsonapi/tools/migrate-entity/README.md` ·
`packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.ts`

---

## ADR-0005 — One binary, two modes

**Status** Accepted

**Context.** The API must not run cron jobs on every replica, and a queue worker
must not hold an HTTP port. The usual answers are two codebases or a shared
library plus two thin entry points.

**Decision.** `apps/api` builds one artefact that starts in either mode,
selected by a command-line flag. `getAppMode()` reads `--mode=api`,
`--mode=worker`, `--api` or `--worker` from `process.argv` and defaults to API;
`getAppModeConfig()` turns that into three booleans:

| Mode | `enableControllers` | `enableWorkers` | `enableCronJobs` |
|---|---|---|---|
| api | true | false | false |
| worker | false | true | true |

API mode creates a Fastify application and listens; worker mode creates an
application **context** with no HTTP server at all. `createWorkerProvider` and
`createApiProvider` wrap a class so it resolves to `null` in the other mode,
which is how the RBAC reconciler and the migrator stay worker-only. The
scripts are `start:prod` and `start:worker:prod` in `apps/api/package.json`, and
the worker compiles through its own `apps/api/tsconfig.worker.json` so its
output does not collide with the API's.

The consequence: CLS middleware is mounted only when controllers are enabled, so
worker code has no ambient request context and must open one with `cls.run()`.

**Evidence** `packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts` ·
`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` ·
`packages/nestjs-neo4jsonapi/src/common/decorators/conditional-service.decorator.ts` ·
`apps/api/tsconfig.worker.json`

---

## ADR-0006 — Company scoping lives in the query builder

**Status** Accepted

**Context.** Multi-tenant isolation enforced per repository fails the first time
someone writes a query and forgets. The failure is silent and reads other
tenants' data.

**Decision.** Two framework functions inject the tenant predicate and no
repository writes one by hand. `Neo4jService.initQuery()` binds the `company`
and `currentUser` variables from CLS; `AbstractRepository.buildDefaultMatch()`
requires the entity to reach that bound `company` over `BELONGS_TO`. Opting out
is explicit and named: `isCompanyScoped: false` on the descriptor.

A repository whose Cypher is hand-written still starts from `initQuery()` and
joins the bound variable — the notification repository is the worked example and
states the rule in its own header.

**Evidence** `packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` ·
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` ·
`packages/nestjs-neo4jsonapi/src/foundations/notification/repositories/notification.repository.ts`

---

## ADR-0007 — Base UI, not Radix

**Status** Accepted

**Context.** The component layer in `packages/nextjs-jsonapi` needs unstyled,
accessible primitives. Radix is the widely-assumed default and its `asChild`
composition pattern is in most examples on the internet.

**Decision.** Base UI is the primitive library. It composes with a `render`
prop, not `asChild`, and a trigger must not wrap a `<Button>` — it renders as
one. Two Radix packages remain in the dependency list (`react-label`,
`react-slot`) and are not a licence to add more.

This decision is a frequent source of wrong code, because both a newcomer and a
coding assistant will reach for `asChild` by habit. The guardrail is repeated in
`CLAUDE.md` for that reason.

**Evidence** `packages/nextjs-jsonapi/package.json` · `CLAUDE.md`

---

## ADR-0008 — A pnpm catalog plus overrides, not per-app ranges

**Status** Accepted

**Context.** In a workspace, two packages declaring compatible-but-different
ranges for the same dependency get two resolutions. For most libraries that is
waste; for `react`, `next`, `@nestjs/common`, `rxjs`, `yjs` and
`class-validator` it is a runtime bug — duplicated React contexts, a second
`@nestjs/common` that breaks DI, a `vi.mock` that patches only one copy.

**Decision.** `pnpm-workspace.yaml` holds a `catalog:` block as the single
source of truth for shared versions, and an `overrides:` block that forces one
copy in the tree. The overrides reference `catalog:` rather than repeating a
literal, because an override **replaces** a declared range instead of
intersecting it, and a stale literal silently undercuts every manifest's floor.
`autoInstallPeers` is off so a missing peer is a loud install failure rather
than a silent second copy, and `verifyDepsBeforeRun` is `warn` so `pnpm run`
never shells out to an implicit install in a production container.

The two submodules deliberately do **not** use catalog references — they build
and publish standalone from their own repositories, where this file does not
exist. `scripts/check-dep-drift.js`, wired into `pnpm lint`, keeps their
concrete pins aligned with the catalog.

**Evidence** `pnpm-workspace.yaml` · `scripts/check-dep-drift.js` ·
`DEPENDENCY_UPGRADE_GUIDE.md`

---

## ADR-0009 — Git submodules in development, npm pins in production

**Status** Accepted

**Context.** The two framework packages are developed alongside the applications
that consume them, and a change in one is usually tested against the other in
the same sitting. Depending on published versions makes that a publish-per-edit
loop; depending only on source makes a production image non-reproducible.

**Decision.** Both, split by environment. `.gitmodules` tracks each package on
`master` and the apps depend on them as `workspace:*`, so a developer edits the
package and the app picks it up. For the Docker build,
`scripts/apply-production-versions.js` substitutes the npm versions pinned in
`versions.production.json` for those `workspace:*` specifiers, and
`scripts/sync-production-versions.js` regenerates that file from the packages
themselves so its contents are derived rather than hand-maintained.

The pin and the submodule can therefore disagree — a submodule checked out at
`master` is newer than the pinned version — and that gap is a deliberate part of
the design, not an oversight. `pnpm sync:versions --check` is what catches a
stale pin.

**Evidence** `.gitmodules` · `versions.production.json` ·
`scripts/sync-production-versions.js` · `scripts/apply-production-versions.js` ·
`Dockerfile`

---

## ADR-0010 — RBAC is reconciled by the worker only

**Status** Accepted

**Context.** The permission matrix is declared in code
(`apps/api/src/rbac/permissions.ts`) and stored in Neo4j as
`HAS_PERMISSIONS` edges. Something has to make the graph match the declaration.
If every API replica did it on boot, *n* replicas would race on the same writes
during a rolling deploy.

**Decision.** The reconciler is registered with `createWorkerProvider`, so it
resolves to `null` in API mode and runs in exactly one place. The same rule
covers the Neo4j migrator. API replicas read the reconciled graph and never
write it.

The consequence to plan for: an API deployed without its worker runs against
whatever permissions the graph already held, and a permissions change is not
live until the worker has restarted.

**Evidence** `packages/nestjs-neo4jsonapi/src/foundations/rbac/rbac.module.ts` ·
`packages/nestjs-neo4jsonapi/src/foundations/rbac/services/rbac-reconciler.service.ts` ·
`apps/api/src/features/features.modules.ts`

---

## ADR-0011 — Cursor pagination, not offset pagination

**Status** Accepted, with a caveat about the name

**Context.** Lists are long and Neo4j has no cheap `COUNT(*) OVER ()`.
Repositories that write their own `SKIP`/`LIMIT` also make it impossible to
change the strategy centrally.

**Decision.** A repository writes the literal token `{CURSOR}` where the page
boundary belongs and never writes `SKIP` or `LIMIT`. `Neo4jService.readMany`
substitutes it, runs a derived COUNT query in parallel to produce `meta.total`,
and `JsonApiPaginator` builds the `next`/`prev` links.

The caveat is honest naming: the "cursor" is an offset.
`generateCursor()` returns `{ cursor: page[offset], take: page[size] + 1 }` and
the substitution is `SKIP … LIMIT …`. What the decision actually buys is
central control — a real keyset cursor can be introduced in one file — plus the
lookahead row that makes `next` correct without a second count. The `+ 1` is the
trap: code that wants exactly *n* rows must bypass the paginator.

**Evidence** `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/jsonapi.paginator.ts` ·
`packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts`

---

## ADR-0012 — The frontend package splits its barrels by `"use client"`

**Status** Accepted

**Context.** In the Next.js App Router a module marked `"use client"` and
everything it imports is bundled for the browser. A single package barrel that
re-exports both client components and server-only code makes every consumer a
client consumer, and a server-only import inside it fails the production build —
often only the production build.

**Decision.** `packages/nextjs-jsonapi` publishes fifteen entry points rather
than one: the root plus `/core`, `/server`, `/cached-get`, `/client`,
`/components`, `/contexts`, `/testing`, `/billing`, `/help`, `/help/server`,
`/tokenusage`, `/analytics`, `/analytics/server` and `/next-config` (and the
`/contexts/styles.css` stylesheet).
Most feature barrels carry `"use client"`; `/core` is the client-safe surface
that server code imports. The root barrel deliberately does **not** re-export
`/unified`, because that module dynamically imports server code.

The rule that follows for application code: import from `/core` in anything the
server renders — the module bootstrapper above all — and only a real
`next build` catches a violation.

**Evidence** `packages/nextjs-jsonapi/package.json` ·
`packages/nextjs-jsonapi/src/index.ts` ·
`apps/web/src/config/Bootstrapper.ts`

---

## ADR-0013 — Serwist with a default-deny runtime cache

**Status** Accepted

**Context.** Serwist ships a `defaultCache` preset. It `NetworkFirst`-caches
same-origin JSON and carries a same-origin catch-all, which means
authentication-scoped bytes can end up on disk and "nothing sensitive is
cached" becomes unprovable.

**Decision.** `apps/web/src/app/sw.ts` declares its own `runtimeCaching`
allowlist that ends in `NetworkOnly`. Navigations, RSC payloads, `/api/` and
everything cross-origin are network-only; only hashed build assets, self-hosted
fonts and a short allowlist of static images are cached, each with an explicit
expiration. `skipWaiting` is false so the user, not the worker, decides when to
reload and lose form state.

The obligation attached to this decision is written into the file: if any entry
is relaxed, a `caches.delete()` sweep on logout and on company switch becomes
mandatory.

**Evidence** `apps/web/src/app/sw.ts` · `apps/web/next.config.js`

---

## ADR-0014 — End-to-end tests run against a production web build

**Status** Accepted

**Context.** Running Playwright against `next dev` compiles each route on first
visit. On a suite of any size that turns into tens of minutes and flakes on
compile timeouts, and the failures look like application bugs.

**Decision.** `scripts/e2e.sh` builds the web application and runs
`next start`. The build uses `E2E_BUILD=true`, which makes `createNextConfig`
(the package's `/next-config` helper that `next.config.js` calls) emit into
`.next-e2e` — a separate directory, so an e2e run cannot clobber the
`.next` a dev server is serving and leave every route 404ing. The whole stack
runs on its own ports — 4080 for the API, 4081 for the web process, 4082
reserved for the worker health endpoint, and 4084 for the results dashboard —
with its own Neo4j database and its own Redis queue prefix, and the worker is started alone
first so migrations complete before the API and web processes check the schema.

**Evidence** `scripts/e2e.sh` · `apps/web/next.config.js` ·
`.env.e2e.example`

---

## The template for a new entry

Copy this block, give it the next number, and append it above this section.

```markdown
## ADR-00NN — <decision in one line, in the imperative>

**Status** Proposed | Accepted | Superseded by ADR-00MM

**Context.** What forced a choice. The constraint, the failure that prompted it,
and the alternatives that were genuinely on the table. Two to five sentences.

**Decision.** What was chosen, stated as a rule someone can follow, plus the
consequence a reader has to accept. Name the mechanism, not just the intent.

**Evidence** `path/to/file` · `path/to/other/file`
```

Rules for the section: number entries in order and never reuse a number; never
edit a past entry's Context or Decision — supersede it instead; cite files that
exist, because `pnpm check:handbook` verifies every path on this page.

## Where to look

| File | What it settles |
|---|---|
| `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` | the Fastify adapter and the fixed boot order |
| `packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts` | `getAppMode()` and the three mode booleans |
| `packages/nestjs-neo4jsonapi/src/common/decorators/conditional-service.decorator.ts` | `createWorkerProvider` and `createApiProvider` |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | where tenancy and `{CURSOR}` are enforced |
| `packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts` | the descriptor model |
| `pnpm-workspace.yaml` | the catalog, the overrides and the reasoning behind each pin |
| `versions.production.json` | the npm pins the Docker build substitutes |
| `scripts/sync-production-versions.js` | how those pins are derived |
| `packages/nextjs-jsonapi/package.json` | the fifteen entry points and the Base UI dependency |
| `apps/web/src/app/sw.ts` | the default-deny cache policy and its obligation |

## Gaps and drift

- ADR-0004 is accepted but incomplete: both entity layouts ship, so "the
  pattern" is ambiguous when reading the package.
- ADR-0009 leaves `versions.production.json` pinning versions older than the
  `master` the submodules track. A generated app therefore develops against
  newer package code than its own production pin describes.
- ADR-0011's name does not match its mechanism; the implementation is offset
  pagination with a lookahead row.
- ADR-0007 is undercut by two remaining Radix packages in
  `packages/nextjs-jsonapi/package.json`.
- No entry is recorded for several choices that are equally baked in and were
  simply never written down: BullMQ over any other queue, pino over any other
  logger, Turborepo over an alternative task runner, semantic-release for
  versioning, Vitest over Jest, and next-intl for i18n. Add them as you learn
  why each one matters.
- Not examined here: any decision taken after the app was scaffolded, which is
  precisely what this page exists to collect.
