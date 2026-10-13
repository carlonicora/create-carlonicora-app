---
title: Runbooks
section: 07-operations
---

**This is a seed page.** Every runbook below is supported by a script or a
command that ships in {{display}} today, so all of them work on day zero. None of
them is about production — the template ships no production tooling.

What the app author adds, as the app grows: an incident runbook per failure mode
that has actually happened; the backup and restore procedures the backup page
asks for; and a runbook for each scheduled or manual operational task the app
acquires. Keep the shape used here — **trigger, numbered steps, verification** —
so that a runbook can be followed under pressure by someone who did not write it.

## Machine safety

Two rules apply to every step on this page and to every runbook added to it.

**Free a port by what is listening on it, never by process name.**

```bash
lsof -i tcp:4051                                 # look first
lsof -ti tcp:4051 -sTCP:LISTEN | xargs -r kill   # then free it
```

`-sTCP:LISTEN` is load-bearing. Without it `lsof -i tcp:<port>` also matches
sockets whose *foreign* port is that number — a browser tab still open on the
page, a `curl` holding a keep-alive — and killing those is killing someone
else's work.

**Never kill by a name pattern.** `pkill -f node`, `pkill -f "next dev"`,
`killall node` and their relatives match every project on the machine, because
their command lines are identical. `scripts/e2e.sh` states the ban outright in
its teardown section: everything it kills is either a PID it captured itself or a
PID listening on one of its own ports. `scripts/dev-reset.sh` enforces the same
rule differently — it reads each candidate process's working directory and kills
it only when that directory is inside this checkout.

---

## Reset the development stack

**Trigger:** the dev stack is wedged — routes 404 that exist on disk, the api
will not restart, turbo appears stuck, or a previous session was killed hard.

1. Stop the current stack with Ctrl+C in its terminal, if it is still attached.
   A clean exit lets `scripts/dev.sh` remove its lock file.
2. Run the reset:
   ```bash
   pnpm dev:reset
   ```
