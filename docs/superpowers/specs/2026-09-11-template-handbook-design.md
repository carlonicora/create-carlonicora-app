# Template developer handbook — design

Date: 2026-09-11
Status: awaiting approval
Repo: `~/Development/create-carlonicora-app` (branch `dev`, v1.16.0)
Source of the structure: `~/Development/a360ai/docs/handbook` (120 EN pages) and its
design at `~/Development/a360ai/docs/superpowers/specs/2026-09-10-developer-handbook-design.md`

## 1. Goal

Every application scaffolded by `create-carlonicora-app` ships with a developer
handbook at `docs/handbook/`, reachable from a rewritten root `README.md`, and a
path checker at `scripts/check-handbook.mjs` that fails when a cited path is gone.

The handbook describes the stack the app was handed: the pnpm/Turborepo monorepo,
the NestJS API and its worker mode, the Next.js app, the shared package, the two
`@carlonicora/*` framework packages and the 43 foundation modules they ship, the
AI layer, the operations story and the working practices.

It copies the **structure** of the a360ai handbook — the nine-section layout, the
front-matter contract, the "every claim cites a path" rule, the twelve-section
chapter skeleton, the checker — and none of its content. No legal domain, no
proceedings, no judgements, no corpus service, no Italian locale, no a360ai
product vocabulary. Where a360ai's handbook described one company's product, this
one describes what the template actually contains.

## 2. Reader

A senior TypeScript developer who has just run `npx create-carlonicora-app my-app`.
They know NestJS and Next.js. They do not know Neo4j, {json:api}, the two nja
packages, or what the 43 foundations already give them for free. The handbook
explains stack basics only where this template deviates from the norm: Fastify
`reply.send()`, CLS tenancy, descriptor-driven entities, cursor pagination, the
`"use client"` barrel split, Base UI rather than Radix.

## 3. Principles

1. **Every claim cites a path that exists in the generated app.** A page saying
   "the worker owns the migrator" names the file. §10's checker enforces it.
2. **Document the template as it is, not as it was meant to be.** Where a shipped
   doc and the code disagree, the code wins and the disagreement is recorded in
   `docs/handbook/08-workflow/known-drift.md` rather than silently corrected. The
   handbook writers never fix template code or config.
3. **No a360ai content, ever.** Not a domain, not a label, not an example entity,
   not an Italian UI string, not a port number, not a hostname. The only permitted
   references to a360ai are absent: the generated app has never heard of it. The
   same rule covers the other consumer repos (`wyrdli`, `neural-erp`, `narr8`).
4. **The handbook describes the generated app, never the generator.**
   `create-carlonicora-app`'s own `src/`, `scripts/compare/`, `scripts/integrity/`,
   `template.sources.json` and `integrity.config.json` do not exist inside a
   scaffolded project and are never mentioned. The one seam that does reach the
   app — `CORE-UPDATE.md` and `scripts/update.sh` — is described from the app's
   side only.
5. **Two kinds of page, both declared.**
   - **Fixed pages** describe template or package code. True on day zero; they go
     stale only when the template changes.
   - **Seed pages** are written to be extended as the app grows. Each states in
     its opening lines what the author is expected to add. The seed pages are
     `01-architecture/graph-model.md`, `01-architecture/decisions.md`,
     `05-foundations/_template.md`, `06-ai/agents.md`,
     `07-operations/runbooks.md`, `07-operations/backup-and-recovery.md`,
     `08-workflow/known-traps.md`, `08-workflow/known-drift.md`.
   A seed page is never empty and never says TODO. It ships with the real content
   the template already justifies, plus a stated shape for what comes next.
6. **One skeleton per foundation chapter** (§6), so the reader learns the shape once.
7. **Systems, not folders.** Chapters follow how the code couples, not directory names.
8. **No invented names.** Terms come from the code or from a shipped doc. Acronyms
   are expanded on first use per page.
