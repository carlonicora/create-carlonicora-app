---
title: Deployment
section: 07-operations
---

{{display}} deploys as three units built from one `Dockerfile`. Nothing in this
repository provisions infrastructure or pushes an image; CI builds, tests and
tags, and the platform does the rest.

## The three deployment units

| Unit | Image target | Command | Listens | Needs |
|---|---|---|---|---|
| api | `api-production` | `node dist/main --mode=api` | `API_PORT` (4050) | Neo4j, Redis, object storage |
| worker | `api-production` | `node dist/main --mode=worker` | nothing | Neo4j, Redis, object storage |
| web | `web-production` | the web app's `start` script | `PORT` (4051) | the api, over HTTP |

api and worker are the **same image**, distinguished only by the `--mode` flag
`getAppMode()` reads from `process.argv` in
`packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts`. Worker mode turns
controllers off and turns queue processors, cron jobs and the migrator on.

Two consequences follow from that split and both matter at deploy time:

- **The worker owns the schema.** `MigratorService` is registered through
  `createWorkerProvider`, so only a worker applies `apps/api/src/neo4j.migrations`.
  An api-only deployment against a fresh database never gets its schema.
- **Workers scale horizontally, the api scales behind a load balancer.** They
  share the Redis queue, so any number of workers may run. `DOCKER.md` covers
  the sizing.

The web app can be scaled freely: it holds no server state beyond the session
cookies the browser carries.

## Environment at the platform

Every variable is read from `process.env` through
`packages/nestjs-neo4jsonapi/src/config/base.config.ts`, merged with
`apps/api/src/config/config.ts`. `.env.example` is the complete inventory,
grouped by subsystem, and marks which service reads each group. In production
nothing reads a file: `docker-compose.yml` passes variables inline, the three
single-service compose files use `env_file`, and a PaaS injects them directly.

**Must be set before the first boot, or the process exits:**

| Variable | Unit | What happens without it |
|---|---|---|
| `NEO4J_URI` | api, worker | `Neo4jService`'s constructor throws `"Neo4j configuration is required"`. |
| `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | api, worker | The driver authenticates as empty credentials against an unnamed database. |
| `JWT_SECRET` | api, worker | `JwtModule.registerAsync` receives `undefined` and the Passport strategy refuses to construct. |
| `REDIS_HOST`, `REDIS_PORT` | api, worker | BullMQ and the cache cannot connect; the readiness probe never returns 200. |
| `REDIS_QUEUE` | api, worker | Falls back to `default` — shared with every other app on the same Redis. |
| `S3_TYPE`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api, worker | Uploads fail; the `storage` health indicator reports "not configured" rather than failing, so this one is silent. |
| `API_URL`, `API_PORT` | api | Pagination links and OAuth redirect URIs point at `localhost:3000`. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADDRESS` | web | Baked into the bundle at build time — see below. |
| `API_URL`, `API_INTERNAL_URL`, `PORT` | web | Server-side rendering cannot reach the api. |

**Build-time only, for the web unit:** `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_ADDRESS`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `IMAGE_SOURCES` are inlined by
`next build`. Setting them on a running container does nothing. Changing one is
a rebuild, not a restart.

`.env.example`'s own header states the per-service requirement lists, and
`DOCKER.md` repeats them per deployment scenario.

## Pinning the framework packages

In development the two `@carlonicora/*` packages are git submodules resolved
through `workspace:*`. In production they come from npm at a fixed version.
Three files carry that seam.

| File | Role | Runs where |
|---|---|---|
| `versions.production.json` | The pins. Two entries, package name to version. | Read, never executed. |
| `scripts/sync-production-versions.js` | **Regenerates** the pins from the workspace packages themselves. | A developer machine, after a submodule bump. |
| `scripts/apply-production-versions.js` | **Applies** the pins, rewriting `workspace:*` in the two app manifests. | Inside the Docker build and inside both CI workflows. |

`scripts/sync-production-versions.js` derives its keys rather than trusting the file: it
parses the `packages:` globs out of `pnpm-workspace.yaml`, reads every package
manifest it finds, and for each `workspace:*` dependency of `apps/api` or
`apps/web` records that package's own `version`. Private packages —
`packages/shared` — are skipped and reported, because they ship as source and
pinning them to an npm version would break the build.

```bash
node scripts/sync-production-versions.js          # rewrite the file
node scripts/sync-production-versions.js --check  # exit 1 if stale, print the diff
pnpm sync:versions                                # the same, via package.json
```

`--check` prints each drifted entry as `name: old → new` and tells you to run
`pnpm sync:versions`. It is the read-only half of the same code path, so it can
never disagree with the writer.

`scripts/apply-production-versions.js` is deliberately dumber: it loads
`versions.production.json`, walks `apps/api/package.json` and
`apps/web/package.json`, and replaces a `dependencies` entry only when its value
is exactly the string `workspace:*`. It touches nothing else and writes nothing
when nothing matched.

## The dependency-drift guard

`scripts/check-dep-drift.js` runs on every `pnpm lint`
(`"lint": "turbo run lint && node scripts/check-dep-drift.js"`) and therefore on
every commit through `.husky/pre-commit`. It exits 1 on any violation and has no
external dependencies. It refuses to run at all when a submodule directory is
missing, telling you to `git submodule update --init`.

Its five invariants:

1. **Peers are provided.** Each app must declare every non-optional
   `peerDependency` of the framework package it consumes, with a range that
   satisfies the package's floor. `pnpm` is configured without
   `autoInstallPeers`, so a missing peer is a runtime crash, not a warning.
