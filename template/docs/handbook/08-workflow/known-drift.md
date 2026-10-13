---
title: Known drift
section: 08-workflow
---

Where shipped code and shipped documentation disagree, or where a configuration
declares something the code never uses. **The code wins, always.** This page
records the disagreement instead of quietly patching either side, so that the
next person who trips over it finds a note rather than a mystery.

**This is a seed page.** It opens with the findings a full read of the template
produced on 2026-09-11, and carries what every other handbook page recorded in
its own "Gaps and drift" section — each one re-opened and checked against the
file it names before it was entered here.

**The register holds 71 entries as of 2026-09-11**, some of which carry two or
three related findings. That is everything the handbook's own reading of this
repository turned up, not a selection from it — but it is a working list, not a
closed one. It grows as people find things, and an entry leaves only when
someone fixes what it describes. If what you have just hit is not here, it is
probably new: add it.

## How a finding is collected and recorded

1. **Notice the contradiction.** Usually while doing something else: a document
   names a script that does not exist, a config declares a path nothing reads, a
   dependency appears twice.
2. **Prove it, both ways.** Open the file that claims it and the file that
   contradicts it. A finding with only one of the two is a suspicion.
3. **Decide which is right.** In this repository the answer is always the code.
   The document is what gets corrected — later, as its own change.
4. **Record it here, not in a fix.** Handbook writers never edit template code
   or configuration to match the prose. Someone owns that change; it is not the
   person writing the note.
5. **Remove the entry when it is fixed**, or mark it fixed with the date and
   what fixed it, when the pattern is worth keeping on record.

Every entry names the file that proves it and states the consequence in one
line; a finding you cannot attach to a file does not go here. Entries are
grouped by area, worst consequence first.

## Repository documents

### `DOCKER.md` documents two files that do not exist

It gives the development workflow as `docker compose -f docker-compose.yml -f
docker-compose.dev.yml …` in six places and explains a ".dockerignore" the
repository does not contain. The development images are reachable only by
building `Dockerfile`'s `api-development` and `web-development` stages.

*Consequence:* the documented development command fails on a missing file, and
every stage's `COPY` takes in whatever the build context holds.

### `apps/api/CLAUDE.md` draws the wrong feature layout

Its "File Organization" block puts the repository, service, controller and
module in the feature root, with only `entities/` and `dtos/` below. The shipped
feature uses a directory per layer —
`apps/api/src/features/essentials/search/repositories/search.repository.ts` and
its siblings — and so does `pnpm generate-module`.

*Consequence:* a developer following the instruction file produces a layout
neither the generator nor the one worked example matches.

### `apps/web/CLAUDE.md` requires a static `rehydrate()`

Its rules table says models implement `rehydrate()` **statically**. The only
shipped model, `apps/web/src/features/essentials/search/data/Search.ts`,
implements it as an instance method returning `this`, as does the package base
class it extends.

*Consequence:* a model written to the instruction file does not compile against
the base class it must extend.

### The root README claimed a repository that did not exist — fixed 2026-09-11

It advertised ports 3000 and 3001, a `pnpm structure` script and a
docs/architecture directory; `.env.example` sets 4050 and 4051 and `package.json`
has no such script. The README rewrite now derives every port, version and
command from the file that declares it.

*Consequence:* a new developer followed instructions that had not been true for
several versions. The pattern stays on record: it is what this handbook prevents.

### The dependency guide shipped twice

`DEPENDENCY_UPGRADE_GUIDE.md` at the root had a near-identical twin under
`docs/`, 936 lines each, differing in five lines of wording. The `docs/` copy was
deleted on 2026-09-11.

*Consequence while it lasted:* two sources of truth, and no way to tell which.

## Configuration

### `versions.production.json` pins versions the submodules can pass, and lint fails for it

`.gitmodules` records no branch, so a fresh checkout gets each package's default
branch. The pins (`4.17.3` and `4.0.4`) are the latest published releases, and
the generator's `production-versions` check keeps them there; any commit on the
default branch after a release puts a checkout ahead of them. Rule 5 of
`scripts/check-dep-drift.js`, which `pnpm lint` runs, requires the pins to equal
the workspace versions. Both CI workflows and `Dockerfile` strip the submodules
from `pnpm-workspace.yaml` and install the pins instead.

*Consequence:* `pnpm lint` fails on a freshly scaffolded application, before
anyone has touched a line. `pnpm sync:versions` realigns the pins.

### Ninety-nine configuration variables are read and never declared

`packages/nestjs-neo4jsonapi/src/config/base.config.ts` reads 203 environment
variables; `.env.example` declares 117, and 99 of the 203 are absent from it —
every `OAUTH_*` key, the five `EMAIL_*` SMTP fields, `DISCORD_TOKEN`, `APP_MODE`,
the chunker and OCR keys, the `_LITE`/`_LARGE` tier system.

*Consequence:* `oauth.enabled` is false and `POST /oauth/register` answers 404
with no obvious cause; SMTP and Discord credentials have no documented home; and
`baseConfig`'s pre-built export reports `api` inside the worker.

### `.env.example` and the configuration disagree on six values

| Variable | `.env.example` | `base.config.ts` |
|---|---|---|
| `EMBEDDER_DIMENSIONS` | `3072` | defaults to `0` |
| `JWT_EXPIRES_IN` | `1d` | falls back to `1h` |
| `CACHE_ENABLED` | `false` | on unless the value is the string `false` |
| `LOKI_ENABLED` | `true` | off unless the value is the string `true` |
| `TEMPO_ENABLED` | `true` | off unless the value is the string `true` |
| `CREDIT_MINIMUM` | "the smallest purchasable top-up" | the per-record credits floor |

