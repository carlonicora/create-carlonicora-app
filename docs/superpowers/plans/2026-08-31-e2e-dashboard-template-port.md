# E2E Dashboard Template Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app scaffolded by `create-carlonicora-app` gets a360ai's e2e dashboard (`pnpm e2e:dash`), its Playwright reporter, a generic 7-spec suite, and the e2e stack on ports 4080–4084.

**Architecture:** `scripts/e2e-dashboard.mjs` (stdlib-only Node) spawns the template's existing `scripts/e2e.sh`, parses its `==> [e2e]` progress lines into boot phases, tails the NDJSON that `tests/reporters/dashboard-reporter.ts` appends (only when `E2E_DASH_EVENTS` is set), and streams both over SSE to `scripts/e2e-dashboard.html`. The runner itself is untouched except for port numbers.

**Tech Stack:** Node 22 (`node:http`, `node:test`), Playwright 1.62, Next.js 16 production build, Neo4j (DozerDB), bash.

**Spec:** `docs/superpowers/specs/2026-08-31-e2e-dashboard-template-port-design.md`

## Global Constraints

- **Donor is `../a360ai` only, read-only.** Never write into `../a360ai`, `../wyrdli`, `../neural-erp`.
- **Nothing from neural-erp.** Every `neural-erp` drift row is KEEP TEMPLATE. Do not open its files.
- **Ports:** e2e api `4080`, web `4081`, worker-health `4082`, dashboard `4084`. No `398x` may survive anywhere in `template/`.
- **Placeholders:** `{{name}}` = kebab-case machine name; `{{display}}` = human-readable. The CLI substitutes both in every non-binary file (`src/utils/files.ts`), `.mjs` and `.html` included.
- **Brand strings that must not survive:** `avvocato360`, `avvocato`, `a360`, `360StudioAI`, `studio`, `corpus`, `wyrdli`, `neural-erp`.
- **`package.json` is `neverAdopt`:** script entries are hand-authored, never copied.
- **No commits during execution.** Carlo smoke-tests the whole change first. `pnpm test` / integrity gates are *run*, not committed.
- **Process kills:** only by PID you spawned or `lsof -tiTCP:<port> -sTCP:LISTEN`. Never `pkill -f`, never by name.
- **`grep` on `e2e-dashboard.html` needs `-a`** — the a360ai file contains one stray NUL byte and `grep` treats it as binary (silently prints nothing). Task 4 strips that byte.
- Paths below are relative to `/Users/carlo/Development/create-carlonicora-app` unless stated. `A360=/Users/carlo/Development/a360ai`.

---

## File map

| Path (under `template/`) | Action | Responsibility |
|---|---|---|
| `scripts/e2e.sh` | modify (ports only) | the runner — unchanged logic |
| `apps/web/tests/e2e.env.ts` | modify (ports) | single source of e2e hosts/ports/personas |
| `env.e2e.example` | modify (ports) | documented overrides |
| `scripts/e2e-dashboard.mjs` | create (ported) | dashboard server + parsers |
| `scripts/e2e-dashboard.html` | create (ported) | control page |
| `scripts/e2e-dashboard.test.mjs` | create (ported) | `node --test` parser suite |
| `apps/web/tests/reporters/dashboard-reporter.ts` | create (verbatim) | NDJSON event reporter |
| `apps/web/playwright.config.ts` | modify | conditional reporter + 2 new projects |
| `apps/web/tests/setup/seed.setup.ts` | modify | saves an extra localhost-origin admin state |
| `apps/web/tests/support/actions.ts` | create | `gotoWithRetry` |
| `apps/web/tests/support/smoke.ts` | create | `smokeTest(route)` |
| `apps/web/tests/unauthenticated/auth-api-contract.spec.ts` | create | login DTO contract |
| `apps/web/tests/unauthenticated/auth-guards.spec.ts` | create | redirects + auth pages render |
| `apps/web/tests/unauthenticated/users-api-contract.spec.ts` | create | token + tenant isolation |
| `apps/web/tests/smoke/admin.smoke.spec.ts` | create | walks `/administration/*` |
| `apps/web/tests/authenticated/users-management.spec.ts` | create | users list, search, logout |
| `apps/web/tests/pwa/service-worker.spec.ts` | create | offline fallback |
| `package.json` | modify (2 scripts) | `e2e:dash`, `e2e:dash:test` |
| `README.md`, `apps/web/tests/README.md` | modify | docs |
| `../template.sources.json` (repo root) | modify | declare 3 `templateOnly` paths |

---

### Task 0: Preflight baseline

**Files:** none modified.

- [ ] **Step 1: Confirm clean tree and donor is readable**

```bash
cd /Users/carlo/Development/create-carlonicora-app && git status --short && git log --oneline -1
ls /Users/carlo/Development/a360ai/scripts/e2e-dashboard.mjs /Users/carlo/Development/a360ai/apps/web/tests/reporters/dashboard-reporter.ts
```
Expected: no output from `git status --short`; HEAD is `5bbb26a` or later; both donor files listed.

- [ ] **Step 2: Baseline integrity — must be green BEFORE any edit**

```bash
cd /Users/carlo/Development/create-carlonicora-app && pnpm check:template --strict 2>&1 | tail -15 && pnpm test 2>&1 | tail -5
```
Expected: every check `PASS`, exit 0; `node --test` reports 0 failures. If either fails, STOP and report — a later failure would be unattributable.

---

### Task 1: Move the e2e stack ports 3980–3982 → 4080–4082

**Files:**
- Modify: `template/scripts/e2e.sh:5,32-34`
- Modify: `template/apps/web/tests/e2e.env.ts:14,15,22`
- Modify: `template/env.e2e.example:28,29,34`
- Modify: `template/apps/web/tests/README.md:23,108,142`

**Interfaces:** Produces the port constants every later task quotes: `E2E.apiPort=4080`, `E2E.webPort=4081`, `E2E.workerHealthPort=4082`, `E2E.webBaseLocalhost = http://localhost:4081`.

- [ ] **Step 1: Count the references that must change (the "failing test")**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && grep -rn "398[0-9]" scripts apps/web/tests env.e2e.example README.md apps/web/next.config.js apps/web/playwright.config.ts | wc -l
```
Expected: `13`.

- [ ] **Step 2: Replace them**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && sed -i '' -e 's/3980/4080/g' -e 's/3981/4081/g' -e 's/3982/4082/g' scripts/e2e.sh apps/web/tests/e2e.env.ts env.e2e.example apps/web/tests/README.md
```

- [ ] **Step 3: Verify zero survivors and the exact new lines**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && grep -rn "398[0-9]" . --exclude-dir=node_modules | wc -l; grep -n "4080\|4081\|4082" scripts/e2e.sh apps/web/tests/e2e.env.ts env.e2e.example apps/web/tests/README.md
```
Expected: `0`, then 13 lines, including `scripts/e2e.sh:5:#   2. boot worker + api + web against it on dedicated ports (4080-4082)`, `DEFAULT_API_PORT=4080`, `e2e.env.ts:14:...?? 4080)`, `README.md:23:   ports — **4080** api, **4081** web, **4082** worker health.`

