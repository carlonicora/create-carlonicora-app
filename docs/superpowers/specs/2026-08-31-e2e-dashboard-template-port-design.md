# E2E dashboard — port from a360ai into `template/`

Date: 2026-08-31. Status: approved design, awaiting implementation plan.

## Goal

Every newly scaffolded app inherits a working e2e setup end to end: the runner it already
has (`scripts/e2e.sh`), plus the `pnpm e2e:dash` control page, the Playwright reporter that
feeds it, and a small generic spec set that demonstrates the patterns.

## Sources and non-sources

| Source | Role |
|---|---|
| `../a360ai` | **Sole donor.** Read-only. Files are hand-ported (it is not a configured sync target and must not become one). |
| `template/` | Everything not listed as ported is the template's own and stays as it is. |
| `../neural-erp` | **Excluded entirely.** The project is being wiped out. Every `neural-erp` row in the drift report — including `scripts/e2e.sh` `TARGET_AHEAD neural-erp` — is KEEP TEMPLATE. |
| `../wyrdli` | Not a source for this task. Untouched. |

`pnpm template:apply` is not used: the donor is not a target. Each ported file is copied by
hand, edited, and swept for brand strings per `references/precedence.md` rule 7.

## Decisions (product calls, made by the user)

1. **Spec count:** a small generic set, ~7 specs total (2 existing + 5 new).
2. **Ports:** e2e stack moves from `3980–3982` to `4080–4082`; dashboard on `4084`. Same
   intent as the recent dev-port move to 4050/4051: no collisions across the fleet
   (a360ai keeps 3980–3984).
3. **Documentation:** root README lists `pnpm test:e2e` as primary with `pnpm e2e:dash`
   one line below; `apps/web/tests/README.md` gains a dashboard section.

## Architecture

```
e2e-dashboard.mjs  --spawn-->  scripts/e2e.sh  -->  playwright
     |   ^ parses "==> [e2e] ..." stdout into boot phases  |
     |   ^ tails NDJSON <-- tests/reporters/dashboard-reporter.ts
     v
   SSE  -->  e2e-dashboard.html
```

Run = two passes: `playwright test --list` with `E2E_DASH_LIST=1` (paints every test as
pending in ~10 s, no stack), then `scripts/e2e.sh <args>` (real run). The runner is NOT
dashboard-aware; the coupling is env vars the dashboard sets (`E2E_DASH_EVENTS`,
`E2E_DASH_LIST`) and the `==> [e2e]` progress lines the runner already prints.

## Components

### 1. `template/scripts/e2e-dashboard.{mjs,html,test.mjs}`

Copied from a360ai, then edited:

- Remove the `corpus` phase from `STACK_PHASES`, the fourth port from every port list, and
  every corpus mention in comments/log strings.
- Ports: `3980,3981,3982` → `4080,4081,4082`; default `E2E_DASH_PORT` `3984` → `4084`.
- `--filter avvocato360ai-web` → `--filter {{name}}-web`; tmp dir `a360ai-e2e-dashboard` →
  `{{name}}-e2e-dashboard`; hostnames in the test file → `{{name}}.test` / `api.{{name}}.test`.
- Phase regex `^recreating test databases` → `^recreating test database` — the template's
  runner prints the singular form. Verify every other `STACK_PHASES` / `STACK_FAILURES`
  regex against the template's actual `echo "==> [e2e] …"` lines and adjust any mismatch.
- Asset allowlist → `favicon.ico`, `logo.webp` (the template ships no svg logos); update the
  html's `<img>` / favicon references accordingly.