*Consequence:* a deployment that omits a variable and a developer who copied the
example get different behaviour from one codebase.

### CI and the images build against different inputs than a developer machine

`.github/workflows/dev.yml` and `.github/workflows/pull-request.yml` both run
`sed -i '/nestjs-neo4jsonapi/d; /nextjs-jsonapi/d' pnpm-workspace.yaml` before
installing, so CI compiles against the pinned npm releases while a developer
compiles against the submodule checkouts. `package.json` declares
`"packageManager": "pnpm@11.24.0"` with an engines floor of `>=11.0.0`, and all
three `Dockerfile` stages run `corepack prepare pnpm@10.18.2 --activate`.

*Consequence:* a break the newer package introduces reaches the branch green,
and images resolve with a different pnpm major than any developer machine.

### Observability is declared more thoroughly than it is wired

`packages/nestjs-neo4jsonapi/package.json` declares `nestjs-pino`,
`apps/api/package.json` declares `pino-roll` and
`@opentelemetry/instrumentation-fastify`, and nothing imports any of the three.
`LOKI_USERNAME` and `LOKI_PASSWORD` are read into config and never passed to the
transport, which also defaults `LOKI_INTERVAL` to 5 where the config says 30.

*Consequence:* no rotating file transport, no Fastify spans, and a Loki endpoint
behind basic auth rejects every write.

### `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are read by nothing

`.env.example` documents both in detail, test keys included. The only
`turnstile` in the code is a content-security-policy service name in
`packages/nextjs-jsonapi/src/next-config/csp.ts`, and `apps/web/next.config.js`
leaves it out of its `services` list, so the widget's host is not even
allowlisted.

*Consequence:* configuration for an unwired feature, indistinguishable from the
kind that matters.

### Neither app type-checks, and neither is strict

`tsconfig.base.json` sets `strict: true` and every individual strict flag;
`apps/api/tsconfig.json` and `apps/web/tsconfig.json` each turn off `strict`,
`strictNullChecks`, `noImplicitAny`, `strictBindCallApply`,
`strictFunctionTypes`, `strictPropertyInitialization` and `noImplicitThis`.
`apps/web/package.json` then declares `"typecheck": "eslint ."`, and no
`tsc --noEmit` exists anywhere in the workspace.

*Consequence:* `pnpm typecheck` passes on code that does not compile, and the
type system catches far less than the shared base implies.

### The React hooks rules are off

`apps/web/eslint.config.mjs` disables `react-hooks/rules-of-hooks` and
`react-hooks/exhaustive-deps`, plus nine `react-hooks/*` compiler rules and
`@typescript-eslint/no-unused-vars`.

*Consequence:* a conditional hook call is not a lint error here. The frontend
package's socket context used to contain one; 4.0 calls `useSocket`
unconditionally, but nothing in this config would have caught it.

### `apps/web` configuration carries entries nothing uses

`apps/web/components.json` maps `components` to `@/components`, `ui` to
`@/components/ui`, `utils` to `@/lib/utils` and `lib` to `@/lib`; only the
`hooks` alias resolves. `apps/web/package.json` lists `tw-animate-css` at
`^1.4.0` in both `dependencies` and `devDependencies`.

*Consequence:* the shadcn CLI writes into directories nothing imports from —
the real helper is `apps/web/src/utils/cn.ts` — and the duplicate range is the
shape `scripts/check-dep-drift.js` exists to catch between manifests.

### Five scripts nothing invokes, one of them shadowed

No `package.json` script invokes `scripts/check-update.sh`,
`scripts/find-duplicate-translations.js`, `scripts/remove-worktree.sh`,
`scripts/update.sh` or `scripts/validate-translations.js`. The last is a
567-line CommonJS twin of `apps/web/scripts/validate-translations.mjs`, which is
what `apps/web`'s `lint` runs, and reports unused keys the wired one does not.

*Consequence:* a fix to the root validator changes nothing, and two of the five
are invisible to anyone reading `package.json`.

### `"composite": true` sits where it has no effect

`apps/web/tsconfig.json` puts `"composite": true` at the top level rather than
inside `compilerOptions`, and `apps/api/tsconfig.json` declares none at all —
while the root `tsconfig.json` references all three workspaces as project
references.

*Consequence:* the solution-style build is declared and not enabled, so nothing
in the repository gets an incremental project build.

### The base image ships an OCR language pack nothing selects

`Dockerfile`'s `base` stage installs `tesseract-ocr-data-ita` beside
`tesseract-ocr`; the chunker configuration defaults `OCR_LANGUAGE` to `eng`,
`.env.example` does not set it, and the production stage installs
`tesseract-ocr` without the extra pack.

*Consequence:* a language pack in the development image that nothing asks for,
and none in the production image if something ever did.

### The worker health port is reserved and never used

`scripts/e2e.sh` frees port 4082 and `.env.e2e.example` declares
`E2E_WORKER_HEALTH_PORT=4082`, but the worker exposes a health endpoint only
when the app opts in through the bootstrap options, and the template does not.

*Consequence:* none today; a trap the day someone assumes the port answers.

## Backend

### `EXPECTED_SEARCH_LABELS` is empty, so the shipped search index is never created

