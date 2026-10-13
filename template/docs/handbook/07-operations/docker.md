---
title: Docker
section: 07-operations
---

{{display}} builds every deployable artefact from one `Dockerfile` with eleven
stages and ships four compose files. This page describes what the file
contains. Deployment strategies, per-service scaling and the resource profiles
live in [`DOCKER.md`](../../../DOCKER.md) at the repository root and are not
repeated here.

## The eleven stages

In file order. Each `FROM` names its parent, so the chain is linear apart from
the two roots.

| Stage | Base | Purpose |
|---|---|---|
| `base` | `node:22-alpine` | corepack activates pnpm 10.18.2; installs the native build toolchain and the OCR/image system libraries. |
| `workspace-deps` | `base` | Copies the manifests, `packages/shared` and **both submodules**, then `pnpm install --frozen-lockfile`. |
| `shared-builder` | `workspace-deps` | Builds `packages/shared`, then `packages/nestjs-neo4jsonapi`, then `packages/nextjs-jsonapi`. |
| `api-development` | `shared-builder` | Adds LibreOffice headless. `CMD` runs the api's `dev` script (hot reload). |
| `web-development` | `shared-builder` | `CMD` runs the web app's `dev` script (Turbopack hot reload). |
| `workspace-deps-prod` | `base` | The production dependency path — see below. Copies `packages/shared` and the two apps, but **not** the submodules. |
| `shared-builder-prod` | `workspace-deps-prod` | Builds `packages/shared` only. The framework packages come from npm, already built. |
| `api-builder` | `shared-builder-prod` | `pnpm --filter {{name}}-api build`. |
| `api-production` | `node:22-bookworm-slim` | The api and worker runtime image. Copies the build output, installs production dependencies only. `CMD` is `node dist/main --mode=api`. |
| `web-builder` | `api-builder` | Declares the build ARGs, promotes them to ENV, then `pnpm --filter {{name}}-web build`. |
| `web-production` | `node:22-alpine` | The web runtime image. `CMD` runs the web app's `start` script. |

`web-builder` inherits from `api-builder`, not from `shared-builder-prod`. A
build that targets `web-production` therefore compiles the api first, whether or
not that output is ever used.

## The two dependency paths

The development and production halves of the file resolve `@carlonicora/*`
differently, and that is the reason there are two of almost every stage.

**Development** (`workspace-deps`) copies `packages/nestjs-neo4jsonapi` and
`packages/nextjs-jsonapi` into the image and installs with
`--frozen-lockfile`. The `workspace:*` ranges in `apps/api/package.json` and
`apps/web/package.json` resolve to those directories, so the image contains the
submodule source and `shared-builder` compiles it. Editing the framework and
seeing the change is the point.

**Production** (`workspace-deps-prod`) copies neither submodule. Instead it
copies `versions.production.json` and `scripts/apply-production-versions.js`,
then does three things in order:

1. `node scripts/apply-production-versions.js` rewrites every
   `"workspace:*"` entry in `apps/api/package.json` and `apps/web/package.json`
   whose name appears in `versions.production.json` to the pinned npm version.
2. `sed -i '/nestjs-neo4jsonapi/d; /nextjs-jsonapi/d' pnpm-workspace.yaml`
   removes the two submodule globs, so pnpm no longer expects those directories
   to exist.
3. `pnpm install --no-frozen-lockfile` fetches the pinned versions from npm.
   The lockfile cannot be frozen here: step 1 has just changed the manifests it
   was generated from.

`packages/shared` is private, so it is never pinned — it is copied as source and
built in every path. `scripts/sync-production-versions.js` skips private
packages for exactly this reason.

The same three commands run in CI; see the deployment page.

## Why `api-production` is Debian and not Alpine

