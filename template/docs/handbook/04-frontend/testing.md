---
title: Testing the frontend
section: 04-frontend
---

Two suites. Vitest with jsdom ships nine unit specs, all for the app shell; Playwright
drives the real stack and ships fourteen specs plus a harness. The imbalance is
deliberate: the components under test almost all live in the package, and what an
application needs proved is that its routes, its gates and its session actually work.

## Vitest

`apps/web/vitest.config.ts` in full:

| Setting | Value | Note |
|---|---|---|
| `plugins` | `[react()]` from `@vitejs/plugin-react` | JSX transform |
| `css.postcss` | `{}` | PostCSS disabled in tests, so Tailwind plugin resolution cannot fail the run |
| `test.globals` | `true` | `describe`/`it`/`expect` without imports |
| `test.environment` | `"jsdom"` | Component tests are possible out of the box |
| `test.setupFiles` | `["./vitest.setup.ts"]` | |
| `test.include` | `["src/**/*.{test,spec}.{ts,tsx}", "__tests__/**/*.{test,spec}.{ts,tsx}"]` | **Both** `.test.*` and `.spec.*` run here — unlike some sibling projects where only `.spec.*` is collected |
| `test.passWithNoTests` | `true` | Why `pnpm test` is green with zero specs |
| `test.silent` / `onConsoleLog` | `true` / `() => false` | Console output suppressed |
| `test.coverage` | v8, `text`/`json`/`html`, includes `src/**`, excludes specs, `.d.ts` and barrels | |
| `test.server.deps.inline` | `[/@carlonicora\/nextjs-jsonapi/]` | Inlines the workspace package so CI cannot silently test a pre-bundled npm build instead |
| `resolve.alias` | `@` → `./src` | Matches `apps/web/tsconfig.json` |

`apps/web/vitest.setup.ts` imports `@testing-library/jest-dom/vitest` and then mocks:

| Target | Mock |
|---|---|
| `shepherd.js/dist/css/shepherd.css` | `{}` — the package's components barrel re-exports the onboarding context, which imports that CSS |
| `next/navigation` | `useRouter` (six stubs), `usePathname` → `"/"`, `useSearchParams` → empty, `useParams` → `{}`, `redirect`, `notFound` |
| `next-intl` | `useTranslations` → identity, `useLocale` → `"en"`, `useNow`, `useTimeZone` → `"UTC"`, `useFormatter` |
| `next-intl/navigation` | `createNavigation` returning `Link`, a router, `usePathname` and `redirect` |
| `next/headers` | `cookies()` with the five accessors, `headers()` → an empty `Headers` |
| `window.matchMedia` | Always `matches: false`, with both listener APIs |
| `ResizeObserver`, `IntersectionObserver` | Class stubs |
| `window.scrollTo`, `Element.prototype.scrollIntoView` | `vi.fn()` |
| Pointer capture (`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`) | `vi.fn()` |
| `crypto.randomUUID` | Polyfilled when absent |

The file deliberately does **not** re-export the package's testing utilities, so the
package is not loaded before the mocks are applied. Import
`@carlonicora/nextjs-jsonapi/testing` — `MockJsonApiProvider`, `renderWithProviders`,
`createMockApiData`, `screen` — directly in each spec.

**Nine unit specs ship, all for the app shell**, each in a `__tests__` directory beside
the code it covers: `apps/web/src/__tests__/proxy.test.ts`,
`apps/web/src/app/__tests__/layouts.test.tsx`,
`apps/web/src/app/__tests__/oauth-authorize.test.tsx`,
`apps/web/src/features/common/components/session/__tests__/AppShell.test.tsx`,
`apps/web/src/features/common/components/session/__tests__/requireAdministrator.test.ts`,
`apps/web/src/features/common/components/skeletons/__tests__/skeletons.test.tsx`,
`apps/web/src/features/common/components/wrappers/__tests__/TrialBlockingWrapper.test.tsx`,
`apps/web/src/i18n/__tests__/request.test.ts` and
`apps/web/src/utils/__tests__/metadata.test.ts`. No feature component has a spec. The
second include glob points at a tests directory beside the config that does not exist,
and `passWithNoTests: true` is still set.