`apps/api/src/features/essentials/search/repositories/search.repository.ts`
declares `const EXPECTED_SEARCH_LABELS: string[] = []`, and its index management
returns early — logging that it was skipped — whenever the list is empty. The
fulltext index `search_index` is never created.

*Consequence:* the one endpoint the template ships returns nothing for a term
that is in the graph, and fails outright on a real fulltext query.

### `RbacDevController` has no guard and writes a file

`packages/nestjs-neo4jsonapi/src/foundations/rbac/controllers/rbac-dev.controller.ts`
declares `GET` and `PUT _dev/rbac/matrix` with no `@UseGuards` at all, and the
`PUT` calls `fs.writeFileSync` on an `outputPath` from the request body —
absolute, or resolved against the directory holding `pnpm-workspace.yaml`. Its
only gate is the `devMode: process.env.NODE_ENV !== "production"` that
`apps/api/src/features/features.modules.ts` passes.

*Consequence:* an API process not started with `NODE_ENV=production` exposes an
unauthenticated write to an arbitrary path under the workspace root.

### The template binds neither AI seam, and both fail open

`packages/nestjs-neo4jsonapi/src/common/tokens.ts` documents
`TOKEN_USAGE_RECORDER` and `CREDIT_VALIDATOR` as the seams an application binds
to record usage and gate credits, and its own tables state that with no provider
bound work proceeds ungated. Neither is bound anywhere under `apps/api`, and
neither is `SYSTEM_ROLES`.

*Consequence:* a fresh application runs every AI operation without a credit
check and records usage only through the package's own service, silently.

### Two notification defects cancel each other out

`NotificationController.findById` passes `request.user.id` where every other
handler passes `request.user.userId`, which is what `JwtAuthGuard` sets.
`NotificationRepository.findByIdForUser` takes that id, binds it as a parameter
and never references it in Cypher — its header comment records this as
pre-existing.

*Consequence:* the id arrives undefined and it does not matter: the query is
company-scoped only, so any user of a company can read another's notification.

### Most of the audit trail cannot fire

`packages/nestjs-neo4jsonapi/src/common/decorators/audit.decorator.ts` finds its
entity id by scanning the handler's arguments for one carrying `params`, and of
five `@Audit` call sites only the assistant-action handler declares `@Req()`.
Separately, `AuditRepository.findByUser` joins no company, and the frontend's
`AuditLogService.findActivityByEntity` builds `audit-logs/activity/…` while
`AuditController` declares `audit-logs/:entityType/:entityId`.

*Consequence:* four of five read audits are never written, the activity endpoint
cannot match a route, and a user id is enough to read that user's trail.

### `buildDefaultMatch()` traverses the tenancy edge in both directions

`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts`
filters a company-scoped read with `EXISTS { MATCH (node)-[:BELONGS_TO]-(company) }`
— undirected. Every write in the same file, and `buildReturnStatement()`'s own
company match, use the directed `-[:BELONGS_TO]->` form.

*Consequence:* a reversed or mis-written edge passes the tenancy filter and then
disappears from the projection, so the row is counted but never returned.

### Two permission grants against unknown module ids

`apps/api/src/neo4j.migrations/20250901_003.ts` grants full permissions on
`78567a47-baa8-47ed-890f-de48574a9cba` and
`e029e271-2896-43ad-87ef-19ab35363936`, neither of which appears in
`apps/api/src/rbac/module-id.map.json` or anywhere else. `permissionQuery` in
`apps/api/src/neo4j.migrations/queries/migration.queries.ts` opens with `MATCH`
on both role and module, so a grant naming something absent writes nothing.

*Consequence:* two grants that do nothing, and a seeding path where every future
typo in a module id fails the same silent way.

### The migration runner is a high-water mark, and its uploads sit outside the transaction

`filterMigrationsToRun` in
`packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts`
keeps only migrations sorting above the newest applied one, rather than those
not yet applied; in the same file `s3-upload` steps run before the Cypher batch
reaches `executeInTransaction`.

*Consequence:* a migration merged with an older version number never runs and
nothing says so, and a failed migration leaves its uploaded object behind.

### Two cleanup sweeps exist and nothing calls them

`OAuthTokenService.cleanupExpiredTokens()` deletes expired tokens and expired
authorization codes, and its docblock says it "should be called periodically
(e.g., daily)". `PendingTwoFactorRepository.deleteExpired()` is its two-factor
twin. Neither has a caller: the package's four `@Cron` jobs are presence (two),
the community summariser and the assistant-action expiry.

*Consequence:* expired OAuth tokens, used authorization codes and pending
two-factor challenges accumulate in the graph for the life of the application.

### The email queue has two producers and no consumer

`StripeWebhookNotificationService` and `ReferralService` both inject
`@InjectQueue(QueueId.EMAIL)` and their modules register the queue. No
`@Processor(QueueId.EMAIL)` exists in the package or in `apps/api` — every other
registered queue has one.

*Consequence:* the billing and referral emails are enqueued and never sent, and
the jobs sit in Redis rather than failing.

### The one declared job name cannot finalise a how-to

`apps/api/src/config/enums/job.name.ts` declares `process.chunk` and nothing
else. `ChunkService` resolves the next job as
`jobNames.process[type] ?? jobNames.process[type.toLowerCase()]` and throws when
neither exists, while the package registers the `howto` queue regardless.

*Consequence:* indexing a how-to fails at the end of the chunk pipeline rather
than at boot, naming a config key most readers have never opened.

