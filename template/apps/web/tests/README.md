# End-to-end tests

This suite drives the **real application** — Next.js UI → NestJS api → Neo4j —
to verify behaviour end to end. It is **deterministic**: every run starts from a
freshly recreated, freshly migrated, freshly seeded database, so a test either
passes for a real reason or fails for a real reason, never because of leftover
state.

The template ships the harness plus **two exemplar specs**. Everything else is
yours to add. Read this file before writing the third one.

---

## 1. Running it

```bash
pnpm test:e2e
```

That runs `scripts/e2e.sh`, which is the whole runtime. It:

1. Sources `.env.e2e` if present (see `env.e2e.example`) and frees the dedicated
   ports — **3980** api, **3981** web, **3982** worker health.
2. Builds the workspace packages (turbo-cached, a no-op after the first run).
3. Recreates the test database `{{name}}test`, empty.
4. Boots the **worker alone** and waits for its migrator to finish.
5. Boots the **api** and a **production build of the web app**, then waits for
   both to answer.
6. Runs Playwright.
7. Tears the whole stack down on exit — including on Ctrl+C.

Any argument is forwarded verbatim to `playwright test`, so a run can be scoped:

```bash
pnpm test:e2e --project=chromium-smoke
pnpm test:e2e tests/smoke/app.smoke.spec.ts
pnpm test:e2e --grep administration
```

The `setup` project is a declared dependency of every other project, so a scoped
run still seeds the database and logs in.

**Prerequisites:** Neo4j and Redis running locally, and `/etc/hosts` entries
pointing `{{name}}.test` and `api.{{name}}.test` at `127.0.0.1`.

---

## 2. How it fits together

```
scripts/e2e.sh ──boots──► worker (migrates) + api + web ──► Playwright
                                                               │
                     ┌─────────────────────────────────────────┘
                     ▼
  project "setup"  → tests/setup/seed.setup.ts
                       ├─ createNonAdministratorUser()   (tests/support/db.ts)
                       └─ loginAndSaveState() ×2         (tests/support/auth.ts)
                          → playwright/.auth/admin.json
                          → playwright/.auth/member.json
                     ▼
  project "chromium-unauth" → tests/unauthenticated/*   (no storageState)
  project "chromium-smoke"  → tests/smoke/*             (admin storageState)
```

| File | Role |
|---|---|
| `e2e.env.ts` | Ports, hosts, database and persona fixtures. The single place any of them is named. |
| `scripts/e2e-db.mjs` | The only DDL in the suite: drop/create the test database, and poll until every migration has been applied. |
| `support/auth.ts` | `POST /auth/login` + `storageState`. No SSO branch, no dev-token shortcut. |
| `support/db.ts` | Read-only Cypher probes for assertions, and the non-administrator fixture. |
| `setup/seed.setup.ts` | The `setup` project. Seeds fixtures, saves one state per persona. |

---

## 3. The decisions that are not negotiable

Each of these encodes a failure that has already been paid for. Changing one
brings the failure back.

**Boot order: the worker starts ALONE, and the api waits for its migrations.**
The worker owns the migrator (a worker-only provider), and both the worker and
the api create fulltext indexes and constraints in `onModuleInit` with a
check-then-create pattern. Boot them together against a fresh database and both
see no index, both create it, and one of them dies with *"An equivalent index
already exists"* — intermittently, which is worse than always.

**The e2e stack uses its own BullMQ queue prefix.** Redis is a single shared
instance, also used by other projects on the same machine. With a shared prefix
the e2e worker and the dev worker consume the *same* queues: a job enqueued by
one stack is executed by the other, against the other stack's database. The
symptom is an endpoint that returns 2xx (it only enqueues) while nothing ever
happens in the test database.

**The web app runs a PRODUCTION build, never `next dev`.** Under dev every route
cold-compiles on first hit — 15 to 110 seconds each — so a suite takes 45+
minutes and flakes on compile timeouts. A production build compiles once and
then serves in under a second.

**`E2E_BUILD=true` → `distDir: ".next-e2e"`.** The e2e build must never touch the
dev server's `.next`; sharing it makes a running `next dev` 404 every route.