## Playwright

### `apps/web/playwright.config.ts`

| Setting | Value | Why |
|---|---|---|
| `testDir` | `apps/web/tests` | |
| `timeout` | 120000 | A first navigation against a freshly booted stack pays for lazy schema work and a cold first paint |
| `fullyParallel` | `false` | The suite shares one seeded database |
| `workers` | `1` | Same reason |
| `forbidOnly` / `retries` | CI-only | |
| `reporter` | `html` (never auto-opened), plus the dashboard reporter when `E2E_DASH_EVENTS` is set | Configured here rather than as a CLI flag, because `--reporter=` replaces the whole list and cannot carry the html options |
| `use.baseURL` | `E2E.webBase` | |
| `use.trace` | `on-first-retry` | |
| `use.actionTimeout` | 15000 | |
| `webServer` | **absent, on purpose** | The stack belongs to `scripts/e2e.sh`. Adding one boots a second, unmigrated stack on top of the real one |

Five projects:

| Project | Test directory | Session | Depends on |
|---|---|---|---|
| `setup` | `apps/web/tests/setup/seed.setup.ts` | — | — |
| `chromium-unauth` | `apps/web/tests/unauthenticated` | none | `setup` |
| `chromium-smoke` | `apps/web/tests/smoke` | administrator | `setup` |
| `chromium-pwa` | `apps/web/tests/pwa` | administrator bound to `localhost`, with `baseURL` on the localhost origin | `setup` |
| `chromium-auth` | `apps/web/tests/authenticated` | administrator | `setup` |

Every project declares `setup` as a dependency, so a scoped run still seeds and logs in.

`chromium-pwa` is separate for two reasons: `navigator.serviceWorker` exists only in a
secure context, which a custom hosts-file name over plain HTTP is not — so the same server
has to be reached as `localhost` — and the worker is a *caching* worker that intercepts
fetches, so enabling it under every other test would change navigation behaviour those
tests were verified without.

### The specs

**`apps/web/tests/unauthenticated/login.spec.ts`** — two tests: "renders the login form"
and "rejects bad credentials and stays on the login page". Its header is the exemplar
note for unauthenticated flows, and it documents a real trap: `FormFieldWrapper` puts the
same `data-testid` on the field wrapper `div` **and** on the `input` inside it, so
`getByTestId` resolves to two elements and strict mode fails. Anchor on
`input[data-testid=…]`.

**`apps/web/tests/unauthenticated/auth-guards.spec.ts`** — five tests in two groups. The
session gate: "an unauthenticated visit to /administration is redirected to /login" (the
assertion is on `/administration` because `/` is exempt) and "/logout without a session
leaves the logout page without an error". The `(auth)` pages: "/register renders the
registration form", "/reset/<code> renders the password reset page", and
"/activation/<unknown code> reports the failure instead of hanging".

**`apps/web/tests/unauthenticated/auth-api-contract.spec.ts`** — six table-driven cases
against `POST /auth/login`: an invalid email format, a missing password, a missing email,
a non-string email and a wrong JSON:API resource type are all 400; well-formed but unknown
credentials are 401, not 400.

**`apps/web/tests/unauthenticated/users-api-contract.spec.ts`** — four tests in two
groups, driving the API directly. Authentication: `/users/me/full` and `/users/:userId`
refused without a token. Tenant isolation: an unknown id is 404 for the platform
administrator, and a company member cannot read a user outside its company. Two protocol
facts are recorded in comments: a NestJS `POST` returns 201, not 200, and the library's
JWT guard answers a missing bearer with 403, not 401.