3. `scripts/dev-reset.sh` then, in order: stops the turbo daemon; kills node
   processes whose working directory is inside this checkout, skipping anything
   under **.claude/worktrees/**; removes the web build directory and the dev lock;
   and `exec`s `pnpm dev`.
4. If a port is still held afterwards, free it by listener as shown above —
   4050 for the api, 4051 for the web app.

**Verify:** the web app answers on `http://{{name}}.test:4051` and the api on
`http://api.{{name}}.test:4050`. Load a route that was 404ing.

This never touches **.turbo** or `node_modules` caches, so it does not trigger a
cold rebuild.

---

## Recover a web build clobbered by a production build

**Trigger:** every route 404s in a running dev server, and `pnpm build`,
`pnpm build:web`, or a `git push` (which runs `pnpm build` through
`.husky/pre-push`) was run while that server was up.

`next build` and `next dev` share one build directory. A production build
overwrites it, and the dev server serving that output 404s everything.

1. Stop the dev server.
2. Start it again:
   ```bash
   pnpm dev
   ```
3. `scripts/dev.sh` detects the condition itself. A production build leaves a
   standalone-server manifest that `next dev` never writes; seeing it, the
   script clears the build directory and prints
   `apps/web/.next holds a production build (next build) — clearing before dev`.
   No manual deletion is needed.
4. If the script instead prints `previous dev run did not exit cleanly`, that is
   the other guarded case — an unclean kill — handled the same way.

**Verify:** the message appears once, and the routes load.

**Prevention:** do not run `pnpm build` while a dev server is running. To
type-check the web app without a build, run its lint task. To push without
triggering the build, stop the dev stack first.

---

## Run the end-to-end suite

**Trigger:** verifying a change end to end, or before handing work over.

**Prerequisites:** Neo4j and Redis running, and hosts-file entries pointing
`{{name}}.test` and `api.{{name}}.test` at `127.0.0.1`.

1. Optionally copy `.env.e2e.example` to .env.e2e and adjust. The defaults work.
2. Run the suite:
   ```bash
   pnpm test:e2e
   ```
3. Watch the prefixed streams: `[packages]`, `[worker]`, `[api]`, `[web-build]`,
   `[web]`. The `==> [e2e]` lines mark each phase. First runs take several
   minutes; the workspace build is turbo-cached afterwards.
4. The stack is torn down on exit, including on Ctrl+C.

**Verify:** Playwright prints its summary and `scripts/e2e.sh` echoes
`Playwright exited with code 0`.

### Scope it to one spec

Any argument is forwarded verbatim to `playwright test`:

```bash
pnpm test:e2e tests/smoke/app.smoke.spec.ts   # one spec
pnpm test:e2e --project=chromium-smoke        # one project
pnpm test:e2e --grep administration           # by title
```

The `setup` project is a declared dependency of every other project, so a scoped
run still seeds the database and logs in.

### If it fails to boot

- `migrations not applied` — read the `[worker]` lines above it. The worker
  applies the migrations and the runner polls for 90 seconds.
- A port is held — the runner frees 4080, 4081 and 4082 on start and on
  teardown. If one survives, free it by listener.
- `apps/web/tests/README.md` is the suite's own documentation.

---

## Drive the e2e dashboard

**Trigger:** you want to watch a run rather than read a log, or you want to see
the test list before the stack finishes booting.

1. Start it:
   ```bash
   pnpm e2e:dash
   ```
2. Open `http://127.0.0.1:4084`. Override the port with `E2E_DASH_PORT`.
3. Press **Run**. Two passes follow: `playwright test --list`, which needs no
   stack and takes a few seconds, paints every row as a pending semaphore; then
   `scripts/e2e.sh` runs for real. Its `==>` lines drive the boot strip and the
   reporter drives the rows.
4. **Stop** signals the process group the dashboard created — the script *and*
   the Playwright process it is waiting on. Signalling the script alone does
   nothing during the Playwright phase, because bash defers a trap until its
   current foreground command returns.
5. Arguments can be passed from the page, and reach `scripts/e2e.sh` unchanged.

**Verify:** rows turn green or red as results arrive, and the report is written
to the web app's `playwright-report` directory.

The dashboard uses no pattern kill anywhere: every process it signals is a PID
it spawned, a process group it created, or — only after a `SIGKILL` skipped
`scripts/e2e.sh`'s own cleanup — whatever `lsof` reports as listening on one of
those four ports.

Its pure parsers have their own tests: `pnpm e2e:dash:test`.

---

## Recreate the e2e database

**Trigger:** the e2e database is in an unknown state, or you want to inspect a
freshly migrated database without running the suite.

`scripts/e2e.sh` does this on every run. Doing it by hand is for debugging.

1. Confirm the target. The helper reads `E2E_NEO4J_DATABASE`, default
   `{{name}}test`. It runs `DROP DATABASE ... IF EXISTS` followed by
   `CREATE DATABASE`. **Never point it at a database you care about.**
2. Drop and recreate, empty:
   ```bash
   node apps/web/tests/scripts/e2e-db.mjs recreate
   ```
3. Fill it by booting the worker against it, which applies the migrations:
   ```bash
   NEO4J_DATABASE={{name}}test pnpm --filter {{name}}-api dev:worker
   ```
4. In another terminal, poll until every migration has landed:
   ```bash
   node apps/web/tests/scripts/e2e-db.mjs check
   ```
   It exits 0 once the `:Migration` node count matches the number of files in
   `apps/api/src/neo4j.migrations`.

**Verify:** `check` exits 0. In Neo4j,
`MATCH (m:Migration) RETURN count(m)` returns that same number.

Connection details come from the root environment file — `NEO4J_URI`,
`NEO4J_USER`, `NEO4J_PASSWORD` — so the helper always talks to the same server
the app does.

---

## Sweep dependencies

**Trigger:** a scheduled dependency review, or a security advisory.

`npm-check-updates` (`ncu`) must be available on the PATH. Neither script is
wired to a `package.json` script; run them with `bash`.

### Check first, change nothing

```bash
bash scripts/check-update.sh
```

It runs `ncu` — read-only — in the root, `apps/api`, `apps/web`,
`packages/shared` and both submodules, and prints what is behind in each. The
`ncu -u` and `pnpm install` lines in that file are commented out on purpose.

### Then sweep

1. Read the header of `scripts/update.sh` first. It carries the **deferred major
   bumps** with a dated review and, for each, why it is held and what would
   unblock it. Bumping one of those anyway is how a working tree stops building.
2. Run it:
   ```bash
   bash scripts/update.sh
   ```
   It runs `ncu -u` followed by `pnpm install` in the same six locations, so it
   rewrites manifests and installs in one pass.
3. Check the invariants:
   ```bash
   pnpm lint
   ```
   `scripts/check-dep-drift.js` runs as part of it and will refuse a peer that
   is now unsatisfied, an app/library range that has drifted apart, a
   devDependency range that differs between manifests, an override that undercuts
   a declaration, or a stale `versions.production.json`.
4. Build and test:
   ```bash
   pnpm build
   pnpm test
   ```
5. Boot the stack and exercise it. A dependency sweep that only passes lint and
   tests has not been verified — DI failures and native-module failures appear at
   runtime.

**Verify:** `pnpm lint`, `pnpm build` and `pnpm test` are green, and the stack
boots and serves a request.

Leave everything uncommitted for review.
[`DEPENDENCY_UPGRADE_GUIDE.md`](../../../DEPENDENCY_UPGRADE_GUIDE.md) covers the
harder upgrades.

---

## Bump a framework submodule and sync the production pins

**Trigger:** adopting a new version of `@carlonicora/nestjs-neo4jsonapi` or
`@carlonicora/nextjs-jsonapi` — including merging the daily
`deps/library-updates` PR, which moves only the npm pin.

Both halves must move together. The release page explains why.

1. Move the submodule. `.gitmodules` tracks `master`:
   ```bash
   git submodule update --remote packages/nestjs-neo4jsonapi
   ```
2. Install and rebuild the package, because `apps/*` consume its `dist`:
   ```bash
   pnpm install
   pnpm --filter @carlonicora/nestjs-neo4jsonapi build
   ```
   For the frontend package, substitute `packages/nextjs-jsonapi` and
   `@carlonicora/nextjs-jsonapi`.
3. Sync the pin from the submodule's own manifest:
   ```bash
   pnpm sync:versions
   ```
   To see what would change without writing:
   ```bash
   node scripts/sync-production-versions.js --check
   ```
4. Check every invariant, not just the pin:
   ```bash
   pnpm lint
   ```
   A package bump usually brings peer, overlap and override fallout with it;
   rules 1 to 4 of `scripts/check-dep-drift.js` are what catch it.
5. `pnpm build` and `pnpm test`, then boot the stack.
6. Commit the submodule pointer and `versions.production.json` **in the same
   commit**, so no revision of `dev` has the two halves disagreeing.

**Verify:** `node scripts/sync-production-versions.js --check` prints
`versions.production.json already matches the workspace packages`, and
`pnpm lint` passes.

---

## Regenerate the RBAC path map

**Trigger:** an entity was added, removed or renamed, or a relationship between
entities changed. The map is compiled from the built entity metadata, so it goes
stale silently.

1. Build the api — the generator reads `dist/features`:
   ```bash
   pnpm --filter {{name}}-api build
   ```
2. Generate:
   ```bash
   pnpm --filter {{name}}-api generate:rbac-paths
   ```
   That runs two steps. `apps/api/scripts/build-module-id-map.ts` writes
   `apps/api/src/rbac/module-id.map.json` from the `ModuleId` enum in
   `packages/shared`. Then the package's `generate-rbac-paths` tool walks
   `dist/features` and writes
   `apps/api/src/features/rbac/module-relationships.map.ts`.
3. Review the diff. Entries appearing or disappearing for entities you did not
   touch mean a relationship changed somewhere else.

**Verify:** the two generated files are written, and `pnpm --filter {{name}}-api build`
still succeeds with them in place.

Both outputs are generated files. Edit the entities, not the maps.

---

## Dump the RBAC matrix from the database

**Trigger:** first-time setup of an environment that has no `apps/api/src/rbac/permissions.ts`
yet, or after editing permissions directly in Neo4j during development.

The worker reconciles permissions from `apps/api/src/rbac/permissions.ts` on
every boot, so a manual edit in the database is reverted at the next worker
start unless it is dumped into that file first.

1. Make sure the environment file points at the database you want to read.
   `apps/api/scripts/rbac-dump.ts` loads the root env file and connects with
   `NEO4J_URI`, `NEO4J_USER` and `NEO4J_PASSWORD`.
2. Dump:
   ```bash
   pnpm --filter {{name}}-api rbac:dump
   ```
   It reads the live grants, inverts the `RoleId` and `ModuleId` enums so the
   output references names rather than raw identifiers, and overwrites
   `apps/api/src/rbac/permissions.ts`.
3. Review the diff before committing. This overwrites the file wholesale.

**Verify:** the script prints the byte count and the path it wrote. Boot the
worker and confirm it reconciles without changing anything.

This is a developer script. It writes a source file in the repository — never
wire it into a runtime endpoint or a deploy pipeline.

---

## Find duplicate or missing translation keys

**Trigger:** adding or reorganising UI strings, or a key rendering as its own
name in the interface.

There are three tools, and only one of them runs automatically.

**Missing and unused keys** — `scripts/validate-translations.js` scans
`apps/web/src` and `packages/nextjs-jsonapi/src` for translation keys and
compares them against `apps/web/messages/en.json`:

```bash
node scripts/validate-translations.js
```

Exit 1 means keys are used but not defined. Unused keys are reported as warnings
only.

**Duplicate values** — `scripts/find-duplicate-translations.js` reports keys
whose *values* are identical, which is how two labels drift out of sync later:

```bash
node scripts/find-duplicate-translations.js
```

Exit 1 means duplicates were found.

**The one that runs on its own** — the web app's `lint` script ends with
`pnpm validate-translations`, which runs
`apps/web/scripts/validate-translations.mjs`. That is the check `pnpm lint`, and
therefore `.husky/pre-commit`, actually enforces.

**Verify:** the script you ran exits 0, and the string renders in the UI.

---

## Create and remove a worktree

**Trigger:** starting work that needs isolation from the current checkout.

Worktrees live under **.claude/worktrees/**, which `.gitignore` ignores.

### Create

The `WorktreeCreate` hook in `.claude/settings.json` does the whole setup. Given
a name, it: adds a git worktree at `.claude/worktrees/<name>` on a new branch
`worktree-<name>` cut from `dev`; copies the root environment file into it if one
exists; runs `git submodule update --init --recursive`; runs `pnpm install`; and
builds both framework packages so the apps have a `dist` to consume. It prints
the path.

The submodule initialisation and the two package builds are not optional steps
you can skip — `scripts/check-dep-drift.js` refuses to run without the
submodules, so `pnpm lint` fails in a worktree that has not had them
initialised.

Note that a worktree's directory is *inside* the main checkout's root. That is
why `scripts/dev-reset.sh` explicitly skips **.claude/worktrees/** when killing
stale processes: without that exclusion, a reset run from the main repository
would kill every worktree's dev server.

### Remove

1. List what exists:
   ```bash
   bash scripts/remove-worktree.sh
   ```
   With no argument it prints the available worktrees and exits.
2. Remove one by name:
   ```bash
   bash scripts/remove-worktree.sh <name>
   ```
   It deletes the directory, runs `git worktree prune`, and deletes the
   `worktree-<name>` branch if it exists. The directory is removed by hand
   rather than with `git worktree remove`, because that command does not work
   with submodules.

**Verify:** `bash scripts/remove-worktree.sh` no longer lists the name, and
`git worktree list` does not show it.

**Before removing:** the branch is deleted with `git branch -D`. Anything
unmerged on it is gone.

---

## Where to look

| File | What it gives you |
|---|---|
| `scripts/dev.sh` | The guarded launcher and both recovery cases. |
| `scripts/dev-reset.sh` | The scoped orphan kill and the targeted clean. |
| `scripts/e2e.sh` | The e2e runtime, with the ban on pattern kills stated inline. |
| `scripts/e2e-dashboard.mjs` | The dashboard, its two passes and its stop semantics. |
| `apps/web/tests/scripts/e2e-db.mjs` | `recreate` and `check`. |
| `apps/web/tests/README.md` | The e2e suite's own guide. |
| `scripts/update.sh` | The sweep, and the deferred-major list in its header. |
| `scripts/check-update.sh` | The read-only version of the same sweep. |
| `scripts/sync-production-versions.js` | `--check` and the pin regeneration. |
| `scripts/remove-worktree.sh` | Listing and removal, including the submodule caveat. |

## Gaps and drift

- **This page has no production runbooks**, because the template ships no
  production tooling: no deploy script, no backup script, no migration-rollback
  command, no log-query helper. Every runbook here runs on a developer machine.
- `scripts/validate-translations.js` and `scripts/find-duplicate-translations.js`
  are invoked by no `package.json` script. The web app's `lint` runs a *different*
  file, `apps/web/scripts/validate-translations.mjs`, which shadows the root
  one — so the root script can pass while the enforced check fails, or the
  reverse.
- `scripts/update.sh` and `scripts/check-update.sh` require `ncu` on the PATH and
  neither declares it. Neither is wired to a `package.json` script.
- The deferred-major list in `scripts/update.sh` carries a "last reviewed" date.
  It is accurate only as of that date, and an app that has since diverged should
  re-verify before trusting it.
- `apps/api/src/rbac/permissions.ts` is both a generated file and a committed
  source file. `rbac:dump` overwrites it wholesale, so an uncommitted hand edit
  is lost without warning.
- Not examined: the `playwright-cli` skill under `.claude/skills/`, which is a
  separate driving surface for the running application.
