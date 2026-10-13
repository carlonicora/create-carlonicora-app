---
title: Reading order
section: 00-start-here
---

Three routes through the handbook. Each leg names its pages in order and carries
a time estimate for reading them attentively — not for doing the work they
describe. Nobody needs all three at once; pick the one that matches what you are
about to do.

| Path | For | Total |
|---|---|---|
| 1. Understand the stack | You have just cloned {{display}} and want to know what it is made of | about 3 hours |
| 2. Ship a feature | You have an entity to add and want to add it the way the rest of the code does | about 2 hours 30 minutes |
| 3. Run it in production | You own the deployment, the data or the on-call rota | about 2 hours |

## Path 1 — Understand the stack

You finish this path able to explain where a request goes, why there are two
processes, and what the two `@carlonicora/*` packages already do for you.

### Leg 1 — Get it running (40 minutes)

1. [Local setup](local-setup.md)
2. [Repository tour](repo-tour.md)
3. [Day-one checklist](day-one-checklist.md)

Do not read further until the stack boots and you can log in. Every later page
assumes you can put a breakpoint in it.

### Leg 2 — The shape of the system (45 minutes)

1. [Topology](../01-architecture/topology.md)
2. [Monorepo and build](../01-architecture/monorepo-and-build.md)
3. [API and worker modes](../01-architecture/api-and-worker-modes.md)
4. [Configuration](../01-architecture/configuration.md)

### Leg 3 — The protocol and the data (50 minutes)

1. [{json:api} contract](../01-architecture/jsonapi-contract.md)
2. [Entity descriptors](../01-architecture/entity-descriptors.md)
3. [Graph model](../01-architecture/graph-model.md)
4. [Multi-tenancy and security](../01-architecture/multi-tenancy-and-security.md)
5. [Request lifecycle](../01-architecture/request-lifecycle.md)

Read the request lifecycle last. It is the page that ties the previous four
together, and it is wasted if you read it first.

### Leg 4 — What you already own (35 minutes)

1. [Framework overview](../02-framework/overview.md)
2. [Foundations overview](../05-foundations/README.md)
3. [Glossary](glossary.md)

The foundations overview is the one page that stops you rebuilding something the
application already has.

## Path 2 — Ship a feature

You finish this path able to add an entity end to end: Neo4j label, endpoints,
permissions, frontend feature, translations and tests.

### Leg 1 — The rules (30 minutes)

1. [Rulebook](../02-framework/rulebook/README.md)
2. [Core principles](../02-framework/rulebook/core-principles.md)
3. [Anti-patterns](../02-framework/rulebook/anti-patterns.md)

These are non-negotiable and they are shorter than the time you will spend
undoing a violation.

### Leg 2 — The backend (45 minutes)

1. [Entity descriptors](../01-architecture/entity-descriptors.md)
2. [Module anatomy](../03-backend/module-anatomy.md)
3. [Backend: entity basics](../02-framework/rulebook/backend/01-entity-basics.md)
4. [Backend: repositories](../02-framework/rulebook/backend/03-repositories.md)
5. [Backend: controllers](../02-framework/rulebook/backend/05-controllers.md)
6. [Migrations](../03-backend/migrations.md)

### Leg 3 — The frontend (45 minutes)

1. [Bootstrap and modules](../04-frontend/bootstrap-and-modules.md)
2. [Feature anatomy](../04-frontend/feature-anatomy.md)
3. [Frontend: models](../02-framework/rulebook/frontend/01-models.md)
4. [Frontend: services](../02-framework/rulebook/frontend/03-services.md)
5. [UI system](../04-frontend/ui-system.md)
6. [i18n and theme](../04-frontend/i18n-and-theme.md)

### Leg 4 — Gates and tests (30 minutes)

1. [RBAC and permissions](../03-backend/rbac-and-permissions.md)
2. [Access control](../04-frontend/access-control.md)
3. [Testing strategy](../08-workflow/testing-strategy.md)
4. [Contributing](../08-workflow/contributing.md)

Permissions are the step most often skipped. An entity nobody can read is
indistinguishable from an entity that does not work.

## Path 3 — Run it in production

You finish this path able to deploy, watch and recover the application.

### Leg 1 — What runs where (40 minutes)

1. [Topology](../01-architecture/topology.md)
2. [Docker](../07-operations/docker.md)
3. [Environments](../07-operations/environments.md)

### Leg 2 — State and secrets (35 minutes)

1. [Data stores](../07-operations/data-stores.md)
2. [Secrets](../07-operations/secrets.md)
3. [Configuration](../01-architecture/configuration.md)

### Leg 3 — Watching it (25 minutes)

1. [Observability](../07-operations/observability.md)
2. [Queues, crons and workers](../01-architecture/queues-crons-and-workers.md)

### Leg 4 — Shipping and repairing (30 minutes)

1. [Release](../07-operations/release.md)
2. [Backup and recovery](../07-operations/backup-and-recovery.md)
3. [Runbooks](../07-operations/runbooks.md)
4. [Known traps](../08-workflow/known-traps.md)

Read the traps page before your first incident, not during it.

## When you are stuck rather than learning

[Task index](task-index.md) answers "I want to…" in one hop and ignores all
three paths. Use it when you know the task and not the page.

## Where to look

| File | Why |
|---|---|
| `docs/handbook/README.md` | The full page list, grouped by section |
| `docs/handbook/00-start-here/task-index.md` | The alternative to reading in order |
| `docs/handbook/00-start-here/local-setup.md` | Leg 1 of every path in practice |
| `README.md` | The commands each leg tells you to run |
| `CLAUDE.md` | The guardrails the rulebook legs expand on |
| `apps/api/src/main.ts` | The smallest file that shows how the backend starts |
| `apps/web/src/config/Bootstrapper.ts` | The smallest file that shows how the frontend starts |
| `apps/api/src/features/essentials/search` | The one shipped backend feature every backend leg refers to |
| `apps/web/src/features/essentials/search` | Its frontend counterpart |
| `scripts/check-handbook.mjs` | What breaks when a page's citation goes stale |

## Gaps and drift

- The time estimates are reading estimates, measured against page length rather
  than observed. They are not calibrated against a real reader.
- No path covers the AI layer or the assistant. Those pages sit outside all
  three routes because a generated application can ship without ever configuring
  a provider; start at the LLM layer page when you need them.
- Path 2 assumes the entity is company-scoped and CRUD-shaped. An entity that is
  global, or that needs endpoints beyond CRUD, needs the repository and service
  rulebook pages as well, which no leg lists.
