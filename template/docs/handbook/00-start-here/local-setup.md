---
title: Local setup
section: 00-start-here
---

From a fresh clone to a logged-in browser. Roughly twenty minutes, most of it
waiting for the first install and the first Next.js compile.

## Prerequisites

| Requirement | Version | Declared in |
|---|---|---|
| Node.js | `>=22.0.0` | `package.json`, `engines` |
| pnpm | `>=11.0.0`, pinned to `11.24.0` | `package.json`, `engines` and `packageManager` |
| Git | any version with submodule support | `.gitmodules` |

`corepack enable` makes pnpm resolve to the pinned version automatically.
`package.json` runs `npx only-allow pnpm` on `preinstall`, so npm and yarn stop
with an error rather than producing a second lockfile.

Both apps additionally declare `"node": "22"` in `apps/api/package.json` and
`apps/web/package.json`.

## Hostnames

The stack answers on two named hosts, not on `localhost`. Add both:

```
# /etc/hosts
127.0.0.1 {{name}}.test
127.0.0.1 api.{{name}}.test
```

The names are not cosmetic. `CORS_ORIGINS` in `.env.example` allows exactly
`http://{{name}}.test:4051`, `WEBAUTHN_ORIGIN` must match the frontend origin
character for character, and `PUBLIC_HOSTNAME` is what `scripts/e2e.sh` derives
both e2e hosts from. Reaching the app on `http://localhost:4051` instead
produces CORS failures and passkey registration errors that look like
application bugs.

## Ports

| Port | Process | Variable |
|---|---|---|
| 4050 | API | `API_PORT` |
| 4051 | Web | `PORT` |
| 4080 / 4081 / 4082 | The end-to-end stack's API, web and reserved worker health port | `E2E_API_PORT`, `E2E_WEB_PORT`, `E2E_WORKER_HEALTH_PORT` in `.env.e2e.example` |
| 4084 | The e2e dashboard | `E2E_DASH_PORT`, default in `scripts/e2e-dashboard.mjs` |

The development ports and the e2e ports are disjoint on purpose: both stacks are
meant to run at the same time.

## The environment file

```bash
cp .env.example .env
```

`.env.example` is documentation. Nothing reads it; `apps/api/src/load-env.ts`
loads the real environment file, and `apps/web/package.json` runs every Next.js
command through `dotenv`, pointed at the same file.

Almost every setting has a working default, because
`createBaseConfig()` in `packages/nestjs-neo4jsonapi/src/config/base.config.ts`
falls back to a literal for each one. Three groups do not have usable defaults.

### Required before the first boot

| Variable | Why |
|---|---|
| `NEO4J_URI` | `Neo4jService`'s constructor throws `Neo4j configuration is required` when it is empty. This is the one variable whose absence stops the process. |
| `NEO4J_USER`, `NEO4J_PASSWORD` | Default to empty strings, so the driver authenticates as nobody and every query fails. |
| `NEO4J_DATABASE` | Defaults to empty. The driver then uses the server's default database, which is almost never the one you meant. |
| `REDIS_HOST` | Defaults to empty. BullMQ and the response cache both need it. |
| `REDIS_QUEUE` | Defaults to `default`. Redis is usually shared between projects; a shared prefix means another project's worker can consume your jobs. |
| `JWT_SECRET` | Defaults to an empty string. Tokens signed with an empty secret verify against any other empty-secret deployment. |

### Required before file upload works

`S3_TYPE`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
`S3_SECRET_ACCESS_KEY`. `S3Service` selects its client from `S3_TYPE` — the
shipped default is `minio`, which builds a path-style client against
`S3_ENDPOINT`. Nothing throws when these are wrong; uploads fail at request
time instead, and `/health` reports storage as unhealthy.

### Optional, and genuinely optional

Everything under the `AI_*`, `VISION_*`, `EMBEDDER_*`, `TRANSCRIBER_*`,
`EMAIL_*`, `STRIPE_*`, `VAPID_*`, `LOKI_*`, `TEMPO_*` and OAuth headings. An
unset block disables its feature rather than breaking the boot. Two are worth
setting early anyway: `TOTP_ENCRYPTION_KEY` (two-factor enrolment fails without
it) and `ENCRYPTION_KEY` (the administration page for AI connections rejects
every save without it).

`.env.example` groups every variable and marks which service reads it.

## The three data stores

| Store | Holds | Reached by |
|---|---|---|
| Neo4j | Every entity, every relationship, the RBAC matrix, the migration ledger | `NEO4J_URI` and the credentials beside it |
| Redis | BullMQ queues, the response cache | `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_QUEUE` |
| S3-compatible object storage | Uploaded files | The `S3_*` block |

**None of the three is provided by this repository.** `docker-compose.yml`
builds and runs `api`, `worker` and `web` and nothing else; the other three
compose files each run one of those services. Install Neo4j, Redis and MinIO (or
any S3-compatible store) yourself, or point the variables at instances you
already have.

Two things must exist before the first boot:

- the Neo4j database named in `NEO4J_DATABASE`. The migrator creates
  constraints, indexes and seed data inside a database; it does not create the
  database.
- the bucket named in `S3_BUCKET`.

## Install

```bash
pnpm install
```

This does three things beyond fetching dependencies:

1. `preinstall` refuses to continue under npm or yarn.
2. `.pnpmfile.cjs` strips the optional `supports-color` peer from every package
   that declares it, which is what keeps a single `@nestjs/core` in the tree. A
   duplicate crashes the API at boot with an unresolved-dependency error naming
   the wrong module.
