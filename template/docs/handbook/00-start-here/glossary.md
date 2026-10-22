---
title: Glossary
section: 00-start-here
---

Framework and infrastructure vocabulary only. Every term here comes from the
stack {{display}} was scaffolded with, and every entry names the file that
declares it. Nothing in this page is product vocabulary; when {{display}} grows
its own nouns, give them their own page rather than adding them here.

Terms are grouped by the layer they belong to. Within a group they are ordered so
each one only depends on terms above it.

## Entities and the graph

### Descriptor

The single declaration of an entity: its {json:api} identity, its fields, its
relationships, its computed and virtual fields, and whether it is company-scoped.
Written with `defineEntity()` in
`packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts`. From one
descriptor the framework derives the Cypher mapper, the serialiser class, the
relationship metadata and the OpenAPI schema. A descriptor replaces the
hand-written entity, mapper, serialiser and model files an older codebase would
have needed.

### `DataMeta`

The four strings that identify an entity everywhere: `type` (the {json:api}
type), `endpoint` (the URL segment), `nodeName` (the Cypher alias) and
`labelName` (the Neo4j label). Declared in
`packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts`.
The application's one example is
`apps/api/src/features/essentials/search/entities/search.meta.ts`, whose values
are `searches` / `searches` / `search` / `Search`.

`labelName` is the Neo4j label; `type` is the registry key. They are not
interchangeable, and two entities that share a `nodeName` while differing in
`type` is a known hazard.

### Alias descriptor

A second descriptor over the same entity with different `DataMeta` — the same
label, fields and relationships appearing under another {json:api} type. Created
with `defineEntityAlias()` in
`packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts`. It exists so
one label can appear as several relationship endpoints: a `User` reached as an
owner, an author or an assignee is one node and three aliases.

### Edge property

A field stored on a relationship rather than on either node. Declared as
`fields` on a relationship inside a descriptor
(`packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts`),
supported only for `cardinality: "one"`. `defineEntity()` turns each one into a
computed field read from an aliased Cypher column, and they surface in the
relationship's `meta`, never in the entity's own attributes.

### `dtoKey`

An override on a relationship definition that renames the key used on the wire
and in the DTO, leaving the descriptor's own key alone. Declared in
`packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts`.
It changes the contract, so two relationships whose effective keys collide lose
one of them silently.

### Serialiser

The object that turns an entity into a {json:api} resource. Almost never written
by hand: `defineEntity()` generates one per descriptor, a subclass of
`DescriptorBasedSerialiser`
(`packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts`).
A descriptor supplies its own only for transformations the descriptor cannot
express, such as signing a storage URL.

### Global entity

An entity that belongs to no company. Declared by setting
`isCompanyScoped: false` on its descriptor. The default is company-scoped, so
this is an opt-out, and getting it wrong in either direction is a data-visibility
bug rather than a compile error.

## Tenancy and access

### CLS

Continuation-local storage, provided by `nestjs-cls`. Per-request state that any
service can read without it being threaded through every signature. The keys
this stack sets are `userId`, `companyId`, `isAutomatedJob` and logging context;
`SecurityService` in
`packages/nestjs-neo4jsonapi/src/core/security/services/security.service.ts` is
the main reader.

### Company scope

The tenancy rule: a company-scoped entity is only ever read or written inside
the company held in the CLS context. It is enforced centrally, by
`buildDefaultMatch()` in
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts`,
which injects the company filter into the query. A repository that builds its own
`MATCH` without it is not a style problem; it is a tenancy leak.

### Link scope

The `linkScope` setting on a descriptor, declared in
`packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts`.
Its one value, `"own-or-platform"`, is for an entity that mixes platform rows,
which have no company edge, with rows a company owns: a relationship write may
point at a platform row or at one of the caller's own, never at another
company's. It is valid only on a company-scoped or `tenancy: { via }` entity, and
the package's example is `Role`. Without it, a company-scoped target must belong
to the caller's company.

### Projection descriptor

A second descriptor over a label another descriptor owns — a portal view, a count
or a lookup — declared with `isProjection: true` in
`packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts`.
A projection does not register the label's tenancy, so only the owner decides
what a relationship write to that label is checked against. Without the flag, a
projection whose tenancy differs from the owner's stops the API at boot.

### Automated job

Code running outside any request — a queue processor or a cron. It has no user
and no company, so `SecurityService` returns an empty scope rather than throwing
when `isAutomatedJob` is set in the CLS context. Worker code must therefore run
inside a CLS context that sets it; without one, the access check crashes.

### Module id

The UUID of a `Module` node in Neo4j, and the identity a feature registers its
descriptors against. The application's ids are in
`packages/shared/src/const/module.id.ts` and the nodes are seeded by
`apps/api/src/neo4j.migrations/20250901_002.ts`. Ids rather than names, so
renaming a module in the migration cannot silently unlink it.

### Feature id

A coarser switch than a module id: a string naming a slice of the product that
can be turned on or off for a company, gating whole areas of the frontend. The
application's enumeration is `apps/web/src/enums/feature.ids.ts`, which ships
with exactly one value, `Core`.

Module id and feature id are different identifier spaces. A module id is a UUID
and addresses permissions; a feature id is a short string and addresses
availability.

## The wire

### Cursor

The {json:api} pagination token. Opaque to the client; it encodes the position in
the ordered result rather than an offset, which is why the protocol has no
`page[offset]`.

### `{CURSOR}`

The literal placeholder a repository writes into a paginated Cypher query where
the skip and limit belong. The framework substitutes it —
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts`
and `packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` — and
in the process it also runs the companion count query. Hand-written `SKIP` and
`LIMIT` produce a result that paginates but reports the wrong total.

