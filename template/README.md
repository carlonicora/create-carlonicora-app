# {{display}}

[![version](https://img.shields.io/badge/version-1.39.0-blue)](package.json)
[![node](https://img.shields.io/badge/node-%3E%3D22-339933)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-11.24.0-F69220)](package.json)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E)](pnpm-workspace.yaml)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-000000)](pnpm-workspace.yaml)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB)](pnpm-workspace.yaml)
[![neo4j-driver](https://img.shields.io/badge/neo4j--driver-6-018BFF)](apps/api/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6)](package.json)

<!-- Replace this paragraph with a description of {{display}}. -->
{{display}} is a multi-tenant web application: people sign in, work inside a
company, and everything they create is stored as a graph. Nothing below this
paragraph says what the product does — it describes the stack the application
was scaffolded with. Say what {{display}} does here, in three or four sentences,
before the first feature ships.

## Workspace projects

| Path | pnpm name | Role |
|---|---|---|
| `apps/api` | `{{name}}-api` | NestJS on Fastify. One binary, two modes: `--mode=api` serves HTTP and WebSockets, `--mode=worker` runs queue processors, cron jobs and the Neo4j migrator. |
| `apps/web` | `{{name}}-web` | Next.js App Router frontend. `apps/web/src/proxy.ts` handles locale routing and token refresh. |
| `packages/shared` | `@{{name}}/shared` | The identifiers both apps must agree on — module ids and role ids. Built with `tsup`; a local workspace package, not a submodule. |
| `packages/nestjs-neo4jsonapi` | `@carlonicora/nestjs-neo4jsonapi` | The backend framework: `bootstrap()`, the Neo4j and {json:api} layers, RBAC, the LLM layer and 43 foundation modules. A git submodule. |
| `packages/nextjs-jsonapi` | `@carlonicora/nextjs-jsonapi` | The frontend framework: the typed API client, the model and module registries, the UI system and the foundation features. A git submodule. |

Both `@carlonicora/*` directories are git submodules declared in `.gitmodules`.
They are consumed as `workspace:*` dependencies, so the two apps build against
the checked-out source rather than an npm release.

## Technology stack

### Backend — `apps/api`

| Technology | Version | Declared in |
|---|---|---|
| NestJS (`@nestjs/common`, `@nestjs/core`) | `^12.0.1` | `pnpm-workspace.yaml` catalog |
| Fastify platform (`@nestjs/platform-fastify`) | `^12.0.1` | `pnpm-workspace.yaml` catalog |
| Fastify | `^5.12.1` | `apps/api/package.json` |
| Neo4j driver | `^6.2.0` | `apps/api/package.json` |
| BullMQ | `6.3.1` | `pnpm-workspace.yaml` overrides |
| `nestjs-cls` | `^6.2.1` | `apps/api/package.json` |
| LangChain | `^1.5.4` | `apps/api/package.json` |
| Zod | `^4.4.3` | `pnpm-workspace.yaml` catalog |
| OpenTelemetry API | `^1.9.1` | `apps/api/package.json` |

### Frontend — `apps/web`

| Technology | Version | Declared in |
|---|---|---|
| Next.js | `16.3.3` | `pnpm-workspace.yaml` catalog |
| React and React DOM | `19.2.8` | `pnpm-workspace.yaml` catalog |
| Tailwind CSS | `^4.3.3` | `apps/web/package.json` |
| `next-intl` | `^4.13.7` | `apps/web/package.json` |
| `react-hook-form` | `7.86.0` | `pnpm-workspace.yaml` catalog |
| Serwist | `9.5.12` | `apps/web/package.json` |
| Stripe.js | `^9.13.0` | `apps/web/package.json` |
| Yjs | `^13.6.32` | `pnpm-workspace.yaml` overrides |

### Toolchain

| Technology | Version | Declared in |
|---|---|---|
| Node.js | `>=22.0.0` | `package.json` engines |
| pnpm | `11.24.0` | `package.json` packageManager |
| Turborepo | `^2.10.8` | `package.json` |
| TypeScript | `^6.0.3` | `package.json` and `pnpm-workspace.yaml` overrides |
| Vitest | `^4.1.11` | `pnpm-workspace.yaml` catalog |
| Playwright | `^1.62.1` | `apps/web/package.json` |
| ESLint | `^9.39.5` | `pnpm-workspace.yaml` catalog |
| Prettier | `^3.9.6` | `package.json` |
| semantic-release | `25.0.8` | `package.json` |

## Prerequisites

- Node.js 22 or newer.
- pnpm 11 or newer; `corepack enable` picks up the pinned `packageManager`.
- Git, with submodule support.
- A reachable Neo4j server, a Redis server and an S3-compatible object store.
  This repository starts none of them: `docker-compose.yml` builds and runs
  `api`, `worker` and `web` only.

## Getting started

### 1. Add the two hostnames

The development stack answers on named hosts, not on `localhost`. Add both to
`/etc/hosts`:

```
127.0.0.1 {{name}}.test
127.0.0.1 api.{{name}}.test
```

### 2. Create the environment file

```bash
cp .env.example .env
```

`.env.example` documents every variable the stack reads. Before the first boot
set `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`, `REDIS_HOST`,
`REDIS_PORT`, `REDIS_QUEUE`, `JWT_SECRET` and the `S3_*` block. The API refuses
to start without `NEO4J_URI`; everything else either has a working default or
degrades to a disabled feature.

### 3. Point the three data stores at the app

Neo4j holds every entity, Redis backs the BullMQ queues and the response cache,
and the S3-compatible store holds uploaded files. Create the Neo4j database
named in `NEO4J_DATABASE` and the bucket named in `S3_BUCKET` before booting:
the worker's migrator creates constraints and indexes, not the database itself.

### 4. Install and run

```bash
pnpm install
pnpm dev
```

`pnpm install` checks out and builds both submodules. `pnpm dev` runs
`scripts/dev.sh`, which starts the web app, the API and the worker together. The
API listens on `http://api.{{name}}.test:4050` and the web app on
`http://{{name}}.test:4051`; both ports come from `.env.example` (`API_PORT` and
`PORT`).

The first hour, including the seeded administrator login, is walked through in
`docs/handbook/00-start-here/local-setup.md`.

## Commands

### Run

| Command | Description |
|---|---|
| `pnpm dev` | Web, API and worker together, through `scripts/dev.sh` |
| `pnpm dev:api` | API only |
| `pnpm dev:web` | Web only |
| `pnpm dev:worker` | Worker only |
| `pnpm dev:reset` | Clear the web app's Next.js build directory, kill stale node processes rooted in this checkout, then start dev |
| `pnpm start` | Every project's `start` task |
| `pnpm start:prod` | Every project's `start:prod` task |

### Build

| Command | Description |
|---|---|
| `pnpm build` | Build every workspace project |
| `pnpm build:api` | Build the API only |
| `pnpm build:web` | Build the web app only |
| `pnpm clean` | Remove build output and the root dependency tree |
| `pnpm clean:all` | Also remove every project's dependencies, build output, Next.js directory and Turborepo cache |

Never run a build while a dev server is up: `next build` and `next dev` share
the web app's Next.js build directory, and the dev server then serves 404s on
every route.

### Test

| Command | Description |
|---|---|
| `pnpm test` | Every project's Vitest suite |
| `pnpm test:verbose` | The same suites, full output |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:cov` | Vitest with V8 coverage |
| `pnpm test:e2e` | The full-stack Playwright suite via `scripts/e2e.sh`, on its own ports, database and queue prefix |
| `pnpm test:e2e:api` | The API's own end-to-end Vitest config |
| `pnpm e2e:dash` | The interactive e2e dashboard on `http://127.0.0.1:4084` |
| `pnpm e2e:dash:test` | The dashboard's own `node:test` suite |

### Quality

| Command | Description |
|---|---|
| `pnpm lint` | ESLint across the workspace, then `scripts/check-dep-drift.js` |
| `pnpm format` | Prettier across the workspace |
| `pnpm check:drift` | The dependency-drift rules on their own |
| `pnpm sync:versions` | Rewrite `versions.production.json` from the submodules' manifests |
| `pnpm check:handbook` | Verify every path and link this README and the handbook cite |

`.husky/pre-commit` runs `pnpm lint`; `.husky/pre-push` runs `pnpm build` and
`pnpm test`.

### Code generation

| Command | Description |
|---|---|
| `pnpm generate-module` | Scaffold an API feature module |
| `pnpm generate-web-module` | Scaffold a web feature |
| `pnpm neo4jsonapi-migrate` | Migrate an entity to the descriptor form |

All three run from the submodules' build output, so `pnpm install` (or a package
build) has to have completed first.

## API documentation

With the API running and `NODE_ENV` set to anything other than `production`:

- ReDoc — `http://api.{{name}}.test:4050/docs`
- Swagger UI — `http://api.{{name}}.test:4050/api-docs`

Both paths are set in `apps/api/src/openapi/openapi.config.ts`. In production
each is served only when `ENABLE_REDOC` or `ENABLE_SWAGGER` is `true`.

## Docker

`Dockerfile` is a single eleven-stage build covering development and production
images for the API, the worker and the web app. `docker-compose.yml` runs all
three together; `docker-compose.api.yml`, `docker-compose.worker.yml` and
`docker-compose.web.yml` run them independently. `DOCKER.md` covers deployment
strategies, scaling and the environment contract.

### Model cache

The API and the worker download every model registered in
`apps/api/config/models.config.yaml` on first start and cache it under
`MODELS_CACHE_DIR` (`/app/.cache/models`). That path lives in the container's
writable layer, so each release would otherwise start from an empty cache and
re-download the whole registry — around 2 GB per release for a full vision
stack. All three compose files therefore mount a named volume there, and
`docker-compose.yml` gives the API and the worker one each, since the two load
different model sets.

On Coolify a *Docker Compose* resource picks the volume up on its own and keeps
it across deployments; a *Dockerfile* resource ignores the compose file, so add
the mount by hand under *Storages → Add → Volume Mount* with destination
`/app/.cache/models`. Never prune volumes on those hosts. The registry ships
empty, so none of this costs anything until you register your first model.
`DOCKER.md` has the full section, including the `MODEL_*` environment variables.

## Core update workflow

This project can exchange configuration improvements with the scaffold it was
generated from. `CORE-UPDATE.md` describes proposing an improvement, generating
a portable patch, and applying one.

## Documentation

Start at `docs/handbook/README.md`, the developer handbook. It is the entry
point for architecture, the two framework packages, the backend and frontend
guides, the 43 foundation modules, the AI layer, operations and working
practices. Every directory and root file in this repository is described in
`docs/handbook/00-start-here/repo-tour.md`.

| Document | Covers |
|---|---|
| `docs/handbook/README.md` | The developer handbook index |
| `CLAUDE.md` | Architecture guardrails and the component routing table |
| `AGENTS.md` | Agent entry point; points at `CLAUDE.md` |
| `DOCKER.md` | Docker images, compose files, deployment and scaling |
| `DEPENDENCY_UPGRADE_GUIDE.md` | The dependency sweep procedure |
| `CORE-UPDATE.md` | Sharing template improvements back, and pulling them in |
| `EXTEND-USER.md` | Extending the user entity |
| `apps/api/CLAUDE.md` | API-specific rules |
| `apps/web/CLAUDE.md` | Web-specific rules |
| `packages/shared/CLAUDE.md` | Shared-package rules |
| `apps/web/tests/README.md` | The Playwright end-to-end suite |
| `CHANGELOG.md` | Written by semantic-release from conventional commits |

## License

Replace this section with the license {{display}} ships under.
`apps/api/package.json` currently declares `UNLICENSED`.
