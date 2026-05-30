# RBAC Template Baseline — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)
**Scope:** Bring neural-erp's RBAC into `create-carlonicora-app`'s generated template as a generic, framework-modules-only baseline so a freshly scaffolded app boots with working, extensible RBAC and every documented RBAC command works.

## Problem

The template is derived from `neural-erp` via `scripts/sync-template.js`, which strips all
business-specific code. The RBAC *infrastructure* was stripped, but the RBAC *documentation and
tooling were not* (they live in `PROTECTED_PATHS` files lifted from neural-erp):

- `apps/api/CLAUDE.md` documents an RBAC system at `src/rbac/permissions.ts` + a worker reconciler
  that the template does not ship.
- `apps/api/package.json` ships `rbac:dump`, `generate:rbac-paths`, and `build-module-id-map`
  scripts. The script files exist (`apps/api/scripts/*.ts`) but both import `ModuleId` from
  `@{{name}}/shared`, which the template's shared package no longer exports — so running them fails.
  `generate:rbac-paths` also targets the stripped `src/rbac/module-id.map.json` and
  `src/features/rbac/`.

Result: a documented, half-wired feature that does not work in a generated app.

## Goal

Ship the **generic foundation slice** of neural-erp's RBAC — the 8 framework modules (Auth, Company,
Feature, Notification, Role, S3, User, HowTo) and 2 system roles (Administrator,
CompanyAdministrator) — with **zero business coupling** (none of the 48 business modules or 11
business roles). The full stack is included: backend matrix + reconciler wiring + dump/generate
tooling + admin RBAC UI + validate script + docs.

## Key Facts (verified)

- neural-erp's RBAC cleanly separates into a generic foundation (8 framework modules, 2 system
  roles, zero business coupling) and a business layer (48 modules, 11 roles).
- All heavy machinery (`RbacModule.register`, the worker reconciler, `dumpRbacMatrix`, the
  `generate-rbac-paths` CLI, the `perm`/`defineRbac` DSL) lives in the
  `@carlonicora/nestjs-neo4jsonapi` library (a git submodule). The app only supplies constants, the
  `permissions.ts` matrix, `module-relationships.map.ts`, migrations, scripts, and admin UI wrappers.
- The admin RBAC UI (`(admin)/administration/rbac/page.tsx`, `roles/page.tsx`) is generic: it imports
  only `ModuleId, RoleId` from `@{{name}}/shared` plus library components, and builds its name maps
  inline. It works as-is once shared exports `ModuleId`.
- `scripts/validate-rbac-alignment.ts` is generic (pure ts-morph descriptor parsing; no business
  names).
- Migrations `_001`–`_004` (retained in the template) already seed only the framework roles, modules,
  and permission matrix. Business seeding lived in the stripped `_005`+. No migration changes needed.

## Approach (chosen)

**Generic baseline as PROTECTED files + selectively un-ignore the generic files.** Business-coupled
RBAC files stay in `IGNORE_PATTERNS` so neural-erp's full versions never leak in; we hand-author tiny
framework-only versions in `template/` and list them in `PROTECTED_PATHS`. Genuinely-generic files
get removed from `IGNORE_PATTERNS` so they sync verbatim. This matches the established template
pattern (`features.modules.ts`, `roles.id.ts`, etc. are already hand-maintained PROTECTED files).

Rejected alternative: programmatic generalization in `sync-template.js` (parse + filter business
entries). Fragile TS/JSON parsing and a hardcoded denylist for ~8-entry files — not worth it.

## Changes

### 1. Hand-maintained generic versions (add to `PROTECTED_PATHS`), framework-modules-only

| File | Content |
|---|---|
| `packages/shared/src/const/module.id.ts` | `ModuleId` const with the **8 framework UUIDs only**; UUIDs lifted to match migration `_002` |
| `packages/shared/src/index.ts` | add `export { ModuleId } from "./const/module.id"` (edit existing hand-maintained file) |
| `apps/api/src/rbac/permissions.ts` | `defineRbac` matrix covering only the 8 framework modules |
| `apps/api/src/rbac/module-id.map.json` | 8 framework label→UUID entries |
| `apps/api/src/features/rbac/module-relationships.map.ts` | `MODULE_USER_PATHS` with the 8 framework entries → `[]` (regenerate after adding entities) |
| `apps/api/src/features/features.modules.ts` | edit existing PROTECTED stub to also `RbacModule.register({ moduleUserPaths, rbac, devMode })` |

### 2. Remove from `IGNORE_PATTERNS` so they sync verbatim (confirmed generic)

- `apps/web/src/app/[locale]/(admin)/administration/rbac`
- `scripts/validate-rbac-alignment.ts`

Note: keep `administration/howtos` ignored (out of scope). The stale `apps/web/scripts/build-module-id-map.ts`
ignore entry is a no-op (file does not exist in neural-erp); remove or leave — harmless.

### 3. Already correct — no change

- `apps/api/scripts/rbac-dump.ts` + `build-module-id-map.ts` already ship; they start working once
  `ModuleId` is exported.
- `apps/api/package.json` already has the three RBAC scripts (PROTECTED).
- Migrations `_001`–`_004` already seed framework-only RBAC.
- `apps/api/CLAUDE.md` RBAC docs become accurate as-is.

## Data Flow (generated app)

`permissions.ts` (matrix) + `module-relationships.map.ts` (paths) → `RbacModule.register()` in
`features.modules.ts` → library reconciler syncs file→Neo4j on worker bootstrap. Migrations seed the
framework roles/modules. Admin edits the matrix in the RBAC UI and runs `rbac:dump` to persist.
Adding a business module = add a `ModuleId` entry + entity + `pnpm generate:rbac-paths` + edit
`permissions.ts`.

## Verification

Scaffold a throwaway project from the updated template and confirm:
1. `tsc` / build is clean.
2. `pnpm build-module-id-map` and `pnpm generate:rbac-paths` run without the `ModuleId` import error.
3. The earlier dangling-reference audit still passes — no business modules reappear anywhere
   (`module.id.ts`, `permissions.ts`, `module-id.map.json`, `module-relationships.map.ts`, the admin
   UI, migrations).
4. API boots with `RbacModule` registered (matches neural-erp's `features.modules.ts` registration
   shape).

## Out of Scope

- `administration/howtos` admin UI.
- Any business module, business role, or business feature.
- Changes to the library (`@carlonicora/nestjs-neo4jsonapi`).