### `QueueModule.forRoot()` is dead code

`packages/nestjs-neo4jsonapi/src/core/queue/queue.module.ts` offers `forRoot()`
beside `forRootWithQueues()`, and only the second is ever called. `forRoot()`'s
`QUEUE_REGISTRATIONS` provider computes the app's additional queue ids and
registers none of them, deferring — in its own comment — to
`BullModule.registerQueue()` imports that are not there.

*Consequence:* copying `forRoot()` into an application module gets you the four
package queues and silently none of your own.

### `contentTypes.types` is empty, so `GET /contents` reads a label nothing writes

`apps/api/src/config/config.ts` sets `contentTypes: { types: [] }`, and
`ContentRepository.getContentTypes()` falls back to `contentMeta.labelName` — the
literal `Content` — when the list is empty. No `CREATE` or `MERGE` anywhere in
the package writes a `:Content` node.

*Consequence:* the content endpoints are live, answer 200, and can only ever
return an empty set until the app lists its own labels.

### Community detection has no caller

`CommunityService` in
`packages/nestjs-neo4jsonapi/src/foundations/community` is a class with a
constructor and no methods, and nothing in the package calls
`CommunityDetectorService.detectAndAssignCommunities` or
`markAffectedCommunitiesStale`. The summariser cron runs every ten minutes
regardless.

*Consequence:* communities are never detected on a stock install, so the cron
wakes up, finds nothing to summarise, and reports success.

### `S3HealthIndicator` reports healthy when no bucket is configured

`packages/nestjs-neo4jsonapi/src/core/health/indicators/s3.health.ts` returns
`getStatus(key, true, …)` with the message "S3 not configured - skipping check"
when `s3.bucket` is empty, rather than degrading.

*Consequence:* a deployment that forgot `S3_BUCKET` passes every readiness probe
and fails on the first upload instead.

### `/version` reports 1.0.0 in the shipped container

`baseConfig` derives `api.version` from `process.env.npm_package_version` with a
`"1.0.0"` fallback, and `VersionService` returns it unchanged. The `Dockerfile`
production stage starts the api with `CMD ["node", "dist/main", "--mode=api"]`,
which sets no npm environment at all.

*Consequence:* the api reports 1.0.0 in production whatever the release, while
the web sidebar reports the real number.

### The one worked example breaks two guardrails

`apps/api/src/features/essentials/search/dtos/search.dto.ts` declares
`SearchQueryDTO` with `class-validator` decorators, and
`apps/api/src/features/essentials/search/controllers/search.controller.ts` reads
both parameters as raw `@Query()` strings, checks emptiness by hand, and maps
results into a `type`/`id`/`attributes` literal inside `reply.send()` rather
than through a serialiser. `CLAUDE.md` forbids the second in as many words.

*Consequence:* the only DTO the application ships is dead code, the only
endpoint bypasses the validation pipe, and the example teaches both.

### `searchMeta` describes a node that is never created

`apps/api/src/features/essentials/search/entities/search.meta.ts` declares
`nodeName: "search"` and `labelName: "Search"`. Nothing creates a `:Search`
node; the repository reads a fulltext index, and only `endpoint` is ever read
from the meta.

*Consequence:* the one meta a new developer copies from teaches two fields that
mean nothing in the example they were copied from.

### Every `MODULE_USER_PATHS` entry is empty

`apps/api/src/features/rbac/module-relationships.map.ts` maps all eight module
ids to `[]`. It is generated from the compiled feature tree, and the template
ships one feature with no user relationships to find.

*Consequence:* path-scoped permissions have no relationship paths to resolve
against until the map is regenerated once real features exist.

### `BootstrapOptions.rbac` is declared and never read

`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.options.ts` declares
`rbac?: RbacMatrix` and a comment saying the reconciler uses it on bootstrap;
nothing in the bootstrap path forwards it. The name is reused:
`RbacModule.register()` reads a different option also called `rbac`, and
`apps/api/src/features/features.modules.ts` passes the matrix that way, which
works.

*Consequence:* passing `rbac` to `bootstrap()` silently does nothing, while the
option that looks identical in an application module is the one that counts.

### Two more bootstrap options that are not options

`bootstrap()`'s JSDoc in
`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` shows a
`queueIds: ["chunk"]` key that `BootstrapOptions` does not declare — queue ids
come from `config().chunkQueues.queueIds`. Separately, `base.config.ts` reads
`MCP_ENABLED` into `mcp.enabled`, while what actually mounts the MCP server is
`bootstrap({ mcp: true })`.

*Consequence:* an example copied from the docblock is dropped silently, and an
app that sets only `MCP_ENABLED=true` gets no MCP server and no error.

### `pushMeta.labelName` is not the label that is stored

`packages/nestjs-neo4jsonapi/src/foundations/push/entities/push.meta.ts`
declares `labelName: "Push"`, while every query in
`packages/nestjs-neo4jsonapi/src/foundations/push/repositories/push.repository.ts`
matches and merges `:PushSubscription`.

*Consequence:* inert today, because the repository hand-writes its Cypher — and
wrong the first time someone builds a descriptor-driven query from that meta.

### `stripeWebhookEventMeta.type` does not match its endpoint

It declares `type: "stripe-webhook"` against `endpoint: "stripe-webhooks"`.
Every other Stripe meta — payment methods, usage records — keeps the two
identical.

*Consequence:* a client that derives the {json:api} `type` from the endpoint, as
the sibling resources allow, gets it wrong for this one.