9. **`{{display}}` and `{{name}}` wherever the app must be named.** The scaffolder
   substitutes both in file contents and in file names. Handbook prose says
   "{{display}}" for the product and "{{name}}" for the slug, exactly as the rest
   of the template does. Never a hard-coded placeholder name.
10. **Living docs stay where they are and are linked, never copied** — `CLAUDE.md`,
    `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/shared/CLAUDE.md`,
    `apps/web/tests/README.md`, `CORE-UPDATE.md`, `EXTEND-USER.md`, `DOCKER.md`,
    `DEPENDENCY_UPGRADE_GUIDE.md`, `packages/*/README.md`, `packages/*/CLAUDE.md`,
    `packages/nestjs-neo4jsonapi/docs/*.md`,
    `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/*.md`.
11. **Mermaid for diagrams** (GitHub renders it). ASCII only for tiny boxes.
12. **Writers read code, not other chapters.** Cross-references are added in the
    final consistency pass, so every page can be written in parallel.
13. **English only.** No `it/` mirror; the a360ai Italian tree has no counterpart here.

## 4. Evidence that shaped the layout

Collected 2026-09-11 by four read-only recon passes: the template root and
`apps/api`, `apps/web`, `packages/nestjs-neo4jsonapi`, `packages/nextjs-jsonapi`.

| Fact | Consequence |
|---|---|
| `apps/api/src/main.ts` is 25 lines calling `bootstrap()`; `apps/api/src` is 26 files | the backend chapters describe the package's boot contract, not app code |
| `packages/nestjs-neo4jsonapi/src/foundations/` holds 43 modules, 37 of them auto-registered | `05-foundations` replaces a360ai's `05-domains`: ten chapters over the foundations the app already owns |
| The only app feature that ships is `apps/api/src/features/essentials/search` (6 files) and its web quartet (4 files) | `03-backend/module-anatomy.md` and `04-frontend/feature-anatomy.md` are annotated on `search`, the one real example |
| `apps/web/src/config/Bootstrapper.ts` registers ~55 package modules + 1 local, with a load-bearing comment about module-graph-local dedup | `04-frontend/bootstrap-and-modules.md` gets its own chapter |
| `apps/web/messages/en.json` is 4,413 keys, 3,392 of them under `features` | `04-frontend/i18n-and-theme.md` must say plainly which block a new app prunes |
| `.gitmodules` tracks `master`; `git submodule add -b master` checks out latest, while `versions.production.json` pins 4.1.3 / 3.5.7 | `02-framework/overview.md` documents both paths; the pin gap is a known-drift entry |
| 10 of the 43 foundations are Stripe billing plus `tokenusage` | one chapter, `05-foundations/billing-and-token-usage.md` |
| `chunk`/`chunker`/`atomicfact`/`keyconcept`/`community`/`relevancy` form one pipeline | one chapter, `05-foundations/knowledge-graph-and-retrieval.md` |
| `apps/api` ships one queue (`chunk`), one job name, zero crons; the package ships 9 queue ids and 3 crons | `01-architecture/queues-crons-and-workers.md` is mostly a package page with an app extension point |
| No `apps/corpus`, no second Neo4j, no legal ingestion | a360ai's `07-corpus` is deleted, and sections renumber to a contiguous 00–08 |
| `apps/api/src/ai` does not exist; the LLM layer and 8 agents live in the package | a360ai's 17-page `06-ai` collapses to 3 pages |
| No marketing routes in `apps/web/src/app` | a360ai's `04-frontend/marketing-site.md` is deleted |
| `docs/superpowers/**` and an `e2e-coverage.md` do not exist in a fresh app | a360ai's `09-workflow/historical-material.md` is deleted |
| `DEPENDENCY_UPGRADE_GUIDE.md` ships twice, 936 lines each, differing in 5 lines of wording | the `docs/` copy is deleted (§8) |
| Root `README.md` claims ports 3000/3001, a `pnpm structure` script and a `docs/architecture/` directory, none of which exist | the README rewrite is part of this work, and the pattern is recorded in known-drift |

