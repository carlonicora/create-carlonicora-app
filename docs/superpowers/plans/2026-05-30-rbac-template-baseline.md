# RBAC Template Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a generic, framework-modules-only RBAC baseline in `create-carlonicora-app`'s `template/` so a freshly scaffolded app boots with working, extensible RBAC and every documented RBAC command works — with zero business coupling.

**Architecture:** Hand-author tiny framework-only versions of the business-coupled RBAC files in `template/` and register them in `PROTECTED_PATHS` (so a future `sync-template` never overwrites them with neural-erp's 48-module versions). Remove the two genuinely-generic RBAC files (admin UI, validate script) from `IGNORE_PATTERNS` so they sync verbatim. All heavy machinery (`RbacModule`, reconciler, `dumpRbacMatrix`, `generate-rbac-paths` CLI, `perm`/`defineRbac` DSL) already lives in the `@carlonicora/nestjs-neo4jsonapi` submodule.

**Tech Stack:** TypeScript, NestJS, Next.js, Neo4j, the `@carlonicora/nestjs-neo4jsonapi` + `@carlonicora/nextjs-jsonapi` libraries, the `create-carlonicora-app` scaffolder (`scripts/sync-template.js`).

**Reference spec:** `docs/superpowers/specs/2026-05-30-rbac-template-baseline-design.md`

**The 8 framework modules and their UUIDs** (identical to `template/apps/api/src/neo4j.migrations/20250901_002.ts`):

| Module | UUID |
|---|---|
| Auth | `035fe8a6-d467-40c0-9d1d-6a87f0dd286e` |
| Company | `f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113` |
| Feature | `025fdd23-2803-4360-9fd9-eaa3612c2e23` |
| Notification | `9259d704-c670-4e77-a3a1-a728ffc5be3d` |
| Role | `9f6416e6-7b9b-4e1a-a99f-833191eca8a9` |
| S3 | `db41ba46-e171-4324-8845-99353eba8568` |
| User | `04cfc677-0fd2-4f5e-adf4-2483a00c0277` |
| HowTo | `6f975207-0df3-4c0d-b541-ed5dc04487b2` |

---

## File Structure

**Create (hand-maintained generic baselines):**
- `template/packages/shared/src/const/module.id.ts` — `ModuleId` const, 8 framework UUIDs
- `template/apps/api/src/rbac/permissions.ts` — `defineRbac` matrix, 8 framework modules
- `template/apps/api/src/rbac/module-id.map.json` — 8 framework label→UUID entries
- `template/apps/api/src/features/rbac/module-relationships.map.ts` — `MODULE_USER_PATHS`, 8 framework UUIDs → `[]`

**Modify:**
- `template/packages/shared/src/index.ts` — add `ModuleId` value + type re-exports
- `template/apps/api/src/features/features.modules.ts` — register `RbacModule`
- `scripts/sync-template.js` — add 4 paths to `PROTECTED_PATHS`; remove 3 entries from `IGNORE_PATTERNS`

**Sync verbatim (no manual content — removed from ignore so they copy from neural-erp on next sync; for THIS plan they do not yet exist in `template/` and we do NOT hand-create them — they arrive on the next `npm run sync-template`):**
- `template/apps/web/src/app/[locale]/(admin)/administration/rbac/` (admin UI)
- `template/scripts/validate-rbac-alignment.ts`

> Note: this plan makes the scaffolder *ready* to carry the admin UI + validate script through on the next sync. It does not run a sync. The RBAC backend baseline (the hand-authored files above) is fully functional without them.

---

### Task 1: Add the generic `ModuleId` constant to the shared package

**Files:**
- Create: `template/packages/shared/src/const/module.id.ts`
- Modify: `template/packages/shared/src/index.ts`

- [ ] **Step 1: Create the framework-only `ModuleId` constant**

Create `template/packages/shared/src/const/module.id.ts` with exactly:

```typescript
/**
 * Module IDs as seeded in apps/api/src/neo4j.migrations/20250901_002.ts.
 * Authoritative identity for the (Module) nodes in Neo4j.
 *
 * Feature modules register their entity descriptors using these IDs — NOT by
 * name — so renames in the migration never silently desync the catalog.
 *
 * Keep this file in sync with the migration file. Add a new entry here for
 * every business module you introduce, then run `pnpm build-module-id-map`
 * and `pnpm generate:rbac-paths` in apps/api.
 */
export const ModuleId = {
  // Framework modules (20250901_002.ts)
  Auth: "035fe8a6-d467-40c0-9d1d-6a87f0dd286e",
  Company: "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
  Feature: "025fdd23-2803-4360-9fd9-eaa3612c2e23",
  Notification: "9259d704-c670-4e77-a3a1-a728ffc5be3d",
  Role: "9f6416e6-7b9b-4e1a-a99f-833191eca8a9",
  S3: "db41ba46-e171-4324-8845-99353eba8568",
  User: "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
  HowTo: "6f975207-0df3-4c0d-b541-ed5dc04487b2",
} as const;

export type ModuleId = (typeof ModuleId)[keyof typeof ModuleId];
```

- [ ] **Step 2: Re-export `ModuleId` from the shared package barrel**

Replace the entire contents of `template/packages/shared/src/index.ts` (currently a single `RoleId` export) with:

```typescript
export { ModuleId } from "./const/module.id";
export type { ModuleId as ModuleIdValue } from "./const/module.id";
export { RoleId } from "./const/roles.id";
```

- [ ] **Step 3: Verify the shared package type-checks**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app/template/packages/shared && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20; cd /Users/carlo/Development/create-carlonicora-app
```
Expected: no errors. (If `packages/shared` has no standalone tsconfig, skip — it is type-checked in the scaffold-verification task instead.)

- [ ] **Step 4: Confirm the UUIDs match the migration**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app/template && for u in 035fe8a6-d467-40c0-9d1d-6a87f0dd286e f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113 025fdd23-2803-4360-9fd9-eaa3612c2e23 9259d704-c670-4e77-a3a1-a728ffc5be3d 9f6416e6-7b9b-4e1a-a99f-833191eca8a9 db41ba46-e171-4324-8845-99353eba8568 04cfc677-0fd2-4f5e-adf4-2483a00c0277 6f975207-0df3-4c0d-b541-ed5dc04487b2; do grep -q "$u" apps/api/src/neo4j.migrations/20250901_002.ts && echo "OK $u" || echo "MISSING $u"; done; cd /Users/carlo/Development/create-carlonicora-app
```
Expected: 8 lines all starting with `OK`.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlo/Development/create-carlonicora-app
git add template/packages/shared/src/const/module.id.ts template/packages/shared/src/index.ts
git commit -m "feat(template): add generic framework-only ModuleId to shared package"
```

---

### Task 2: Add the generic backend RBAC files

**Files:**
- Create: `template/apps/api/src/rbac/permissions.ts`
- Create: `template/apps/api/src/rbac/module-id.map.json`
- Create: `template/apps/api/src/features/rbac/module-relationships.map.ts`

- [ ] **Step 1: Create the module-relationship paths map (framework modules have no user paths)**

Create `template/apps/api/src/features/rbac/module-relationships.map.ts` with exactly:

```typescript
// Auto-generated by generate-rbac-paths CLI tool
// Do not edit manually - regenerate with: pnpm generate:rbac-paths

export const MODULE_USER_PATHS = {
  "035fe8a6-d467-40c0-9d1d-6a87f0dd286e": [],
  "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113": [],
  "025fdd23-2803-4360-9fd9-eaa3612c2e23": [],
  "9259d704-c670-4e77-a3a1-a728ffc5be3d": [],
  "9f6416e6-7b9b-4e1a-a99f-833191eca8a9": [],
  "db41ba46-e171-4324-8845-99353eba8568": [],
  "04cfc677-0fd2-4f5e-adf4-2483a00c0277": [],
  "6f975207-0df3-4c0d-b541-ed5dc04487b2": [],
} as const;

export type ModuleUserPathsType = typeof MODULE_USER_PATHS;
```

- [ ] **Step 2: Create the declarative RBAC matrix (8 framework modules)**

Create `template/apps/api/src/rbac/permissions.ts` with exactly:

```typescript
// Auto-maintained by the RBAC UI. Edit via `pnpm dev` + UI, or by hand.

import { RoleId, ModuleId } from "@{{name}}/shared";
import { perm, defineRbac } from "@carlonicora/nestjs-neo4jsonapi";
import { MODULE_USER_PATHS } from "../features/rbac/module-relationships.map";

export const rbac = defineRbac<typeof MODULE_USER_PATHS>({
  [ModuleId.Feature]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Auth]: {
    default: perm.full,
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.User]: {
    default: [perm.read, perm.update("id")],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.HowTo]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Notification]: {
    default: [perm.read, perm.update],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Role]: {
    default: [perm.read],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.S3]: {
    default: [perm.read],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
  [ModuleId.Company]: {
    default: [perm.read],
    [RoleId.CompanyAdministrator]: [perm.create, perm.update, perm.delete],
    [RoleId.Administrator]: perm.full,
  },
});
```

> `RoleId.Administrator` and `RoleId.CompanyAdministrator` already exist in the template's `packages/shared/src/const/roles.id.ts` (they map to `SystemRoles`). No business roles are referenced.

- [ ] **Step 3: Create the module-id label→UUID map (8 framework entries)**

Create `template/apps/api/src/rbac/module-id.map.json` with exactly:

```json
{
  "Auth": "035fe8a6-d467-40c0-9d1d-6a87f0dd286e",
  "Company": "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
  "Feature": "025fdd23-2803-4360-9fd9-eaa3612c2e23",
  "Notification": "9259d704-c670-4e77-a3a1-a728ffc5be3d",
  "Role": "9f6416e6-7b9b-4e1a-a99f-833191eca8a9",
  "S3": "db41ba46-e171-4324-8845-99353eba8568",
  "User": "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
  "HowTo": "6f975207-0df3-4c0d-b541-ed5dc04487b2"
}
```

- [ ] **Step 4: Verify no business module names leaked into the new files**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app/template && grep -rEi "crm|finance|warehouse|\bsales\b|\bhr\b|procurement|logistic|operations|catalog|consumable|\basset\b|invoice|\bplm\b|\bproject\b|annotation|workorder|materialrequisition|timeentry|document|template|equipment|\btool\b|\bpart\b" apps/api/src/rbac/ apps/api/src/features/rbac/ && echo "FOUND business refs (FAIL)" || echo "CLEAN — framework only"; cd /Users/carlo/Development/create-carlonicora-app
```
Expected: `CLEAN — framework only`.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlo/Development/create-carlonicora-app
git add template/apps/api/src/rbac/ template/apps/api/src/features/rbac/
git commit -m "feat(template): add generic framework-only RBAC matrix, id-map, and user-paths"
```

---

### Task 3: Register `RbacModule` in the feature registry

**Files:**
- Modify: `template/apps/api/src/features/features.modules.ts`

- [ ] **Step 1: Replace the stub registry with one that registers RbacModule**

Replace the entire contents of `template/apps/api/src/features/features.modules.ts` with exactly:

```typescript
import { RbacModule } from "@carlonicora/nestjs-neo4jsonapi";
import { Module } from "@nestjs/common";
import { SearchModule } from "src/features/essentials/search/search.module";
import { MODULE_USER_PATHS } from "src/features/rbac/module-relationships.map";
import { rbac } from "src/rbac/permissions";