Every other stage is Alpine. `api-production` is `node:22-bookworm-slim`, and
the `Dockerfile` states why: the model-manager infrastructure in
`packages/nestjs-neo4jsonapi/src/core/model-manager` uses `onnxruntime-node`,
whose prebuilt binaries link against glibc and have no musl build. On Alpine the
native load fails with a missing `ld-linux-x86-64.so.2` and the worker crashes
during boot. The template ships glibc by default so that an app which later
enables ONNX or Transformers.js models in
`apps/api/config/models.config.yaml` does not have to change its base image to
do it. That file ships with `onnx: []` and `transformers: []`, so nothing is
downloaded until an entry is added.

The consequence is a package-name split: the Alpine stages install `cairo-dev`,
`jpeg-dev`, `libwebp-dev`; the Debian stage installs `libcairo2`,
`libjpeg62-turbo`, `libwebp7`. A new runtime dependency must be added twice.

## System packages, and what needs them

| Stage | Packages | Needed by |
|---|---|---|
| `base` | `python3`, `py3-pip`, `make`, `g++` | node-gyp builds of native modules during `pnpm install`. |
| `base` | `cairo-dev`, `jpeg-dev`, `pango-dev`, `giflib-dev`, `libwebp-dev` | `sharp` — Next.js image optimisation and server-side image handling. |
| `base` | `tesseract-ocr`, `tesseract-ocr-data-ita`, `graphicsmagick`, `ghostscript` | The chunker's OCR path for scanned PDFs and images. |
| `api-development` | `libreoffice`, `ttf-liberation`, `ttf-dejavu` | `libreoffice-convert`, DOCX to PDF. Present only to keep development at parity with production. |
| `api-production` | `libcairo2`, `libjpeg62-turbo`, `libpango-1.0-0`, `libgif7`, `libwebp7` | `sharp`, runtime only — no build tools in the runtime image. |
| `api-production` | `tesseract-ocr`, `graphicsmagick`, `ghostscript` | OCR, as above. |
| `api-production` | `libreoffice`, `fonts-liberation`, `fonts-dejavu` | DOCX to PDF. |
| `web-production` | `cairo`, `jpeg`, `pango`, `giflib`, `libwebp` | `sharp` at request time, for the Next.js image optimizer. |

`api-production` also sets `MODELS_CACHE_DIR=/app/.cache/models` and
`MODEL_CONFIG_PATH=/app/config/models.config.yaml`, and copies
`apps/api/config/models.config.yaml` to that second path. The first of those is
a container path, which is why every compose file mounts a volume over it — see
[the model cache volume](#the-model-cache-volume) below.

## The web build ARGs and the `NEXT_PUBLIC_*` bake

`web-builder` declares nine ARGs and promotes each to an ENV of the same name so
the Next.js build can read it from `process.env`:

| ARG | Becomes | Reaches |
|---|---|---|
| `API_URL` | `API_URL` | Server components and route handlers. |
| `API_INTERNAL_URL` | `API_INTERNAL_URL` | Server-side calls on the same machine. |
| `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_API_URL` | **The browser bundle.** |
| `NEXT_PUBLIC_ADDRESS` | `NEXT_PUBLIC_ADDRESS` | **The browser bundle.** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **The browser bundle.** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **The browser bundle.** |
| `IMAGE_SOURCES` | `IMAGE_SOURCES` | The CSP headers and the image `remotePatterns` that `createNextConfig`, called from `apps/web/next.config.js`, builds. |
| `WEB_NODE_OPTIONS` | `NODE_OPTIONS` | The build process's heap limit. |
| `PORT` | *(ARG only)* | `EXPOSE` in `web-production`. |

Next.js inlines every `NEXT_PUBLIC_*` value into the JavaScript it emits. Those
four are therefore **fixed at build time and public**. Changing one at runtime
changes nothing; the image has to be rebuilt. `docker-compose.web.yml` says so
in its header, and repeats the values under `environment:` only so that a reader
comparing the two blocks is not confused — Next.js does not read them there.

`IMAGE_SOURCES` is in the same position for a different reason: it feeds the CSP
header list that the package's `createNextConfig` (in
`packages/nextjs-jsonapi/src/next-config/csp.ts`), called from
`apps/web/next.config.js`, computes at build time.