## 5. Complete file list

97 markdown files under `docs/handbook/`, of which 20 are verbatim rulebook copies.

### `README.md` (rewritten, at the template root)

Modelled on the a360ai rewrite. Sections: what the app is (`{{display}}`, one
paragraph the author replaces), a workspace-project table (`apps/api`,
`apps/web`, `packages/shared`, the two submodules) with pnpm names and roles, a
technology-stack table per tier with the file that declares each version, ports
and hosts as `env.example` actually sets them (`4050` api, `4051` web), a
four-step getting-started, the command tables, and the handbook entry point. It
carries the same badge row the current README has. It does **not** keep the
current README's project-structure ASCII tree — `00-start-here/repo-tour.md`
owns that.

### `docs/handbook/README.md`

The index: the two rules, the three reading orders, and one line per page,
grouped by section — the same shape as a360ai's index.

### 00-start-here/ (6)

| File | Covers | Sources |
|---|---|---|
| `reading-order.md` | Three paths with a time estimate per leg: understand the stack; ship a feature; run it in production | the index |
| `repo-tour.md` | Every top-level directory and root file in one line each, including the two submodules and the un-dotted-at-rest dotfiles | template root |
| `local-setup.md` | Prerequisites (node ≥22, pnpm ≥11), `/etc/hosts` for `{{name}}.test` and `api.{{name}}.test`, `.env` from `env.example`, external Neo4j/Redis/MinIO, `pnpm install`, `pnpm dev` and its variants, first login as the seeded administrator | `env.example`, `scripts/dev.sh`, `package.json`, `apps/api/src/neo4j.migrations/20250901_004.ts` |
| `day-one-checklist.md` | Boot, log in, create a user, upload through `S3Service`, watch the chunk queue, find the nodes in Neo4j, run one spec, run one e2e spec, read the rules | the above plus `apps/web/tests/` |
| `glossary.md` | Framework and infrastructure terms only — descriptor, foundation, module factory, rehydration, CLS, cursor, company scope, feature id, module id — each with its Neo4j label or registry key. No product vocabulary | both packages |
| `task-index.md` | "I want to add a field / an entity / a queue job / a permission / a translation / a foundation exclusion" → the page that answers it | the index |

### 01-architecture/ (13)

`topology.md`, `monorepo-and-build.md`, `api-and-worker-modes.md`,
`request-lifecycle.md`, `configuration.md`, `multi-tenancy-and-security.md`,
`jsonapi-contract.md`, `entity-descriptors.md`, `graph-model.md`,
`queues-crons-and-workers.md`, `realtime.md`, `notifications-and-email.md`,
`decisions.md`.

Notes on the ones that differ most from a360ai:

- `topology.md` — two processes from one binary (`--mode=api`, `--mode=worker`)
  plus the Next.js app; external Neo4j, Redis and S3-compatible storage; the
  trust boundaries.
- `api-and-worker-modes.md` — `getAppMode()`/`getAppModeConfig()`, what
  `enableControllers`/`enableWorkers`/`enableCronJobs` switch, why
  `tsconfig.worker.json` has its own `outDir`, `createWorkerProvider`, and the
  fact that the migrator and the RBAC reconciler are worker-only.
- `request-lifecycle.md` — one GET and one POST traced through `searches`, the
  only endpoint the template ships, from the web service to Cypher and back.
- `configuration.md` — the three layers (`env.example` → `load-env.ts` →
  `baseConfig` merged with `apps/api/src/config/config.ts`), the `process.env`
  ban and its two documented exceptions, `apps/web/src/config/middleware-env.ts`
  and why it is library-free, and every variable grouped by subsystem.
- `graph-model.md` — **seed page.** The labels and relationship types the 43
  foundations declare, global versus company-scoped, the constraint and
  fulltext-index rules `defineEntity()` derives, and an empty "labels this app
  declares" table with the instructions to fill it.
