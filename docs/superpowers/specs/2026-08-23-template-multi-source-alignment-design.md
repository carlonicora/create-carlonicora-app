# Template multi-source alignment — design

**Date:** 2026-08-23
**Status:** Approved design, pending implementation plan
**Scope:** `create-carlonicora-app` — template contents, sync tooling, and the agentic skill that maintains both

---

## Problem

`template/` is refreshed by `scripts/sync-template.js`, which blind-copies from a single
hardcoded source (`neural-erp`), skipping a business-code deny-list and preserving a
40-entry `PROTECTED_PATHS` allow-list. Two things have gone wrong with that arrangement:

1. **The template has rotted.** It is one generation behind both consuming projects on
   `/administration` and `/settings`, and three defects ship in every generated app today
   (see Evidence). It no longer typechecks against the library it depends on.
2. **Single-source sync cannot express reality.** `wyrdli` and `neural-erp` advance
   independently; neither is a superset. A three-way file census (243 text files) shows
   that honouring both would require protecting ~200 of them — at which point the copier
   is a deny-list with a copier attached.

The template must instead be defined by **whichever project most recently advanced a given
surface**, merged under explicit judgement rules.

---

## Evidence

A full audit was run on 2026-08-23 against `wyrdli` and `neural-erp` (both on library
`nextjs-jsonapi@3.3.8` / `nestjs-neo4jsonapi@3.1.0`).

### Ships broken today

| # | Defect | Consequence |
|---|---|---|
| 1 | `(admin)/layout.tsx` gates on `isLogged()` only; the `notFound()` is the *locale* check. `administration/companies/page.tsx` carries no guard. | Any authenticated user reaches the admin page. **Not a data leak** — the API enforces `@Roles(Administrator)` on `GET /companies` (`company.controller.ts:39-41`), so the request 403s. UI exposure only. Must be fixed before adding 7 further admin routes that would inherit it. |
| 2 | `SettingsContainer.tsx` imports `ProductsAdminContainer` from `@carlonicora/nextjs-jsonapi/billing`; the symbol exists in neither `dist` nor `src`. | **The template does not typecheck against 3.3.8.** |
| 3 | `utils/metadata.ts`: `metadataBase: new URL(ENV.APP_URL ?? "{{name}}.com")` | Scaffolds to `new URL("myapp.com")` → `TypeError: Invalid URL`. `generateSpecificMetadata` backs nearly every `generateMetadata`, so with `APP_URL` unset every page 500s. |

### Missing / stale

| # | Finding |
|---|---|
| 4 | `Bootstrapper.ts` registers neither `...tokenUsageModules(moduleFactory)` nor `AiConnection: AiConnectionModule(moduleFactory)`. The library warns this is **not** a compile error: `FoundationModuleDefinitions` declares the names, so `Modules.X` typechecks and is `undefined` at runtime. |
| 5 | `env.example` has no `ENCRYPTION_KEY` — `AiConnectionService` throws *"ENCRYPTION_KEY is not configured — cannot store AI connection secrets"*. Also missing `NEXT_PUBLIC_EMAIL_LOGIN`, `CREDIT_COST`, `CREDIT_MINIMUM`, `AI_*_LITE`/`AI_*_LARGE`. Still carries retired `ALLOW_REGISTRATION` alongside `NEXT_PUBLIC_REGISTRATION_MODE`. |
| 6 | `versions.production.json` pins `2.0.0`/`2.0.0`; actual libraries are `3.1.0`/`3.3.8`. Production Docker builds resolve major-version-old packages. |
| 7 | Email templates `invitationEmail.hbs` and `resetEmail.hbs` absent, yet `/invitation/[code]` and `/reset/[code]` routes ship. |
| 8 | Two `.DS_Store` files inside `template/` are copied into every generated app. |
| 9 | Root `package.json` `"structure"` → `scripts/import-structure.sh`, which does not exist. |
| 10 | Bundled `{{name}}-architecture` skill is stale: all 15 reference files are older/smaller than the `nja` plugin's; `backend/06-llm-calls.md`, `decisions.md`, `frontend/05-typography.md` and `evals/` are absent; SKILL.md routing table has no rows for them. |
| 11 | i18n: **142 literal keys + 6 dynamic subtrees** required by the library's admin/settings components are missing from `en.json`. All exist in `wyrdli`. |
| 12 | Missing framework routes beyond admin/settings: `/tokenusage` (self-service), `app/robots.ts`, `app/sitemap.ts`, `help/sitemap.xml/route.ts`. |
| 13 | Dead files, 0 consumers: `AccountContainer`, `DeleteAccountDialog`, `AccountContext`, `HeaderContentContext`, `VisibilityBadge`. Plus `SettingsNav`, `SettingsPageLayout`, `SettingsContext`, local `AdminIndexContainer` once the rewrite lands. `apps/api/jest.config.js` is dead (no jest deps; `"test": "vitest run"`). |

