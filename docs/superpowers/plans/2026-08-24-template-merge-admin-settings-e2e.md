# Template merge: admin surface, settings rail, e2e harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. **Execution model is non-standard — see "Execution Model" below.**

**Goal:** Bring the template's administration surface, settings rail and end-to-end test harness up to what the consuming projects actually run, using the drift report as the evidence rather than a hand audit.

**Architecture:** Most adoption is executed by `pnpm template:apply`, which copies a named path list from a named target and re-generalizes it. That keeps this plan short where the tool does the work, and reserves authored code for the three things the tool cannot do: a route-group **move** it can only see as a delete plus an add, an i18n **merge** behind a single `DIVERGED` row, and an e2e harness inherited as *design* from a fourth project rather than copied.

**Tech Stack:** Next.js 16 (Base UI, not Radix), NestJS 11, Playwright, Node 22 ESM tooling, zero new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-template-multi-source-alignment-design.md` — Phase 4 plus the **2026-08-24 amendment**, which records the four product decisions and the e2e scope. Read the amendment; the original Phase 4 predates the drift report.

**Predecessors:** Plan A (`2026-08-23-template-integrity-checks-and-repairs.md`) built the nine-check harness. Plan B (`2026-08-24-compare-template-multi-target-and-sync-skill.md`) built `compare:template`, `template:apply` and the `template-sync` skill this plan uses.

## Global Constraints

- Template app code is **Base UI, never Radix**: no `asChild`, never wrap `<Button>` inside a trigger component, use the `render` prop (`references/frontend/04-components.md` § "TRIGGER COMPOSITION").
- Typography follows the 17 roles. **Admin and settings sub-pages take the role-3 muted eyebrow (`text-muted-foreground text-xl font-light`), never a role-1 page title** (`references/frontend/05-typography.md` § "THE 17 ROLES", row 3, and its "Common Mistakes" row "Role-1 page title on a settings/admin sub-page"). Links are never underlined (role 14).
- `{{name}}` (kebab) and `{{display}}` (human-readable) are scaffolder placeholders and are **different values**. They must survive verbatim in template files, and must not be mixed inside one rendered artifact.
- **Locales: `en` only.** Do not adopt `it.json` or add locales to `routing.ts`.
- Zero new npm dependencies except Playwright, which the e2e task adds as a devDependency to `apps/web`.
- All nine integrity checks must pass at the end; `pnpm test` must stay green.
- **NO git commits at any point.** The user commits after manual verification.
- Never use a name-pattern process kill (`pkill -f node`, `killall node`). Several projects run on this machine simultaneously.

---

## Execution Model

Same as Plan B, at the user's standing instruction:

1. **Tasks 1–7 dispatch IN PARALLEL**, one Agent call each, in a single message.
2. **No review between implementations.**
3. **Every task that authors logic writes tests**; adoption-only tasks verify via the integrity harness instead.
4. **ONE review after all tasks land** (Task 8, step 8).
5. **No commits, ever.**

File sets are disjoint — verified below. The only shared file is `apps/web/package.json`, owned solely by Task 6.

Every sub-agent brief must include, verbatim:

> "If the plan contradicts the nja-architecture skill, the skill wins. Flag the contradiction in your hand-off summary; do not silently follow either."

---

## Shared Contracts

This plan introduces no new entity, DTO, repository, service, model or interface. It composes containers the library already exports, so there are no new type signatures to fix. The contracts that matter are the **library exports the adopted routes depend on**, which must exist before adoption is meaningful:

```
@carlonicora/nextjs-jsonapi/components  AdminIndexContainer, CompaniesListContainer,
                                        PlatformUsersContainer, RbacContainer,
                                        HowToListContainer, HowToContainer,
                                        AiConnectionsContainer, RoundPageContainer, Tab
@carlonicora/nextjs-jsonapi/contexts    AdministrationProvider, RbacProvider, HowToProvider,
                                        SharedProvider, useCurrentUserContext
@carlonicora/nextjs-jsonapi/billing     ProductsListContainer, PriceContainer, PriceProvider,
                                        BillingDashboardContainer, isStripeConfigured,
                                        StripeProvider
@carlonicora/nextjs-jsonapi/tokenusage  TokenUsageAdminContainer, TokenUsageAdminProvider,
                                        TokenUsageReportProvider