- `decisions.md` — **seed page.** The decisions already baked into the template
  (Fastify over Express, Neo4j, {json:api} as the only protocol, descriptors over
  five-file entities, Base UI over Radix, pnpm catalog + overrides, submodules
  over npm in development, worker-only reconciliation), each with the file that
  evidences it, plus the ADR template.

### 02-framework/ (31)

Authored (10): `overview.md`, `shared-package.md`,
`nestjs-neo4jsonapi/{public-surface,foundations,agents-and-graphrag,tooling}.md`,
`nextjs-jsonapi/{public-surface,data-layer,components-and-hooks,tooling}.md`.

Verbatim rulebook copies (21): `rulebook/README.md` (authored) plus 20 files
copied byte-for-byte from the `nja` plugin's `nja-architecture` skill
`references/` tree — `core-principles`, `anti-patterns`, `discipline`,
`date-handling`, `decisions`, `feature-template`, `backend/01-entity-basics`,
`backend/02-dtos`, `backend/03-repositories`, `backend/04-services`,
`backend/05-controllers`, `backend/06-llm-calls`, `backend/template`,
`frontend/01-models`, `frontend/02-interfaces`, `frontend/03-services`,
`frontend/04-components`, `frontend/05-typography`, `frontend/06-blocknote`,
`frontend/template`.

Each copy gets a four-line front-matter block, a blank line, and an
HTML comment recording the plugin name, skill and version it was copied from,
with "do not edit here; re-copy when the plugin updates" — then the reference
verbatim. The checker skips path and link validation on them, because their
citations point at the plugin's tree.

`rulebook/README.md` carries the routing table, the page index, the
non-negotiable rules, and the sync obligation.

### 03-backend/ (6)

`bootstrap.md` (every `BootstrapOptions` field and the exact boot order,
including the two things `bootstrap()` does not wire), `module-anatomy.md`
(annotated on `apps/api/src/features/essentials/search/`, with the variants the
generator emits), `rbac-and-permissions.md` (the three identifier spaces, the
matrix DSL, `MODULE_USER_PATHS`, worker-only reconciliation,
`pnpm generate:rbac-paths` and `pnpm rbac:dump`), `token-usage-and-credits.md`
(the `TOKEN_USAGE_RECORDER` and `CREDIT_VALIDATOR` seams, the credits formula,
and the fail-open behaviour of both), `migrations.md` (the four shipped
migrations, the two step kinds, how to write one), `testing.md` (the Vitest
config, `oxc: false` and why, the absence of any shipped spec).

a360ai's `credits.md` becomes `token-usage-and-credits.md` because the template
has Stripe and token accounting rather than a bespoke credit ledger.

### 04-frontend/ (10)

`app-shell-and-routing.md`, `bootstrap-and-modules.md`, `feature-anatomy.md`,
`auth-and-onboarding.md`, `access-control.md`, `ui-system.md`,
`realtime-notifications-pwa.md`, `i18n-and-theme.md`, `admin-console.md`,
`testing.md`. a360ai's `marketing-site.md` is dropped.

`app-shell-and-routing.md` covers the four route groups, the provider stacks,
every route, and everything `apps/web/src/proxy.ts` does — including that token
refresh is app-owned and the package never refreshes.

### 05-foundations/ (12)

This section replaces a360ai's `05-domains`. A generated app has no domain yet,
but it has 43 foundation modules on day zero, and the reader needs to know what
they already own before adding anything.

