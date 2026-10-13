---
title: Developer handbook
section: handbook
---

The handbook for {{display}}: what the application was handed on day zero, how
the pieces couple, and the rules for adding to them. It describes the stack, not
the product — the product chapters are the ones you write.

## Two rules

1. **Every claim cites a path.** A sentence that says the worker owns the
   migrator names the file that proves it. `node scripts/check-handbook.mjs`
   extracts every path in backticks and every relative link from `README.md` and
   from these pages, and fails when one of them no longer exists. Run it with
   `pnpm check:handbook`. A page that cannot cite a file says so in its "Gaps and
   drift" section instead of guessing.
2. **The code wins.** Where a page and the code disagree, the code is right and
   the page is wrong. Do not quietly patch the code to match the prose: record
   the disagreement in `08-workflow/known-drift.md` and fix it as its own change.

Every page carries exactly two front-matter keys, `title` and `section`, and
ends with `## Where to look` and `## Gaps and drift`.

## Reading orders

Three routes through the handbook, with time estimates, are in
[Reading order](00-start-here/reading-order.md):

- **Understand the stack** — the monorepo, the two processes, {json:api} over
  Neo4j, descriptors, and what the two framework packages already do for you.
- **Ship a feature** — the rulebook, the backend module anatomy, the frontend
  feature anatomy, permissions, translations and tests.
- **Run it in production** — Docker, environments, data stores, secrets,
  observability, release and the runbooks.

## 00-start-here

- [Reading order](00-start-here/reading-order.md) — three routes through the handbook with a time estimate per leg.
- [Repository tour](00-start-here/repo-tour.md) — every top-level directory and root file in one line each.
- [Local setup](00-start-here/local-setup.md) — prerequisites, hosts, environment, the three data stores, first boot, first login.
- [Day-one checklist](00-start-here/day-one-checklist.md) — a numbered walkthrough from boot to reading the rules.
- [Glossary](00-start-here/glossary.md) — framework and infrastructure terms, each with its declaring file.
- [Task index](00-start-here/task-index.md) — "I want to…" mapped to the page that answers it.

## 01-architecture

- [Topology](01-architecture/topology.md) — the processes, the external stores and the trust boundaries.
- [Monorepo and build](01-architecture/monorepo-and-build.md) — pnpm workspaces, the catalog and overrides, Turborepo tasks, the submodules.
- [API and worker modes](01-architecture/api-and-worker-modes.md) — one binary, two modes, and what each one switches on.
- [Request lifecycle](01-architecture/request-lifecycle.md) — a GET and a POST traced from the browser to Cypher and back.
- [Configuration](01-architecture/configuration.md) — the config layers, the `process.env` ban, and every variable by subsystem.
- [Multi-tenancy and security](01-architecture/multi-tenancy-and-security.md) — CLS, company scope, guards and the default match.
- [{json:api} contract](01-architecture/jsonapi-contract.md) — the wire format, inclusion, sparse fieldsets, errors and cursors.
- [Entity descriptors](01-architecture/entity-descriptors.md) — `defineEntity()`, what it derives, and the pieces it does not.
- [Graph model](01-architecture/graph-model.md) — labels, relationship types, global versus company-scoped, and the table you fill in.
- [Queues, crons and workers](01-architecture/queues-crons-and-workers.md) — the queue ids, the processors, the crons and the extension point.
- [Realtime](01-architecture/realtime.md) — the socket gateway, rooms and the events the frontend listens for.
- [Notifications and email](01-architecture/notifications-and-email.md) — the notification entity, push, and the email templates.
- [Decisions](01-architecture/decisions.md) — the choices already baked into the stack, plus the ADR template.

## 02-framework