### `WaitlistService` sends English links whatever the locale

`packages/nestjs-neo4jsonapi/src/foundations/waitlist/services/waitlist.service.ts`
hard-codes the string `"en"` in three places — the mail locale and the `en/`
segment of every confirmation URL it builds.

*Consequence:* a localised application sends its waitlist audience English mail
pointing at the English route.

### `ChunkService.propagateAndEmbedDates` has no caller

The method is public and fully implemented; the only other mention of it in the
package is a comment in `ChunkRepository` describing what it would pass. No
processor invokes it.

*Consequence:* date propagation across a document's chunks runs only if your own
code calls it, which nothing tells you.

### The chunker leaves its downloaded files in `/tmp`

`ChunkerService._downloadFile` writes `/tmp/temp-file.<uuid>.<ext>` and returns
the path with no cleanup. The two paths that do unlink — email attachments and
the plain-text extraction branch — show the pattern the main path omits.

*Consequence:* every chunked document leaves a copy of itself on the worker's
filesystem, and the container has no sweep.

### Three files read `process.env` outside the sanctioned place

`base.config.ts` is supposed to be the only backend reader.
`apps/api/src/features/features.modules.ts`,
`apps/api/src/openapi/openapi.config.ts` and
`apps/web/src/server-actions/auth-cookies.ts` read `NODE_ENV`, the two OpenAPI
toggles and `npm_package_version` directly.

*Consequence:* every one of those reads is a build-mode flag, so nothing breaks
— but the rule as written admits no exception, and each is a precedent.

## Frontend

### `matchUrlToModule` ignored the URL it was asked about — fixed in `@carlonicora/nextjs-jsonapi` 4.0

`packages/nextjs-jsonapi/src/features/user/contexts/CurrentUserContext.tsx`
named the parameter `_params` and matched against the pathname from
`usePathname()` instead, so `hasPermissionToPath(url)` answered for the page the
user was already on. 4.0 matches `params.path`. It still returns `true`
whenever no module matches; that half is a trap, recorded on the known-traps
page.

*Consequence while it lasted:* every navigation item in a render got the same
answer. Treat the client gate as cosmetic either way; the API enforces.

### `ErrorProvider` is dead, so no global error handler is installed

`apps/web/src/features/common/contexts/ErrorContext.tsx` exports `ErrorProvider`,
which requires `setGlobalErrorHandler` from `@/data/abstracts/AbstractService`.
No layout mounts the provider, and apps/web/src/data does not exist — the real
export lives in the frontend package's `AbstractService`.

*Consequence:* the handler consulted on a non-ok response is never set, so a
failed call throws instead of rendering the error surface.

### A user who belongs to two companies cannot finish logging in

`packages/nestjs-neo4jsonapi/src/foundations/auth/entities/auth.ts` returns
`requiresCompanySelection` and a scoped `selectionToken`, and documents the
client contract: let the user pick, then call
`POST /auth/company-selection/:companyId`. None of the three strings
`requiresCompanySelection`, `company-selection` or `selectionToken` appears
anywhere in `packages/nextjs-jsonapi/src`.

*Consequence:* the backend refuses to create a session and the frontend has no
screen to satisfy it, so login stops with a token the app cannot spend.

### `FeatureIds.Core` joins to nothing that is seeded

`apps/web/src/enums/feature.ids.ts` declares one member, `Core = "core"`. The
only `Feature` node any migration creates is `Common`, with a UUID, in
`apps/api/src/neo4j.migrations/20250901_001.ts`, and the package's feature check
compares that node's `id` to the string it is handed.

*Consequence:* feature gating is inert out of the box — a module declaring
`feature: FeatureIds.Core` is hidden from everyone but an administrator, who
short-circuits the check.

### Three redirect targets have no route

`ServerSession.checkPermission` sends a refused permission to `/401`;
`apps/web/src/features/common/components/wrappers/TrialBlockingWrapper.tsx`
sends a blocked subscription to `/trial-expired`; the OAuth error page, the
package's register form and its waitlist confirmation link to `/waitlist`. None
of the three exists; the only waitlist surface is `/administration/waitlist`.

*Consequence:* three failure paths land on the 404 page instead of the page that
would explain what happened.

### The admin console's two menus disagree, and three of its routes have no entry point

`apps/web/src/features/common/components/navigations/CommonSidebar.tsx` carries a
comment saying its administration group mirrors the platform group of the
package's `AdminIndexContainer` — "same destinations, same order". The sidebar
lists companies, users, token-usage, ai-connections and products; the index grid
also lists `/administration/rbac`. Three shipped pages —
`/administration/howtos`, `/administration/waitlist` and
`/administration/rbac/roles` — are linked from neither.

*Consequence:* RBAC is reachable from one menu only, and three admin screens are
reachable only by typing the URL.

### Six registered frontend modules have nowhere to render

`apps/web/src/config/Bootstrapper.ts` registers `Assistant`, `AssistantMessage`
and `AssistantAction`, plus `TwoFactorEnable`, `TwoFactorChallenge` and
`TwoFactorStatus`. Nothing under `apps/web/src/app` mounts an assistant surface,
and `SecurityContainer` and `TwoFactorSettings` appear nowhere in `apps/web/src`.

*Consequence:* six modules are in the registry, their API routes are live, and a
user has no page from which to reach any of them.

### Registration is gated by two flags, and the template sets one