### Rehydration

Turning a plain {json:api} payload back into typed model instances on the
frontend: `rehydrate()` and `rehydrateList()` in
`packages/nextjs-jsonapi/src/core/utils/rehydrate.ts`, which look the class up in
the model registry by the module's name. Every response crosses this boundary, so
a model that is not registered is a runtime error rather than a type error.

### Dehydration

The inverse: flattening a model instance into the plain object shape that can
cross the server-to-client boundary. Declared on `AbstractApiData` in
`packages/nextjs-jsonapi/src/core/abstracts/AbstractApiData.ts`. A server
component fetches and dehydrates; the client rehydrates.

## The frontend registries

### Module factory

The function an application passes to every module definition, which turns the
module's description into a `ModuleWithPermissions`. The application's
implementation is the local `moduleFactory` in
`apps/web/src/config/Bootstrapper.ts`; its type is `ModuleFactory` in
`packages/nextjs-jsonapi/src/permissions/types.ts`. Defining it in the
application is what lets one place decide identifier fields, icons and inclusions
for every module at once.

### `ModuleWithPermissions`

What a module is, once built: a name, a model class, an optional page URL, an
optional feature id, an optional module id, an icon and the inclusion defaults
for its requests. Declared in
`packages/nextjs-jsonapi/src/permissions/types.ts`.

### Module registry

The name-to-module map the frontend resolves every request and route through:
`ModuleRegistry` in
`packages/nextjs-jsonapi/src/core/registry/ModuleRegistry.ts`. It is stored on
`globalThis` under a symbol so hot reloading does not empty it, and it declares
the full set of framework modules as `FoundationModuleDefinitions`, which the
application augments rather than replaces.

### Model registry

The parallel map from module name to model constructor, used by rehydration:
`DataClassRegistry` in
`packages/nextjs-jsonapi/src/core/registry/DataClassRegistry.ts`. Last
registration wins, deliberately, so an edited model class takes effect in a
long-running dev server.

### Bootstrapper

The application function that fills both registries. In {{display}} it is
`bootstrap()` in `apps/web/src/config/Bootstrapper.ts`, and it registers itself
with `setBootstrapper()` at import time so the registry can call it if a module
is read before it has run. Its `bootstrapped` flag is module-level state, which
is why the file must not be imported through a barrel that changes its identity.

## Runtime

### Foundation

A module the framework ships whole — entity, repository, service, controller,
permissions and, usually, a frontend counterpart. There are 43 of them under
`packages/nestjs-neo4jsonapi/src/foundations`, covering identity, tenancy,
storage, notifications, billing, the assistant and more. An application receives
them at boot and either uses, narrows or excludes each one; it does not
reimplement them.

### Worker mode

The second of the two modes the single API binary runs in. `getAppMode()` in
`packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts` reads `--mode=worker`
from the command line, and `getAppModeConfig()` turns that into the switches that
enable queue processors and cron jobs and disable the HTTP controllers. The Neo4j
migrator runs in this mode and only this mode.

### Token tier

One of three named chat configurations — `ai`, `aiLite` and `aiLarge` — built by
`buildAiTier()` in
`packages/nestjs-neo4jsonapi/src/config/base.config.ts` from the `AI_*`
environment variables and their `_LITE` and `_LARGE` suffixes. A tier that names
no provider of its own inherits the base tier field by field; a tier that names a
different provider inherits nothing, because the base credentials point at the
wrong service.

### Credit

The billing unit shown to customers: a fractional conversion of the real euro
cost of an AI call, defined in
`packages/nestjs-neo4jsonapi/src/config/interfaces/config.credits.interface.ts`
as `credits = max(minCreditsPerRecord, round4(cost / creditCost))`. Driven by
`CREDIT_COST` and `CREDIT_MINIMUM`. A `creditCost` of zero — which is what an
application that never sets `CREDIT_COST` gets — disables credits entirely:
usage is still recorded, no balance is deducted.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts` | `defineEntity()`, `defineEntityAlias()`, and everything derived from a descriptor |
| `packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts` | `DataMeta` and the relationship metadata |
| `packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts` | Every field a descriptor can declare, `dtoKey` and edge fields included |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | `buildDefaultMatch()` and the cursor substitution |
| `packages/nestjs-neo4jsonapi/src/core/security/services/security.service.ts` | What the CLS context is read for |
| `packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts` | `getAppMode()` and the mode switches |
| `packages/nestjs-neo4jsonapi/src/config/base.config.ts` | The tiers, and every environment default |
| `packages/nextjs-jsonapi/src/core/registry/ModuleRegistry.ts` | The module registry and the framework module list |
| `packages/nextjs-jsonapi/src/core/registry/DataClassRegistry.ts` | The model registry |
| `apps/web/src/config/Bootstrapper.ts` | The module factory and the bootstrapper, in the application |

## Gaps and drift

- Entries were written from the declaring files, not from the runtime. Where a
  term has several call sites, only the declaration and the primary reader were
  read.
- Cursor encoding is described by its contract, not its implementation. The
  format of the token itself was not examined.
- The three token tiers are chat tiers. The embedder, transcriber, vision, audio
  and image configurations follow their own fallback rules, which this entry does
  not state.
- Several terms — descriptor, foundation, company scope — have a chapter of their
  own elsewhere in the handbook. This page defines them; it does not explain how
  to use them.