- [Overview](02-framework/overview.md) — the two packages, how they are consumed, and the submodule versus npm question.
- [Shared package](02-framework/shared-package.md) — what belongs in `packages/shared` and what must not.
- [nestjs-neo4jsonapi: public surface](02-framework/nestjs-neo4jsonapi/public-surface.md) — what the package exports and what each export is for.
- [nestjs-neo4jsonapi: foundations](02-framework/nestjs-neo4jsonapi/foundations.md) — the 43 foundation modules and how they are selected.
- [nestjs-neo4jsonapi: agents and GraphRAG](02-framework/nestjs-neo4jsonapi/agents-and-graphrag.md) — the agent base classes, tools and the retrieval pipeline.
- [nestjs-neo4jsonapi: tooling](02-framework/nestjs-neo4jsonapi/tooling.md) — the generators, the entity migrator and the RBAC path tools.
- [nextjs-jsonapi: public surface](02-framework/nextjs-jsonapi/public-surface.md) — the entry points, the barrel split and the `/core` rule.
- [nextjs-jsonapi: data layer](02-framework/nextjs-jsonapi/data-layer.md) — models, services, `callApi()`, rehydration and the registries.
- [nextjs-jsonapi: components and hooks](02-framework/nextjs-jsonapi/components-and-hooks.md) — the UI primitives, containers and hooks the app inherits.
- [nextjs-jsonapi: tooling](02-framework/nextjs-jsonapi/tooling.md) — the web module generator and the package's own build.
- [Rulebook](02-framework/rulebook/README.md) — the routing table, the non-negotiable rules and the sync obligation.
- [Core principles](02-framework/rulebook/core-principles.md) — rulebook copy.
- [Anti-patterns](02-framework/rulebook/anti-patterns.md) — rulebook copy.
- [Discipline](02-framework/rulebook/discipline.md) — rulebook copy.
- [Date handling](02-framework/rulebook/date-handling.md) — rulebook copy.
- [Decisions](02-framework/rulebook/decisions.md) — rulebook copy.
- [Feature template](02-framework/rulebook/feature-template.md) — rulebook copy.
- [Backend: entity basics](02-framework/rulebook/backend/01-entity-basics.md) — rulebook copy.
- [Backend: DTOs](02-framework/rulebook/backend/02-dtos.md) — rulebook copy.
- [Backend: repositories](02-framework/rulebook/backend/03-repositories.md) — rulebook copy.
- [Backend: services](02-framework/rulebook/backend/04-services.md) — rulebook copy.
- [Backend: controllers](02-framework/rulebook/backend/05-controllers.md) — rulebook copy.
- [Backend: LLM calls](02-framework/rulebook/backend/06-llm-calls.md) — rulebook copy.
- [Backend: template](02-framework/rulebook/backend/template.md) — rulebook copy.
- [Frontend: models](02-framework/rulebook/frontend/01-models.md) — rulebook copy.
- [Frontend: interfaces](02-framework/rulebook/frontend/02-interfaces.md) — rulebook copy.
- [Frontend: services](02-framework/rulebook/frontend/03-services.md) — rulebook copy.
- [Frontend: components](02-framework/rulebook/frontend/04-components.md) — rulebook copy.
- [Frontend: typography](02-framework/rulebook/frontend/05-typography.md) — rulebook copy.
- [Frontend: BlockNote](02-framework/rulebook/frontend/06-blocknote.md) — rulebook copy.
- [Frontend: routes and Cache Components](02-framework/rulebook/frontend/07-routes-and-cache-components.md) — rulebook copy.
- [Frontend: template](02-framework/rulebook/frontend/template.md) — rulebook copy.

The twenty-one rulebook pages are byte-for-byte copies of the `nja` plugin's
architecture references. Edit them in the plugin and re-copy; an edit made here
is lost on the next sync, and the checker skips their citations because those
point at the plugin's own tree.

## 03-backend

- [Bootstrap](03-backend/bootstrap.md) — every `BootstrapOptions` field, the boot order, and what `bootstrap()` does not wire.
- [Module anatomy](03-backend/module-anatomy.md) — a feature module annotated on `apps/api/src/features/essentials/search`.
- [RBAC and permissions](03-backend/rbac-and-permissions.md) — the three identifier spaces, the matrix, and the worker-only reconciler.
- [Token usage and credits](03-backend/token-usage-and-credits.md) — the recorder and validator seams, the credits formula, and the fail-open behaviour.
- [Migrations](03-backend/migrations.md) — the four shipped migrations, the two step kinds, and how to write one.
- [Testing](03-backend/testing.md) — the Vitest configuration, why `oxc` is off, and the absence of any shipped spec.

## 04-frontend

- [App shell and routing](04-frontend/app-shell-and-routing.md) — the route groups, the provider stacks, every route, and what `apps/web/src/proxy.ts` does.
- [Bootstrap and modules](04-frontend/bootstrap-and-modules.md) — `apps/web/src/config/Bootstrapper.ts`, the registries, and module-graph dedup.
- [Feature anatomy](04-frontend/feature-anatomy.md) — a feature annotated on `apps/web/src/features/essentials/search`.
- [Auth and onboarding](04-frontend/auth-and-onboarding.md) — login, registration, activation, invitation, OAuth and the onboarding tour.
- [Access control](04-frontend/access-control.md) — feature ids, module permissions and the client-side gate.
- [UI system](04-frontend/ui-system.md) — Base UI rather than Radix, the primitives, the containers and the composition rules.
- [Realtime, notifications and PWA](04-frontend/realtime-notifications-pwa.md) — the socket client, the notification bell, web push and the service worker.
- [i18n and theme](04-frontend/i18n-and-theme.md) — `next-intl`, the message file, the locale routing and the theme tokens.
- [Admin console](04-frontend/admin-console.md) — the administration route group and what each page administers.
- [Testing](04-frontend/testing.md) — the jsdom Vitest setup and the Playwright suite under `apps/web/tests`.