@Module({
  imports: [
    SearchModule,
    RbacModule.register({
      moduleUserPaths: MODULE_USER_PATHS,
      rbac,
      devMode: process.env.NODE_ENV !== "production",
    }),
  ],
})
export class FeaturesModules {}
```

- [ ] **Step 2: Verify the registration shape matches the library's expectation**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app/template && grep -n "RbacModule.register" apps/api/src/features/features.modules.ts && grep -n "moduleUserPaths\|rbac,\|devMode" apps/api/src/features/features.modules.ts; cd /Users/carlo/Development/create-carlonicora-app
```
Expected: shows `RbacModule.register({` plus the three options — matching neural-erp's `features.modules.ts` registration.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlo/Development/create-carlonicora-app
git add template/apps/api/src/features/features.modules.ts
git commit -m "feat(template): register RbacModule in the feature registry"
```

---

### Task 4: Update the scaffolder to protect the new files and stop ignoring the generic ones

**Files:**
- Modify: `scripts/sync-template.js`

- [ ] **Step 1: Remove the admin RBAC UI and validate script from `IGNORE_PATTERNS`**

In `scripts/sync-template.js`, find this block (the project-specific admin pages comment):

```javascript
  // project-specific admin pages (RBAC + how-to admin UI; import stripped ModuleId)
  'apps/web/src/app/[locale]/(admin)/administration/rbac',
  'apps/web/src/app/[locale]/(admin)/administration/howtos',