---

### Task 2: Reporter, Playwright config, localhost admin state

**Files:**
- Create: `template/apps/web/tests/reporters/dashboard-reporter.ts` (verbatim copy)
- Modify: `template/apps/web/playwright.config.ts` (whole file)
- Modify: `template/apps/web/tests/setup/seed.setup.ts`

**Interfaces:**
- Produces Playwright projects `setup`, `chromium-unauth` (`tests/unauthenticated`), `chromium-smoke` (`tests/smoke`, `playwright/.auth/admin.json`), `chromium-pwa` (`tests/pwa`, baseURL `E2E.webBaseLocalhost`, `playwright/.auth/admin-localhost.json`), `chromium-auth` (`tests/authenticated`, `playwright/.auth/admin.json`).
- Produces the reporter switch: `E2E_DASH_EVENTS` set → `[["html",{open:"never"}],["./tests/reporters/dashboard-reporter.ts"]]`, else `[["html",{open:"never"}]]` (template's existing choice — keep `never`, not a360ai's `always`).
- The reporter honours `E2E_DASH_LIST=1` (suppresses `runEnd`).

- [ ] **Step 1: Copy the reporter and prove it is brand-free**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/apps/web/tests && mkdir -p reporters && cp /Users/carlo/Development/a360ai/apps/web/tests/reporters/dashboard-reporter.ts reporters/ && grep -in "avvocato\|a360\|studio\|corpus\|398" reporters/dashboard-reporter.ts | wc -l
```
Expected: `0`.

- [ ] **Step 2: Rewrite `playwright.config.ts`**

Replace the whole file with:

```ts
import { defineConfig, devices } from "@playwright/test";
import type { ReporterDescription } from "@playwright/test";
import { E2E } from "./tests/e2e.env";

// The e2e dashboard (`scripts/e2e-dashboard.mjs`) drives the run and sets
// E2E_DASH_EVENTS to the NDJSON file its reporter appends to. The dashboard
// owns the UI, so the HTML report is still WRITTEN (the dashboard serves it at
// /report when the run ends) but never auto-opened. Configured here rather
// than as a CLI `--reporter=` flag because the CLI form REPLACES the config's
// reporter list and cannot carry the html options.
const dashboardEvents = process.env.E2E_DASH_EVENTS;
const reporter: ReporterDescription[] = dashboardEvents
  ? [
      ["html", { open: "never" }],
      ["./tests/reporters/dashboard-reporter.ts"],
    ]
  : [["html", { open: "never" }]];

export default defineConfig({
  testDir: "./tests",
  // Generous: a first navigation against a freshly booted stack pays for the
  // api's lazy schema work and the browser's first paint of a heavy route.
  timeout: 120000,
  // The suite shares one seeded database. Parallelism makes it non-deterministic
  // — a spec that reads what another spec wrote then passes or fails on timing
  // rather than on behaviour. Keep both of these as they are.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter,
  // The stack (database + worker + api + web) is owned by scripts/e2e.sh.
  // Playwright NEVER starts servers — there is no webServer block, on purpose.
  // Adding one boots a second, unmigrated stack on top of the real one.
  use: {
    baseURL: E2E.webBase,
    trace: "on-first-retry",
    actionTimeout: 15000,
  },
  projects: [
    // Seeds the fixtures the suite needs (the database itself was already
    // recreated and migrated by scripts/e2e.sh) and saves one storageState per
    // persona. Every other project depends on it, so a scoped run still seeds.
    { name: "setup", testMatch: /setup\/seed\.setup\.ts/ },
    {
      name: "chromium-unauth",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testDir: "./tests/unauthenticated",
    },
    {
      name: "chromium-smoke",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
      dependencies: ["setup"],
      testDir: "./tests/smoke",
    },
    // Service-worker tests only. `navigator.serviceWorker` exists ONLY in a
    // secure context — HTTPS, or the literal hostname localhost — and this
    // stack serves plain HTTP on the custom host, so the API is absent there.
    // The same server is reached as http://localhost:<port> instead. Scoped to
    // its own project because sw.ts is a CACHING worker that intercepts
    // fetches; enabling it under every other test would change navigation
    // behaviour they were all verified without.
    {
      name: "chromium-pwa",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: E2E.webBaseLocalhost,
        storageState: "playwright/.auth/admin-localhost.json",
      },
      dependencies: ["setup"],
      testDir: "./tests/pwa",
    },
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
      dependencies: ["setup"],
      testDir: "./tests/authenticated",
    },
  ],
});
```

- [ ] **Step 3: Save the localhost-origin admin state in `seed.setup.ts`**

Insert after the `administrator` role check block (after the `throw new Error("the seeded administrator did not come back…")` closing `}`), before the `// The ordinary user.` comment:

```ts
  // The same administrator, bound to the literal "localhost" origin — the only
  // origin Chromium treats as a secure context over plain HTTP, which the
  // service worker needs. Cookies are domain-scoped, so the state above does
  // not authenticate localhost; this one does. Consumed by the chromium-pwa project.
  await loginAndSaveState({
    browser,
    email: E2E.administrator.email,
    password: E2E.administrator.password,
    authFile: "playwright/.auth/admin-localhost.json",
    webBase: E2E.webBaseLocalhost,
    cookieDomain: "localhost",
  });
```