3. `prepare` installs the husky hooks in `.husky/`.

If `packages/nestjs-neo4jsonapi` and `packages/nextjs-jsonapi` are empty, run
`git submodule update --init --recursive` first. Both apps depend on them as
`workspace:*`, and `turbo.json` makes every `dev`, `build` and `test` task
depend on `^build`, so the submodules are compiled before anything that imports
them starts. The apps consume the packages' build output, not their sources —
after editing a package, rebuild it.

## Run

```bash
pnpm dev
```

`pnpm dev` runs `scripts/dev.sh`, which ends in `turbo run dev dev:worker`.
Four long-running processes start: the `tsup` watcher for `packages/shared`,
the API in `--mode=api`, the API again in `--mode=worker`, and `next dev`.

Before starting anything, `scripts/dev.sh` clears the web app's Next.js build
directory in two cases: when the previous run left its lock file behind (an
unclean exit can leave a half-written route manifest, and Next then serves 404s
for pages that exist), and when the directory holds a production build (which
`next dev` cannot serve at all).

| Command | Starts |
|---|---|
| `pnpm dev` | Everything: shared watcher, API, worker, web |
| `pnpm dev:api` | The API only |
| `pnpm dev:web` | The web app only |
| `pnpm dev:worker` | The worker only |
| `pnpm dev:reset` | Stops the turbo daemon, kills node processes whose working directory is inside this checkout, clears the Next.js build directory, then runs `pnpm dev` |

`pnpm dev:reset` is the first thing to try when routes 404 or a watcher appears
wedged. It only kills processes rooted in this checkout and skips nested
worktrees, so it will not touch a dev server you are running elsewhere.

The worker, not the API, owns the Neo4j migrator. On a first boot, wait for the
worker to report the migrations before expecting a successful login.

## Verify the boot

`HealthController` in
`packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts`
exposes three public, unthrottled endpoints:

| Endpoint | Checks | Use |
|---|---|---|
| `http://api.{{name}}.test:4050/health` | Neo4j, Redis, storage and disk | The one to read while setting up. A 503 body names the failing dependency. |
| `http://api.{{name}}.test:4050/health/live` | Nothing — only that the process answers | Liveness probe |
| `http://api.{{name}}.test:4050/health/ready` | Neo4j and Redis | Readiness probe |

The API documentation confirms the HTTP layer is wired:

- ReDoc — `http://api.{{name}}.test:4050/docs`
- Swagger UI — `http://api.{{name}}.test:4050/api-docs`

Both paths come from `apps/api/src/openapi/openapi.config.ts`, which enables
them whenever `NODE_ENV` is not `production`.

Then open `http://{{name}}.test:4051`.

## First login

`apps/api/src/neo4j.migrations/20250901_004.ts` seeds one user:

| Field | Value |
|---|---|
| Email | `admin@{{name}}.com` |
| Password | `password` — the plaintext of the bcrypt hash the migration stores, recorded in `.env.e2e.example` |
| Role | Administrator, granted through `grantPlatformRole` |

Change that password before the application is reachable by anyone else.

### Why the seeded administrator belongs to no company

The migration grants the Administrator role on a membership with **no company
edge**, and the file says why: `AuthRepository.createSession` branches on
exactly that shape — holds Administrator, has no company — to build a session
with no company in scope. Seed the role any other way and login takes the
company branch, which dereferences the company id of a user that has none and
returns a 500 before a token is issued.

This is also the shape of a platform administrator generally. A user with a
company edge is scoped to that company by the CLS context, and every repository
query filters on it. A platform administrator has to sit outside that filter to
administer across companies at all. The role is granted with the framework's own
`grantPlatformRole` rather than hand-written Cypher so the seed cannot drift
from the membership model the rest of the code reads.

## Where to look

| File | Why |
|---|---|
| `.env.example` | Every variable, grouped, with the service that reads it |
| `packages/nestjs-neo4jsonapi/src/config/base.config.ts` | The default for every variable, and the only file allowed to read the environment |
| `apps/api/src/load-env.ts` | Why the environment load is an import and not a statement |
| `scripts/dev.sh` | What `pnpm dev` starts, and when it clears the build directory |
| `scripts/dev-reset.sh` | The safe reset, and the process-killing rules it follows |
| `apps/api/src/neo4j.migrations/20250901_004.ts` | The seeded administrator and the reasoning behind its shape |
| `packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts` | The three health endpoints |
| `apps/api/src/openapi/openapi.config.ts` | The documentation paths and their production switches |
| `.env.e2e.example` | The seeded credentials and the e2e stack's ports |
| `turbo.json` | Why the submodules build before anything else runs |

## Gaps and drift

- "Required" here means the boot fails or the feature silently does not work. It
  was determined by reading the defaults in
  `packages/nestjs-neo4jsonapi/src/config/base.config.ts` and the one constructor
  that throws, not by booting with each variable removed in turn.
- The list of stores assumes the shipped `S3_TYPE` of `minio`. `S3Service` also
  supports other providers whose required variables differ; those paths were not
  exercised.
- No compose file, script or documentation in this repository starts Neo4j,
  Redis or MinIO. The previous `README.md` claimed `docker compose up -d` did;
  it does not, and the claim is gone.
- The migration stores a bcrypt hash whose plaintext is recorded in
  `.env.e2e.example`. That is deliberate — the e2e suite logs in as this user —
  but it means the seeded password is public in every generated application.
