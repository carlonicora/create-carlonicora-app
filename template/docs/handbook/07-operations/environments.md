---
title: Environments
section: 07-operations
---

{{display}} has three environments. Two of them run on a developer's machine at
the same time and must not touch each other, which is why almost every value
below differs between them.

| | Local | End-to-end | Production |
|---|---|---|---|
| api port | 4050 (`API_PORT`) | 4080 (`E2E_API_PORT`) | `API_PORT`, platform-set |
| web port | 4051 (`PORT`) | 4081 (`E2E_WEB_PORT`) | `PORT`, platform-set |
| worker health port | not opened | 4082 reserved, not opened | not opened |
| Neo4j database | `{{name}}` (`NEO4J_DATABASE`) | `{{name}}test`, dropped and recreated every run | per deployment |
| Redis queue prefix | `{{name}}` (`REDIS_QUEUE`) | `{{name}}e2e` | per deployment |
| Web build | `next dev`, Turbopack, **.next** | `next build` + `next start`, **.next-e2e** | `next build` inside the image |
| api runtime | `nest start --watch` from source | the same | `node dist/main` |
| Rate limiting | on (`RATE_LIMIT_ENABLED=true`) | **off**, forced by the runner | on |
| Cookie `secure` flag | false | true under `next start`, which is why the suite plants cookies directly | true |

The cookie column is the one surprise. `setAuthCookies` in
`packages/nextjs-jsonapi/src/features/auth/utils/AuthCookies.ts` derives `secure`
from `ENV.IS_PRODUCTION`, which is `process.env.NODE_ENV === "production"` and
nothing else. There is no override. Under the e2e stack's production build over
plain HTTP the browser would drop any cookie the app writes, so the suite mints
the session through the api and writes the cookies into Playwright's own jar
instead.

## Local

### Environment file

Copy `.env.example` to .env at the repository root. Nothing reads `.env.example`
itself — it is the documented inventory. `apps/api/src/load-env.ts` loads the
root .env as the first import of the api process, and every Next.js script in
`apps/web/package.json` runs through `dotenv -e ../../.env`.

### Hosts

`.env.example` uses named hosts rather than `localhost`, so two entries are
needed in the system hosts file, both pointing at `127.0.0.1`:

- `{{name}}.test` — the web app
- `api.{{name}}.test` — the api

They are not cosmetic. `CORS_ORIGINS` allows exactly `http://{{name}}.test:4051`,
`WEBAUTHN_ORIGIN` must match the frontend URL exactly, and
`PUBLIC_HOSTNAME` feeds the `extra_hosts` mapping in the two web compose files.

Neo4j, Redis and an S3-compatible store must already be running. This repository
does not start them.

### `pnpm dev`

`pnpm dev` runs `scripts/dev.sh`, which is a guarded launcher around
`turbo run dev dev:worker` — the api, the worker and the web app together.

The guard exists because `next dev` writes route manifests into **.next**. If a
previous session died mid-write — a hard-closed terminal, a `SIGKILL`, a crash —
the directory is left inconsistent and Next serves random 404s for pages that
exist on disk. The script handles that with a lock file, plus a second check for
a different failure with the same symptom:

1. If **apps/web/.next-dev.lock** exists, the previous run did not exit cleanly.
   Clear **apps/web/.next**.
2. Otherwise, if **apps/web/.next/required-server-files.json** exists,
   `next build` has written a *production* build into the directory `next dev`
   shares. `next dev` over that 404s every route, and this case leaves no lock.
   Clear **apps/web/.next**.
3. Create the lock, register a trap that removes it on `EXIT`, `INT` and `TERM`,
   then start turbo.

It never touches **.turbo** or `node_modules` caches, so it cannot trigger the
cold rebuild that a blanket `rm -rf` used to cause.

The second check is the reason the repository's standing rule is: **never run
`pnpm build` while a dev server is running.** `scripts/dev.sh` turns that
mistake into a one-time automatic reset rather than an afternoon of confusion.

### `pnpm dev:reset`

`scripts/dev-reset.sh` is the targeted recovery when a dev stack is wedged:

1. `npx turbo daemon stop` — clears wedged daemon state.
2. Kill stale node processes **rooted in this checkout**. For every `node` PID it
   reads that process's working directory with
   `lsof -a -p <pid> -d cwd -Fn` and kills it only when the directory is under
   this repository's root. Directories under **.claude/worktrees/** are explicitly
   skipped, so a reset run from the main checkout does not kill a worktree's dev
   server even though the worktree lives inside the main root.
3. Remove **apps/web/.next** and the dev lock.
4. `exec pnpm dev`.