- [ ] **Step 4: Verify**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/apps/web && grep -c "name: \"" playwright.config.ts && grep -n "admin-localhost" tests/setup/seed.setup.ts playwright.config.ts && grep -n "dashboard-reporter" playwright.config.ts
```
Expected: `5` project names; `admin-localhost` in both files; the reporter path present.

---

### Task 3: Port `scripts/e2e-dashboard.mjs` and its test

**Files:**
- Create: `template/scripts/e2e-dashboard.mjs` (from `$A360/scripts/e2e-dashboard.mjs`, 897 lines)
- Create: `template/scripts/e2e-dashboard.test.mjs` (from `$A360/scripts/e2e-dashboard.test.mjs`)

**Interfaces:**
- Consumes: the template runner's `==> [e2e] …` lines (Task 1 file, unchanged text); the reporter (Task 2).
- Produces: exports `STACK_PHASES`, `parseStackLine`, `extractIds`, `parseCoverage`, `projectLabel`, `fileTitle`, `splitArgs`; HTTP on `127.0.0.1:${E2E_DASH_PORT ?? 4084}`; routes `/`, `/assets/<favicon.ico|logo.webp>`, `/api/*`, `/report`.

The test file runs **inside `template/`** — it resolves `ROOT` from its own location and reads `template/scripts/e2e.sh` and `template/apps/web/playwright.config.ts`, so it is the executable check for this task. `{{name}}` in those files is harmless to the parsers.

- [ ] **Step 1: Copy both files, then write the test edits first**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/scripts && cp /Users/carlo/Development/a360ai/scripts/e2e-dashboard.mjs /Users/carlo/Development/a360ai/scripts/e2e-dashboard.test.mjs .
```

Edit `e2e-dashboard.test.mjs`:

1. Header comment: replace `(e2e-coverage.md and scripts/e2e.sh)` with `(scripts/e2e.sh and apps/web/playwright.config.ts)`.
2. Delete the whole test `"parseCoverage reads the real e2e-coverage.md"` (the `test(...)` block, 8 lines). The inline-fixture test just above it stays.
3. In `"parseStackLine classifies every phase e2e.sh announces"`:
   - `:3981` → `:4081`; `http://api.avvocato360.test:3980/` → `http://api.{{name}}.test:4080/`
   - both occurrences of `migrations applied — starting API + CORPUS + WEB` → `migrations applied — starting API + WEB`
   - add, after the `freeing test ports` deepEqual:
     ```js
     assert.equal(parseStackLine("==> [e2e] building workspace packages").key, "packages");
     assert.equal(parseStackLine("==> [e2e] recreating test database x").key, "databases");
     ```
4. In `"parseStackLine catches each hard boot failure"`: `http://avvocato360.test:3981/` → `http://{{name}}.test:4081/`; add
   ```js
   assert.equal(parseStackLine("[e2e] workspace package build failed").key, "packages");
   ```
5. In `"extractIds handles both title conventions"`: `selecting a studio mints the scoped session` → `selecting a company mints the scoped session`.
6. Replace the body of `"fileTitle turns a spec path into something readable"` with:
   ```js
   assert.equal(fileTitle("unauthenticated/auth-guards.spec.ts"), "Auth guards");
   assert.equal(fileTitle("unauthenticated/users-api-contract.spec.ts"), "Users API contract");
   assert.equal(fileTitle("smoke/admin.smoke.spec.ts"), "Admin");
   assert.equal(fileTitle("smoke/app.smoke.spec.ts"), "App");
   assert.equal(fileTitle("pwa/service-worker.spec.ts"), "Service worker");
   assert.equal(fileTitle("support/smoke.ts"), "Route smoke checks");
   assert.equal(fileTitle("setup/seed.setup.ts"), "Seed database & log in");
   ```

- [ ] **Step 2: Run the test — expect the mjs-side failures**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && node --test scripts/e2e-dashboard.test.mjs 2>&1 | grep -E "^# (pass|fail)|^not ok"
```
Expected: `not ok` on "classifies every phase" (`packages` undefined, `databases` unmatched), "catches each hard boot failure", "every '==> [e2e]' line … maps to a phase" (`building workspace packages` is a note), and "fileTitle" (`Seed databases`). "projectLabel names every project" passes already (5 names, all labelled).

- [ ] **Step 3: Edit `e2e-dashboard.mjs`** — every change, by current line:

| Line | Old | New |
|---|---|---|
| 6 | `http://127.0.0.1:3984` | `http://127.0.0.1:4084` |
| 11 | `parses "==> [e2e] ..." stdout into boot phases  \|` | unchanged |
| 18 | `~643 rows` | `every row` |
| 27 | `frees only ports 3980-3983` | `frees only ports 4080-4082` |
| 43 | `?? 3984` | `?? 4084` |
| 51 | `new Set(["logo-icon.svg", "logo-icon-dark.svg", "logo.svg", "logo-dark.svg", "favicon.ico"])` | `new Set(["logo.webp", "favicon.ico"])` |
| 53 | `"a360ai-e2e-dashboard"` | `"{{name}}-e2e-dashboard"` |
| 68 (STACK_PHASES) | `{ key: "ports", … }` line stays; **insert after it**: | `{ key: "packages", label: "Build workspace packages", match: /^building workspace packages/ },` |
| 69 | `{ key: "databases", label: "Reset test databases", match: /^recreating test databases/ },` | `{ key: "databases", label: "Reset test database", match: /^recreating test database/ },` |
| 72 | `{ key: "corpus", label: "Start corpus", match: /^starting CORPUS/ },` | **delete line** |
| 82 (STACK_FAILURES) | first entry `{ key: "databases", … }` — **insert before it**: | `{ key: "packages", match: /^\[e2e\] workspace package build failed/ },` |
| 106–107 | `"migrations applied — starting API + CORPUS + WEB" closes the migration` / `wait; the API/CORPUS/WEB phases announce` | `"migrations applied — starting API + WEB" closes the migration` / `wait; the API/WEB phases announce` |
| 126 | `selecting a studio` | `selecting a company` |
| ~236 (FILE_TITLES) | `"setup/seed.setup.ts": "Seed databases & log in"` | `"setup/seed.setup.ts": "Seed database & log in"` |
| 568 | `"avvocato360ai-web"` | `"{{name}}-web"` |
| 604 | `frees ports 3980-3983` | `frees ports 4080-4082` |
| 637 | `(api / worker / corpus / web)` | `(api / worker / web)` |
| 671 | `on the four e2e ports` | `on the three e2e ports` |
| 675 | `[3980, 3981, 3982, 3983]` | `[4080, 4081, 4082]` |
| 714 | `frees ports 3980-3983` | `frees ports 4080-4082` |

Line numbers shift by +1 after the `packages` insert and −1 after the corpus delete; match on the **text**, not the number.

- [ ] **Step 4: Run the test — green**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && node --test scripts/e2e-dashboard.test.mjs 2>&1 | grep -E "^# (pass|fail)"
```
Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 5: Brand and port sweep**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/scripts && grep -in "avvocato\|a360\|studio\|corpus\|398[0-9]\|e2e-coverage.md" e2e-dashboard.mjs e2e-dashboard.test.mjs | grep -v "COVERAGE_DOC\|coverage.md\", \"utf8\|not readable\|Parse e2e-coverage.md\|loaded from"
```
Expected: no output. (The four excluded matches are the intentional optional `e2e-coverage.md` hook.)

---

### Task 4: Port `scripts/e2e-dashboard.html`

**Files:**
- Create: `template/scripts/e2e-dashboard.html` (from `$A360/scripts/e2e-dashboard.html`, 610 lines)

**Interfaces:** Consumes `/assets/favicon.ico`, `/assets/logo.webp` (Task 3 allowlist) and the SSE/API routes unchanged.

- [ ] **Step 1: Copy and strip the stray NUL byte**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/scripts && tr -d '\000' < /Users/carlo/Development/a360ai/scripts/e2e-dashboard.html > e2e-dashboard.html && file e2e-dashboard.html && wc -l e2e-dashboard.html
```
Expected: `file` reports `HTML document text` (not `data`); 610 lines.

- [ ] **Step 2: Find every brand/logo reference**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/scripts && grep -an "360StudioAI\|logo-light\|logo-dark\|logo-icon\|avvocato\|a360\|corpus" e2e-dashboard.html
```
Expected: lines 6 (`<title>`), 225–226 (two `<img>`), 229 (`brandsub`), 506 (`document.title`), plus any `.logo-light` / `.logo-dark` CSS rules.

- [ ] **Step 3: Edit**

- Line 6: `<title>360StudioAI · e2e</title>` → `<title>{{display}} · e2e</title>`
- Lines 223–226: replace the comment + two `<img>` with
  ```html
          <!-- The web app's own mark, served from apps/web/public. -->
          <img class="logo" src="/assets/logo.webp" alt="{{display}}" />
  ```
- Line 229: `360StudioAI · <span id="scopeLabel">` → `{{display}} · <span id="scopeLabel">`
- Line 506: `"360StudioAI · e2e"` → `"{{display}} · e2e"`
- Any CSS rule selecting `.logo-light` or `.logo-dark` (typically a `@media (prefers-color-scheme: dark)` toggle): delete the rule; keep the base `.logo` rule.

- [ ] **Step 4: Verify**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/scripts && grep -ain "360Studio\|logo-light\|logo-dark\|logo-icon\|avvocato\|a360\|corpus\|studio" e2e-dashboard.html | wc -l; grep -ac "{{display}}" e2e-dashboard.html
```
Expected: `0` then `4`.

- [ ] **Step 5: Serve it once, in the template dir, and hit the routes**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template && (E2E_DASH_PORT=4084 node scripts/e2e-dashboard.mjs > /private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad/dash.log 2>&1 & echo $! > /private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad/dash.pid); sleep 2; curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:4084/; curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:4084/assets/favicon.ico; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4084/assets/logo.webp; kill "$(cat /private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad/dash.pid)"; cat /private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad/dash.log | head -3
```
Expected: `200 200 200`; log contains `e2e-coverage.md not readable — descriptions disabled` (the graceful path) and the listen line. Kill is by the PID we captured.

---

### Task 5: Support helpers `actions.ts` and `smoke.ts`

**Files:**
- Create: `template/apps/web/tests/support/actions.ts`
- Create: `template/apps/web/tests/support/smoke.ts`

**Interfaces (Produces):**
- `gotoWithRetry(page: Page, url: string, ready: (page: Page) => Locator): Promise<void>`
- `type SmokeRoute = { path: string; ready: (page: Page) => Locator; allowConsole?: RegExp[]; allowRequest?: RegExp[] }`
- `smokeTest(route: SmokeRoute): void` — registers a Playwright test titled `smoke <path>`.
- `GLOBAL_CONSOLE_ALLOWLIST: RegExp[]`

- [ ] **Step 1: Write `support/actions.ts`**

```ts
import { Locator, Page } from "@playwright/test";

/**
 * Navigate and wait until `ready` resolves at least one element, retrying the
 * navigation a few times. The first hit on a route after a cold boot can pay
 * for the api's lazy schema work; a bare `goto` + assertion races that.
 */