| File | Foundations covered |
|---|---|
| `README.md` | What a foundation is, `FoundationsModule.forRoot`, how `bootstrap({foundations:{exclude,disabled}})` selects them, the narrowed-extend pattern, the six that are not auto-registered, and how to write a chapter for a domain of your own |
| `_template.md` | The twelve-section skeleton (§6) as a fill-in page. **Seed page.** |
| `identity-and-tenancy.md` | company, user, membership, role, auth, discord-user, google-user |
| `modules-features-and-rbac.md` | module, feature, rbac — as data; the engine lives in `03-backend/rbac-and-permissions.md` and the client gate in `04-frontend/access-control.md` |
| `two-factor-and-oauth.md` | two-factor, oauth |
| `notifications-and-push.md` | notification, push |
| `content-and-storage.md` | content, s3, chunker, chunk |
| `knowledge-graph-and-retrieval.md` | atomicfact, keyconcept, community, relevancy |
| `assistant-and-actions.md` | assistant, assistant-message, assistant-action, ai-connection |
| `billing-and-token-usage.md` | stripe + the nine `stripe-*` foundations + tokenusage |
| `audit-and-activity.md` | audit, user-activity |
| `growth-and-help.md` | waitlist, referral, how-to, discord |

Ten chapters cover all 43 directories with no overlap and no gap.

### 06-ai/ (3)

