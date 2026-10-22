---
title: Task index
section: 00-start-here
---

"I want to…", answered in one hop. Each row names the page that governs the
task and, where one exists, the file to copy. When two pages are listed, read
them in the order given: the first tells you what to do, the second what not to.

For a route through the handbook rather than a single answer, use
[Reading order](reading-order.md).

## Entities and data

| I want to… | Read | Copy from |
|---|---|---|
| Add a field to an entity | [Entity descriptors](../01-architecture/entity-descriptors.md), then [Backend: entity basics](../02-framework/rulebook/backend/01-entity-basics.md) | `apps/api/src/features/essentials/search/entities/search.meta.ts` |
| Add a new entity end to end | [Module anatomy](../03-backend/module-anatomy.md), then [Feature anatomy](../04-frontend/feature-anatomy.md) | `apps/api/src/features/essentials/search` and `apps/web/src/features/essentials/search` |
| Add a relationship between two entities | [Entity descriptors](../01-architecture/entity-descriptors.md) | The relationships block of any foundation descriptor |
| Make an entity global instead of company-scoped | [Multi-tenancy and security](../01-architecture/multi-tenancy-and-security.md) | — |
| Add a second descriptor for an existing label (a portal view, a count, a lookup) | [Multi-tenancy and security](../01-architecture/multi-tenancy-and-security.md#one-rule-per-label-and-isprojection) | `isProjection: true` and a comment naming the owner |
| Change what the graph looks like | [Graph model](../01-architecture/graph-model.md) | — |
| Write a migration | [Migrations](../03-backend/migrations.md) | `apps/api/src/neo4j.migrations/20250901_003.ts` |
| Extend the user entity | [Identity and tenancy](../05-foundations/identity-and-tenancy.md), then `EXTEND-USER.md` | — |

Adding an entity is four registrations, not one: the backend module in
`apps/api/src/features/features.modules.ts`, the module id in
`packages/shared/src/const/module.id.ts`, the `Module` node in a migration, and
the frontend module in `apps/web/src/config/Bootstrapper.ts`. Missing any one of
them produces a different and unhelpful failure.

## Foundations

| I want to… | Read |
|---|---|
| Find out whether the application already has this | [Foundations overview](../05-foundations/README.md) |
| Exclude a foundation I do not want | [Foundations overview](../05-foundations/README.md), then [Bootstrap](../03-backend/bootstrap.md) |
| Narrow a foundation rather than replace it | [Foundations overview](../05-foundations/README.md) |
| Document a foundation-sized area of my own | [Chapter template](../05-foundations/_template.md) |

Excluding a foundation is a `bootstrap()` option, not a deletion. Its frontend
counterpart in `apps/web/src/config/Bootstrapper.ts` has to go with it.

## Background work

| I want to… | Read |
|---|---|
| Add a queue job | [Queues, crons and workers](../01-architecture/queues-crons-and-workers.md), then [API and worker modes](../01-architecture/api-and-worker-modes.md) |
| Add a cron | [Queues, crons and workers](../01-architecture/queues-crons-and-workers.md) |
| Work out why a job never runs | [API and worker modes](../01-architecture/api-and-worker-modes.md), then [Known traps](../08-workflow/known-traps.md) |

A new queue is an entry in `apps/api/src/config/enums/queue.id.ts` and a job name
in `apps/api/src/config/enums/job.name.ts`; both reach the framework through
`apps/api/src/config/config.ts`. Processors and crons run in the worker only, and
the code inside them has to run in a CLS context that marks it as an automated
job.

## Permissions and access

| I want to… | Read |
|---|---|
| Add a permission for a new module | [RBAC and permissions](../03-backend/rbac-and-permissions.md) |
| Add a role | [RBAC and permissions](../03-backend/rbac-and-permissions.md), then [Modules, features and RBAC](../05-foundations/modules-features-and-rbac.md) |
| Gate a page or a control in the frontend | [Access control](../04-frontend/access-control.md) |
| Add a feature flag | [Access control](../04-frontend/access-control.md) |
| Understand why a user cannot see something | [Multi-tenancy and security](../01-architecture/multi-tenancy-and-security.md), then [Access control](../04-frontend/access-control.md) |

System role ids live in `packages/shared/src/const/system.roles.id.ts`, and
`apps/web/src/enums/feature.ids.ts` holds the feature enumeration.

## Frontend

| I want to… | Read |
|---|---|
| Add a page or a route group | [App shell and routing](../04-frontend/app-shell-and-routing.md) |
| Add a table to a list page | [UI system](../04-frontend/ui-system.md), then [Frontend: components](../02-framework/rulebook/frontend/04-components.md) |
| Add a translation key | [i18n and theme](../04-frontend/i18n-and-theme.md) |
| Add a locale | [i18n and theme](../04-frontend/i18n-and-theme.md) |
| Change the theme | [i18n and theme](../04-frontend/i18n-and-theme.md), then [UI system](../04-frontend/ui-system.md) |
| Style text correctly | [Frontend: typography](../02-framework/rulebook/frontend/05-typography.md) |
| Call the API from a component | [nextjs-jsonapi: data layer](../02-framework/nextjs-jsonapi/data-layer.md), then [Frontend: services](../02-framework/rulebook/frontend/03-services.md) |
| Add something to the administration console | [Admin console](../04-frontend/admin-console.md) |

Keys go in `apps/web/messages/en.json`, the only catalogue the application ships.
The base UI library is Base UI, not Radix: there is no `asChild`, and composition
goes through the `render` prop.

## AI

| I want to… | Read |
|---|---|
| Add an LLM call | [LLM layer](../06-ai/llm-layer.md), then [Backend: LLM calls](../02-framework/rulebook/backend/06-llm-calls.md) |
| Add an agent | [Agents](../06-ai/agents.md) |
| Give an agent a tool | [Agents](../06-ai/agents.md) |
| Change which model a call uses | [LLM layer](../06-ai/llm-layer.md), then [Configuration](../01-architecture/configuration.md) |
| Find out what a feature costs to run | [Evaluation and cost](../06-ai/eval-and-cost.md), then [Token usage and credits](../03-backend/token-usage-and-credits.md) |

Prompts are written in English, always, whatever the application's interface
language. Every schema field an LLM fills needs a description.

## Billing

| I want to… | Read |
|---|---|
| Wire Stripe | [Billing and token usage](../05-foundations/billing-and-token-usage.md), then [Secrets](../07-operations/secrets.md) |
| Charge for AI usage | [Token usage and credits](../03-backend/token-usage-and-credits.md) |
| Add a product or a price | [Billing and token usage](../05-foundations/billing-and-token-usage.md) |

## Configuration and operations

| I want to… | Read |
|---|---|
| Change a config value | [Configuration](../01-architecture/configuration.md) |
| Add a new environment variable | [Configuration](../01-architecture/configuration.md), then [Secrets](../07-operations/secrets.md) |
| Run the end-to-end suite | [Testing](../04-frontend/testing.md), then `apps/web/tests/README.md` |
| Write an end-to-end spec | [Testing](../04-frontend/testing.md) |
| Deploy | [Deployment](../07-operations/deployment.md), then [Docker](../07-operations/docker.md) |
| Cut a release | [Release](../07-operations/release.md) |
| Restore from a backup | [Backup and recovery](../07-operations/backup-and-recovery.md) |
| Add a metric, a log or a trace | [Observability](../07-operations/observability.md) |
| Upgrade dependencies | [Contributing](../08-workflow/contributing.md), then `DEPENDENCY_UPGRADE_GUIDE.md` |

Never read the process environment directly. Configuration comes from
`packages/nestjs-neo4jsonapi/src/config/base.config.ts`, merged with
`apps/api/src/config/config.ts`, and reaches code through the config service.

## When something is broken

| I want to… | Read |
|---|---|
| Debug a failing boot | [Bootstrap](../03-backend/bootstrap.md), then [Known traps](../08-workflow/known-traps.md) |
| Work out why every route returns 404 | [Known traps](../08-workflow/known-traps.md) |
| Work out why a shipped document disagrees with the code | [Known drift](../08-workflow/known-drift.md) |
| Check whether a dependency is duplicated | [Monorepo and build](../01-architecture/monorepo-and-build.md) |
| Run the health checks | [Observability](../07-operations/observability.md), then [Local setup](local-setup.md) |
| Reset the development stack | [Runbooks](../07-operations/runbooks.md) |

A boot failure naming a NestJS injection token that looks unrelated to your
change is almost always a duplicated package in the dependency tree. A dev server
returning 404 on every route is almost always a production build in the shared
Next.js directory; `pnpm dev:reset` fixes it.

## Working with an agent

| I want to… | Read |
|---|---|
| Understand the instruction hierarchy | [AI-assisted development](../08-workflow/ai-assisted-development.md), then `CLAUDE.md` |
| Scaffold a module with a generator | [nestjs-neo4jsonapi: tooling](../02-framework/nestjs-neo4jsonapi/tooling.md) and [nextjs-jsonapi: tooling](../02-framework/nextjs-jsonapi/tooling.md) |
| Drive a browser from the command line | [AI-assisted development](../08-workflow/ai-assisted-development.md) |

## Where to look

| File | Why |
|---|---|
| `docs/handbook/README.md` | The full page list this index shortcuts |
| `apps/api/src/features/essentials/search` | The only shipped backend feature, and the one to copy |
| `apps/web/src/features/essentials/search` | Its frontend counterpart |
| `apps/api/src/features/features.modules.ts` | Where a backend feature module is registered |
| `apps/web/src/config/Bootstrapper.ts` | Where a frontend module is registered |
| `packages/shared/src/const/module.id.ts` | Where a module id is declared |
| `apps/web/messages/en.json` | Where a translation key goes |
| `apps/api/src/config/enums/queue.id.ts` | Where a queue is declared |
| `.env.example` | Where a new environment variable is documented |
| `CLAUDE.md` | The guardrails every row here assumes you have read |

## Gaps and drift

- Rows point at pages, not at procedures. A task whose page has not been written
  yet — anything in the product domain of {{display}} — has no row here.
- Several rows name two pages because the task genuinely spans backend and
  frontend. None of them names the migration, the module id and the bootstrapper
  in full; the module-anatomy page does.
- This index is maintained by hand. Nothing checks that a row's advice still
  matches the page it links to, only that the link resolves.