```

Replace it with (keep `howtos` ignored — out of scope — and drop the now-inaccurate part of the comment):

```javascript
  // project-specific admin pages (how-to admin UI)
  'apps/web/src/app/[locale]/(admin)/administration/howtos',
```

Then find this line inside the `// project tooling & content` block:

```javascript
  'migrations', 'scripts/migrations', 'scripts/validate-rbac-alignment.ts',
```

Replace it with (remove `scripts/validate-rbac-alignment.ts` — it is generic and should sync):

```javascript
  'migrations', 'scripts/migrations',
```

Then find this line:

```javascript
  'apps/web/tests', 'apps/web/scripts/build-module-id-map.ts',
```

Replace it with (remove the stale `build-module-id-map.ts` entry — that file does not exist in neural-erp):

```javascript
  'apps/web/tests',
```

- [ ] **Step 2: Add the four hand-maintained RBAC files to `PROTECTED_PATHS`**

In `scripts/sync-template.js`, find the existing comment line in `PROTECTED_PATHS`:

```javascript
  // module registry: template ships a minimal stub (essentials only); neural-erp's
  // version imports every business module + project RBAC files.
  'apps/api/src/features/features.modules.ts',
```

Replace it with:

```javascript
  // module registry: template ships an essentials + RBAC baseline; neural-erp's
  // version imports every business module.
  'apps/api/src/features/features.modules.ts',
  // generic framework-only RBAC baseline — neural-erp's versions enumerate all
  // 48 business modules, so these must be hand-maintained and never overwritten.
  'packages/shared/src/const/module.id.ts',
  'apps/api/src/rbac/permissions.ts',
  'apps/api/src/rbac/module-id.map.json',
  'apps/api/src/features/rbac/module-relationships.map.ts',
```