`llm-layer.md` (`LLMService` and its five entry points, the provider adapters,
the modality services, `AiConnection` fallback chains, the three model tiers and
their inheritance rules, `MOCK_AI`'s production fail-closed gate),
`agents.md` (**seed page** — the eight agents `AgentsModule` wires, the one it
exports but does not wire, `AbstractTools` and `@Tool`, the `OPERATOR_TOOLS` and
`MCP_TOOLS` contribution tokens, prompts as configuration, caller attribution,
and the per-agent page skeleton for agents the app adds), `eval-and-cost.md`
(the retrieval eval harness, token accounting, the cost variables).

a360ai's 14 legal-agent pages have no counterpart and are not carried over.

### 07-operations/ (9)

`docker.md`, `deployment.md`, `environments.md`, `data-stores.md`,
`backup-and-recovery.md`, `secrets.md`, `observability.md`, `release.md`,
`runbooks.md`.

- `docker.md` — the eleven Dockerfile stages, why `api-production` is Debian and
  not Alpine, the four compose files, the healthchecks, the `NEXT_PUBLIC_*`
  build-time bake. Links to `DOCKER.md` for deployment strategies and scaling.
- `environments.md` — local, e2e (`env.e2e.example`, `scripts/e2e.sh`, the
  separate database and queue prefix), production.
- `data-stores.md` — Neo4j, Redis, S3/MinIO: what the app stores in each, the
  connection settings, and that none of the three is provided by a compose file.
- `backup-and-recovery.md` — **seed page.** What each store needs, the
  constraints (Neo4j stores never shrink on delete; the queue prefix must not be
  shared), the recovery order, and a stated shape for the app's own procedures.
- `secrets.md` — the inventory of every secret-bearing variable and where it is set.
- `observability.md` — pino, optional Loki, optional Tempo/OTel, the three health
  endpoints, `VersionDisplay`.
- `release.md` — `.releaserc`, conventional commits, the three CI workflows, the
  local gates in `.husky/`.
- `runbooks.md` — **seed page.** The runbooks the template's own scripts support:
  reset the dev stack, run the e2e suite and its dashboard, sweep dependencies,
  bump a submodule, regenerate the RBAC paths, dump the RBAC matrix.

### 08-workflow/ (6)

`contributing.md`, `conventions.md`, `testing-strategy.md`,
`ai-assisted-development.md`, `known-traps.md`, `known-drift.md`.
a360ai's `historical-material.md` is dropped.

- `ai-assisted-development.md` — the instruction hierarchy (`CLAUDE.md`,
  `AGENTS.md`, the per-app `CLAUDE.md` files), the `nja` plugin and its
  architecture skill, `.claude/settings.json` and its worktree hook, the
  `playwright-cli` skill, and the two code generators.
- `known-traps.md` — **seed page**, opening with the traps §9 of this spec lists.
- `known-drift.md` — **seed page**, opening with the drift §4 and the recon found.

## 6. Foundation chapter skeleton

Every `05-foundations/*.md` except `README.md` has these H2 sections, in this
order. A section with nothing to say says so in one line rather than being
omitted. The checker enforces the list and the order.

1. **Purpose** — what it does for the app, two to four sentences.
2. **Vocabulary** — terms specific to the chapter.
3. **Graph model** — table: label, key fields, relationships (name, direction,
   target, cardinality), declaring file; plus a Mermaid graph of the labels.
4. **Backend** — table per module: endpoint, controller, service, repository,
   DTOs, guards, endpoints beyond CRUD; notable Cypher.
5. **Frontend** — table per module: model, service, module factory, routes,
   components, the feature id gating it, whether the template wires it into
   `Bootstrapper.ts`.
6. **Flows** — numbered sequences for each key action, naming the file at each
   hop, including queue jobs, socket events and notifications.
7. **Background jobs** — queues, processors, crons this chapter touches.
8. **Permissions and gating** — module ids, feature ids, roles, ACL.
9. **Configuration** — env vars and config keys this chapter reads.
10. **Tests** — where the package's specs are; what the template does not test.
11. **Where to look** — file table for the ten most useful files.
12. **Gaps and drift** — what was not examined, what disagrees with a shipped doc.

Non-foundation pages use headings suited to their content but keep sections 11
and 12.

## 7. Page conventions

- Front matter on every page except the root `README.md`, two keys and no more:
  ```yaml
  ---
  title: <page title>
  section: <00-start-here … 08-workflow>
  ---
  ```
  There is no `sources_verified` key. a360ai's handbook carries one; this one
  does not, because a date written into the template is stale the moment an app
  is scaffolded from it and there is nothing the checker could validate it
  against. The checker requires exactly `title` and `section`.
- Paths are inline code, relative to the app root, and must exist.
- Line references are avoided; symbol names are used instead.
- Tables for parallel data, prose for reasoning, Mermaid for structure.
- No page longer than about 600 lines; split by adding a sibling and a line in
  the section index. One deliberate exception: `08-workflow/known-drift.md` is a
  lookup table rather than a narrative, and a register that stops short of the
  findings it has fails at its only job, so it carries all of them (71 entries,
  888 lines on 2026-09-11). The checker enforces no line limit.
- No "TODO", "TBD", "FIXME" or placeholder text. Unknowns go in "Gaps and drift".
- The `nja:nja-unslop` rule applies: no filler, no AI tells.
- The two framework-package pages record the version they were read against in
  their body, and say that a generated app tracks `master` rather than the pin.

## 8. Disposition of the template's existing documents

| Existing | Action |
|---|---|
| `README.md` | rewritten (§5) |
| `CLAUDE.md` | only its component table and architecture pointer rewritten to handbook links; the guardrail lists stay verbatim |
| `AGENTS.md` | untouched (3 lines, points at `CLAUDE.md`) |
| `CONTRIBUTING.md` | folded into `08-workflow/contributing.md`, then deleted, and every link to it rewritten |
| `docs/DEPENDENCY_UPGRADE_GUIDE.md` | deleted; it duplicates the root copy in 931 of 936 lines |
| `DEPENDENCY_UPGRADE_GUIDE.md` (root) | kept, linked from `07-operations/deployment.md` and `08-workflow/contributing.md` |
| `DOCKER.md` | kept. `07-operations/docker.md` covers the stages, compose files and env contract with citations and links out to it for deployment strategies and scaling |
| `CORE-UPDATE.md` | kept, linked from `08-workflow/contributing.md` |
| `EXTEND-USER.md` | kept, linked from `05-foundations/identity-and-tenancy.md` |
| `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/shared/CLAUDE.md` | kept; each gains a handbook link |
| `apps/web/tests/README.md` | kept, linked from `04-frontend/testing.md` and `08-workflow/testing-strategy.md` |
| `.claude/skills/playwright-cli/**` | untouched, described in `08-workflow/ai-assisted-development.md` |
| `CHANGELOG.md` | untouched (0 bytes in the template; semantic-release fills it) |
| `packages/**/*.md` | untouched, linked |

Deleting a file also means rewriting every link to it across the template.

## 9. The checker

`template/scripts/check-handbook.mjs`, ported from `a360ai/scripts/check-handbook.mjs`
with its companion `template/scripts/check-handbook.test.mjs`. It resolves the
repo root as its own `..`, so the same file runs inside `template/` during
development and inside a generated app afterwards.

What it does, unchanged from the original:

1. Extracts every inline-code token that looks like a path (`apps/…`,
   `packages/…`, `scripts/…`, `docs/…`, `.github/…`, `.husky/…`, `.claude/…`,
   root entries) from `README.md` and `docs/handbook/**/*.md` and fails if it
   does not exist. Tokens containing `* < > { } $ …` or a space are skipped,
   which is what keeps `{{name}}` citations out of the check.
2. Extracts every relative markdown link and fails on a missing file or anchor.
3. Fails on `TODO`, `TBD`, `FIXME`, `lorem ipsum`.
4. Checks the front matter on every page — exactly `title` and `section`, no
   `sources_verified` — and the twelve skeleton headings in order on
   `05-foundations/*` except `README.md`.
5. Checks the file list in §5 against disk, both directions.
6. Skips path and link checks on the 20 rulebook copies.

Four changes the template context requires:

- **Template mode.** When `gitmodules` exists and `.gitmodules` does not, the
  script is running inside `template/`, where dotfiles are stored without their
  leading dot. For root-level cited paths it then also accepts the un-dotted
  spelling, using the same rename map the scaffolder uses.
- **Uninitialised submodules.** Paths under `packages/nestjs-neo4jsonapi/` and
  `packages/nextjs-jsonapi/` are skipped when that directory is empty or holds
  only `.gitkeep` — the state inside `template/` and after `--skip-git`. The run
  reports how many it skipped rather than passing silently.
- **No Italian.** `--it`, `EN_MANIFEST`'s Italian twin, `DOMAIN_HEADINGS_IT` and
  the Italian-only `source` front-matter key are removed.
- **Front matter.** The required keys drop to `title` and `section`; a page
  carrying `sources_verified` is a failure, so the a360ai key cannot creep back in.
- **Manifest.** `EN_MANIFEST` becomes the 97-file list of §5.

Wiring: `template/package.json` gains `"check:handbook": "node scripts/check-handbook.mjs"`.
It is **not** added to `pnpm lint`, matching a360ai and your answer. The
generator's own integrity suite gains a tenth check that runs it against
`template/`, so a template edit that breaks a citation fails
`npm run check:template` in this repo before it can ship.

`template.sources.json` gains `docs/handbook`, `scripts/check-handbook.mjs` and
`scripts/check-handbook.test.mjs` to its `templateOnly` list, so the drift
comparison against the consumer repos does not propose removing them.

## 10. What the seed pages start with

`08-workflow/known-drift.md` opens with the drift the recon actually found, each
with the file that proves it: `apps/web/global.d.ts` importing a `messages/it.json`
that does not exist; `apps/web/components.json` aliasing four directories that do
not exist; `"typecheck": "eslint ."` in `apps/web/package.json` with no
`tsc --noEmit` anywhere; `strict: false` in both app tsconfigs; `tw-animate-css`
declared twice in `apps/web/package.json`; "Radix UI compatibility" comments in a
Base UI codebase; two `cn` implementations; an `it` branch in
`apps/web/src/i18n/useDateFnsLocale.ts` with only `en` configured;
`react-hooks/rules-of-hooks` disabled; `search.dto.ts` not wired into its
controller; two permission grants in `20250901_003.ts` against UUIDs in no module
map; five scripts under `scripts/` that no `package.json` script invokes;
`scripts/validate-translations.js` shadowed by `apps/web/scripts/validate-translations.mjs`;
`packages/nextjs-jsonapi/README.md` advertising four entry points absent from its
exports map; `tsup.config.ts` in `packages/nestjs-neo4jsonapi` that `pnpm build`
never runs; `BootstrapOptions.rbac` declared and never read; `OperatorModule`
exported but not wired into `AgentsModule`; `versions.production.json` pinning
4.1.3 / 3.5.7 while the submodules track `master`; every `MODULE_USER_PATHS` entry
empty; the reserved-but-unused worker health port; and no unit or component spec
in either app, with all three suites passing via `passWithNoTests`.

`08-workflow/known-traps.md` opens with the traps both packages and the template
document inline — `pnpm build` beside a running dev server, `Modules.X` at module
scope, the `"use client"` barrel split and the `/core` rule, the module-level
bootstrap flag, Base UI's missing `asChild`, `cmdk`'s unique `value`, `dtoKey`
renaming the wire key, `modelRegistry` keyed by `nodeName`, `{CURSOR}`'s second
COUNT query, `cls.run()` around worker code, guards instantiating in the host
module, `NEXT_PUBLIC_*` baked at build time, `.pnpmfile.cjs` and the duplicate
`@nestjs/core`, `oxc: false`, the double Tailwind `@source`, the `--color-success`
and `cursor: pointer` consumer requirements, a to-one relationship that cannot be
cleared by PATCH, `tsup`'s `clean: false`, the e2e ban on pattern kills,
`EndpointCreator` not URL-encoding, `translateResponse` swallowing rehydration
errors, substring matching in `ServerSession.hasRole`, `hasPermissionToPath`
defaulting open, and the two fail-open AI tokens.

## 11. Execution shape

1. You approve this spec.
2. Fourteen work packages, all dispatched in parallel to Opus agents, each
   reading the code it documents and writing only the files it names:

   | WP | Files |
   |---|---|
   | 1 | root `README.md` rewrite + `docs/handbook/README.md` + 00-start-here (7) |
   | 2 | 08-workflow (6) |
   | 3 | 01-architecture, infrastructure half (7) |
   | 4 | 01-architecture, data half (6) |
   | 5 | 02-framework, nestjs package + overview (5) |
   | 6 | 02-framework, nextjs package + shared + rulebook README (6) |
   | 7 | 03-backend (6) |
   | 8 | 04-frontend (10) |
   | 9 | 05-foundations README + `_template` + identity + modules/rbac (4) |
   | 10 | 05-foundations content/knowledge/assistant/two-factor-oauth (4) |
   | 11 | 05-foundations billing/notifications/audit/growth (4) |
   | 12 | 06-ai (3) |
   | 13 | 07-operations (9) |
   | 14 | the checker, its test, `package.json`, `CLAUDE.md` links, `template.sources.json`, the integrity check, and the two file deletions |

   The 20 rulebook copies are mechanical and I do them inline, not in an agent.
3. Consistency pass, by me: cross-links added, vocabulary unified, duplicate
   explanations collapsed to one page plus links, every chapter's "Gaps and
   drift" merged into `known-drift.md`.
4. Verification (§9's checker, plus a scaffold of a throwaway app to prove the
   handbook survives `{{name}}` substitution and that the checker passes there).
5. You review.

No commits at any stage.

## 12. Decisions taken

Answered 2026-09-11:

1. `CONTRIBUTING.md` is folded into `08-workflow/contributing.md` and deleted.
2. `DOCKER.md` stays; `07-operations/docker.md` cites it rather than absorbing it.
3. No `sources_verified` front-matter key anywhere (§7).

## 13. Out of scope

- Any Italian or other non-English mirror.
- Changing template code or configuration to match the docs. Every mismatch the
  writers find is recorded in `known-drift.md` and left alone.
- Documenting `create-carlonicora-app` itself beyond the app-facing update seam.
- Wiring the checker into `pnpm lint` in the generated app.
- Per-agent pages for agents the template does not ship.