@carlonicora/nextjs-jsonapi/core        Modules, BreadcrumbItemData
```

Task 8 step 3 verifies every one of these resolves before the merge is declared done. **`ProductsAdminContainer` is NOT in this list** — it does not exist in the library, and removing its only importer is what closes Plan A's one known typecheck error.

---

## Task 1: Tighten `template.sources.json`

81 of 196 `TARGET_ONLY` rows are missing ignore entries, not decisions. Until they are gone, every later triage reads through noise.

**Files:** Modify `template.sources.json`

- [ ] **Step 1: Add per-target ignores**

To **both** targets' `ignore` arrays:

```
"apps/web/public",
"apps/web/tests",
"apps/api/test",
"apps/api/src/__tests__",
"scripts/__tests__",
".claude/memory",
".claude/hooks",
".claude/nja-gate-off",
".impeccable"
```

`apps/web/public` holds each project's own logos, icons and splash screens — brand, not framework. `apps/web/tests` and `apps/api/test` are each project's own suites; the template gets its harness from a360ai in Task 6, not from these.

To **neural-erp** only:

```
"apps/web/messages/it.json",
"CLAUDE_OLD.md",
"apps/api/tsconfig.scripts.json"
```

To **wyrdli** only:

```
"apps/api/validate-post-tmp.ts",
"apps/api/jest.config.js",
"apps/web/.impeccable"
```

- [ ] **Step 2: Confirm the noise is gone**

Run: `pnpm compare:template`
Expected: `TARGET_ONLY` drops from 196 to roughly 115. Report the exact before/after counts for every classification. If a count moves that this task does not explain, stop and report it — an unexplained movement means an ignore entry is too broad.

- [ ] **Step 3: Confirm nothing legitimate was swept away**

```bash
node -e "const j=require('./template-drift-report.json');
const gone=['administration','settings','messages/en.json','.claude/skills'];
for(const g of gone) console.log(g.padEnd(22), j.rows.filter(r=>r.rel.includes(g)).length+' rows still present')"
```

Every one of those must still have rows. An ignore pattern that swallowed the admin routes or `en.json` is a bug in this task, not a success.

---

## Task 2: Administration surface

The library's `AdminIndexContainer` hardcodes the route contract, so these paths are not a style choice — the index links to them.

**Files:**
- Adopt into `template/apps/web/src/app/[locale]/(admin)/administration/`
- Modify: `template/apps/web/src/app/[locale]/(main)/page.tsx`
- Modify: `template/apps/web/src/features/common/components/navigations/CommonSidebar.tsx`
- Delete: `template/apps/web/src/features/common/components/containers/AdminIndexContainer.tsx`

- [ ] **Step 1: Adopt wyrdli's admin routes**

```bash
pnpm template:apply --target wyrdli --paths \
"apps/web/src/app/[locale]/(admin)/administration/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/users/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/token-usage/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/ai-connections/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/products/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/products/[id]/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/prices/[id]/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/companies/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/companies/[id]/page.tsx"
```

**Do NOT adopt `administration/calendars/page.tsx`.** The report offers it, but it imports `@/features/features/calendar/...` — a wyrdli business feature the template does not have. Adopting it produces an unresolvable import. This is the check-fires-on-correct-code rule inverted: the tool is right that the file differs, and wrong that it belongs here.

- [ ] **Step 2: Adopt the RBAC and HowTo pages from neural-erp**

```bash
pnpm template:apply --target neural-erp --paths \
"apps/web/src/app/[locale]/(admin)/administration/rbac/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/rbac/roles/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/howtos/page.tsx,\
apps/web/src/app/[locale]/(admin)/administration/howtos/[id]/page.tsx"
```

RBAC comes from neural-erp deliberately, and the drift report picked it correctly: wyrdli's own RBAC page carries a comment saying wyrdli never calls `RbacModule.register()`, so that version cannot load. The template's API **does** register it (`apps/api/src/features/features.modules.ts`), so neural-erp's version is the one that works here.

- [ ] **Step 3: Point the home page at the library container**

In `template/apps/web/src/app/[locale]/(main)/page.tsx`, replace the local import

```ts
import { AdminIndexContainer } from "@/features/common/components/containers/AdminIndexContainer";
```

with

```ts
import { AdminIndexContainer } from "@carlonicora/nextjs-jsonapi/components";
```

Leave the rest of the file alone — the `AuthContainer` landing branch is the template's, not wyrdli's marketing page.

- [ ] **Step 4: Delete the superseded local stub**

```bash
rm -f "template/apps/web/src/features/common/components/containers/AdminIndexContainer.tsx"
```

It rendered a single hard-coded Companies card against the retired `common.administration_*` keys.

- [ ] **Step 5: Add the administration group to the sidebar**

In `CommonSidebar.tsx`, add an administration group gated on the Administrator role, with entries for companies, users, token-usage, ai-connections and products, mirroring the paths `AdminIndexContainer` links to.

Also fix the stale billing link in that file: `/settings/billing?action=subscribe` becomes `/settings?section=billing&action=subscribe`. The rail reads `?section=`, and the library's `TokenStatusIndicator` still emits the old form — which is why Task 3 keeps a redirect route.

**Base UI:** the sidebar uses the project's `Sidebar*` components. Do not introduce a trigger wrapping a `<Button>`; if a menu is needed use the `render` prop (`references/frontend/04-components.md` § "TRIGGER COMPOSITION").

- [ ] **Step 6: Verify**

Run: `pnpm check:template`
Expected: nine PASS. `bootstrapper-modules` in particular must stay green — the adopted pages dereference `Modules.*` entries Plan A registered.

---

## Task 3: Settings rail, moved to `(foundations)`

The tool sees six deletes and three adds. It is one move. The template's settings are a generation behind: a sidebar layout whose container imports `ProductsAdminContainer`, which the library no longer exports.

**Files:**
- Create `template/apps/web/src/app/[locale]/(main)/(foundations)/{layout.tsx,settings/**}`
- Create `template/apps/web/src/features/common/contexts/SettingsSectionActionsContext.tsx`
- Create `template/apps/web/src/features/common/components/containers/UserProfileContainer.tsx`
- Rewrite `template/apps/web/src/features/common/components/containers/SettingsContainer.tsx`
- Delete the `(features)/settings/` tree and `layouts/SettingsNav.tsx`, `layouts/SettingsPageLayout.tsx`, `contexts/SettingsContext.tsx`

- [ ] **Step 1: Adopt the route shells and support files from wyrdli**

```bash
pnpm template:apply --target wyrdli --paths \
"apps/web/src/app/[locale]/(main)/(foundations)/layout.tsx,\
apps/web/src/app/[locale]/(main)/(foundations)/settings/page.tsx,\
apps/web/src/app/[locale]/(main)/(foundations)/settings/layout.tsx,\
apps/web/src/app/[locale]/(main)/(foundations)/settings/[module]/page.tsx,\
apps/web/src/features/common/contexts/SettingsSectionActionsContext.tsx,\
apps/web/src/features/common/components/containers/UserProfileContainer.tsx"
```

`settings/[module]/page.tsx` is **required, not optional**: the library's `TokenStatusIndicator` hard-codes `href="/settings/billing?action=subscribe"`. Wyrdli's version preserves the query string when redirecting to `?section=`; dropping it would land the user on the dashboard with no wizard and look like it worked.

- [ ] **Step 2: Move the OAuth routes**

`git mv` is not available to you — this plan forbids state-changing git commands. Copy, then let Step 4's `rm -rf` remove the original:

```bash
cp -R "template/apps/web/src/app/[locale]/(main)/(features)/settings/oauth" \
      "template/apps/web/src/app/[locale]/(main)/(foundations)/settings/oauth"
```

Then update the three `router.push` targets inside them only if they are absolute `/settings/oauth...` paths — they are, and they stay correct, because only the route *group* changed and route groups do not appear in URLs.

- [ ] **Step 3: Write the rail container**

Rewrite `SettingsContainer.tsx` modelled on **neural-erp's**, which is the fuller of the two (wyrdli's has three sections; neural-erp's has six), minus its app-specific ones. Sections: **Profile · Company · Users · Billing · Products (admin) · OAuth (admin)**.

Key shape, adopted from the working implementations:

```tsx
<SettingsSectionActionsProvider value={sectionActionsValue}>
  <SharedProvider value={{ breadcrumbs, title: { type: t(`common.settings`), element: activeLabel, functions: actionsBySection[section] } }}>
    <RoundPageContainer layout="rail" tabs={tabs} onSectionChange={setSection} />
  </SharedProvider>
</SettingsSectionActionsProvider>
```

Three constraints that are not obvious:

- Sections mount as tab **content**, i.e. descendants of the shared header, so they cannot feed `title.functions` upward directly. Each publishes through `SettingsSectionActionsContext` keyed by its section; only the active section's node reaches the header.
- `onSectionChange` must mirror the section into state. The rail writes the URL with `history.replaceState`, which does not re-render the ancestor — and both the breadcrumb and the title depend on it.
- Import `ProductsListContainer`, **not** `ProductsAdminContainer`. The latter does not exist in the library; the current template imports it and that is the one known typecheck failure this plan closes.

**Typography:** the settings pane must NOT carry a role-1 page title. The pane's breadcrumb and title strip already name it; a `text-3xl` title triples up (`references/frontend/05-typography.md` § "COMMON MISTAKES", row "Role-1 page title on a settings/admin sub-page").

- [ ] **Step 4: Delete the superseded tree**

```bash
rm -rf "template/apps/web/src/app/[locale]/(main)/(features)"
rm -f "template/apps/web/src/features/common/components/layouts/SettingsNav.tsx" \
      "template/apps/web/src/features/common/components/layouts/SettingsPageLayout.tsx" \
      "template/apps/web/src/features/common/contexts/SettingsContext.tsx"
```

`(features)` is the template's business-code group and holds nothing else, so it goes entirely.

- [ ] **Step 5: Verify**

Run: `pnpm check:template`
Expected: nine PASS, and `orphan-modules` in particular should now be clean — those three deleted files were live only because the old `SettingsContainer` imported them.

---

## Task 4: i18n merge

One `DIVERGED` row standing for ~142 keys the library's admin and settings components demand.

**Files:** Modify `template/apps/web/messages/en.json`

- [ ] **Step 1: Merge the required namespaces from wyrdli**

Lift the `administration`, `ai_connections` and `token_usage` subtrees wholesale from `/Users/carlo/Development/wyrdli/apps/web/messages/en.json`, and merge `billing.admin.*` into the template's existing `billing`. Add `entities.rbac` and `entities.howtos`.

Do **not** replace the file — the template's own namespaces stay.

- [ ] **Step 2: Remove the retired scheme**

Delete `common.administration`, `common.administration_subtitle`, `common.administration_companies_description`, `common.administration_rbac_description`, `common.administration_howtos_description`. The library reads `administration.*` now; the local `AdminIndexContainer` that used the old keys is deleted in Task 2.

- [ ] **Step 3: Prove every key the library needs resolves**

```bash
node -e "
const fs=require('fs'),path=require('path');
const m=JSON.parse(fs.readFileSync('template/apps/web/messages/en.json','utf8'));
const has=k=>k.split('.').reduce((a,p)=>a&&typeof a==='object'?a[p]:undefined,m)!==undefined;
const lib='../wyrdli/packages/nextjs-jsonapi/src/features';
const walk=(d,o=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory()){if(e.name==='__tests__')continue;walk(p,o);}else if(/\.tsx?\$/.test(e.name))o.push(p);}return o;};
const miss=new Set();
for(const dir of ['administration','ai-connection','tokenusage','rbac','company','user','billing','how-to']){
  const full=path.join(lib,dir); if(!fs.existsSync(full))continue;
  for(const f of walk(full)){const s=fs.readFileSync(f,'utf8');
    const ns=[...s.matchAll(/useTranslations\(\s*[\"'\`]([^\"'\`]+)[\"'\`]\s*\)/g)].map(x=>x[1]);
    if(ns.length>1)continue; const pre=ns.length===1?ns[0]+'.':'';
    for(const x of s.matchAll(/\bt\(\s*[\"'\`]([A-Za-z0-9_.\-]+)[\"'\`]/g)) if(!has(pre+x[1]))miss.add(pre+x[1]);
    for(const x of s.matchAll(/(?:labelKey|descriptionKey|titleKey)\s*:\s*[\"'\`]([A-Za-z0-9_.\-]+)[\"'\`]/g)) if(!has(x[1]))miss.add(x[1]);
  }}
console.log(miss.size===0?'all library keys resolve':'MISSING '+miss.size+':');
[...miss].sort().forEach(k=>console.log('  '+k));"
```

Expected: `all library keys resolve`. This scan must handle namespace-scoped `useTranslations("ns")` and `labelKey:`/`descriptionKey:` properties — naive versions miss both and report a false clean.

- [ ] **Step 4: Run the template's own validator**

Run: `node scripts/validate-translations.js` (or `template/apps/web/scripts/validate-translations.mjs` against the template) and confirm it reports all keys valid.

---

## Task 5: Bundled skill refresh + `playwright-cli`

**Files:**
- Modify `.claude/skills/{{name}}-architecture/**` inside `template/`
- Create `template/.claude/skills/playwright-cli/**`

- [ ] **Step 1: Refresh the bundled architecture skill**

Source of truth: `/Users/carlo/.claude/plugins/cache/nja/nja/1.10.0/skills/nja-architecture/`.

Copy in the three missing reference docs — `references/backend/06-llm-calls.md`, `references/decisions.md`, `references/frontend/05-typography.md` — and refresh all 15 existing ones, which are each older and smaller than the plugin's. Then add the corresponding rows to the bundled `SKILL.md` routing table and its reference index.

Rename `nja-architecture` → `{{name}}-architecture` in the frontmatter `name:` and in every internal cross-reference, matching how the bundled copy already refers to itself.

- [ ] **Step 2: Adopt the `playwright-cli` skill**

```bash
pnpm template:apply --target neural-erp --paths \
".claude/skills/playwright-cli/SKILL.md,\
.claude/skills/playwright-cli/references/request-mocking.md,\
.claude/skills/playwright-cli/references/running-code.md,\
.claude/skills/playwright-cli/references/session-management.md,\
.claude/skills/playwright-cli/references/storage-state.md,\
.claude/skills/playwright-cli/references/test-generation.md,\
.claude/skills/playwright-cli/references/tracing.md,\
.claude/skills/playwright-cli/references/video-recording.md"
```

- [ ] **Step 3: Verify no dangling references**

Confirm every `references/*.md` named in either SKILL.md's routing table exists on disk, and that no doc links to a file that was not copied.

---

## Task 6: e2e harness, inherited from a360ai

Inherit the **structure and logic**, not the tests. Every non-obvious decision below encodes a real failure in `~/Development/a360ai`; read `~/Development/a360ai/scripts/e2e.sh` and `~/Development/a360ai/apps/web/playwright.config.ts` before writing.

**Files:**
- Create: `template/scripts/e2e.sh`, `template/env.e2e.example`
- Create: `template/apps/web/playwright.config.ts` (replace the existing one)
- Create: `template/apps/web/tests/{README.md,e2e.env.ts,setup/seed.setup.ts,support/{auth.ts,db.ts},scripts/e2e-db.mjs,smoke/app.smoke.spec.ts,unauthenticated/login.spec.ts}`
- Modify: `template/package.json`, `template/turbo.json`, `template/apps/web/package.json`, `template/apps/web/next.config.js`

- [ ] **Step 1: Write `template/scripts/e2e.sh`**

Generalize a360ai's runner. Drop its corpus service entirely — the template has no such app. Ports 3980 (api), 3981 (web), 3982 (worker health). Database `{{name}}test`. Queue prefix `{{name}}e2e`. Hosts from `PUBLIC_HOSTNAME`.

The logic that must survive, each with its comment explaining why:

```bash
# BOOT ORDER MATTERS. The WORKER owns the migrator (worker-only provider) AND, like
# the API, its repositories create fulltext indexes/constraints in onModuleInit via a
# check-then-create (TOCTOU) pattern. If API and WORKER bootstrap concurrently against
# a freshly-recreated database, both see no index and both CREATE it → "An equivalent
# index already exists" crashes one process, intermittently. So: start the WORKER
# ALONE, wait for migrations, THEN start API and WEB.
```

```bash
# BullMQ key prefixes MUST differ from the dev stack's. Redis is a single shared
# instance, also used by other projects on this machine. Without these, the e2e worker
# and the DEV worker consume the SAME queues: a job enqueued by one stack is executed
# by the other, against the OTHER stack's database.
QUEUE_PREFIX="{{name}}e2e"
```

```bash
# WEB runs a PRODUCTION build (next build → next start), NOT `next dev`. Under dev every
# route cold-compiles on first hit (15-110s each), so the suite takes 45+ minutes and
# flakes on compile timeouts. A production build compiles once, then serves in <1s —
# and instrumentation.ts bootstraps before render, so the dev-only SSR race cannot occur.
#  - E2E_BUILD=true → next.config uses distDir ".next-e2e", so this build never touches
#    the dev server's `.next`. Sharing it makes a running `next dev` 404 every route.
#  - NEXT_PUBLIC_* are inlined at BUILD time, so they are exported BEFORE the build.
#  - E2E_INSECURE_COOKIES=true → auth cookies stay non-secure under NODE_ENV=production
#    so they survive plain http. Needed at BUILD and at START.
```

```bash
# RATE_LIMIT_ENABLED=false: the login route hard-codes a per-IP @Throttle that the
# env-configured global throttlers cannot raise. Off = no 429 flakiness in e2e.
# CORS_ORIGINS carries localhost as well as the custom host: navigator.serviceWorker
# only exists in a secure context, and a custom /etc/hosts name over plain HTTP is not
# one — so any PWA test must load the same server via http://localhost.
```

Also carry over: `killtree()`, `free_ports()`, a `cleanup` trap that tears the stack down on exit, log streams prefixed `[api] [worker] [web]`, `curl --retry ... --retry-connrefused` readiness waits, and **forwarding `"$@"` to `playwright test`** so a run can be scoped to one project or spec.

**Teardown must kill by captured PID or by port. Never by name pattern.**

- [ ] **Step 2: Write `playwright.config.ts`**

Mirror a360ai's project graph, minus its pwa and dashboard-reporter projects:

```ts
projects: [
  { name: "setup", testMatch: /setup\/seed\.setup\.ts/ },
  { name: "chromium-unauth", use: { ...devices["Desktop Chrome"] },
    dependencies: ["setup"], testDir: "./tests/unauthenticated" },
  { name: "chromium-smoke",
    use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
    dependencies: ["setup"], testDir: "./tests/smoke" },
]
```

with `fullyParallel: false` and `workers: 1` — the suite shares seeded state, so parallelism makes it non-deterministic. `baseURL` comes from `tests/e2e.env.ts`.

- [ ] **Step 3: Write the seed/auth scaffolding**

- `tests/scripts/e2e-db.mjs` — recreate the test database empty, over bolt, using `.env.e2e` values.
- `tests/setup/seed.setup.ts` — the `setup` project: log in as the administrator that migration `20250901_004` seeds, and save `storageState` to `playwright/.auth/admin.json`.
- `tests/support/auth.ts` — log in via `POST /auth/login` with email + password. Do not depend on any SSO or dev-token shortcut.
- `tests/support/db.ts` — bolt helper for assertions.
- `tests/e2e.env.ts` — resolve and export `apiBase`, `webBase` from env.

- [ ] **Step 4: Write two exemplar specs — and only two**

- `tests/unauthenticated/login.spec.ts` — the login page renders and rejects bad credentials.
- `tests/smoke/app.smoke.spec.ts` — authenticated: `/` renders, `/administration` renders for an administrator, and **a non-administrator receives the 403** from the `(admin)` layout gate.

That third assertion is the highest-value test in the template: it is the Plan A security fix, and so far it has only ever been verified by regex and by a controller probe.

- [ ] **Step 5: Wire the scripts and the distDir**

`template/package.json`: `"test:e2e": "bash scripts/e2e.sh"`.
`template/turbo.json`: a `test:e2e` task with `"cache": false` and `dependsOn: ["build"]`.
`template/apps/web/package.json`: add `@playwright/test` as a devDependency.
`template/apps/web/next.config.js`: honour `E2E_BUILD` by setting `distDir: ".next-e2e"`.

Add `.next-e2e` and `apps/web/playwright/.auth` to the template's `gitignore` — **the auth storageState file holds a real session token and must never be committed or published.**

- [ ] **Step 6: Verify the script parses and is honest about the environment**

```bash
bash -n template/scripts/e2e.sh && echo "e2e.sh parses"
grep -c "pkill\|killall" template/scripts/e2e.sh   # must be 0
```

The suite itself is exercised in Task 8 against a scaffolded app; it cannot run against `template/`, which is not an installable project.

---

## Task 7: Missing framework routes

Small, independent, no shared files.

**Files:** adopt into `template/apps/web/src/app/`

- [ ] **Step 1: Adopt**

```bash
pnpm template:apply --target wyrdli --paths \
"apps/web/src/app/[locale]/(main)/(foundations)/tokenusage/page.tsx,\
apps/web/src/app/robots.ts,\
apps/web/src/app/sitemap.ts,\
apps/web/src/app/[locale]/(public-help)/help/sitemap.xml/route.ts"
```

- [ ] **Step 2: Sever the wyrdli-specific bridge**

Wyrdli's `tokenusage/page.tsx` renders `TokenUsageReportBody` from `@/features/features/tokenusage/...`, a wyrdli app component, and passes `targetLabel="Campaign"`. The template has neither. Replace the body with the library's report container directly and drop `targetLabel` — the API rejects any label the app's `TokenUsageTargetsModule` did not declare, and the template declares none.

- [ ] **Step 3: Generalize the SEO routes**

`robots.ts` and `sitemap.ts` must contain no wyrdli hostnames or marketing paths. Derive the origin from `ENV.APP_URL`, and list only routes the template actually ships.

- [ ] **Step 4: Verify**

Run: `pnpm check:template`
Expected: nine PASS. `placeholder-urls` in particular guards the SEO routes — a schemeless `new URL()` there is exactly the defect it exists for.

---

## Task 8 (Verification): full gates, scaffold, boot, e2e, review

Runs after Tasks 1–7. The only task that runs the suites.

- [ ] **Step 1: Lint**

This repo has **no lint script** — `package.json` has no `lint` entry and no linter is configured. Do not invent one. State plainly in the report that lint was not run and why. The template's own translation validator runs in Task 4.

- [ ] **Step 2: Build**

Run: `pnpm build` — expected exit 0.

- [ ] **Step 3: Test, and prove the library contract**

Run: `pnpm test` — expected all green, no regressions from Plan B's 98.

Then verify every export in "Shared Contracts" resolves against the library on disk, and that `ProductsAdminContainer` appears nowhere in the template:

```bash
grep -rn "ProductsAdminContainer" template/ && echo "STILL REFERENCED — Plan A's known error is not closed" || echo "clean"
```

- [ ] **Step 4: Integrity harness**

Run: `pnpm check:template --strict` — nine PASS, no SKIP.

- [ ] **Step 5: Regenerate the drift report**

Run: `pnpm compare:template`. Report the classification counts. `TARGET_AHEAD` and the admin/settings `TARGET_ONLY` rows should have collapsed into `ALIGNED`; anything that did not is either a deliberate divergence or an incomplete adoption — say which.

- [ ] **Step 6: Scaffold and boot**

Scaffold a throwaway app **with git** so submodules build, `pnpm install`, then `pnpm --filter <name>-web exec tsc --noEmit`.

**Expect ZERO typecheck errors.** Plan A's one known error was `ProductsAdminContainer`; Task 3 removes its only importer. If it still appears, Task 3 is incomplete.

Boot `pnpm dev:worker` first (the migrator is worker-gated and seeds the admin user), then `pnpm dev:api`, then `pnpm dev:web`. A `200` on `/` is the gate, not "Ready".

Use ports that do not collide with anything already running, and kill by captured PID or port only.

- [ ] **Step 7: Run the e2e suite against the scaffolded app**

Run: `bash scripts/e2e.sh` inside the scaffolded app.

This is the first real exercise of Task 6, and the first time the `(admin)` role gate is verified against a live session rather than a regex. Report the Playwright results, and if the harness fails, report whether it failed in orchestration (ports, boot order, migrations) or in the assertions.

- [ ] **Step 8: Architecture audit, then ONE review**

Compute scope from `git status --short`. Files under `template/apps/web/src/**` ARE governed by the routing table — audit each against `references/frontend/04-components.md` and `05-typography.md`, reporting severity, `file:line`, verbatim code and the rule cited by doc path and section. Files under `scripts/`, `.claude/` and `template/apps/web/tests/**` are not governed; say so rather than citing an unrelated doc.

Then dispatch ONE reviewer over the whole change on the most capable model available. Point it at: the settings rail (the only substantially authored component), `e2e.sh` (the only authored shell logic, and the place a name-pattern kill would do real damage), and whether the adopted routes carry any wyrdli/neural-erp specifics the generalizer missed.

- [ ] **Step 9: Hand off — do NOT commit**

---

## Not in this plan

**Row-by-row triage of the remaining ~115 candidates.** That is interactive judgement, not a plan task — it is what the `template-sync` skill exists for, and it should be run as an operation after this plan lands and the report is regenerated. Enumerating 115 decisions in a plan document would be a worse artifact than the report itself.

---

## Plan compliance check

### Routing-table applicability

Files under `template/apps/web/src/features/**` and `template/apps/web/src/app/**` match the frontend component row: `references/frontend/04-components.md` → `references/frontend/05-typography.md`. Both were read end-to-end before drafting. No task creates a frontend model, interface or service, so `01-models.md`, `02-interfaces.md` and `03-services.md` do not apply. No task touches `apps/api/src/features`, so no backend doc applies. `scripts/`, `.claude/` and `apps/web/tests/**` match no row — stated explicitly rather than given a fabricated citation.

### Canonical examples (rule 3)

The rail composition, the admin route shells and the e2e harness have **no canonical example in the skill** — the references cover entity/DTO/repository/service/model/interface/component patterns, not route composition, `RoundPageContainer layout="rail"`, or test orchestration. Rather than invent citations, every such block in this plan is adopted from **working code in a named project** and cited by path: wyrdli and neural-erp for the settings rail and admin routes, `~/Development/a360ai` for the e2e harness. That is a stronger provenance than a doc snippet, and it is declared here rather than disguised.

### `references/anti-patterns.md` — walked top to bottom

| Anti-pattern (quoted) | Sections checked | Result |
|---|---|---|
| "`result.records[0]` — Returning raw Neo4j records" | all tasks | N/A — no repository code |
| "`WHERE company.id = $companyId` (manual) — Manual company filtering" | all tasks | N/A — no Cypher except the e2e DB-recreate helper, which creates an empty database and reads nothing |
| "`SKIP ${offset} LIMIT ${limit}` — Manual pagination" | all tasks | N/A |
| "`{ data: { type: ..., attributes: ... } }` (manual) — Manual JSON:API construction" | Tasks 2, 3, 7 | Clean — adopted routes compose library containers |
| "`fetch('/api/...')` — Using fetch() directly" | Tasks 3, 6 | Clean in app code. `tests/support/auth.ts` posts to `/auth/login` from a Playwright context — that is test infrastructure outside the app, not a frontend service |
| "`overridesJsonApiCreation: true`" | all tasks | Clean — not used |
| "`asChild`, `<DialogContent>` as single component, `<Sub>` — Using Radix API" | Tasks 2, 3 | Constrained in Global Constraints and restated in Task 2 step 5 |
| "`<PopoverTrigger><Button>` or trigger wrapping Button" | Tasks 2, 3 | Same |
| "`someDate: { type: \"string\" }` for a calendar field" | all tasks | N/A — no descriptors |
| "`SET n.due_date = $due_date` in custom Cypher" | all tasks | N/A |
| "`SET n.processed_at = $processed_at` in custom Cypher" | all tasks | N/A |
| "`response.data.attributes.date = data.date` with `data.date: Date`" | all tasks | N/A — no models |
| "`get date(): string` on a frontend interface" | all tasks | N/A — no interfaces |
| "`@IsString()` for a date attribute on a DTO" | all tasks | N/A — no DTOs |

### `references/frontend/04-components.md` — "COMMON MISTAKES" / Radix→Base UI table walked

Only Tasks 2 and 3 author JSX. Both are constrained against `asChild`, against wrapping `<Button>` in a trigger, and toward the `render` prop. Neither introduces a floating element, so `Positioner`/`Popup` structure does not arise. No Radix names are used.

### `references/frontend/05-typography.md` — "COMMON MISTAKES" walked

| Mistake (quoted) | Result |
|---|---|
| "Styled `div`/`span` doing a header's job" | Adopted routes delegate headers to `RoundPageContainer`/`MicroLabel` |
| "Raw `<h1 className=\"text-2xl font-bold\">`" | None authored |
| "Role-1 page title on a settings/admin sub-page" | Explicitly constrained — Global Constraints and Task 3 step 3 |
| "`text-gray-500` / `text-green-600` on text" | No palette colours authored |
| "`font-mono` for IDs/amounts" | Not used |
| "Hand-rolled pastel pill" | Not used |
| "Raw `<Label className=\"text-sm\">` in a form" | No forms authored |
| "Ad-hoc `<p className=\"text-sm text-destructive\">` error" | None |
| "`underline` / `hover:underline` on a link" | Constrained in Global Constraints |

### Type signatures vs Decision Matrices

This plan introduces **no** new type signature. "Shared Contracts" lists library exports the adopted routes consume, not authored signatures, so no Decision Matrix row applies. Task 8 step 3 verifies each export resolves rather than asserting it from memory.

### `references/date-handling.md`

Not applicable — no date or datetime field is introduced at any layer.

### Result

No contradictions surfaced. One item declared rather than resolved: rule 3's canonical-example requirement cannot be met from the skill for route composition, the settings rail or the e2e harness, so provenance is cited to working project code instead. That is stated above rather than papered over.
