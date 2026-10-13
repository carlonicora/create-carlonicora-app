---
title: Testing strategy
section: 08-workflow
---

What this application actually tests on day zero, stated without flattery. The
pyramid has a base and almost no middle: **`apps/api` ships no unit spec**,
`packages/shared` ships none either, and `apps/web` ships nine, all for the
application shell — the proxy, the layouts, `AppShell`, `requireAdministrator`,
the skeletons, `TrialBlockingWrapper`, locale resolution and the metadata
helper. All three Vitest suites set `passWithNoTests: true`, so the two empty
ones stay green. `pnpm test` on a freshly scaffolded app proves the shell holds
and nothing about any feature.

The coverage that does exist comes from two places: the Playwright end-to-end
suite under `apps/web/tests/`, which drives the real stack, and the two
framework packages' own Vitest suites, which the monorepo `pnpm test` runs
because both are workspace members.

## What runs where

| Suite | Config | Files today |
|---|---|---|
| `apps/api` unit | `apps/api/vitest.config.ts` | none |
| `apps/api` integration | `apps/api/vitest.e2e.config.ts` | none |
| `apps/web` unit and component | `apps/web/vitest.config.ts` | eight, for the shell |
| `packages/shared` unit | `packages/shared/vitest.config.ts` | none |
| `packages/nestjs-neo4jsonapi` | `packages/nestjs-neo4jsonapi/vitest.config.ts` | hundreds of specs |
| `packages/nextjs-jsonapi` | `packages/nextjs-jsonapi/vitest.config.ts` | dozens of specs |
| End-to-end | `apps/web/playwright.config.ts` | nine spec files |

## The four app-side Vitest configurations

### `apps/api/vitest.config.ts`

Node environment, `globals: true`, setup file `apps/api/vitest.setup.ts` (which
imports `reflect-metadata` and mocks the NestJS `Logger`). Includes
`src/**/*.{test,spec}.ts`. Coverage is v8 over `src/**/*.ts`, excluding specs,
declaration files, barrels and `apps/api/src/main.ts`. `testTimeout` is 30 s.

### `apps/api/vitest.e2e.config.ts`

The same SWC plugin and the same setup file, but includes
`test/**/*.e2e-spec.ts` and raises `testTimeout` to 60 s. `apps/api` declares
`testcontainers` and `supertest` as devDependencies, which is what this config
exists to run. That directory itself does not exist yet — create it with the
first spec.

### `apps/web/vitest.config.ts`

jsdom environment with `@vitejs/plugin-react`, setup file
`apps/web/vitest.setup.ts`. PostCSS is disabled in tests to avoid plugin
resolution. `server.deps.inline` inlines `@carlonicora/nextjs-jsonapi` so CI
exercises the workspace build rather than a pre-bundled npm copy.

The include glob is:

```
["src/**/*.{test,spec}.{ts,tsx}", "__tests__/**/*.{test,spec}.{ts,tsx}"]
```

**Both `*.test.*` and `*.spec.*` run here.** So do files directly under a root
__tests__ directory as well as anywhere inside the source tree. Name a file
either way; the convention in `apps/web/CLAUDE.md` is `<Entity>.spec.tsx` inside
a feature's __tests__ folder, which the first half of the glob already covers.

`apps/web/vitest.setup.ts` is where the environment is faked: `next/navigation`,
`next-intl`, `next-intl/navigation` and `next/headers` are mocked module-wide,
`matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollTo`,
`scrollIntoView`, the pointer-capture methods and `crypto.randomUUID` are
stubbed, and the Shepherd stylesheet import is neutralised. A component test
inherits all of it.

### `packages/shared/vitest.config.ts`

Node environment, includes `src/**/*.test.ts` only — a spec-suffixed file does
**not** run in this package. The file carries a comment explaining `passWithNoTests`:
Vitest exits 1 on "no test files found", which failed `pnpm test` in every
generated app before a line was written.

## `oxc: false`, and why it is not optional

Both `apps/api` configs, and `packages/nestjs-neo4jsonapi/vitest.config.ts`, set
`oxc: false` at the top level and hand the TypeScript transform to
`unplugin-swc`.