`apps/web/src/config/instrumentation-env.ts` calls `configureLogin` with
`registrationMode: ENV.REGISTRATION_MODE` and no `allowRegistration`, which
`packages/nextjs-jsonapi/src/login/config.ts` then defaults to `true`.
`Register.tsx` branches on `getRegistrationMode()`, while `LandingComponent`
shows its register link on `isRegistrationAllowed()`.

*Consequence:* with `NEXT_PUBLIC_REGISTRATION_MODE=closed` the landing page
still offers registration; only the form behind it knows the mode.

### The search module carries a placeholder module id

`apps/web/src/features/essentials/search/SearchModule.ts` declares
`moduleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"`, which appears in no
migration, in no entry of `apps/api/src/rbac/module-id.map.json`, and not at all
in `packages/shared`.

*Consequence:* every permission check against the search module denies.

### The global stylesheet meets neither consumer requirement

`packages/nextjs-jsonapi/CLAUDE.md` states two things a consuming app must add:
the `--color-success` / `--color-success-foreground` tokens, and the base-layer
`cursor: pointer` rule Tailwind v4 dropped from Preflight.
`apps/web/src/app/globals.css` has neither, and nothing mounts
`DirectionProvider`.

*Consequence:* success-styled text compiles to no colour at all, raw buttons in
package components show no pointer, and an RTL locale gets LTR-resolved popups.

### The theme block maps the font tokens to variables nothing defines

`apps/web/src/app/globals.css`'s `@theme inline` block sets
`--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)`;
neither Geist variable is defined anywhere in `apps/web/src`. The root layout
loads Inter and sets `--font-sans` on the body itself. The same file carries a
commented-out duplicate of its own `@layer base` block.

*Consequence:* the token resolves to nothing, and the page renders in Inter only
because the layout sets that variable a second time further down the cascade.

### Two files know about an Italian locale that does not exist

`apps/web/global.d.ts` does `import it from "./messages/it.json"` and derives
`IntlMessages` from it, while `apps/web/messages/` holds
`apps/web/messages/en.json` and nothing else.
`apps/web/src/i18n/useDateFnsLocale.ts` maps both `en` and `it` to a `date-fns`
locale, while `apps/web/src/i18n/routing.ts` declares only `en`.

*Consequence:* message-key type checking is broken from the first scaffold, and
both files must be edited for a real second locale.

### "This is Base UI, not Radix" — except for the two Radix packages still installed

`apps/web/vitest.setup.ts` stubs pointer-capture methods "for Radix UI
compatibility", `apps/web/src/features/onboarding/config/tours.config.ts`
simulates a click "for Radix UI", and the frontend package carries a third such
comment. `apps/web` depends on neither library directly; the frontend package
depends on `@base-ui/react` and still declares `@radix-ui/react-label`, which
nothing imports, and `@radix-ui/react-slot`, which
`packages/nextjs-jsonapi/src/shadcnui/custom/kanban.tsx` imports as `Slot`.

*Consequence:* `CLAUDE.md` spends a bullet asserting that Radix is gone and
`asChild` does not exist, while one package component is built on the Radix
primitive that provides it.

### Two `cn` implementations

`apps/web/src/utils/cn.ts` and `packages/nextjs-jsonapi/src/utils/cn.ts` are
separate implementations of the same `clsx` + `tailwind-merge` helper.

*Consequence:* two places to change a merge rule, and no alias naming either.

## Framework packages

### Regenerating the RBAC matrix emits an import from another organisation

`apps/api/scripts/rbac-dump.ts` calls `dumpRbacMatrix` without `importLines`, so
`packages/nestjs-neo4jsonapi/src/foundations/rbac/serializer/matrix-to-ts.ts`
writes its `DEFAULT_IMPORT_LINES`, which import `RoleId` and `ModuleId` from
another organisation's package rather than `@{{name}}/shared`. The dev
controller's `PUT` uses the same serialiser.

*Consequence:* the dump script, and the RBAC editing UI behind it, overwrite a
compiling `apps/api/src/rbac/permissions.ts` with one that does not compile.

### The socket layer accepts anyone and emits nothing the client listens for

`packages/nestjs-neo4jsonapi/src/core/websocket/gateways/event.gateway.ts`
hard-codes `cors: { origin: "*" }` and, on a handshake with no token, sets the
client's user to a null id and returns rather than refusing, while
`packages/nextjs-jsonapi/src/hooks/useSocket.ts` subscribes to a `notification`
event no package code emits.

*Consequence:* an unauthenticated socket from any origin receives broadcasts,
and the bell stays silent until application code emits that event.

### Five declared symbols are unreachable from outside their package

`usePushNotifications` is a default export re-exported with `export *`, which
carries no default; `ServerAbstractService` is exported by no barrel;
`packages/nextjs-jsonapi/src/components/tables/cells/cell.text.tsx` is missing
from its own `index.ts`; `packages/nestjs-neo4jsonapi/src/index.ts` re-exports
`./openapi`, which has no `exports` entry; and the retrieval-eval harness under
that package's `src/eval` is in neither the root barrel nor the `exports` map.

*Consequence:* five things that read as public API and cannot be imported, with
errors that name the subpath rather than the barrel.

### A second locale means editing the package, not configuring it

`AbstractService.getClientLocale` and its twin in `ClientAbstractService` both
validate against a hard-coded `const supportedLocales = ["en"]`.
`configureI18n` in `packages/nextjs-jsonapi/src/i18n/config.ts` accepts hooks, a
`Link` component and a `getLocale` function only — it carries no locale list that
could override the array.