## The four compose files

| File | Services | Build target | Ports | Env source |
|---|---|---|---|---|
| `docker-compose.yml` | `api`, `worker`, `web` | `api-production` (twice), `web-production` | `${API_PORT:-4050}`, none, `${PORT:-4051}` | Inline `environment:`, api and worker sharing a YAML anchor |
| `docker-compose.api.yml` | `api` | `api-production` | `${API_PORT:-4050}` | `env_file: .env` |
| `docker-compose.worker.yml` | `worker` | `api-production` | none | `env_file: .env` |
| `docker-compose.web.yml` | `web` | `web-production` | `${PORT:-4051}` | `env_file: .env`, plus build args |

The three single-service files carry `restart: unless-stopped`; the combined
file does not.

`worker` has no ports in any file. It runs the same image as `api` with an
explicit `command:` of `node dist/main --mode=worker`, which overrides the
`CMD` baked into `api-production`.

### The model cache volume

Every compose file mounts a named volume at `/app/.cache/models`, the
`MODELS_CACHE_DIR` the `api-production` stage sets.

| File | Volumes |
|---|---|
| `docker-compose.yml` | `api-model-cache` on `api`, `worker-model-cache` on `worker` |
| `docker-compose.api.yml` | `model-cache` |
| `docker-compose.worker.yml` | `model-cache` |
| `docker-compose.web.yml` | none |

The model manager downloads everything registered in
`apps/api/config/models.config.yaml` on first start and caches it under that
path. The path is in the container's writable layer, so a release that builds a
new container would otherwise find an empty cache and fetch the whole registry
again — for an app with a full vision stack, gigabytes per release, per service.
The registry ships empty, so the mount does nothing until an app adds its first
model, and costs nothing while it does nothing.

`docker-compose.yml` declares two volumes rather than one because the api and
the worker do not load the same set: `ModelManagerService.shouldLoadModel` loads
every model in worker mode but only those flagged `loadInApi` in api mode. Two
containers sharing one volume would also race on a cold start, both writing the
same file. The single-service files declare one volume each, since each runs one
service.