The cwd test is the whole point. Several projects on one machine run the same
command lines, so a name-pattern kill cannot tell them apart and would destroy
unrelated work.

## End-to-end

The e2e stack is deliberately disjoint from the dev stack — different ports, a
different Neo4j database, a different Redis queue prefix, a different Next.js
build directory. Both run at once.

### Configuration

Copy `.env.e2e.example` to .env.e2e at the repository root and edit only what
you need. `scripts/e2e.sh` sources that file with `set -a` before it boots
anything, so every value in it is exported into every child process and
overrides the built-in default. The file is also listed in `turbo.json`
`globalDependencies`, so editing it busts the turbo cache.

Everything `scripts/e2e.sh` reads:

| Variable | Default | Meaning |
|---|---|---|
| `E2E_API_PORT` | 4080 | The e2e api port. |
| `E2E_WEB_PORT` | 4081 | The e2e web port. |
| `E2E_WORKER_HEALTH_PORT` | 4082 | Freed on start and teardown; never listened on. |
| `E2E_NEO4J_DATABASE` | `{{name}}test` | Dropped and recreated empty every run. |
| `E2E_REDIS_QUEUE` | `{{name}}e2e` | BullMQ key prefix. Must differ from `REDIS_QUEUE`. |
| `PUBLIC_HOSTNAME` | from the root .env | The web host; the api host is `api.` plus it. |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | from the root .env | Connection details are not duplicated — the suite talks to the same server the app does. |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | the seeded administrator | Read by the Playwright `setup` project. Change only if you changed migration `20250901_004`. |

The queue prefix carries the sharpest warning in the file, and
`scripts/e2e.sh` repeats it. Redis is one shared instance. With a shared prefix
the e2e worker and the dev worker consume the *same* queues, so a job enqueued
by one stack is executed by the other against the other stack's database. The
failure is intermittent and looks exactly like a bug in the code under test,
because an endpoint that only enqueues returns 2xx immediately.

### What the runner sets itself

These are exported by `scripts/e2e.sh` into its children. Setting them in
.env.e2e has no effect; `.env.e2e.example` lists them so the stack's behaviour is
readable from one file.

| Variable | Value | Why |
|---|---|---|
| `NEO4J_DATABASE` | `E2E_NEO4J_DATABASE` | api and worker. |
| `REDIS_QUEUE` | `E2E_REDIS_QUEUE` | api and worker. |
| `API_PORT`, `PORT` | the e2e ports | api and web respectively. |
| `API_URL`, `API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL` | `http://api.<host>:<api port>/` | |
| `APP_URL`, `NEXT_PUBLIC_ADDRESS` | `http://<host>:<web port>` | |
| `CORS_ORIGINS` | the web host **and** `http://localhost:<web port>` | `navigator.serviceWorker` exists only in a secure context, and a custom hosts-file name over plain HTTP is not one, so PWA tests load through `localhost` and their client-side calls need that origin allowed. |
| `RATE_LIMIT_ENABLED` | `false` | The login route hard-codes a per-IP `@Throttle` that the env-configured global throttlers cannot raise. A suite that logs in repeatedly from `127.0.0.1` otherwise collects 429s. No spec asserts throttling. |
| `E2E_BUILD` | `true` | `createNextConfig`, which `apps/web/next.config.js` calls, then sets `distDir` to **.next-e2e**, so the e2e build never clobbers the dev server's build. Set for the build *and* for `start`. |
| `E2E_INSECURE_COOKIES` | `true` | Exported for apps that add the lever. The shipped library does not read it. |
| `API_WORKER_HEALTH_PORT` | `E2E_WORKER_HEALTH_PORT` | Passed to the worker; unused until an app opts in. |

### The run, step by step

`pnpm test:e2e` runs `scripts/e2e.sh`. Any arguments are forwarded verbatim to
`playwright test`.

1. **Source .env.e2e** if present, with `set -a`.
2. **Register the teardown trap** on `EXIT`, `INT` and `TERM`. It kills every PID
   the script captured, each with its whole descendant tree, then frees the
   three e2e ports.
3. **Free ports 4080, 4081 and 4082** — before boot, not only after, in case a
   previous run was killed hard. Only processes *listening* on those ports are
   killed: `lsof -ti tcp:<port> -sTCP:LISTEN`. The `-sTCP:LISTEN` filter is
   load-bearing, because without it `lsof` also matches sockets whose *foreign*
   port is that number — a browser tab still open on the web port, a `curl`
   holding a keep-alive. The script states the rule outright: never kill by
   process name; every project on this machine runs `node`.