**`apps/web/tests/smoke/app.smoke.spec.ts`** — the exemplar authenticated spec and the
highest-value file in the suite. Two tests assert the home page and the administration
index render for an administrator; the third uses the member `storageState` and proves the
`(admin)` group refuses a non-administrator — on the index **and** on a child route,
checking that none of the `admin-index-*` testids rendered and that the refusal is not a
redirect to `/login`. The gate lives in each page's `requireAdministrator` call, so the
refusal it looks for is the `errors.404` copy that
`apps/web/src/app/[locale]/(admin)/not-found.tsx` renders inside the app frame.

**`apps/web/tests/smoke/admin.smoke.spec.ts`** — nine route smokes generated from a table.

**`apps/web/tests/authenticated/users-management.spec.ts`** — three tests: the user list
shows both seeded personas; search narrows it; and logout clears the
`token` and `refreshToken` cookies.

**`apps/web/tests/pwa/service-worker.spec.ts`** — one test. It waits for
`navigator.serviceWorker.ready`, polls until `/offline` is in the cache (the precache, not
just the registration), goes offline, navigates to `/administration`, asserts the offline
heading renders while the address bar keeps the requested URL, then clicks Try Again and
asserts the real page comes back.

### The support modules

| File | Role |
|---|---|
| `apps/web/tests/e2e.env.ts` | Ports, hosts, database name and both persona fixtures. The single place any of them is named. Layers the local e2e environment file over the repo-root one, neither overwriting already-exported values |
| `apps/web/tests/support/auth.ts` | `login()` against `POST /auth/login`, and `loginAndSaveState()` which plants cookies and hydrates localStorage |
| `apps/web/tests/support/db.ts` | `testProbe()` read-only Cypher, `num()` for neo4j integers, and `createNonAdministratorUser()` |
| `apps/web/tests/support/smoke.ts` | `smokeTest(route)` — renders, no failing same-stack request, nothing unexpected on `console.error` — plus the global console allowlist |
| `apps/web/tests/support/actions.ts` | `gotoWithRetry(page, url, ready)` — navigate and retry up to five times while a cold route warms |
| `apps/web/tests/setup/seed.setup.ts` | The `setup` project: the fixture, three logins, two role assertions |
| `apps/web/tests/scripts/e2e-db.mjs` | The only DDL in the suite: drop and create the test database, and poll until every migration file has a matching node |
| `apps/web/tests/reporters/dashboard-reporter.ts` | Appends NDJSON events for the dashboard |

### The two personas

| Persona | Origin | Holds |
|---|---|---|
| administrator | Seeded by a migration in `apps/api/src/neo4j.migrations` | The `Administrator` role on a platform membership, and no company |
| member | `createNonAdministratorUser()` in `apps/web/tests/support/db.ts` | `Company Administrator` in its own company. Never `Administrator` |

The member is created with Cypher rather than through registration because registration is
a multi-step flow — register, mail an activation code, activate — whose first step fires a
mail side effect and whose second is only reachable by reading the code back out of the
database. Driving it would make the suite depend on the registration mode and on a mail
provider, to obtain a fixture that is pure setup. Its password is not hashed either: the
node copies `password` straight off the seeded administrator, so both personas share one
plaintext and the suite takes no bcrypt dependency. Every node is `MERGE`d on a fixed id,
so re-running `setup` duplicates nothing.

The seed project asserts **both** role memberships and fails the whole run if either is
wrong, so a downstream 403 assertion can never pass for the wrong reason.

### Why cookies are planted rather than collected

`loginAndSaveState` authenticates through the real `POST /auth/login` and then writes the
cookies into Playwright's jar itself. The reason is mechanical: the library marks its auth
cookies `secure` whenever `NODE_ENV` is `"production"`, and the e2e web server is a
production build served over plain HTTP — so the browser would reject every `Set-Cookie`
the app emits. Playwright's cookie jar is not subject to that rule.