export async function gotoWithRetry(page: Page, url: string, ready: (page: Page) => Locator): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await page.goto(url);
    // best-effort: some pages never reach networkidle (e.g. a retried image 404)
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    if ((await ready(page).count()) > 0) return;
    await page.waitForTimeout(1000);
  }
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
```

- [ ] **Step 2: Write `support/smoke.ts`**

```ts
import { expect, Locator, Page, test } from "@playwright/test";
import { E2E } from "../e2e.env";

export type SmokeRoute = {
  path: string;
  /** Something that only renders once the page's data has actually arrived. */
  ready: (page: Page) => Locator;
  allowConsole?: RegExp[];
  /** Same-stack request URLs whose 4xx/5xx responses are EXPECTED on this route. */
  allowRequest?: RegExp[];
};

/**
 * Console errors that are noise in the isolated e2e stack, not regressions.
 * Extend ONLY with a comment naming the route and the run that produced the
 * message — an allowlist that grows silently stops catching anything.
 */
export const GLOBAL_CONSOLE_ALLOWLIST: RegExp[] = [
  /WebSocket/i, // socket reconnection noise: the stack has no realtime server
  /favicon/i,
];

const SAME_STACK = [E2E.apiBase, E2E.webBase, E2E.webBaseLocalhost];

/**
 * A route smoke: the page renders its `ready` element, no same-stack request
 * failed, and nothing unexpected reached console.error. Three cheap assertions
 * that catch a route 500ing, an api call the page cannot make, and a runtime
 * exception in a client component.
 */