*Consequence:* an application that adds a locale keeps sending the package's
English `Accept-Language` until the package itself changes.

### A `cache` value the package does not recognise became a 60-second tag — fixed in `@carlonicora/nextjs-jsonapi` 4.0

`packages/nextjs-jsonapi/src/server/request.ts` mapped a reserved cache-life
name to its seconds and treated anything else as a cache tag with a hard-coded
`revalidate = 60`, while `packages/nextjs-jsonapi/README.md` described the
feature as built-in support for `cacheLife()` and `cacheTag()`. In 4.0 a GET
with a `cache` value goes through `cachedServerGet` in
`packages/nextjs-jsonapi/src/server/cachedGet.ts`, which does call both: a
profile name from `packages/nextjs-jsonapi/src/server/cacheProfiles.ts` becomes
`cacheLife(name)`, anything else `cacheTag(value)` with `cacheLife("max")`. The
README is now right.

*Consequence while it lasted:* a typo in a profile name was cached for a minute.
It still does not fail — it now becomes a tag cached until that tag is
revalidated.

### `packages/shared` hides `SystemRoles` and declares an unused `zod`

`packages/shared/src/index.ts` exports `ModuleId` and `RoleId` only.
`SystemRoles`, which `packages/shared/src/const/roles.id.ts` spreads into
`RoleId`, is reachable from outside only by deep path import.
`packages/shared/package.json` declares `zod`, and nothing under
`packages/shared/src` imports it.

*Consequence:* an app that wants to tell framework roles from its own has to
reach past the barrel, and the manifest claims a runtime dependency the package
does not have.

### Both packages document surfaces they do not have

`packages/nestjs-neo4jsonapi/CLAUDE.md` lists five entry points where
`package.json` declares nine, and names an `AbstractController` that exists
nowhere in the package. `packages/nextjs-jsonapi/README.md` up to 4.0.2
advertised `/permissions`, `/features`, `/utils` and `/shadcnui`, none of which
its `exports` map declares; 4.0.3 fixed the nextjs README, so only the nestjs
half of this entry still holds.

*Consequence:* an import copied from either document fails to resolve, and the
instruction file an agent reads first is wrong about both public surfaces.

### Two package scripts cannot do what they say

`packages/nestjs-neo4jsonapi/tsup.config.ts` defines a multi-entry build that no
script runs — `build` is a chain of `tsc` invocations plus a template copy —
though `tsup` remains a devDependency. The package's own `generate:rbac-paths`
runs its CLI without `--module-id-map`, which that CLI rejects; only the
app-level script passes it.

*Consequence:* two manifest entries that look authoritative, one describing a
build that never happens and one that fails the moment it runs.

### `StripePromotionCodeModule`'s module id is not a UUID

`packages/nextjs-jsonapi/src/features/billing/stripe-promotion-code/stripe-promotion-code.module.ts`
declares `moduleId: "b8e4f6a2-9d0c-5b3f-c7e8-4g2d9f0a5c6e"`, which contains the
character `g`.

*Consequence:* inert today, since nothing resolves it — and it can never match a
seeded module node, so the permission check it exists for cannot pass.

### `OperatorModule` is exported but not in `AgentsModule`

`packages/nestjs-neo4jsonapi/src/agents/index.ts` exports `OperatorModule`, while
`AgentsModule` imports eight other agent modules and not that one. It reaches
the application through a `forwardRef` in `AssistantModule`.

*Consequence:* the agent inventory you get from reading `AgentsModule` is
incomplete by one, and disabling the assistant foundation silently takes the
operator with it.

## Tests

### Two application suites are empty, and one of them targets a missing directory

`apps/api` and `packages/shared` ship zero test files, `apps/web` ships eight
that cover only the application shell, and all three Vitest configs set
`passWithNoTests: true`.
`apps/api/vitest.e2e.config.ts` includes `test/**/*.e2e-spec.ts` against a
directory `apps/api` does not have, with `testcontainers` and `supertest`
installed for it.

*Consequence:* "the tests pass" is true and means little; `pnpm test:e2e:api`
is a no-op that reports success. Apart from the web shell specs, the only
application coverage is the Playwright suite under `apps/web/tests/`.

### `packages/shared` runs `*.test.ts` only

`packages/shared/vitest.config.ts` includes `src/**/*.test.ts`; the other three
app-side configs include both `*.test.*` and `*.spec.*`.

*Consequence:* a spec-suffixed file added to the shared package never runs, and
`passWithNoTests` means it never says so.

## Vocabulary from other applications

Names written for an earlier application, shipped verbatim and substituted by
nothing. Three were fixed on 2026-09-11 — the two in this repository and the
TOTP issuer in the backend package. The rest are in the framework packages,
which are separate repositories with their own consumers.

| File | What it carries |
|---|---|
| `packages/nestjs-neo4jsonapi/src/foundations/oauth/services/oauth.service.ts` | A fallback API URL on another product's domain, used when `api.url` is unset |
| `packages/nestjs-neo4jsonapi/src/foundations/oauth/constants/oauth.scopes.ts` | Four of nine fixed scopes naming resources no foundation defines |
| `packages/nestjs-neo4jsonapi/CLAUDE.md` | A `bootstrap()` example importing two modules from another product |
| `packages/nestjs-neo4jsonapi/src/foundations/user/repositories/user.repository.ts` | A docblock describing platform administrators as another product's owners |
| `packages/nestjs-neo4jsonapi/src/foundations/auth/controllers/auth.company.controller.ts`, `src/foundations/foundations.modules.ts`, `src/core/onnx-runtime/index.ts` | Comments citing another product as the worked example |