### Verified clean (do not "fix")

- 0 unresolved internal imports across `apps/web/src` and `apps/api/src`.
- 0 missing i18n keys for code the template ships today (namespace-aware check).
- `api-production` correctly on `node:22-bookworm-slim` (glibc, for `onnxruntime-node`) while `web-production` is alpine.
- `/settings/oauth` static route takes precedence over the new `[module]` redirect — no collision.
- `apps/api/tsconfig.json` `paths` does override the base `@{{name}}/shared` mapping, but `turbo.json` gives `build` and `dev` `dependsOn: ["^build"]`, so shared is always built first. **Not a defect.**
- `AuthService.findToken` still exists; `ServerAuthService` is an alias re-export of the same class. Import-hygiene only.

### Three-way file census

243 text files, template vs wyrdli vs neural-erp (after dotfile mapping and per-target
`generalize()`):

| Class | Count | Meaning |
|---|---|---|
| `T==N, T≠W` | 49 | switching source to wyrdli would change these |
| `T==N`, absent in wyrdli | 52 | would be orphaned by a wyrdli-sourced sync |
| `T≠N, T≠W` | 108 | already hand-edited |
| `T==W` | 34 | already aligned |

Per-file judgement on the 49 found the **template ahead** in ~40 cases (it keeps CI
`pnpm test` steps and the `pre-push` hook that wyrdli deleted; the `^_` unused-args ESLint
rule; i18n'd `VersionDisplay`; newer `components.json`; richer help chrome). Genuine
regressions hiding in that set: `neo4j.migrations/*` (wyrdli uses a **different bootstrap
scheme**, not drift), app-specific `config.ts`/`config.interface.ts`, and
`packages/shared/src/const/modules.id.ts` (wyrdli's entity UUIDs share the `ModuleId`
symbol with the template's RBAC UUIDs but mean something else).

### Why recency alone is insufficient

Per-file `git log -1` on contested files:

| file | wyrdli | neural-erp | verdict |
|---|---|---|---|
| `SettingsContainer.tsx` | 08-19 `feat: rename narr8 → Wyrdli` | 08-22 `chore: update pnpm workspace…` | picks nerp — correct |
| `utils/metadata.ts` | 08-19 `feat(marketing)` | 02-23 `fix: rename` | picks wyrdli — correct |
| `neo4j.migrations/20250901_002.ts` | 2025-12-15 | 2026-03-18 | picks nerp — correct |
| `.github/workflows/dev.yml` | 08-22 `ci: bump actions` | 08-22 `chore: pnpm workspace…` | tie — and wyrdli's file has **no `pnpm test`** |

Every winning commit on a contested file is a **bulk or rename commit** that touched the
file incidentally. File mtime records *when touched*, not *what advanced*. Recency is
therefore a ranked hint with a confidence flag, never the decision.

---

## Non-goals

- Trimming `en.json` of neural-erp business copy (separate concern; not blocking).
- Reworking `Dockerfile` / `docker-compose*.yml` / `turbo.json` / `proxy.ts` — audited for
  stale references, none found.
- Adding features neither project has.
- Changing the library packages themselves.

---

## Design

Five phases. Phase 1 is independent and lands first.

### Phase 1 — repair what ships broken

Direct edits to `template/`, no tooling involved.

- **Admin gate.** `(admin)/layout.tsx` returns `<ErrorDetails code={403} />` for anyone
  without `RoleId.Administrator`, carrying wyrdli's comment explaining that the routes
  beneath hold no auth of their own.
- **`metadataBase`.** `new URL(ENV.APP_URL ?? "https://{{name}}.com")`. Also drop the
  `it`/`fr`/`fi` alternates, which contradict `routing.locales: ["en"]`.
- **`versions.production.json`** → `3.1.0` / `3.3.8`.
- **`Bootstrapper.ts`** → add `...tokenUsageModules(moduleFactory)` and
  `AiConnection: AiConnectionModule(moduleFactory)`.
- **`env.example`** → add `ENCRYPTION_KEY`, `NEXT_PUBLIC_EMAIL_LOGIN`, `CREDIT_COST`,
  `CREDIT_MINIMUM`, the `AI_*_LITE`/`AI_*_LARGE` tiers; remove `ALLOW_REGISTRATION` and
  `NEXT_PUBLIC_ALLOW_REGISTRATION`.
- **Email templates** → add `invitationEmail.hbs` and `resetEmail.hbs`, generalized from
  wyrdli's (strip brand colour `#167b5d`, logo `img`, and "Wyrdli" strings).
- **Junk** → delete both `.DS_Store`. The permanent guard belongs in the CLI's copy step
  (`src/utils/files.ts`), not in the sync script, which Phase 2 deletes: add a skip-list to
  `copyTemplate()` so junk can never reach a generated app regardless of what `template/`
  contains. Integrity check 5 catches recurrences in `template/` itself.
- **`scripts/import-structure.sh`** → drop the `structure` entry from root `package.json`.
  No consumer references the script and it has never existed in the template.
- **`apps/web/package.json`** → remove `"packageManager": "pnpm@11.1.1"` (root declares
  `pnpm@11.18.0`).
- **Dead files** → delete `AccountContainer`, `DeleteAccountDialog`, `AccountContext`,
  `HeaderContentContext`, `VisibilityBadge`, `apps/api/jest.config.js`.

`ProductsAdminContainer` is *not* fixed here — it disappears with the Phase 4 settings
rewrite, which is its only consumer.

### Phase 2 — `compare-template` v2, multi-target

Replaces the single-source comparison. `scripts/sync-template.js` is **deleted**.

**Configuration** — `template.sources.json` at repo root:

```jsonc
{
  "targets": [
    { "path": "../wyrdli",     "appName": "wyrdli",     "ignore": ["apps/web/src/features/features/**", "apps/web/src/features/marketing/**", "apps/api/src/features/**", "packages/shared/src/{calendar,game-system}/**", "..."] },
    { "path": "../neural-erp", "appName": "neural-erp", "ignore": ["apps/web/src/features/{activity,asset,crm,finance,hr,...}/**", "..."] }
  ],
  "neverAdopt": ["apps/api/src/neo4j.migrations/**", "apps/api/src/config/config.ts", "apps/api/src/config/interfaces/config.interface.ts", "packages/shared/src/index.ts", "packages/shared/src/const/module*.id.ts"],
  "templateOnly": ["apps/web/src/features/pwa/**", "apps/web/src/features/onboarding/**", "apps/web/src/features/essentials/**", "apps/web/src/app/[locale]/(auth)/oauth/**", "..."]
}
```

CLI args override `targets`. Adding `only35`/`phlow` later is one entry.

**Recency index** — one pass per repo:
`git log --format=%H|%ct|%s --name-only` → `path → { date, subject, filesInCommit }`.
`filesInCommit > 25` sets a **`bulk`** flag that demotes the recency hint. This is the
mechanism that catches the `dev.yml` and rename-commit cases above.

**Row model** — union of template + all targets, after dotfile mapping and per-target
`generalize()`. Each row carries, per target: `present`, `equalToTemplate`, `date`,
`subject`, `bulk`; plus a truncated unified diff.

**Classification** — `ALIGNED` · `TARGET_AHEAD(<which>)` · `DIVERGED` (3-way, judgement
required) · `TARGET_ONLY` (candidate addition) · `TEMPLATE_ONLY` · `NEVER_ADOPT`.

**Outputs** — `report.md` for humans, `report.json` for the merging session.

**Apply step** — `template:apply --paths <list>` copies a reviewed subset from a named
target, re-running `generalize()`. Decisions are made by judgement; execution is
mechanical. There is no path back to blind whole-tree copying.

### Phase 3 — `template-sync` skill

Repo-local at `.claude/skills/template-sync/`. Built with `superpowers:writing-skills`.
Structure mirrors `nja-architecture` (SKILL.md + routing + `references/`).

```
SKILL.md                    preflight → compare → triage → judge → apply → integrity → verify → report
references/precedence.md    ahead-vs-divergent rules; recency is a hint; bulk commits are not evidence
references/never-adopt.md   migrations, app config.ts, shared/index.ts, entity ModuleId — with rationale
references/integrity.md     the 8 checks below — what each catches, how to read a failure
references/verification.md  scaffold → install → boot → click /administration and /settings
```

**Judgement rules** seeded from this audit:

- The template keeps CI test steps and pre-push hooks even when a target deletes them.
- Never adopt a target's `neo4j.migrations/*`, app `config.ts`/`config.interface.ts`
  extensions, `packages/shared/src/index.ts`, or entity-flavoured `ModuleId`.
- Prefer i18n'd strings over hardcoded ones; prefer library containers over hand-rolled
  ones; prefer server-safe subpath imports inside Server Components.
- Bulk/rename commits are not evidence of advancement.
- Every adopted file is re-generalized and brand-string swept.

**Integrity checks** — the audit, promoted from prose to tested scripts. These are the
deliverable that stops the template rotting again:

1. unresolved internal imports (`@/…`, `src/…`, relative)
2. app imports vs library `dist` exports — catches `ProductsAdminContainer`
3. i18n keys the library's components demand vs `en.json` — catches the 142-key gap
4. `package.json` script refs vs files on disk — catches `import-structure.sh`
5. junk sweep (`.DS_Store`, `*.log`) — catches finding 8
6. brand-string leak sweep (literal `wyrdli`/`neural-erp` surviving generalization) and
   unsubstituted-placeholder-in-URL — catches finding 3
7. `versions.production.json` vs submodule `package.json` — catches finding 6
8. `Bootstrapper` registrations vs `Modules.*` referenced by library features — catches
   finding 4, which nothing else catches

Checks 2, 3 and 8 must handle `export type { … }` blocks, namespace-scoped
`useTranslations("ns")`, and star re-exports respectively. Naive versions of all three
produced false positives during the audit.

### Phase 4 — run the merge

The skill's first real exercise, and the honest test of whether it works.

**`/administration`** — the library's `AdminIndexContainer` hardcodes the route contract
(`companies`, `users`, `token-usage`, `ai-connections`, `rbac`, plus `products` when
Stripe is configured). Backend needs nothing: `foundations.modules.ts` already registers
ai-connection, tokenusage, company, user, rbac and stripe-*.

| route | composition |
|---|---|
| `administration/page.tsx` | `<AdminIndexContainer />` — bare; it brings its own shell and `AdministrationProvider` |
| `companies/`, `companies/[id]/` | `CompaniesListContainer` / existing detail |
| `users/` | `PlatformUsersContainer` (platform-wide; the company-scoped list renders empty for a system admin) |
| `token-usage/` | `AdministrationProvider` → `TokenUsageAdminProvider` → `TokenUsageAdminContainer`, imported from the **client** subpath |
| `ai-connections/` | `AdministrationProvider` → `AiConnectionsContainer` |
| `rbac/` | `AdministrationProvider` → `RoundPageContainer` → `RbacProvider` → `RbacContainer` |
| `products/`, `products/[id]/`, `prices/[id]/` | billing admin containers |
| `waitlist/` | unchanged (template-only, kept) |

**`/settings`** — moves from `(main)/(features)/settings` to `(main)/(foundations)/settings`;
`(features)` disappears from the template entirely.

- new `(main)/(foundations)/layout.tsx` — login gate
- `page.tsx` → `SettingsContainer initialSection={section ?? PROFILE_SECTION}`
- `[module]/page.tsx` → **query-preserving** redirect to `?section=`. Required: the library
  hardcodes `/settings/billing?action=subscribe` in `TokenStatusIndicator`, and dropping the
  query silently breaks the subscribe deep-link.
- `SettingsContainer.tsx` rewritten as a rail (`RoundPageContainer layout="rail" tabs`),
  modelled on neural-erp's (the fuller of the two) minus its app-specific sections:
  **Profile · Company · Users · Billing · Products (admin) · OAuth (admin)**
- new `SettingsSectionActionsContext.tsx` and `UserProfileContainer.tsx`
- `settings/oauth/page.tsx` body becomes the OAuth rail section; `oauth/new` and
  `oauth/[clientId]` remain standalone routes

**Navigation** — `CommonSidebar` gains the administration group (companies, users,
token-usage, ai-connections, products) gated on Administrator, and its stale
`/settings/billing?action=subscribe` becomes `/settings?section=billing&action=subscribe`.
`(main)/page.tsx` switches to the library `AdminIndexContainer`.

**i18n** — lift the `administration`, `ai_connections`, `token_usage` subtrees wholesale
from wyrdli's `en.json` and merge `billing.admin.*`; drop the obsolete
`common.administration_*` keys.

**Bundled skill** — refresh all 15 reference files from the `nja` plugin, add
`backend/06-llm-calls.md`, `decisions.md`, `frontend/05-typography.md` and `evals/`, and
add the corresponding routing-table rows to SKILL.md.

**Also adopt** (from the category-A judgement): `packages/shared/vitest.config.ts` include
`*.{test,spec}.ts`; `(auth)/auth/page.tsx` → `ServerAuthService`.

**Also add** (missing framework routes): `/tokenusage`, `app/robots.ts`, `app/sitemap.ts`,
`help/sitemap.xml/route.ts`.

### Phase 5 — verification gate

Non-optional, and the step that would have caught defects 1–4:

1. scaffold a throwaway app into a temp dir
2. `pnpm install`
3. `pnpm --filter <name>-web exec tsc --noEmit`
4. boot `pnpm dev:api` and `pnpm dev:web`
5. log in and open `/administration`, every admin sub-route, and `/settings`

Lint, build and test all pass on a NestJS graph that cannot start; only booting proves it.

---

## Precondition — the WIP branch

`create-carlonicora-app` is on `chore/deps-update-2026-08-03` with **23 uncommitted files**,
a three-week-stale dependency pass that overlaps this work: it bumped
`versions.production.json` to `2.0.0` (still short of `3.x`) and `@next/*` to `16.2.12`,
and added untracked `template/pnpmfile.cjs` and `template/scripts/check-dep-drift.js`. It
did **not** touch `packageManager`, `ENCRYPTION_KEY` or `EMAIL_LOGIN`.

All audit findings were taken from the working tree, so they reflect that state and remain
valid. This WIP must be committed or set aside before Phase 1 begins — its disposition is
the user's call, and nothing here should modify or discard it.

---

## Risks

| Risk | Mitigation |
|---|---|
| Merge judgement drifts between runs | rules live in `references/precedence.md`, not in a session's head |
| A future target project is added and its quirks leak in | per-target `ignore` in `template.sources.json`; `neverAdopt` is repo-level |
| Integrity checks give false positives and get ignored | the three known-fragile checks have explicit requirements in `references/integrity.md`, derived from real false positives hit during the audit |
| Verification gate skipped under time pressure | it lives inside the same skill as the merge, not a separate one |
| `en.json` keeps accumulating neural-erp business copy | out of scope here; check 3 makes the *required* set explicit, so a later trim is safe |