Vitest 4 replaced esbuild with Oxc as its built-in transformer. Oxc does not
implement `emitDecoratorMetadata`, and it runs *after* `unplugin-swc` —
overwriting SWC's `design:paramtypes` with a same-length array of `undefined`s.
Anything that resolves a dependency through `Reflect.getMetadata` — which is
every NestJS constructor injection — then sees undefined tokens and fails in
ways that point at the wrong thing. `unplugin-swc`'s own `esbuild: false` no
longer covers this, so Oxc has to be switched off explicitly.

Consequence: **a NestJS test file added to a config without `oxc: false` will
fail on DI, not on its assertions.** `apps/web` and `packages/shared` do not set
it and do not need it; neither uses decorators.

## The end-to-end suite

This is the real coverage. It boots the actual stack — a freshly recreated,
freshly migrated, freshly seeded Neo4j database, the worker, the api, and a
production build of the web app — and drives it through a browser.
`apps/web/tests/README.md` is the full guide; what follows is the inventory.

`scripts/e2e.sh` owns the runtime. Playwright starts no servers: there is no
`webServer` block in `apps/web/playwright.config.ts`, on purpose. The stack runs
on its own ports (4080 api, 4081 web, 4082 reserved for worker health), its own
database and its own Redis queue prefix, so it never collides with `pnpm dev`.
`fullyParallel: false` and `workers: 1` are deliberate — the suite shares one
seeded database.

### Projects

| Project | Directory | Session |
|---|---|---|
| `setup` | `apps/web/tests/setup/seed.setup.ts` | creates fixtures, saves one storage state per persona |
| `chromium-unauth` | `apps/web/tests/unauthenticated/` | none |
| `chromium-smoke` | `apps/web/tests/smoke/` | administrator |
| `chromium-auth` | `apps/web/tests/authenticated/` | administrator |
| `chromium-pwa` | `apps/web/tests/pwa/` | administrator, on `localhost` |

`setup` is a declared dependency of every other project, so a scoped run still
seeds and logs in. The PWA project uses a different base URL because
`navigator.serviceWorker` exists only in a secure context — HTTPS, or the
literal hostname `localhost` — and the stack serves plain HTTP on the custom
host.

### Every spec the template ships

| Spec | Covers |
|---|---|
| `apps/web/tests/unauthenticated/login.spec.ts` | the login form renders; bad credentials are rejected and the page does not navigate |
| `apps/web/tests/unauthenticated/auth-guards.spec.ts` | an unauthenticated `/administration` visit redirects to `/login`; `/logout` without a session does not error; `/register` renders; `/reset/<code>` renders; an unknown activation code reports failure instead of hanging |
| `apps/web/tests/unauthenticated/auth-api-contract.spec.ts` | six table-driven `POST /auth/login` cases against the api directly — invalid email format, missing password, missing email, non-string email, wrong JSON:API resource type, and unknown-but-well-formed credentials returning 401 rather than 400 |
| `apps/web/tests/unauthenticated/users-api-contract.spec.ts` | `/users/me/full` and `/users/:userId` refuse an anonymous request; an unknown id is 404 for the platform administrator; a company member cannot read a user outside its company |
| `apps/web/tests/smoke/app.smoke.spec.ts` | the home page and the administration index render for an administrator; the `(admin)` route group answers a non-administrator with the in-frame 404, on the index and on a child route |
| `apps/web/tests/smoke/admin.smoke.spec.ts` | nine `(admin)` routes render, issue no failing same-stack request and throw nothing in the browser: the index, users, companies, rbac, products, ai-connections, token-usage, howtos, waitlist |
| `apps/web/tests/authenticated/users-management.spec.ts` | the users list shows both seeded personas; search narrows it; logout clears the session cookies |
| `apps/web/tests/pwa/service-worker.spec.ts` | a failed navigation falls back to `/offline` and recovers on retry |

Supporting files, not specs: `apps/web/tests/e2e.env.ts` (the single place ports,
hosts, database and personas are named), `apps/web/tests/support/auth.ts`,
`apps/web/tests/support/db.ts`, `apps/web/tests/support/actions.ts`,
`apps/web/tests/support/smoke.ts`, `apps/web/tests/scripts/e2e-db.mjs` (the only
DDL in the suite) and `apps/web/tests/reporters/dashboard-reporter.ts`.