export function smokeTest(route: SmokeRoute): void {
  test(`smoke ${route.path}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const allow = [...GLOBAL_CONSOLE_ALLOWLIST, ...(route.allowConsole ?? [])];

    page.on("console", (msg) => {
      if (msg.type() === "error" && !allow.some((re) => re.test(msg.text()))) consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      const sameStack = SAME_STACK.some((base) => res.url().startsWith(base));
      const expected = (route.allowRequest ?? []).some((re) => re.test(res.url()));
      if (sameStack && !expected && res.status() >= 400)
        failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    });

    for (let i = 0; i < 5; i++) {
      try {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      } catch {
        await page.waitForTimeout(1000);
        continue;
      }
      if ((await route.ready(page).count()) > 0) break;
      await page.waitForTimeout(1000);
    }

    await expect(route.ready(page)).toBeVisible({ timeout: 15000 });
    expect(failedRequests, `failed requests on ${route.path}`).toEqual([]);
    expect(consoleErrors, `console errors on ${route.path}`).toEqual([]);
  });
}
```

- [ ] **Step 3: Verify they parse (typecheck happens in Task 8 step 5 on the scaffolded app)**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/apps/web/tests/support && grep -c "export" actions.ts smoke.ts && grep -in "avvocato\|a360\|398" actions.ts smoke.ts | wc -l
```
Expected: `actions.ts:1`, `smoke.ts:3`, then `0`.

---

### Task 6: The five new specs

**Files:**
- Create: `template/apps/web/tests/unauthenticated/auth-api-contract.spec.ts`
- Create: `template/apps/web/tests/unauthenticated/auth-guards.spec.ts`
- Create: `template/apps/web/tests/unauthenticated/users-api-contract.spec.ts`
- Create: `template/apps/web/tests/smoke/admin.smoke.spec.ts`
- Create: `template/apps/web/tests/authenticated/users-management.spec.ts`
- Create: `template/apps/web/tests/pwa/service-worker.spec.ts`

**Interfaces (Consumes):** `E2E` from `../e2e.env` (Task 1 ports), `gotoWithRetry`, `smokeTest` (Task 5), storage states from Task 2. Selectors verified against the library at `packages/nextjs-jsonapi/src`: `data-testid="content-table-search-trigger"` / `"content-table-search-input"` (`components/tables/ContentTableSearch.tsx`), `data-testid="sidebar-container"` (template `apps/web/src`), `admin-index-*` (existing `app.smoke.spec.ts`), `page-login-container`, register inputs `#company #name #email #password` (`features/auth/components/forms/Register.tsx:253-274`), en.json strings `offline.title = "You're Offline"`, `offline.retry = "Try Again"`, `auth.errors.activating_account = "An error occurred while activating your account."`, `auth.password_reset = "Reset Password"`.

- [ ] **Step 1: `unauthenticated/auth-api-contract.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { E2E } from "../e2e.env";

/**
 * POST /auth/login request-contract assertions, against the api directly.
 *
 * These exercise the DTO / ValidationPipe layer, not the UI: the login form
 * cannot produce a numeric email or a wrong `data.type`, so the 400 branches
 * are unreachable from any page-driven spec.
 *
 * RATE LIMITING IS OFF IN THIS STACK: scripts/e2e.sh starts the api with
 * RATE_LIMIT_ENABLED=false. If that pin is ever removed, POST /auth/login is
 * throttled per IP and this file's six logins would 429. Fix the stack, not
 * this file.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const loginBody = (attributes: Record<string, unknown>) => ({
  data: { type: "auth", attributes },
});

test.describe("POST /auth/login — request contract", () => {
  const cases: Array<{ label: string; body: unknown; status: number }> = [
    { label: "an invalid email format is rejected", body: loginBody({ email: "invalid-email", password: "password" }), status: 400 },
    { label: "a missing password is rejected", body: loginBody({ email: "someone@example.test" }), status: 400 },
    { label: "a missing email is rejected", body: loginBody({ password: "password" }), status: 400 },
    { label: "a non-string email is rejected", body: loginBody({ email: 12345, password: "password" }), status: 400 },
    {
      label: "a wrong JSON:API resource type is rejected",
      body: { data: { type: "wrong-type", attributes: { email: "someone@example.test", password: "password" } } },
      status: 400,
    },
    {
      label: "well-formed but unknown credentials are 401, not 400",
      body: loginBody({ email: "nonexistent@example.test", password: "wrongpassword" }),
      status: 401,
    },
  ];

  for (const c of cases) {
    test(c.label, async ({ request }) => {
      const res = await request.post(`${E2E.apiBase}/auth/login`, { data: c.body });
      expect(res.status()).toBe(c.status);
    });
  }
});
```

- [ ] **Step 2: `unauthenticated/auth-guards.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

/**
 * The proxy's session gate (apps/web/src/proxy.ts) and the (auth) route group,
 * seen without any session. `/` is deliberately exempt from the gate, so the
 * redirect is asserted on /administration.
 */
test.describe("session gate", () => {
  test("an unauthenticated visit to /administration is redirected to /login", async ({ page }) => {
    await page.goto("/administration");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 30000 });
    await expect(page.getByTestId("page-login-container")).toBeVisible();
  });

  test("/logout without a session leaves the logout page without an error", async ({ page }) => {
    await page.goto("/logout");
    await page.waitForURL((url) => !url.pathname.includes("/logout"), { timeout: 30000 });
    // Logout.tsx sends the browser to "/" (exempt) — the gate must not bounce it
    // back through /logout, and nothing may have thrown on the way.
    expect(["/", "/login"]).toContain(new URL(page.url()).pathname);
    await expect(page.getByText(/application error/i)).toHaveCount(0);
  });
});

test.describe("(auth) pages render", () => {
  test("/register renders the registration form", async ({ page }) => {
    await page.goto("/register");
    // Register.tsx: FormFieldWrapper ids company / name / email / password.
    await expect(page.locator("#company")).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("button[type='submit']").first()).toBeVisible();
  });

  test("/reset/<code> renders the password reset page", async ({ page }) => {
    await page.goto("/reset/00000000-0000-0000-0000-000000000000");
    // ResetPassword.tsx heading: t("auth.password_reset") = "Reset Password".
    await expect(page.getByText(/reset password/i).first()).toBeVisible();
  });

  test("/activation/<unknown code> reports the failure instead of hanging", async ({ page }) => {
    await page.goto("/activation/00000000-0000-0000-0000-000000000000");
    // ActivateAccount.tsx: after the api refuses the code the card switches
    // from "Please wait…" to t("auth.errors.activating_account").
    await expect(page.getByText(/error occurred while activating/i)).toBeVisible({ timeout: 30000 });
  });
});
```

- [ ] **Step 3: `unauthenticated/users-api-contract.spec.ts`**

```ts
import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E } from "../e2e.env";

/**
 * GET /users/* seen from the api directly: the bearer guard and tenant
 * isolation. Both personas are seeded by tests/setup/seed.setup.ts; the
 * member belongs to "E2E Company", the administrator to no company at all.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const JSON_API = "application/vnd.api+json";

async function bearer(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E.apiBase}/auth/login`, {
    headers: { "Content-Type": JSON_API, Accept: JSON_API },
    data: { data: { type: "auth", attributes: { email, password } } },
  });
  expect(res.status(), `login ${email}`).toBe(200);
  const body = (await res.json()) as { data?: { attributes?: { token?: string } } };
  const token = body.data?.attributes?.token;
  if (!token) throw new Error(`login ${email}: no token in ${JSON.stringify(body)}`);
  return token;
}

test.describe("GET /users — authentication", () => {
  test("/users/me/full is refused without a token", async ({ request }) => {
    const res = await request.get(`${E2E.apiBase}/users/me/full`, { headers: { Accept: JSON_API } });
    expect(res.status()).toBe(401);
  });

  test("/users/:userId is refused without a token", async ({ request }) => {
    const res = await request.get(`${E2E.apiBase}/users/${E2E.member.id}`, { headers: { Accept: JSON_API } });
    expect(res.status()).toBe(401);
  });
});