4. **Build the workspace packages** with
   `pnpm turbo run build --filter=...^{{name}}-api --filter=...^{{name}}-web`.
   The `...^app` form means "everything the app depends on, but not the app
   itself", so it adapts to whatever packages the project has. The two apps are
   deliberately excluded: the api runs from source, and the web build below needs
   the e2e environment exported into it, which turbo's strict env mode would
   filter out. Turbo caches this, so it is a no-op after the first run.
5. **Recreate the database** — `apps/web/tests/scripts/e2e-db.mjs recreate` runs
   `DROP DATABASE ... IF EXISTS` then `CREATE DATABASE`, leaving it empty.
6. **Start the worker alone.** Boot order matters. The worker owns the migrator,
   and both api and worker create fulltext indexes and constraints in
   `onModuleInit` with a check-then-create pattern. Booting them together against
   a fresh database means both see no index, both issue the create, and one
   crashes with "An equivalent index already exists" — intermittently.
7. **Wait for the migrations.** `e2e-db.mjs check` counts `:Migration` nodes
   against the number of migration files and is polled up to 45 times at 2s
   intervals. This is the worker's real readiness signal; nothing polls port
   4082.
8. **Start the api** with the e2e database, queue prefix, ports, URLs,
   `CORS_ORIGINS` and `RATE_LIMIT_ENABLED=false`.
9. **Build the web app for production** with the e2e environment exported ahead
   of the build, because `NEXT_PUBLIC_*` values are inlined then. The web app's
   `dotenv -e ../../.env` does not override already-set variables, so the e2e
   values win. A production build is used rather than `next dev` because under
   dev every route cold-compiles on first hit — 15 to 110 seconds each, pushing
   the suite past 45 minutes and flaking on compile timeouts.
10. **Start the web app** with `next start` and the same environment.
11. **Wait for both HTTP endpoints** with `curl --retry 120 --retry-delay 2
    --retry-connrefused`.
12. **Run Playwright**, forwarding any arguments. The `setup` project is a
    declared dependency of every other project, so a scoped run still seeds and
    logs in.
13. **Tear down** via the trap, including on Ctrl+C, and exit with Playwright's
    own exit code.

`apps/web/tests/README.md` is the suite's own documentation; `pnpm e2e:dash`
serves a live view of a run on `http://127.0.0.1:4084`.

## Production

There is no `.env` file in production. Variables arrive from the platform:
`docker-compose.yml` declares them inline and shares an anchored block between
api and worker, while `docker-compose.api.yml`, `docker-compose.worker.yml` and
`docker-compose.web.yml` each read an env file the platform writes. The Docker
page covers the compose files and the build; the deployment page covers which
variables must exist before the first boot.

Three differences from local are worth stating explicitly:

- `NODE_ENV=production` is set in the two production image stages, which is what
  makes auth cookies `Secure`.
- The api and the worker are separate deployment units of the same image, so
  they must receive identical `NEO4J_*` and `REDIS_*` values. The compose anchor
  enforces that; a PaaS does not.
- Neo4j, Redis and object storage are external in every environment, including
  production. No compose file defines them.

## Where to look

| File | What it gives you |
|---|---|
| `.env.example` | Every variable, grouped, with the service that reads it. |
| `.env.e2e.example` | Every variable the e2e runner reads, and the ones it sets itself. |
| `scripts/dev.sh` | The dev launcher, the lock and the production-build detection. |
| `scripts/dev-reset.sh` | The scoped orphan kill and the targeted clean. |
| `scripts/e2e.sh` | The whole e2e runtime, with the reasoning inline. |
| `apps/web/tests/scripts/e2e-db.mjs` | `recreate` and `check` for the test database. |
| `apps/web/tests/README.md` | The suite's own guide. |
| `apps/web/next.config.js` | The app's options to `createNextConfig`, which owns the `E2E_BUILD` `distDir` switch and the CSP headers. |
| `apps/api/src/load-env.ts` | Why the root env file is loaded as an import. |
| `turbo.json` | `globalDependencies` includes both env files. |

## Gaps and drift

- `E2E_INSECURE_COOKIES` is exported by `scripts/e2e.sh` but nothing reads it.
  The library derives `secure` from `NODE_ENV` alone. The script documents this
  honestly and keeps the export so that an app which adds the lever works
  without editing the runner.
- `E2E_WORKER_HEALTH_PORT` (4082) is freed on start and teardown but never
  listened on, because `apps/api/src/main.ts` does not pass
  `worker.healthCheckPort` to `bootstrap()`.
- The three environments share one Redis instance and one Neo4j server by
  default. Only the prefix and the database name keep them apart, and both are
  plain strings with no runtime assertion that they differ.
- Not examined: any real hosting platform's variable injection, secret store or
  reverse-proxy configuration.