The **values** are still entirely the API's: the token, the role ids, the feature ids and
the module permissions all come out of the login response, so a test that depends on a
role is testing the role the API actually granted. The encodings mirror
`apps/web/src/server-actions/auth-cookies.ts` exactly, gzip-plus-base64-plus-JSON-quoting
of `modules` included.

Two further details the file records. Planting cookies alone produces a half-authenticated
session — the server sees it, but every client component reads the user from a persisted
atom that is still null, so role-gated *client* chrome never renders while server-gated
routes work fine. `loginAndSaveState` therefore also fetches the full-user endpoint and writes the
dehydrated user into `localStorage`, from a page already on the target origin, because
`storageState` only records origins the context visited. And it performs one real
navigation before saving, failing loudly if the planted session lands on `/login`.

Cookies are domain-scoped, which is why the administrator is logged in twice — once for
the custom host, once for `localhost` — and why `chromium-pwa` needs its own state file.

## `scripts/e2e.sh`

`pnpm test:e2e` runs it; any argument is forwarded verbatim to `playwright test`. The
sequence, each step announced with an `==> [e2e]` line the dashboard parses:

1. **Load the local e2e environment file** if present, with `set -a` so every value is exported.
2. **Resolve ports and names** — 4080 api, 4081 web, 4082 worker health; the test database
   and a dedicated BullMQ queue prefix; hosts from `PUBLIC_HOSTNAME`.
3. **Free the three ports**, killing only processes `LISTENING` on them. `-sTCP:LISTEN` is
   load-bearing: without it `lsof` also matches sockets whose *foreign* port is that
   number — a browser tab, a keep-alive curl — and this runs before boot as well as on
   teardown.
4. **Build the workspace packages** with `turbo run build --filter=...^<app>` for both
   apps — "everything the app depends on, but not the app itself", so it adapts to whatever
   packages the project has. Cached, so a no-op after the first run.
5. **Recreate the test database**, empty, through the database helper.
6. **Start the worker alone** and wait, for up to 90 seconds, until every migration has
   been applied.
7. **Start the API** with `RATE_LIMIT_ENABLED=false` and a `CORS_ORIGINS` list carrying
   both the custom host and `localhost`.
8. **Build the web app for production** with `E2E_BUILD=true`, then start it. The
   `NEXT_PUBLIC_*` values are exported *before* the build because they are inlined at
   build time.
9. **Wait for both origins** to answer with `curl --retry`.
10. **Run Playwright**, forwarding any arguments.
11. **Tear the stack down** on exit — `trap cleanup EXIT INT TERM` — by killing each
    captured PID's process tree and freeing the three ports.

The worker health port is reserved and freed but never polled: exposing it requires the
app to opt in through the bootstrap options, and the template does not. The migration
check is the worker's real readiness signal.

## `pnpm e2e:dash`

`scripts/e2e-dashboard.mjs` is a dependency-free Node server on `127.0.0.1:4084`. It does
not run tests — it spawns `scripts/e2e.sh` and reads two streams:

- the `==> [e2e] …` lines, which drive a boot strip: free ports → build packages → reset
  database → worker → migrations → api → web build → web start → health → Playwright →
  teardown;
- an NDJSON file the dashboard reporter appends to, which drives the per-test rows.

Pressing **Run** makes two passes. First `playwright test --list` with `E2E_DASH_LIST=1`,
which needs no stack and takes seconds, so every test is painted as pending during the
three-to-five-minute boot; the reporter suppresses its run-end event in that pass so the UI
does not believe the run finished. Then the real run.

**Stop** signals the process group the dashboard created — the script *and* the Playwright
it is waiting on. Signalling the script alone is not enough: bash defers a trap until its
current foreground command returns, so nothing would happen during the Playwright phase.
Nothing is ever killed by name.

The HTML report is served at `/report` when a run ends. `pnpm e2e:dash:test` runs the
parser tests, which are pinned against the real runner script and the Playwright config —
add a boot phase and the test tells you to teach the dashboard about it.