test.describe("GET /users/:userId — tenant isolation", () => {
  test("an unknown user id is 404 for the platform administrator", async ({ request }) => {
    const token = await bearer(request, E2E.administrator.email, E2E.administrator.password);
    const res = await request.get(`${E2E.apiBase}/users/00000000-0000-0000-0000-000000000000`, {
      headers: { Accept: JSON_API, Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test("a company member cannot read a user outside its company", async ({ request }) => {
    // Both personas share one plaintext: createNonAdministratorUser copies the
    // administrator's password hash onto the member node.
    const token = await bearer(request, E2E.member.email, E2E.administrator.password);
    const res = await request.get(`${E2E.apiBase}/users/${E2E.administrator.id}`, {
      headers: { Accept: JSON_API, Authorization: `Bearer ${token}` },
    });
    // The isolation property is what matters; whether the api says 403 or 404
    // is its choice. What it must NEVER do is answer 2xx with the other
    // tenant's data.
    expect(res.status(), "a cross-tenant read must be refused").toBeGreaterThanOrEqual(400);
    expect(await res.text()).not.toContain(E2E.administrator.email);
  });
});
```

- [ ] **Step 4: `smoke/admin.smoke.spec.ts`**

```ts
import { smokeTest, type SmokeRoute } from "../support/smoke";

/**
 * Every route under the (admin) group, as the platform administrator. The
 * layout gate is proved elsewhere (app.smoke.spec.ts); this file proves that
 * each page still renders, makes no failing same-stack request and throws
 * nothing in the browser.
 *
 * `ready` anchors on the admin shell's sidebar for pages whose content is a
 * library container without a stable testid, and on something page-specific
 * wherever one exists. Prefer the latter when you add a route.
 */
const sidebar: SmokeRoute["ready"] = (page) => page.getByTestId("sidebar-container");

const routes: SmokeRoute[] = [
  { path: "/administration", ready: (page) => page.getByTestId("admin-index-companies") },
  { path: "/administration/users", ready: (page) => page.getByTestId("content-table-search-trigger") },
  { path: "/administration/companies", ready: sidebar },
  { path: "/administration/rbac", ready: sidebar },
  { path: "/administration/products", ready: sidebar },
  { path: "/administration/prices", ready: sidebar },
  { path: "/administration/ai-connections", ready: sidebar },
  { path: "/administration/token-usage", ready: sidebar },
  { path: "/administration/howtos", ready: sidebar },
  { path: "/administration/waitlist", ready: sidebar },
];

for (const route of routes) smokeTest(route);
```

If `/administration/products` or `/administration/prices` fail **only** because Stripe is unconfigured in the e2e stack (a same-stack `GET …/stripe/…` or `…/products` 4xx/5xx with a "Stripe" message in the api log), add to those two routes only: `allowRequest: [/\/(products|prices)\b/]` with a comment `// Stripe is not configured in the e2e stack; the page's own render is what is asserted`. Any other failure is a finding — report it, do not allowlist it.

- [ ] **Step 5: `authenticated/users-management.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { E2E } from "../e2e.env";
import { gotoWithRetry } from "../support/actions";

/**
 * The `chromium-auth` project — administrator storageState.
 * PlatformUsersContainer (`/administration/users`) is a ContentListTable with
 * search; the two rows it must show are the two seeded personas.
 */
test.describe("users list", () => {
  test("lists both seeded personas", async ({ page }) => {
    await gotoWithRetry(page, "/administration/users", (p) => p.getByTestId("content-table-search-trigger"));
    await expect(page.getByText(E2E.administrator.email)).toBeVisible();
    await expect(page.getByText(E2E.member.email)).toBeVisible();
  });

  test("search narrows the list to the matching user", async ({ page }) => {
    await gotoWithRetry(page, "/administration/users", (p) => p.getByTestId("content-table-search-trigger"));
    await expect(page.getByText(E2E.administrator.email)).toBeVisible();

    await page.getByTestId("content-table-search-trigger").click();
    const input = page.getByTestId("content-table-search-input");
    await expect(input).toBeVisible();
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/users") && res.url().includes("search")),
      input.fill(E2E.member.name),
    ]);

    await expect(page.getByText(E2E.member.email)).toBeVisible();
    await expect(page.getByText(E2E.administrator.email)).toHaveCount(0);
  });
});

test.describe("logout", () => {
  test("clears the session cookies", async ({ page, context }) => {
    const before = await context.cookies();
    expect(before.find((c) => c.name === "token")).toBeTruthy();

    await page.goto("/logout");
    await page.waitForURL((url) => !url.pathname.includes("/logout"), { timeout: 30000 });

    const after = await context.cookies();
    expect(after.find((c) => c.name === "token")).toBeUndefined();
    expect(after.find((c) => c.name === "refreshToken")).toBeUndefined();
  });
});
```

- [ ] **Step 6: `pwa/service-worker.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { gotoWithRetry } from "../support/actions";

/**
 * The `chromium-pwa` project: baseURL is http://localhost:<port> and the
 * storageState is the localhost-domain administrator session, because
 * `navigator.serviceWorker` exists only in a secure context and the custom
 * host over plain HTTP is not one. Same server either way.
 *
 * src/app/sw.ts declares `/offline` as the document fallback; Serwist
 * precaches it on install, so the wait below is for that precache, not for
 * the registration alone.
 */
test.describe("service worker — offline fallback", () => {
  test("serves /offline for a failed navigation and recovers on retry", async ({ page, context }) => {
    await gotoWithRetry(page, "/", (p) => p.getByTestId("admin-index-companies"));

    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(
        () => page.evaluate(async () => !!(await caches.match("/offline", { ignoreSearch: true }))),
        { timeout: 30000 },
      )
      .toBe(true);

    try {
      await context.setOffline(true);
      await page.goto("/administration", { waitUntil: "domcontentloaded" }).catch(() => undefined);
      // offline/page.tsx: <h1>{t("offline.title")}</h1> = "You're Offline".
      await expect(page.getByRole("heading", { name: /you.re offline/i })).toBeVisible({ timeout: 15000 });
      // The worker answered the /administration navigation with the fallback
      // body — the address bar stays on the requested URL.
      expect(page.url()).toContain("/administration");
    } finally {
      await context.setOffline(false);
    }

    // "Try Again" reloads the SAME URL, which now succeeds for real.
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("admin-index-companies")).toBeVisible({ timeout: 15000 });
  });
});
```

- [ ] **Step 7: Verify file set and brand sweep**

```bash
cd /Users/carlo/Development/create-carlonicora-app/template/apps/web/tests && find . -name "*.spec.ts" | sort && grep -rin "avvocato\|a360\|studio\|398[0-9]\|[A-Z]\{2,5\}-[0-9]\+:" --include='*.ts' . | wc -l
```
Expected: 7 spec files (`authenticated/users-management`, `pwa/service-worker`, `smoke/admin.smoke`, `smoke/app.smoke`, `unauthenticated/auth-api-contract`, `unauthenticated/auth-guards`, `unauthenticated/login`, `unauthenticated/users-api-contract` — that is 8 with `login`; the spec's "7" counted the smoke pair as one; 8 is correct) and `0` brand/coverage-id hits.

---

### Task 7: Manifest scripts, `templateOnly`, and docs

**Files:**
- Modify: `template/package.json` (scripts block, after `"test:e2e:api"`)
- Modify: `template.sources.json` (`templateOnly`)
- Modify: `template/README.md:134` (Testing table)
- Modify: `template/apps/web/tests/README.md` (section 1 + new section 8)

- [ ] **Step 1: Root scripts (hand-authored — `package.json` is `neverAdopt`)**

In `template/package.json`, after the line `"test:e2e:api": "turbo run test:e2e",` insert:

```json
    "e2e:dash": "node scripts/e2e-dashboard.mjs",
    "e2e:dash:test": "node --test scripts/e2e-dashboard.test.mjs",
```

- [ ] **Step 2: Declare the template-only files**

In `template.sources.json`, append to `templateOnly`:

```json
    "scripts/e2e-dashboard.mjs",
    "scripts/e2e-dashboard.html",
    "scripts/e2e-dashboard.test.mjs"
```

- [ ] **Step 3: Root README Testing table**

Replace `| \`pnpm test:e2e\` | Run end-to-end tests |` with:

```markdown
| `pnpm test:e2e` | Run the full-stack end-to-end suite headless (`scripts/e2e.sh`) |
| `pnpm e2e:dash` | Interactive e2e dashboard on http://127.0.0.1:4084 — live per-test status, Run/Stop, HTML report |
```

- [ ] **Step 4: `apps/web/tests/README.md`**

In section 1, after the `**Prerequisites:**` paragraph, add:

```markdown
**Watching a run:** `pnpm e2e:dash` (root) serves a control page on
`http://127.0.0.1:4084`. Press **Run** and it lists every test first
(`playwright test --list`, a few seconds, no stack needed), then starts
`scripts/e2e.sh` and colours each row as its result arrives. See §8.
```

Append after section 7:

```markdown
---

## 8. The dashboard

`scripts/e2e-dashboard.mjs` is a dependency-free Node server. It does not run
tests itself — it spawns `scripts/e2e.sh` and reads two things from it:

- the `==> [e2e] …` progress lines the runner prints, which drive the boot strip
  (build packages → reset database → worker → migrations → api → web build →
  web start → health → Playwright → teardown);
- an NDJSON file that `tests/reporters/dashboard-reporter.ts` appends to.
  `playwright.config.ts` attaches that reporter **only** when the dashboard sets
  `E2E_DASH_EVENTS`, so a plain `pnpm test:e2e` is unaffected.

Pressing **Run** makes two passes: `playwright test --list` (with
`E2E_DASH_LIST=1`, so the reporter enumerates without ending the run) paints
every test as pending in seconds, then the real run starts. **Stop** signals the
process group the dashboard created — the script *and* the Playwright it is
waiting on — and the runner's own `trap` frees ports 4080–4082. Nothing is
ever killed by name. The HTML report is served at `/report` when a run ends.

Optional: if a `e2e-coverage.md` exists at the repo root with entries shaped
`#### ID-01 · summary — ✅ …`, and test titles carry those ids, the dashboard
shows the description next to each row. Absent, it just says so once at start.

`pnpm e2e:dash:test` runs the parser tests, which are pinned against the real
`scripts/e2e.sh` and `playwright.config.ts` — add a phase there and the test
tells you to teach the dashboard about it.

Automation must call `scripts/e2e.sh` directly; the dashboard waits for a human.
```

- [ ] **Step 5: Verify**

```bash
cd /Users/carlo/Development/create-carlonicora-app && node -e "const p=require('./template/package.json');console.log(p.scripts['e2e:dash'],'|',p.scripts['e2e:dash:test'])" && node -e "console.log(require('./template.sources.json').templateOnly.filter(x=>x.includes('dashboard')).length)" && grep -c "e2e:dash" template/README.md template/apps/web/tests/README.md
```
Expected: the two script strings; `3`; `README.md:1`, `tests/README.md:2` (or more).

---

### Task 8: Static gates + scaffold assertions (verification.md steps 1–5)

**Files:** none modified in the repo. Scaffolds go under the scratchpad.

- [ ] **Step 1: Integrity and unit tests**

```bash
cd /Users/carlo/Development/create-carlonicora-app && pnpm check:template --strict 2>&1 | tail -15 && pnpm test 2>&1 | tail -5 && cd template && node --test scripts/e2e-dashboard.test.mjs 2>&1 | grep -E "^# (pass|fail)"
```
Expected: all `PASS`, tests 0 failures, dashboard `# fail 0`.

- [ ] **Step 2: Re-run the drift compare — nothing from neural-erp may be pending**

```bash
cd /Users/carlo/Development/create-carlonicora-app && pnpm compare:template > /dev/null 2>&1; node -e "const j=require('./template-drift-report.json');j.rows.filter(r=>/e2e|tests\/|playwright|dashboard/.test(r.rel)).forEach(r=>console.log(r.classification.padEnd(13),(r.winner??'-').padEnd(11),r.rel))"
```
Expected: the three dashboard files and the new tests report `TEMPLATE_ONLY`; `scripts/e2e.sh` still `TARGET_AHEAD neural-erp` and `playwright.config.ts` `DIVERGED` — both **KEEP TEMPLATE** (Global Constraints). Do not act on them.

- [ ] **Step 3: Build the generator**

```bash
cd /Users/carlo/Development/create-carlonicora-app && pnpm build 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 4: Fast scaffold — placeholder / brand / junk assertions**

```bash
S=/private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad; rm -rf "$S/fast-probe"; cd "$S" && node /Users/carlo/Development/create-carlonicora-app/bin/cli.js fast-probe --skip-git --skip-install 2>&1 | tail -3
cd "$S/fast-probe" && echo "placeholders: $(grep -rl '{{name}}\|{{display}}' . | wc -l)"; echo "brand: $(grep -rail 'wyrdli\|neural-erp\|avvocato\|a360\|360StudioAI' . | wc -l)"; echo "junk: $(find . -name .DS_Store -o -name '*.log' -o -name Thumbs.db | wc -l)"; grep -a "<title>" scripts/e2e-dashboard.html; grep -n "e2e:dash\|4084" package.json README.md | head -4; grep -n "fast-probe-web\|fast-probe-e2e-dashboard" scripts/e2e-dashboard.mjs
```
Expected: `placeholders: 0`, `brand: 0`, `junk: 0`; `<title>fast-probe · e2e</title>` (`{{display}}` rendered as entered); `e2e:dash` in `package.json` and README; `--filter fast-probe-web` and the tmp dir name in the mjs.

- [ ] **Step 5: Full scaffold with git, install, typecheck the web app (covers the new specs + reporter + config)**

```bash
S=/private/tmp/claude-501/-Users-carlo-Development-wyrdli/8db6ef23-31ad-4c7a-9536-a65fe1d0fe3e/scratchpad; rm -rf "$S/e2eprobe"; cd "$S" && node /Users/carlo/Development/create-carlonicora-app/bin/cli.js e2eprobe 2>&1 | tail -5
cd "$S/e2eprobe" && pnpm install 2>&1 | tail -3 && pnpm --filter e2eprobe-web exec tsc --noEmit 2>&1 | tail -5 && pnpm e2e:dash:test 2>&1 | grep -E "^# (pass|fail)"
```
Expected: scaffold + install exit 0 (the CLI clones and builds the submodules — several minutes); `tsc` prints nothing; dashboard tests `# fail 0` in the generated app.

If `tsc` reports errors inside `apps/web/tests/**`, fix them **in `template/`** (not in the scaffold), re-scaffold, re-check.

---

### Task 9: Boot gates + real e2e + dashboard in the browser (verification.md steps 6–8)

**Files:** none in the repo. Uses `$S/e2eprobe` from Task 8.

**Prerequisite from Carlo (one-time, needs sudo):** `/etc/hosts` must resolve the throwaway app's hosts. Ask him to run:
```
! sudo sh -c 'printf "127.0.0.1\te2eprobe.test api.e2eprobe.test\n" >> /etc/hosts'
```
Alternative if he prefers not to touch `/etc/hosts`: write `$S/e2eprobe/.env.e2e` with `PUBLIC_HOSTNAME=poser.test` (an existing 127.0.0.1 entry; ports 4080–4082 do not collide with poser's dev stack) and `E2E_NEO4J_DATABASE=e2eprobetest`. Either way the test database is `e2eprobetest` — a new name on that instance, never an existing one.

- [ ] **Step 1: API DI graph builds**

```bash
cd $S/e2eprobe && (pnpm dev:api > $S/api.log 2>&1 & echo $! > $S/api.pid); sleep 45; grep -n "UnknownDependenciesException\|Nest can't resolve\|Nest application successfully started\|Neo4j\|ECONNREFUSED" $S/api.log | head -5
```
Expected: `successfully started` **or** a Neo4j connection error (acceptable: the graph built, infra was not started). `UnknownDependenciesException` / `can't resolve` = FAIL. Then stop by port + PID chain:

```bash
lsof -tiTCP:4050 -sTCP:LISTEN | xargs -r kill; kill "$(cat $S/api.pid)" 2>/dev/null; pkill -P "$(cat $S/api.pid)" 2>/dev/null; sleep 2; lsof -tiTCP:4050 -sTCP:LISTEN | wc -l
```
Expected: `0`. (`pkill -P <pid>` kills children of *our* PID only — it is not a name pattern.)

- [ ] **Step 2: Web boots and `/` is 200**

```bash
cd $S/e2eprobe && (pnpm dev:web > $S/web.log 2>&1 & echo $! > $S/web.pid); sleep 40; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4051/
lsof -tiTCP:4051 -sTCP:LISTEN | xargs -r kill; kill "$(cat $S/web.pid)" 2>/dev/null; pkill -P "$(cat $S/web.pid)" 2>/dev/null; sleep 2; lsof -tiTCP:4051 -sTCP:LISTEN | wc -l
```
Expected: `200`, then `0`. **Do not run `pnpm build` while a dev server is up** — it clobbers `.next`. Both dev servers are down before the next step.

- [ ] **Step 3: Headless full e2e run (3–5 min boot is normal; not a hang)**

```bash
cd $S/e2eprobe && ls .env.e2e 2>/dev/null; bash scripts/e2e.sh > $S/e2e.log 2>&1; echo "exit=$?"; grep -n "==> \[e2e\]" $S/e2e.log; grep -nE "passed|failed|skipped|flaky" $S/e2e.log | tail -3
```
Expected: `exit=0`; the phase lines appear in order `freeing test ports 4080 4081 4082` → `building workspace packages` → `recreating test database e2eprobetest` → `starting WORKER` → `waiting for migrations` → `migrations applied` → `starting API … :4080` → `building WEB` → `starting WEB … :4081` → `waiting for http://…:4080/` → `waiting for http://…:4081/` → `stack is up` → `Playwright exited with code 0` → `tearing down stack`; Playwright reports all tests passed (expect ~28: 1 setup + 2 login + 6 contract + 5 guards + 4 users-api + 3 app smoke + 10 admin smoke + 3 users-mgmt + 1 pwa).

If a spec fails: read `$S/e2eprobe/apps/web/playwright-report` and the `[api]`/`[web]` log lines around it. Fix the **template** spec (or report a product finding), re-copy the changed file into `$S/e2eprobe/apps/web/tests/`, and re-run scoped: `bash scripts/e2e.sh <spec path>`. Do not loosen an assertion to make it pass.

- [ ] **Step 4: Dashboard in the browser**

```bash
cd $S/e2eprobe && (pnpm e2e:dash > $S/dash.log 2>&1 & echo $! > $S/dash.pid); sleep 3; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4084/; head -3 $S/dash.log
```
Expected: `200`; log names the coverage-doc absence once and the listen URL.

Then, with the Chrome tools (`ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_close_mcp"`): open `http://127.0.0.1:4084`, confirm the header reads `e2eprobe`, the logo renders (not a broken image), press **Run** with scope `--project=chromium-unauth`, and confirm: rows appear as pending within ~15 s, the boot strip advances through the phases, rows turn green as results arrive, and the run ends with `Playwright exited with code 0`. Screenshot the finished state to `$S/dash-done.png`. Close the tab.

```bash
kill "$(cat $S/dash.pid)"; sleep 1; lsof -tiTCP:4084 -sTCP:LISTEN | wc -l; for p in 4080 4081 4082; do lsof -tiTCP:$p -sTCP:LISTEN | wc -l; done
```
Expected: four `0`s — the runner's trap freed its ports, the dashboard is gone.

- [ ] **Step 5: Drop the throwaway database and clean up**

```bash
cd $S/e2eprobe/apps/web && node -e '
const neo4j=require("neo4j-driver");const d=neo4j.driver("bolt://localhost:7687",neo4j.auth.basic("neo4j","password"));
(async()=>{const s=d.session({database:"system"});await s.run("DROP DATABASE `e2eprobetest` IF EXISTS");const r=await s.run("SHOW DATABASES YIELD name RETURN collect(name) AS names");console.log(r.records[0].get("names").includes("e2eprobetest")?"STILL THERE":"dropped");await s.close();await d.close();})()'
```
Expected: `dropped`. Leave `$S/e2eprobe` in place until Carlo has looked at the report; tell him it can be deleted. If he added the `/etc/hosts` line, remind him it can be removed.

- [ ] **Step 6: Final diff review against the donor — brand sweep on everything ported**

```bash
cd /Users/carlo/Development/create-carlonicora-app && git status --short && grep -rain "avvocato\|a360\|360StudioAI\|corpus\|398[0-9]" template/scripts template/apps/web/tests template/apps/web/playwright.config.ts template/env.e2e.example template/README.md | wc -l
```
Expected: the file list from the File map, all uncommitted; `0`.

---

## Self-review

- **Spec coverage:** §1 dashboard trio → Tasks 3–4 (corpus strip, ports, filter, tmp dir, regex singular, assets, coverage hook kept, brand zero). §2 reporter + config + projects → Task 2. §3 port move → Task 1. §4 specs + support → Tasks 5–6 (spec said "unknown user id renders the error page" for users-management — the template has **no** user detail route, so that assertion moved to the API contract spec as the 404 case; logout stays in users-management). §5 manifest/docs/templateOnly → Task 7. Error handling (no coverage doc, no `E2E_DASH_EVENTS`, Stop by group) → Tasks 3–4 and README §8. Testing gate 1–8 → Tasks 0, 8, 9.
- **Placeholders:** none; every edit shows its old/new text or full file content.
- **Type consistency:** `SmokeRoute`/`smokeTest` (Task 5) match their use in Task 6; `E2E.webBaseLocalhost`, `E2E.member.{id,email,name}`, `E2E.administrator.{id,email,password}` exist in `e2e.env.ts` today; `admin-localhost.json` name matches between Task 2 steps 2 and 3.
- **Added phase:** the template runner prints `building workspace packages`, which a360ai's parser would classify as a note and its own test would then fail on — Task 3 adds the `packages` phase and failure entry so the pinned test is honest against this runner.