## 05-foundations

- [Foundations overview](05-foundations/README.md) — what a foundation is, how they are selected, the narrowed-extend pattern, and how to write your own chapter.
- [Chapter template](05-foundations/_template.md) — the twelve-section skeleton as a fill-in page.
- [Identity and tenancy](05-foundations/identity-and-tenancy.md) — company, user, membership, role, auth, discord-user, google-user.
- [Modules, features and RBAC](05-foundations/modules-features-and-rbac.md) — module, feature and rbac as data.
- [Two-factor and OAuth](05-foundations/two-factor-and-oauth.md) — two-factor, oauth.
- [Notifications and push](05-foundations/notifications-and-push.md) — notification, push.
- [Content and storage](05-foundations/content-and-storage.md) — content, s3, chunker, chunk.
- [Knowledge graph and retrieval](05-foundations/knowledge-graph-and-retrieval.md) — atomicfact, keyconcept, community, relevancy.
- [Assistant and actions](05-foundations/assistant-and-actions.md) — assistant, assistant-message, assistant-action, ai-connection.
- [Billing and token usage](05-foundations/billing-and-token-usage.md) — stripe, the nine stripe-\* modules, tokenusage.
- [Audit and activity](05-foundations/audit-and-activity.md) — audit, user-activity.
- [Growth and help](05-foundations/growth-and-help.md) — waitlist, referral, how-to, discord.

## 06-ai

- [LLM layer](06-ai/llm-layer.md) — the entry points, the provider adapters, the modality services, the tiers and the mock gate.
- [Agents](06-ai/agents.md) — the agents the package wires, the tool contract, and the skeleton for agents you add.
- [Evaluation and cost](06-ai/eval-and-cost.md) — the retrieval eval harness, token accounting and the cost variables.

## 07-operations

- [Docker](07-operations/docker.md) — the eleven build stages, the four compose files, the healthchecks and the build-time bake.
- [Deployment](07-operations/deployment.md) — what is deployed, in what order, and what must exist first.
- [Environments](07-operations/environments.md) — local, end-to-end and production, and what differs between them.
- [Data stores](07-operations/data-stores.md) — Neo4j, Redis and S3: what lives in each and how it is reached.
- [Backup and recovery](07-operations/backup-and-recovery.md) — what each store needs, the constraints, and the recovery order.
- [Secrets](07-operations/secrets.md) — every secret-bearing variable and where it is set.
- [Observability](07-operations/observability.md) — pino, Loki, OpenTelemetry, the three health endpoints and the version display.
- [Release](07-operations/release.md) — conventional commits, semantic-release, the CI workflows and the local gates.
- [Runbooks](07-operations/runbooks.md) — the procedures the repository's own scripts support.

## 08-workflow

- [Contributing](08-workflow/contributing.md) — branches, commits, the gates a change must pass, and the review expectations.
- [Conventions](08-workflow/conventions.md) — naming, file layout, imports and formatting.
- [Testing strategy](08-workflow/testing-strategy.md) — what is unit-tested, what is end-to-end tested, and where the line sits.
- [AI-assisted development](08-workflow/ai-assisted-development.md) — the instruction hierarchy, the `nja` plugin, the settings file and the generators.
- [Known traps](08-workflow/known-traps.md) — the failures this stack produces that nothing in the error message explains.
- [Known drift](08-workflow/known-drift.md) — where shipped code and shipped documentation disagree, and which one is right.

## Where to look

| File | Why |
|---|---|
| `README.md` | The repository's front door; the handbook is its documentation section |
| `scripts/check-handbook.mjs` | The checker that enforces rule 1 |
| `CLAUDE.md` | The architecture guardrails, unabridged |
| `package.json` | Every command the handbook refers to |
| `pnpm-workspace.yaml` | The catalog and the overrides, with the reasoning inline |
| `apps/api/src/main.ts` | The whole of the API's own entry point |
| `apps/web/src/config/Bootstrapper.ts` | Where the frontend module registry is populated |
| `packages/shared/src/index.ts` | What the two apps agree on |
| `.env.example` | Every environment variable, grouped by subsystem |
| `apps/web/tests/README.md` | The end-to-end suite this handbook defers to |

## Gaps and drift

- The index lists pages, not headings. Anchors inside a page are not validated
  against this file, so a renamed heading breaks nothing here.
- The twenty-one rulebook pages are excluded from path and link checking. Their
  citations point at the `nja` plugin's tree, which a generated app does not
  contain, so a broken citation inside one of them is invisible to
  `pnpm check:handbook`.
- `pnpm check:handbook` is deliberately not part of `pnpm lint`. Nothing runs it
  automatically; a stale citation survives until someone runs it.