Automation should call `scripts/e2e.sh` directly; the dashboard waits for a human.

## The nine decisions that are not negotiable

`apps/web/tests/README.md` §3 lists them, each encoding a failure already paid for. In
short, with the failure each prevents:

| Decision | Failure it prevents |
|---|---|
| The worker starts **alone**, and the API waits for its migrations | Worker and API both create the same index in `onModuleInit` against a fresh database, and one dies with "an equivalent index already exists" — intermittently |
| The e2e stack uses its **own** queue prefix | Redis is shared, so the e2e and dev workers consume the same queues: a job enqueued by one stack executes against the other's database, while the endpoint that only enqueues returns 2xx |
| The web app runs a **production build** | Under `next dev` every route cold-compiles on first hit (15–110s), so the suite takes 45+ minutes and flakes on compile timeouts |
| `E2E_BUILD=true` → a separate build directory | The e2e build clobbers a running dev server's output and it 404s every route |
| `RATE_LIMIT_ENABLED=false` | The login route's hard-coded per-IP throttle, which the env-configured throttlers cannot raise, turns repeated logins from one address into 429s |
| `CORS_ORIGINS` includes `localhost` | The PWA test loads the same server through `localhost` for a secure context, and its client-side API calls need that origin allowed |
| `fullyParallel: false`, `workers: 1` | One shared seeded database; parallelism makes results depend on timing rather than behaviour |
| Playwright **never** starts servers | A `webServer` block boots a second, unmigrated stack on top of the real one |
| Teardown kills by **captured PID or port**, never by name pattern | A name pattern matches every project on the machine, not just this one |

Read that file before writing the third spec. It also carries the housekeeping rules —
the saved session states hold live tokens and are gitignored — and the six-point checklist
for adding a spec: pick the project, anchor on `data-testid` rather than copy, assert an
observable outcome rather than a timeout, use fixed UUID literals for anything you seed,
and keep direct Cypher inside the tests directory only.

## Where to look

| File | Why |
|---|---|
| `apps/web/tests/README.md` | The nine decisions, in full, with their reasoning |
| `apps/web/vitest.config.ts` | The jsdom setup, the include globs and the package inlining |
| `apps/web/vitest.setup.ts` | Every global mock a component spec inherits |
| `apps/web/playwright.config.ts` | The five projects and the absent `webServer` |
| `apps/web/tests/e2e.env.ts` | Ports, hosts, database and both personas |
| `apps/web/tests/support/auth.ts` | Why cookies are planted, and the localStorage hydration |
| `apps/web/tests/support/db.ts` | The non-administrator fixture and its Cypher |
| `apps/web/tests/smoke/app.smoke.spec.ts` | The exemplar authenticated spec |
| `scripts/e2e.sh` | The whole runtime, with the reasoning inline |
| `scripts/e2e-dashboard.mjs` | The two passes, the boot strip and the stop semantics |

## Gaps and drift

- No feature component spec ships in `apps/web`, and `passWithNoTests: true` would hide
  an empty suite in a green `pnpm test`.
- `apps/web/package.json` maps `"typecheck": "eslint ."`, so nothing in the app runs
  `tsc --noEmit`. Combined with `strict: false` in `apps/web/tsconfig.json`, type errors
  are not a gate.
- `apps/web/vitest.config.ts` collects both `.test.*` and `.spec.*`. Do not assume the
  same in a sibling repository built on this template.
- Four routes under `(admin)`, plus `/administration/rbac/roles`, are not smoked, and none
  of the `(main)/(foundations)` routes — settings, roles, notifications, token usage — has
  any coverage at all.
- The smoke console allowlist permits every message matching `WebSocket`, because the e2e
  stack has no realtime server. A genuine socket regression would be invisible.
- I did not run either suite, and did not examine `apps/web/tests/reporters/dashboard-reporter.ts`
  or `apps/web/tests/scripts/e2e-db.mjs` beyond their documented contracts.