## Running each suite

| Command | Runs |
|---|---|
| `pnpm test` | `turbo run test` — every workspace's Vitest suite, including both packages |
| `pnpm test:watch` | the same in watch mode |
| `pnpm test:cov` | the same with v8 coverage |
| `pnpm --filter {{name}}-api test` | the api unit suite only |
| `pnpm --filter {{name}}-web test` | the web suite only |
| `pnpm test:e2e:api` | `turbo run test:e2e` — the api integration config |
| `pnpm test:e2e` | `scripts/e2e.sh` — the whole stack plus Playwright |
| `pnpm e2e:dash` | the e2e control page on port 4084 |

Any argument to `pnpm test:e2e` is forwarded verbatim to `playwright test`, so a
run can be scoped to a project, a file or a title.

**Prerequisites for the e2e suite:** Neo4j and Redis running locally, and
`/etc/hosts` entries for `{{name}}.test` and `api.{{name}}.test`.

## Where the line sits

Given what ships, the honest division of labour is:

- **Package suites** own the framework: descriptors, serialisation, repository
  query building, the registries, the guards, the UI primitives. You inherit
  that coverage; do not re-test it.
- **End-to-end specs** own everything the application itself does. They are the
  only thing that proves a route renders, a guard holds, or a DTO rejects a
  malformed body.
- **Unit and component specs** are the gap, apart from the nine that pin the
  web shell. Add them where a pure function or a
  presentational component has branches an end-to-end spec cannot reach
  cheaply — a Cypher builder, a formatter, a permission predicate, a component
  with several states.

Write the third e2e spec by reading `apps/web/tests/README.md` first; it
documents the fixtures, the personas and the rules the suite depends on to stay
deterministic.

## Where to look

| File | What it settles |
|---|---|
| `apps/web/tests/README.md` | The full end-to-end guide: runtime, fixtures, personas, how to add a spec |
| `apps/web/playwright.config.ts` | Projects, storage states, why there is no `webServer` block |
| `scripts/e2e.sh` | The whole e2e runtime: ports, database, queue prefix, boot order, teardown |
| `apps/web/tests/e2e.env.ts` | The one place ports, hosts, database and personas are named |
| `apps/api/vitest.config.ts` | The api unit config, and the `oxc: false` comment |
| `apps/api/vitest.e2e.config.ts` | The api integration config |
| `apps/web/vitest.config.ts` | The jsdom config and its include glob |
| `apps/web/vitest.setup.ts` | Every mock a component test inherits |
| `packages/shared/vitest.config.ts` | Node config, `*.test.ts` only, and the `passWithNoTests` rationale |
| `turbo.json` | Which tasks are cached, and what each one depends on |

## Gaps and drift

- No unit spec exists in `apps/api` or `packages/shared`, and the web app's
  eight cover only the shell. Every claim about "the test suite" in a shipped
  document refers to the two packages' suites plus those eight.
- `apps/api/vitest.e2e.config.ts` includes `test/**/*.e2e-spec.ts`, but
  `apps/api` has no test directory. The config, the `testcontainers`
  dependency and the `supertest` dependency are all installed for a suite that
  does not exist yet.
- `"typecheck": "eslint ."` in `apps/web/package.json` — the web workspace has
  no `tsc --noEmit` anywhere, so `pnpm typecheck` does not type-check.
- Both app tsconfigs set `strict: false`, so the type system catches
  considerably less than `tsconfig.base.json` implies.
- `packages/shared/vitest.config.ts` matches `*.test.ts` only while the other
  three configs match both `*.test.*` and `*.spec.*`. A spec-suffixed file in the
  shared package silently never runs.
- Neither CI workflow runs the Playwright suite, and neither runs `pnpm lint`.
  The end-to-end suite is a local gate only.
- Not examined: the contents of the two packages' spec files, the coverage
  numbers either suite produces, and the `apps/web/tests/reporters/dashboard-reporter.ts`
  protocol beyond the fact that `scripts/e2e-dashboard.mjs` consumes it.