Deployment-side handling — what a Coolify resource does with the volume, the
disk it needs, and which `MODEL_*` variables tune the cache — is in
[`DOCKER.md`](../../../DOCKER.md#model-cache).

### The shared environment anchor

`docker-compose.yml` defines a YAML anchor, `x-api-worker-shared-env`
(`&api_worker_shared_env`), and both `api` and `worker` merge it with `<<:`.
It carries everything the two processes must agree on: `NEO4J_*`, `REDIS_*`,
`JWT_SECRET` and `JWT_EXPIRES_IN`, `VAPID_*`, `EMAIL_*`, `LOKI_*`,
`CONSOLE_ENABLED`, `TEMPO_*`, `S3_*`, `AI_*`, `TRANSCRIBER_*` and `EMBEDDER_*`.
Anything api-only — `CACHE_*`, `RATE_LIMIT_*`, `CORS_*`, `PORT` — is declared on
the `api` service alone.

A worker with a different `NEO4J_DATABASE` or `REDIS_QUEUE` than the api is a
silent data-corruption bug: the api enqueues a job and a worker executes it
against another database. The anchor exists to make that impossible to do by
accident.

### Healthchecks

| Service | Test | Start period |
|---|---|---|
| `api` | `node -e` GET `localhost:${API_PORT}/health/ready`, exit 0 only on HTTP 200 | 40s |
| `web` | `node -e` GET `localhost:${PORT}/`, exit 0 on any 2xx–4xx | 40s |
| `worker` | `pgrep -f "node.*dist/main.*worker"` | 30s |

All three use a 10s interval, a 5s timeout and 3 retries.

The web check accepts 4xx as well. Without a session `/` is the proxy's rewrite
to the static landing and normally answers 200, but the check is proving the
server answers, not that a route exists.

The worker's check is a process check rather than an HTTP request because **the
template does not opt into the worker health port**. `bootstrapWorker` in
`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` starts a one-route HTTP
server only when `options.worker.healthCheckPort` is set, and
`apps/api/src/main.ts` does not set it. Until an app passes that option there is
nothing to poll, so compose falls back to asking whether the process exists.
`pgrep` inside the container matches only that container's own process tree, so
the rule against name-pattern kills on a developer machine does not apply here.

### `extra_hosts`

Both `web` services map `${PUBLIC_HOSTNAME:-{{name}}.test}` to `host-gateway`.
Next.js 16's image optimizer fetches `/public` assets from the app's own public
hostname. Without the mapping that request leaves the container, goes out to the
reverse proxy or CDN, and comes back in — slow at best, a loop or a TLS failure
at worst. The mapping sends it straight back to the host gateway.
`PUBLIC_HOSTNAME` is set in `.env.example` and defaults to `{{name}}.test`.

## What compose does not provide

Neo4j, Redis and object storage are **external**. No compose file in this
repository defines them, and no volume is declared for them anywhere — the model
caches above are the only volumes the compose files declare. The
services connect over the URIs in the environment — `NEO4J_URI`, `REDIS_HOST`,
`S3_ENDPOINT` — and expect something already listening. Provisioning them,
backing them up and sizing them is outside what this repository automates. The
data-stores page in this section describes what each one holds.

## Where to look

| File | What it gives you |
|---|---|
| `Dockerfile` | All eleven stages; the comment above `api-production` carries the glibc rationale. |
| `docker-compose.yml` | The three-service stack, the shared env anchor and the two model-cache volumes. |
| `docker-compose.api.yml` | The api alone, `env_file`-driven. |
| `docker-compose.worker.yml` | The worker alone, with the scale-out note in its header. |
| `docker-compose.web.yml` | The web app alone, with the rebuild-on-`NEXT_PUBLIC_*`-change warning. |
| `DOCKER.md` | Deployment strategies, scaling, capacity planning, troubleshooting. |
| `versions.production.json` | The npm versions the production path substitutes. |
| `scripts/apply-production-versions.js` | The substitution itself. |
| `apps/api/config/models.config.yaml` | The ONNX/Transformers registry the Debian base exists for. Ships empty. |
| `apps/web/next.config.js` | The app's options to `createNextConfig`, which is where `IMAGE_SOURCES` and the `NEXT_PUBLIC_*` values land. |

## Gaps and drift

- `DOCKER.md` documents a **docker-compose.dev.yml** overlay repeatedly
  (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up`). That
  file does not exist in this repository. The development targets
  `api-development` and `web-development` are reachable only by building them
  directly with `--target`.
- `DOCKER.md` also has a "**.dockerignore** Explanation" section. There is no
  **.dockerignore** in this repository, so every stage's `COPY` includes whatever
  the build context holds.
- The compose anchor passes `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`,
  `EMAIL_USERNAME` and `EMAIL_PASSWORD`, which `.env.example` does not list.
  They are read by the package's email configuration, so an SMTP deployment has
  to add them by hand.
- The `base` stage installs `tesseract-ocr-data-ita`, an Italian OCR language
  pack, while the package's chunker configuration defaults `OCR_LANGUAGE` to
  `eng`. Nothing in the template selects the Italian data.
- The root `package.json` declares `"packageManager": "pnpm@11.24.0"` and
  `engines.pnpm >= 11`, while every `Dockerfile` stage activates
  `pnpm@10.18.2`. Images therefore install with a different pnpm major than a
  developer machine does.
- Not examined: the behaviour of the image under an actual `docker build`. Every
  claim here is read from the files, not from a build log.