*Consequence:* the OAuth fallback URL is the only one with runtime effect — an
application that never sets `api.url` builds absolute URLs against a domain it
does not own. The scope list is a compile-time constant and the rest is comment
text. All of them need an edit to the package repository, not to this one.

**Fixed on 2026-09-11.** `TotpService` hard-coded a product name as the TOTP
issuer; it now reads `twoFactor.totpIssuer`, resolving `TOTP_ISSUER`, then
`WEBAUTHN_RP_NAME`, then `Application`, and `.env.example` sets
`WEBAUTHN_RP_NAME` from the application name rather than its slug. Existing
enrolments are unaffected — the issuer is metadata in the otpauth URI and takes
no part in the HMAC, so only newly generated QR codes carry the new label.
`docker-compose.yml`'s banner named a product where
`{{display}}` belonged and now carries the placeholder, so the scaffolder
substitutes it like every other. `apps/api/tsconfig.worker.json` attributed its
`deleteOutDir` race to a named sibling repository; the attribution is gone and
every technical fact in the comment is unchanged. All three are recorded here
rather than deleted, because a reader comparing an older generated application
against this one will find the difference.

## How to add a finding

Put it in the group it belongs to, under an H3 that states the contradiction in
one line. Then:

- **Name both files.** The one that claims it and the one that disproves it. A
  single citation is not a finding.
- **State the consequence in one line,** starting `*Consequence:*`. "None today"
  is an acceptable consequence; say so rather than inventing severity.
- **Do not fix it in the same change.** Recording and fixing are separate pieces
  of work with separate reviewers. If you do fix it, delete the entry — or, when
  the pattern is worth remembering, keep it and mark it fixed with the date and
  the change that fixed it, as the README entry above does.
- **If the error message hides the cause rather than a document being wrong,**
  it is a trap, not drift. It belongs on the known-traps page.

## Where to look

| File | Findings it proves |
|---|---|
| `apps/web/package.json` | The non-typechecking `typecheck`, the duplicated `tw-animate-css` |
| `apps/web/components.json` | Four aliases pointing at absent directories |
| `apps/web/src/enums/feature.ids.ts` | The feature id that joins to nothing seeded |
| `apps/web/src/app/globals.css` | Neither consumer requirement is met |
| `apps/api/src/features/essentials/search/repositories/search.repository.ts` | The empty label list behind the index that is never created |
| `apps/api/src/neo4j.migrations/20250901_003.ts` | Two grants against unknown module ids |
| `apps/api/scripts/rbac-dump.ts` | The regenerated file that imports another organisation's package |
| `versions.production.json` | The pin that `scripts/check-dep-drift.js` turns into a lint failure |
| `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | The two seams the template never binds, and how they fail |
| `packages/nestjs-neo4jsonapi/src/foundations/rbac/controllers/rbac-dev.controller.ts` | The unguarded file write |

## Gaps and drift

- Compiled by reading the template and the two framework packages on 2026-09-11,
  then merging what the other 96 handbook pages recorded. It is not a full audit
  of either package: the Stripe foundations, the LLM provider adapters, the agent
  tooling and the socket layer were read only where a claim required it.
- `DOCKER.md` (58 KB), `CORE-UPDATE.md` and `DEPENDENCY_UPGRADE_GUIDE.md` were
  read for the sections the handbook cites, not line by line.
- The `apps/web/messages/en.json` key tree was not audited against the strings
  the application renders; `apps/web/scripts/validate-translations.mjs` checks
  one direction only.
- Nothing is held back for space: every finding the handbook pages recorded and
  this page could confirm is here, including the ones about subsystems a fresh
  application never exercises.
- **Every entry was verified by reading source, none by running anything.** No
  claim here was reproduced against a booted API, an HTTP request or a Neo4j
  query, so a consequence stated as certain is a reading of the code, not an
  observation of it.
- Package findings were checked against the submodule checkouts —
  `@carlonicora/nestjs-neo4jsonapi` 4.2.0 and `@carlonicora/nextjs-jsonapi`
  3.8.2 — which are newer than the releases `versions.production.json` pins. A
  package finding may not hold for the version a production image installs.
  The entries updated for the `@carlonicora/nextjs-jsonapi` 4.0 migration were
  re-checked against 4.0.4.
- **Five claims made on other pages were checked and are not true here**, and
  are deliberately absent: that `CREDIT_COST=""` yields `NaN` (the config reads
  `parseFloat(process.env.CREDIT_COST || "0")`, so an empty value is `0`); that
  `POST /oauth/introspect` 404s (the route is declared and its controller
  registered); that the `features` namespace in `apps/web/messages/en.json` is
  read by nothing (the package's own components read it throughout); that
  `TokenUsageDescriptor` hides three relationships (its docblock documents the
  omission and the reason); and that the contextualiser's `chunk` and
  `chunkVector` prompt keys are undocumented dead weight (both are marked
  `@deprecated` and described as ignored). Do not re-add them.
- Nothing here has been fixed except the README rewrite, the deletion of the
  duplicated dependency guide, and the two package entries marked fixed in
  `@carlonicora/nextjs-jsonapi` 4.0. Everything else is open and deliberately so.