2. **Overlaps are identical and justified.** A dependency declared by both an
   app and its framework package must use the *same* range and appear on the
   app's `OVERLAP_ALLOWLIST` in the script. Divergence here is how a second copy
   of a library gets installed — two `@nestjs/common` resolutions break NestJS
   DI, two React copies break hooks and JSX types.
3. **devDependency ranges agree.** A devDependency declared in two or more
   workspace manifests must use one range everywhere.
4. **Overrides do not undercut declarations.** A pnpm override *replaces* a
   declared range rather than intersecting it, so an override below a declared
   floor silently resolves beneath it with no peer warning. The check is
   directional: the override must satisfy the declaration, not merely be
   comparable to it.
5. **`versions.production.json` matches the workspace.** Every pinned name must
   be a known workspace package at exactly the version that package declares.
   This is the invariant `scripts/sync-production-versions.js` repairs.

Ranges written as `catalog:` are resolved against the `catalog:` block of
`pnpm-workspace.yaml` before comparison, so the checks are semantic rather than
textual.

For upgrade work — which majors are deferred and why, and the migration each one
needs — read [`DEPENDENCY_UPGRADE_GUIDE.md`](../../../DEPENDENCY_UPGRADE_GUIDE.md)
at the repository root. `scripts/update.sh` carries the same deferral list as a
header comment.

## Continuous integration

Three workflows live in `.github/workflows/`. None of them builds or pushes a
Docker image, and none of them deploys.

### `.github/workflows/pull-request.yml`

Triggered on `pull_request` `opened` and `synchronize`.

1. `actions/checkout@v7` with `fetch-depth: 0`.
2. `pnpm/action-setup@v6`.
3. `actions/setup-node@v7`, Node 22.x, pnpm cache.
4. Install: `sed` the two submodule lines out of `pnpm-workspace.yaml`, run
   `node scripts/apply-production-versions.js`, then
   `pnpm install --no-frozen-lockfile`. **CI never initialises the submodules**
   — it always builds the production dependency path, against the npm versions
   in `versions.production.json`.
5. Write a three-line env file holding `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_ADDRESS` and a placeholder `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Just
   enough for the Next.js build to resolve its public variables.
6. Build `packages/shared`, then the api, then the web app, the last two with
   `NODE_OPTIONS=--max-old-space-size=4096`.
7. `pnpm test`.

### `.github/workflows/dev.yml`

Triggered on `push` to `dev`, with `permissions: contents: write`. Steps 1–7 are
the same as the pull-request workflow, with `NODE_OPTIONS` set to 6144 for the
whole job rather than per build step. Then one more:

8. **Create Tag** — `pnpm dlx semantic-release`, with `GITHUB_TOKEN` in the
   environment and `HUSKY: "0"` so the release commit does not re-trigger the
   local git hooks. `.releaserc` decides whether a release happens and what the
   version is; the release page in this section covers that file.

### `.github/workflows/check-library-updates.yml`

Triggered daily at 08:00 UTC (`cron: '0 8 * * *'`) and on `workflow_dispatch`.
`permissions: contents: write` and `pull-requests: write`.

1. Checkout, Node 22.
2. For each of `@carlonicora/nestjs-neo4jsonapi` and
   `@carlonicora/nextjs-jsonapi`: read the current pin out of
   `versions.production.json` with `jq`, ask npm for `latest` with `npm view`,
   and if they differ, rewrite the pin in place and record the change as
   `name:old→new`.
3. If anything changed, `peter-evans/create-pull-request@v8` opens a PR on
   branch `deps/library-updates` against base `dev`, titled
   `chore(deps): update library versions`, with the detected changes in the body
   and links to both packages' release pages. `delete-branch: true`.

The PR moves the **npm pin only**. The submodules still point wherever they
pointed. Adopting a package version fully means both halves — the submodule bump
and the pin — which the release page explains.

## Where to look

| File | What it gives you |
|---|---|
| `.github/workflows/pull-request.yml` | The build-and-test gate. |
| `.github/workflows/dev.yml` | The same, plus `semantic-release`. |
| `.github/workflows/check-library-updates.yml` | The daily npm-pin PR. |
| `versions.production.json` | The two production pins. |
| `scripts/sync-production-versions.js` | Regenerates them; `--check` fails when stale. |
| `scripts/apply-production-versions.js` | Substitutes them during the build. |
| `scripts/check-dep-drift.js` | The five invariants, with the allowlists in-file. |
| `.env.example` | Every variable, with the service that reads it. |
| `DEPENDENCY_UPGRADE_GUIDE.md` | Upgrade procedure and the deferred majors. |
| `DOCKER.md` | Deployment scenarios, scaling, capacity planning. |

## Gaps and drift

- No workflow builds, tags or pushes a container image, and none deploys. The
  path from a green `dev` build to a running container is outside this
  repository.
- Both build workflows write a `.env` containing `NEXT_PUBLIC_API_URL` and
  `NEXT_PUBLIC_ADDRESS` pointing at ports 3000 and 3001. Those are not this
  template's ports — `.env.example` uses 4050 and 4051 — but nothing in CI
  serves traffic, so the values only have to exist.
- `pnpm test` in CI exercises little: the api and `packages/shared` ship no
  spec and pass through `passWithNoTests`, and the web app's nine specs cover
  only the application shell.
- `scripts/check-dep-drift.js` hard-requires both submodules, so `pnpm lint`
  cannot run on a checkout created with `--skip-git` until
  `git submodule update --init` has been run.
- Not examined: the behaviour of any actual hosting platform, secret store or
  reverse proxy. This page describes only what the repository declares.