- Coverage doc: keep the optional `e2e-coverage.md` hook (already degrades to "descriptions
  disabled" when the file is absent). The test that reads the real a360ai doc is rewritten
  against an inline fixture string. No coverage doc is shipped in the template.
- Zero `avvocato`/`a360` strings remain (grep-verified).

### 2. Reporter and Playwright config

- `apps/web/tests/reporters/dashboard-reporter.ts`: verbatim copy (no brand strings).
- `apps/web/playwright.config.ts`: reporter list becomes conditional on `E2E_DASH_EVENTS`
  (a360ai's form: `html open:never` + dashboard reporter when set, `html` alone otherwise).
  Template's `timeout`, `workers`, `fullyParallel`, comments and `setup` project are kept.
  New projects: `chromium-auth` (`testDir ./tests/authenticated`, admin storageState) and
  `chromium-pwa` (`testDir ./tests/pwa`, localhost-origin storageState, see §4).

### 3. Port move

All `3980`/`3981`/`3982` references → `4080`/`4081`/`4082` in `scripts/e2e.sh`,
`apps/web/tests/e2e.env.ts`, `env.e2e.example`, `apps/web/tests/README.md`. No other runner
logic changes.

### 4. Specs and support (written against the template's own routes; a360ai's are patterns)

| File | Asserts |
|---|---|
| `unauthenticated/auth-api-contract.spec.ts` | `POST /auth/login` DTO contract (400 on bad email / wrong `data.type` / missing fields; 401 on wrong password). Near-verbatim port. |
| `unauthenticated/auth-guards.spec.ts` | unauth `/administration` and `/` redirect to login; `/logout` lands on `/`; `/register`, `/reset`, `/activation` render without crashing. |
| `unauthenticated/users-api-contract.spec.ts` | `/users/me/full` 403 without token; admin token cannot read `E2E.member` (other company) → 404/403; unknown id → 404. |
| `smoke/admin.smoke.spec.ts` | walks every `/administration/*` route (users, rbac, companies, products, ai-connections, token-usage, howtos, waitlist) as admin: 200, heading visible, no console errors outside the allowlist (no `prices` index route exists — only `prices/[id]`). |
| `authenticated/users-management.spec.ts` | users list shows seeded users; search filters rows (currently `test.fixme` — library defect in `UserRepository.findMany`); logout clears session cookies. |
| `pwa/service-worker.spec.ts` | via `E2E.webBaseLocalhost`: service worker registers, a failed navigation serves `/offline`. Needs a second storageState with `cookieDomain: "localhost"` saved by `setup/seed.setup.ts` (the template's `e2e.env.ts` already documents this). |
| `support/actions.ts` | `gotoWithRetry` (ported). |
| `support/smoke.ts` | `smokeTest(route)` + `GLOBAL_CONSOLE_ALLOWLIST` (ported, allowlist trimmed to what the template emits). |

Existing `unauthenticated/login.spec.ts` and `smoke/app.smoke.spec.ts` stay as they are.
Titles carry no coverage ids (that is an a360ai convention).

### 5. Manifest and docs (hand-authored; `package.json` is `neverAdopt`)

- root `package.json` scripts: `"e2e:dash": "node scripts/e2e-dashboard.mjs"`,
  `"e2e:dash:test": "node --test scripts/e2e-dashboard.test.mjs"`.
- No new dependencies: the dashboard is stdlib-only; web already has `@playwright/test`,
  `dotenv`, `jsonwebtoken`, `neo4j-driver`.
- `README.md` e2e row: `pnpm test:e2e` (headless) then `pnpm e2e:dash` (interactive
  dashboard on :4084). `apps/web/tests/README.md`: new "Dashboard" section (what it is,
  how Run works, ports, that automation must call `scripts/e2e.sh` directly).
- `template.sources.json`: no changes. New template-only paths under `apps/web/tests` are
  already covered by both targets' `ignore` of `apps/web/tests`; `scripts/e2e-dashboard.*`
  will appear as `TEMPLATE_ONLY` and are declared in `templateOnly`.

## Error handling

- Dashboard with no `e2e-coverage.md`: warns once, descriptions disabled, everything else works.
- Reporter without `E2E_DASH_EVENTS`: constructor returns early, plain `scripts/e2e.sh` runs
  are unaffected.
- Stop button: SIGTERM to the run's process group; `e2e.sh`'s trap frees only 4080–4082.
  No name-pattern kill anywhere.

## Testing / verification gate

Order is fixed; `integrity` before `verify`.

1. `pnpm check:template --strict` green **before any edit** (baseline).
2. After edits: `pnpm check:template --strict`, `pnpm test`, `pnpm build`.
3. `node --test template/scripts/e2e-dashboard.test.mjs` run in the generated app
   (`pnpm e2e:dash:test`) — phase parsing verified against the template's runner lines.
4. Scaffold `--skip-git --skip-install` → assert no `{{name}}`/`{{display}}` leaks, no
   `wyrdli`/`neural-erp`/`avvocato`/`a360` strings, no junk files.
5. Scaffold with git → `pnpm install` → `pnpm --filter <app>-web exec tsc --noEmit` (covers
   the new specs, reporter, config).
6. Boot `pnpm dev:api` (DI graph builds) and `pnpm dev:web` (`/` → 200); stop by PID/port.
7. Full e2e in the generated app: create a throwaway DozerDB database (`bolt://localhost:7687`,
   `neo4j`/`password`), run `scripts/e2e.sh` headless (3–5 min boot is normal), then
   `pnpm e2e:dash` and confirm in the browser that the control page renders, Run lists the
   tests and a run starts. **Drop the database afterwards.** Never point at an existing db.
8. Diff every ported file against its a360ai original once more for surviving brand strings.

## Out of scope

- Changing `scripts/e2e.sh` beyond the port numbers.
- Adopting anything from neural-erp or wyrdli.
- Adding a360ai as a sync target.
- Porting a360ai's domain specs (CRM, proceedings, quotes, …) or its `e2e-coverage.md`.