**`RATE_LIMIT_ENABLED=false`.** The login route hard-codes a per-IP `@Throttle`
that the env-configured global throttlers cannot raise. A suite that logs in
repeatedly from `127.0.0.1` otherwise starts collecting 429s.

**`CORS_ORIGINS` includes `localhost`.** `navigator.serviceWorker` only exists in
a secure context, and a custom `/etc/hosts` name over plain http is not one — so
a PWA test has to load the same server through `http://localhost:3981`, and its
client-side api calls need that origin allowed. `E2E.webBaseLocalhost` is there
for exactly that.

**`fullyParallel: false` and `workers: 1`.** The suite shares one seeded
database. Parallelism makes it non-deterministic.

**Playwright never starts servers.** There is no `webServer` block in
`playwright.config.ts`, on purpose. Adding one boots a second, unmigrated stack
on top of the real one.

**Teardown kills by captured PID or by port. Never by name pattern.**
`pkill -f node` and `killall node` match every project on the machine, not just
this one. `scripts/e2e.sh` captures each PID it spawns and frees its own three
ports; keep it that way.

---

## 4. Sessions

`tests/support/auth.ts` authenticates through `POST /auth/login` with an e-mail
and a password, exactly as the login form does, and then plants the resulting
cookies into the Playwright context.

The cookies are planted rather than collected from the app's `Set-Cookie`
headers because the library marks its auth cookies `secure` whenever `NODE_ENV`
is `"production"` — and the e2e web server is a production build served over
plain http, so the browser would reject all of them. Playwright's cookie jar is
not subject to that rule. The **values** are still entirely the api's: the
token, the role ids and the module permissions all come out of the login
response, so a test that depends on a role is testing the role the api actually
granted.

Cookies are domain-scoped. A `storageState` saved for `{{name}}.test` does not
authenticate `http://localhost:3981`; pass `webBase` and `cookieDomain` to
`loginAndSaveState` to build a second state for that origin.

---

## 5. The two personas

| Persona | Where it comes from | Holds |
|---|---|---|
| **administrator** | Seeded by migration `apps/api/src/neo4j.migrations/20250901_004.ts` | The `Administrator` role on a platform membership (no company) |
| **member** | Created by `createNonAdministratorUser()` in `tests/support/db.ts` | `Company Administrator` in its own company. **Never** `Administrator`. |

The member is created with Cypher rather than through `POST /auth/register`
because registration is a multi-step flow — register, e-mail an activation code,
activate — whose first step fires a mail side effect and whose second step is
only reachable by reading the code back out of the database. Driving it would
make the suite depend on the registration mode and on an e-mail provider, to
obtain a fixture that is pure setup and not the thing under test. Its password
is not hashed in the suite either: the node copies `password` straight off the
seeded administrator, so both personas share one plaintext and neither the
suite nor the web app takes a bcrypt dependency.

`seed.setup.ts` asserts both role memberships and fails the whole run if either
is wrong, so a downstream 403 assertion can never pass for the wrong reason.

The administrator's credentials come from migration `20250901_004`. If you
change that migration's e-mail or password hash, override `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` in `.env.e2e` rather than editing `e2e.env.ts`.

---

## 6. Adding a spec

1. Decide the project. Unauthenticated flow → `tests/unauthenticated/`.
   Authenticated → `tests/smoke/`. A different persona → `test.use({
   storageState: "playwright/.auth/member.json" })` inside a `describe`.
2. Anchor on `data-testid`, not on copy. The library's forms and containers
   already ship them (`page-login-container`, `form-login-input-email`,
   `admin-index-companies`, …) and they survive rewording and translation.
3. Assert an **observable outcome** — an element, a response status, a row in
   the database via `testProbe()`. Never assert by waiting for a timeout.
4. Use fixed UUID literals for anything you seed. `randomUUID()` at module scope
   is regenerated when a worker restarts, which quietly breaks idempotency.
5. Direct Cypher is sanctioned **only** under `tests/`. Application code always
   goes through `AbstractRepository` / `AbstractService`.

---

## 7. Housekeeping

`playwright/.auth/*.json` holds **live session tokens**. It is gitignored, and it
must stay that way — never commit it and never attach it to a bug report.
`.next-e2e/` (the e2e build output) and `.env.e2e` are gitignored for the same
family of reasons.