- [ ] **Step 3: Verify the edits are internally consistent**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app
node -e "import('./scripts/sync-template.js').catch(e=>{})" 2>&1 | head -5 || true
grep -n "administration/rbac\|validate-rbac-alignment\|build-module-id-map.ts" scripts/sync-template.js
grep -n "module.id.ts\|rbac/permissions.ts\|module-id.map.json\|module-relationships.map.ts" scripts/sync-template.js
```
Expected: `administration/rbac`, `validate-rbac-alignment`, and `apps/web/scripts/build-module-id-map.ts` no longer appear in `IGNORE_PATTERNS`; the four new files appear in `PROTECTED_PATHS`.

- [ ] **Step 4: Confirm `IGNORE_PATTERNS` still keeps the business-coupled RBAC dirs out**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app && grep -nE "'apps/api/src/rbac'|'apps/api/src/features/rbac'|'packages/shared/src/const'" scripts/sync-template.js
```
Expected: all three still present in `IGNORE_PATTERNS` — so a sync skips neural-erp's business versions, while `PROTECTED_PATHS` (checked first) preserves our hand-authored files.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlo/Development/create-carlonicora-app
git add scripts/sync-template.js
git commit -m "build(sync): protect generic RBAC baseline, sync admin RBAC UI + validate script"
```

---

### Task 5: End-to-end verification by scaffolding a throwaway project

This task proves the template produces a buildable, RBAC-enabled starting point with no business leakage. It requires network access (git submodules) and `pnpm`.

**Files:** none (verification only)

- [ ] **Step 1: Build the scaffolder**

Run:
```bash
cd /Users/carlo/Development/create-carlonicora-app && npm run build 2>&1 | tail -5
```
Expected: `tsc` completes with no errors.

- [ ] **Step 2: Scaffold a throwaway project**

Run:
```bash
cd /tmp && rm -rf rbac-smoke && node /Users/carlo/Development/create-carlonicora-app/bin/cli.js rbac-smoke --skip-install 2>&1 | tail -15
```
Expected: "Copied template files" and (if network available) submodule add/build succeed. `--skip-install` keeps it fast; we install in the next step only if needed.

- [ ] **Step 3: Confirm the generic RBAC files materialized with placeholders replaced**

Run:
```bash
cd /tmp/rbac-smoke
echo "--- shared ModuleId exists & generic ---"; grep -c "035fe8a6-d467-40c0-9d1d-6a87f0dd286e" packages/shared/src/const/module.id.ts; grep -n "ModuleId" packages/shared/src/index.ts
echo "--- permissions.ts uses real package name, not placeholder ---"; grep -n "@rbac-smoke/shared\|{{name}}" apps/api/src/rbac/permissions.ts
echo "--- RbacModule registered ---"; grep -n "RbacModule.register" apps/api/src/features/features.modules.ts
echo "--- admin RBAC UI present ---"; ls "apps/web/src/app/[locale]/(admin)/administration/rbac/page.tsx"
```
Expected: ModuleId UUID present; `index.ts` exports ModuleId; `permissions.ts` imports `@rbac-smoke/shared` (NOT `{{name}}`); RbacModule registered; admin RBAC page exists.

> Note: the admin RBAC UI and `scripts/validate-rbac-alignment.ts` only appear here if `template/` was re-synced after Task 4. If they are absent, run `cd /Users/carlo/Development/create-carlonicora-app && npm run sync-template` once, then re-scaffold. The hand-authored backend baseline (Tasks 1–3) is present regardless.

- [ ] **Step 4: Re-run the dangling-reference audit on the generated project**

Run:
```bash
cd /tmp/rbac-smoke && grep -rEn "features/(crm|finance|hr|sales|warehouse|catalog|consumable|asset|logistic|operations|plm|procurement|project|activity|content)\b" apps/api/src apps/web/src 2>/dev/null && echo "FAIL: business module references found" || echo "PASS: no business module references"
```
Expected: `PASS: no business module references`.

- [ ] **Step 5: Type-check the generated API and web (installs deps)**

Run:
```bash
cd /tmp/rbac-smoke && pnpm install 2>&1 | tail -3 && pnpm --filter "*-api" exec tsc --noEmit 2>&1 | tail -20
```
Expected: install succeeds (submodules built), `tsc` reports no errors in the API package. If the submodule packages failed to clone (offline), note it — the RBAC code is still verifiable by inspection against neural-erp's identical structure.

- [ ] **Step 6: Confirm the RBAC dev scripts no longer fail on the missing `ModuleId` import**

Run:
```bash
cd /tmp/rbac-smoke/apps/api && pnpm build-module-id-map 2>&1 | tail -10
```
Expected: it writes/refreshes `src/rbac/module-id.map.json` with the 8 framework entries and exits 0 (previously failed because `@{{name}}/shared` had no `ModuleId`).

- [ ] **Step 7: Clean up the throwaway project**

Run:
```bash
rm -rf /tmp/rbac-smoke && echo "cleaned"
```

- [ ] **Step 8: No commit needed**

This task created no repository changes. If any defect was found, return to the relevant earlier task, fix, and re-run this task.

---

## Notes for the implementer

- **Do not** remove `apps/api/src/rbac`, `apps/api/src/features/rbac`, or `packages/shared/src/const` from `IGNORE_PATTERNS`. Those directory-level ignores are what keep neural-erp's *business* RBAC out; the `PROTECTED_PATHS` entries (checked first) preserve our generic files.
- The template uses `{{name}}` for the kebab-case project name. Hand-authored files that reference the shared package must use `@{{name}}/shared` (e.g. `permissions.ts`), which the scaffolder rewrites to `@<project>/shared` at generate time.
- Tasks 1–4 are pure template authoring and require no build/network. Task 5 is the only task needing `pnpm` + network (for submodules).
