---
title: Module anatomy
section: 03-backend
---

An API feature module is a directory under `apps/api/src/features/` holding one
entity's meta, DTOs, repository, service, controller and Nest module. The
template ships exactly one — `apps/api/src/features/essentials/search/` — and it
is deliberately atypical: it has no entity descriptor, no CRUD, and no Neo4j
node of its own. This page annotates it file by file because it is the only real
example in the app, then shows the shape a normal CRUD module takes by reading
three foundations out of the package.

## Layout

```
apps/api/src/features/essentials/search/
├── controllers/
│   └── search.controller.ts
├── dtos/
│   └── search.dto.ts
├── entities/
│   └── search.meta.ts
├── repositories/
│   └── search.repository.ts
├── services/
│   └── search.service.ts
└── search.module.ts
```

One directory per layer, singular file names matching the feature, and the Nest
module at the root. `pnpm generate-module` emits this same shape plus an entity
descriptor, three DTOs and four spec files.

## `entities/search.meta.ts`

```ts
export const searchMeta: DataMeta = {
  type: "searches",
  endpoint: "searches",
  nodeName: "search",
  labelName: "Search",
};
```

`DataMeta` is four strings and nothing else
(`packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts`).
Every layer imports the meta rather than repeating any of the four, which is why
renaming an endpoint is a one-line change.

| Field | Used for |
|---|---|
| `type` | The {json:api} `data.type` on the wire. Indexed case-insensitively by `modelRegistry` and matched by `getByType`, so it must be unique across the whole app. |
| `endpoint` | The route path. Controllers write `@Get(searchMeta.endpoint)`; `@CacheInvalidate` uses it as the cache key prefix. Never hard-code a route string. |
| `nodeName` | The Cypher alias and the primary `modelRegistry` key. `AbstractRepository.buildDefaultMatch()` emits `MATCH (${nodeName}:${labelName})` and every derived alias is built from it. Because it is the primary registry key, two descriptors sharing a `nodeName` shadow each other. |
| `labelName` | The Neo4j node label. Also the second registry index, the value `@Audit` records as `entityType`, and the key `pnpm generate:rbac-paths` joins against `apps/api/src/rbac/module-id.map.json`. |

`searchMeta` declares `nodeName: "search"` and `labelName: "Search"` even though
no `:Search` node is ever created. Nothing reads them here; only `endpoint` is
used, by the controller.

## `dtos/search.dto.ts`

```ts
export class SearchQueryDTO {
  @IsNotEmpty() @IsString() term: string;
  @IsOptional() @IsString() types?: string;
}
```

A correct `class-validator` DTO that **nothing imports**. The controller takes
`@Query("term") term: string` and `@Query("types") types?: string` as bare
parameters, so the global `ValidationPipe` never sees this class and the
`@IsNotEmpty()` never runs — the controller re-implements the empty check by
hand. Recorded in Gaps and drift below; the file is left as written.

The general rule the rest of the codebase follows: DTOs validate **bodies** for
`POST`/`PUT`/`PATCH`. `GET` filters arrive as bare `@Query()` params, and any
enum-valued one must be checked against a closed allowlist in the controller —
see the allowlists at the top of
`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/controllers/tokenusage.admin.controller.ts`,
where the values select a Cypher clause rather than binding to a parameter.

## `repositories/search.repository.ts`

The largest file in the feature, and the only one with real behaviour.

**Index reconciliation on `OnModuleInit`.** `manageSearchIndex()` runs `SHOW
INDEXES` filtered to a `FULLTEXT` node index named `search_index`, compares the
existing labels and properties against the two module-scope constants, and when
either differs runs `DROP INDEX … IF EXISTS` followed by `CREATE FULLTEXT INDEX
…` inside `neo4j.executeInTransaction`. Comparison is order-insensitive
(`arraysEqual` sorts copies of both arrays). A failure is logged and rethrown,
so a broken index fails the boot rather than degrading silently.

**The two module-scope constants.**

| Constant | Value | Meaning |
|---|---|---|
| `EXPECTED_SEARCH_LABELS` | `[]` | The node labels the index spans. **Empty by design.** A fresh app has no searchable entity, so `manageSearchIndex()` short-circuits with `Search index management skipped: no labels configured` and `find()` filters every requested type out. |
| `EXPECTED_PROPERTIES` | `["name", "number", "address", "first_name", "last_name"]` | The properties indexed on each label. Populated, but inert while the label list is empty. |

Add your labels to `EXPECTED_SEARCH_LABELS` and the index is created on the next
boot; the constants are the whole configuration surface.

**Lucene escaping.** `find()` escapes the caller's term before wrapping it:

```ts
const escapedTerm = params.term.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
const searchTerm = `*${escapedTerm.toLowerCase()}*`;
```

`db.index.fulltext.queryNodes` parses its argument as a Lucene query, so every
Lucene operator in user input has to be backslash-escaped or a stray `(` throws
a parser error and a `*` silently changes the query's meaning. The leading and
trailing `*` are added **after** escaping, which is what makes them the only
wildcards that survive.

**Company scoping through CLS.** The repository does not extend
`AbstractRepository`, so it gets no `buildDefaultMatch()`. It scopes by hand:

```ts
const companyId = this.clsService.get("companyId");
...
MATCH (company:Company {id: $companyId})
CALL db.index.fulltext.queryNodes("search_index", $term)
YIELD node, score
WHERE (node)-[:BELONGS_TO]->(company)
```

`companyId` is put into CLS by `JwtAuthGuard.handleRequest` from the JWT claim
(falling back to the `x-companyid` header), so a request that never passed the
guard has no company and the `MATCH` yields nothing. Hand-written scoping is the
exception, not the pattern — a module with a descriptor gets the same guarantee
for free from `buildDefaultMatch()`.

Note the type filter is appended as a second `WHERE` after a `WITH`, and the
allowed types are intersected with `EXPECTED_SEARCH_LABELS` before the query
runs, so an arbitrary label can never reach Cypher. The index name is
interpolated from a module constant; everything caller-supplied is a bound
parameter.

**The result interface.** `SearchResult` is `{ id, name, type, score }`, exported
from the repository and re-exported through the service's signature. `name` is a
`COALESCE` over `node.name`, `first_name + ' ' + last_name`, `node.number`,
`node.address` and `''`, so a node without any of them still returns a row. The
query is `ORDER BY score DESC LIMIT 25` — a fixed cap, no cursor.

## `services/search.service.ts`

Eight lines. One method, `search(params)`, forwarding to
`searchRepository.find(params)`.

It earns its place anyway: the controller must never touch a repository, and the
service is where the {json:api} envelope would be built by
`JsonApiService.buildList(...)` in a module that has a model. Search has no
model, so the controller shapes the response instead.

## `controllers/search.controller.ts`

```ts
@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  @Get(searchMeta.endpoint)
  async search(@Res() reply: FastifyReply, @Query("term") term: string, @Query("types") types?: string) { … }
}
```

**`@UseGuards(JwtAuthGuard)` at class level.** Every route on the controller is
authenticated. The guard also populates CLS with `userId`, `companyId`, `roles`,
`language`, `token` and `ipAddress` — which is why the repository can read
`companyId` without being handed one. A guard at method level would authenticate
that method only; the class-level form is what the rest of the codebase uses
unless one route is deliberately public.

**`@Controller()` with an empty prefix.** The path comes from
`searchMeta.endpoint` on the `@Get`, not from the controller prefix. Both styles
exist in the package; the empty-prefix form is what lets one controller serve
several endpoint families (`tokenusages/reports/*` alongside
`tokenusages/administration/*`) without a shared prefix.

**The `@Res()` reply pattern.** The handler takes a `FastifyReply` and calls
`reply.send(...)` rather than returning a value. Taking `@Res()` opts the route
out of Nest's response pipeline, so the handler owns the response entirely and
any `return` value is ignored. That is the convention across this codebase — the
CRUD handlers in the next section are built around it, every one of them taking
`reply` as its first argument. Mixing the two (taking `@Res()` and returning a
body) produces a request that never completes.

The short-circuit for a blank term returns `reply.send({ data: [] })` — a valid
empty {json:api} document, not a 400.

**The `import type { FastifyReply }` comment.** The file carries this:

> `import type`: FastifyReply is an interface used in a decorated method
> signature. Under TS 6 with `isolatedModules` + `emitDecoratorMetadata` a value
> import is TS1272. Safe here because nothing injects it — it arrives via
> `@Res()`, so erasing the runtime binding costs nothing.

`emitDecoratorMetadata` makes the compiler emit `design:paramtypes` referencing
every parameter type, which turns a type-only import into a runtime value
reference; `isolatedModules` then rejects it as TS1272 because a single-file
transpiler cannot know the import was type-only. `import type` erases it. The
trade-off is that the erased binding is unavailable for DI — harmless for
`@Res()`, wrong for anything you actually want injected by type. Package
controllers that import `FastifyReply` as a value do so under a different
`tsconfig`; follow the form in the file you are editing.

## `search.module.ts`

```ts
@Module({
  controllers: [SearchController],
  providers: [SearchRepository, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
```

Controller, repository and service registered; the service exported so another
module can inject it. No `imports` — `Neo4jService` and `ClsService` are both
global. No `onModuleInit`, because there is no descriptor to register.

`SearchModule` reaches the app through `apps/api/src/features/features.modules.ts`,
which `apps/api/src/main.ts` hands to `bootstrap({ appModules })`.

## Variants — what a full CRUD module looks like

Search omits the two things that define a normal module: an entity descriptor
and the abstract base classes. Three foundations show the full shape.

### The descriptor is the module

`packages/nestjs-neo4jsonapi/src/foundations/role/entities/role.ts`:

```ts
export const RoleDescriptor = defineEntity<Role>()({
  ...roleMeta,
  fields: {
    name: { type: "string", required: true },
    description: { type: "string" },
    isSelectable: { type: "boolean" },
    requiredFeature: { type: "string" },
  },
  relationships: {
    feature: {
      model: featureMeta,
      direction: "out",
      relationship: "RELATED_TO",
      cardinality: "one",
      dtoKey: "requiredFeature",
    },
  },
});
```

`defineEntity()` spreads the meta, then derives the mapper, the serialiser, the
relationship tokens, the `id` uniqueness constraint and the fulltext index from
the field and relationship declarations. `RoleDescriptor.model` is the
`DataModelInterface` every other layer consumes, and
`RoleDescriptor.model.serialiser` is a provider class.

`packages/nestjs-neo4jsonapi/src/foundations/how-to/entities/how-to.ts` adds two
things Role does not: `isCompanyScoped: false`, which tells
`buildDefaultMatch()` to skip the `BELONGS_TO` filter for a globally shared
entity, and a `computed` block that derives `relevance` from a `score` column
the Cypher projects.

### Repository and service extend the abstracts

`packages/nestjs-neo4jsonapi/src/foundations/user/repositories/user.repository.ts`
is the reference:

```ts
export class UserRepository extends AbstractRepository<User, typeof UserDescriptor.relationships> {
  protected readonly descriptor = UserDescriptor;
  …
}
```

The descriptor is an **initialised class field**, not a registry lookup: Nest
constructs providers long before `onModuleInit`, where models are registered, so
a lookup at construction time returns `undefined`. Subclassing the repository in
an app and redeclaring `descriptor` is what makes every inherited generic method
resolve the extended model.

`AbstractRepository.onModuleInit` creates the constraints and indexes the
descriptor declares. Anything beyond them — User's `email` UNIQUE constraint —
is added in the subclass's own `onModuleInit`. Where a domain method's name
would collide with inherited CRUD, the foundation renames it
(`createUser`/`putUser`/`deleteUser`) rather than shadowing the generic one.

`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/services/tokenusage.service.ts`
carries the matching service note: every member is `protected` rather than
`private` precisely so a subclass can reuse it, because TypeScript forbids a
subclass from redeclaring a name the base holds privately (TS2415).

### `createCrudHandlers()` and `createRelationshipHandlers()`

`packages/nestjs-neo4jsonapi/src/foundations/how-to/controllers/how-to.controller.ts`
is the fullest example in the package:

```ts
@UseGuards(JwtAuthGuard)
@Controller()
export class HowToController {
  private readonly crud = createCrudHandlers(() => this.howToService);
  private readonly relationships = createRelationshipHandlers(() => this.howToService);
  …
}
```

Both factories take a **lambda** returning the service, not the service itself,
because the class field initialises before the constructor assigns
`this.howToService`. They return plain objects of handler functions; the
controller keeps its own decorated methods, so routes, guards and cross-cutting
decorators stay visible at the call site while the body becomes one line.

| Factory | Handlers |
|---|---|
| `createCrudHandlers` | `findAll(reply, { query, search, fetchAll, orderBy })`, `findById(reply, id)`, `create(reply, body)`, `update(reply, body)`, `patch`, `delete(reply, id)` |
| `createRelationshipHandlers` | `findByRelated(reply, { relationship, id, query, search, fetchAll, orderBy })`, `addToRelationship(reply, entityId, relationship, data)`, `removeFromRelationship` |

`create` forwards `body.included` — the {json:api} sidepost array — to
`createFromDTO`, so a service override can consume it. A request that sends no
`included` passes `undefined`, which the abstract implementation ignores.

`findByRelated` takes its `relationship` from
`SomeDescriptor.relationshipKeys.<name>` rather than a string literal, which is
how a renamed relationship fails at compile time instead of at runtime.

### The three cross-cutting decorators

All three live in `packages/nestjs-neo4jsonapi/src/common/decorators/` and all
three wrap the method rather than using Nest interceptors.

| Decorator | Signature | Behaviour |
|---|---|---|
| `@ValidateId` | `@ValidateId("howToId")` | Compares `req.params.howToId` with `body.data.id` (the `bodyPath` is configurable) and throws `PreconditionFailedException` on a mismatch. Replaces the hand-written `if (id !== body.data.id)` check. Only validates when both are present. |
| `@CacheInvalidate` | `@CacheInvalidate(meta)` or `@CacheInvalidate(meta, "howToId")` | Runs **after** the method. Without an id it calls `cacheService.invalidateByType(meta.endpoint)`; with one it calls `invalidateByElement(meta.endpoint, paramId)`. Reads `this.cacheService`, so the controller **must** inject `CacheService` or the decorator is a silent no-op. |
| `@Audit` | `@Audit(meta, "howToId")` | Runs after the method and calls `auditService.logRead({ entityType: meta.labelName, entityId: paramId })`. Same rule: the controller must inject `AuditService` or nothing is recorded. |

The silent-no-op behaviour of the last two is the trap. A decorator that
compiles, runs and does nothing looks identical to one that works; the only
evidence is the missing constructor parameter.

### The module registers the model in `onModuleInit`

```ts
@Module({
  controllers: [HowToController],
  providers: [HowToDescriptor.model.serialiser, HowToRepository, HowToService, createWorkerProvider(HowToProcessor)],
  exports: [HowToRepository, HowToService],
  imports: [AuditModule, BlockNoteModule, ChunkModule, ChunkerModule, TokenUsageModule],
})
export class HowToModule implements OnModuleInit {
  onModuleInit() {
    modelRegistry.register(HowToDescriptor.model);
  }
}
```

Two obligations, and both are easy to forget:

1. **`Descriptor.model.serialiser` must be in `providers`.** Without it the
   serialiser cannot be constructed and every response for the type fails.
2. **`modelRegistry.register(Descriptor.model)` must run in `onModuleInit`.**
   The registry is a plain singleton
   (`packages/nestjs-neo4jsonapi/src/common/registries/registry.ts`), not an
   injectable, and it indexes by `nodeName`, lowercased `labelName` and
   lowercased `type`. An unregistered model cannot be resolved by an `include:`
   clause, which surfaces as a 500 on a request that asks for the relationship.

`RoleModule`, `UserModule`, `HowToModule` and `TokenUsageModule` are identical on
both points. `TokenUsageModule` registers seven models in one hook — the entity
plus the six read-only projection descriptors — which is the pattern when a
module serves reporting shapes alongside its entity.

`createWorkerProvider(HowToProcessor)` is the third recurring element: a queue
processor exists only in worker mode, and the wrapper resolves the class's
injection tokens through reflection so `@Optional()` markers survive.

`HowToPublicController` is not in that list. `HowToModule.forRoot({ publicRoutes: true })`
adds it, and `bootstrap({ howTo: { publicRoutes: true } })` in
`apps/api/src/main.ts` is how the template asks for it — see
[Bootstrap](bootstrap.md).

## What `pnpm generate-module` emits

`pnpm generate-module <schema.json>` runs
`packages/nestjs-neo4jsonapi/scripts/generate-module/generator.ts` and writes
into `apps/api/src/<targetDir>/<kebab-name>/`:

| File | Notes |
|---|---|
| `entities/<name>.meta.ts` | Written first, so the entity can import it without a cycle. |
| `entities/<name>.ts` | The `defineEntity()` descriptor, fields and relationships from the schema. |
| `<name>.module.ts` | Controller, repository, service, serialiser provider and the `onModuleInit` registration. |
| `services/<name>.service.ts` | Extends `AbstractService`. |
| `repositories/<name>.repository.ts` | Extends `AbstractRepository`. |
| `controllers/<name>.controller.ts` | CRUD routes, plus nested routes for relationships. |
| `dtos/<name>.dto.ts`, `.post.dto.ts`, `.put.dto.ts` | `class-validator` imports pruned to what each file actually uses. |
| `dtos/<name>.relationship.dto.ts` | Only when the schema declares a to-many relationship. |
| `services/<name>.service.spec.ts`, `repositories/<name>.repository.spec.ts`, `controllers/<name>.controller.spec.ts`, `dtos/<name>.dto.spec.ts` | Co-located specs, one per layer. |

Flags: `--dry-run` previews without writing, `--force` overwrites, `--no-register`
skips inserting the module into the parent module's `imports`, `--shared-scope`
overrides the auto-detected shared package scope that exports `ModuleId`.
Everything written is then formatted with Prettier.

The generator is the fastest way to see a compliant module: run it once with
`--dry-run` against a throwaway schema and read the output.

## Where to look

| File | Why |
|---|---|
| `apps/api/src/features/essentials/search/search.module.ts` | The whole module in nine lines. |
| `apps/api/src/features/essentials/search/entities/search.meta.ts` | `DataMeta`'s four strings in context. |
| `apps/api/src/features/essentials/search/repositories/search.repository.ts` | Index reconciliation, Lucene escaping, hand-written CLS scoping. |
| `apps/api/src/features/essentials/search/controllers/search.controller.ts` | The `@Res()` convention and the TS1272 note. |
| `packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts` | `DataMeta`, `DataModelInterface`, `RelationshipInfo`. |
| `packages/nestjs-neo4jsonapi/src/foundations/how-to/controllers/how-to.controller.ts` | CRUD handlers, relationship handlers and all three decorators in one file. |
| `packages/nestjs-neo4jsonapi/src/foundations/how-to/how-to.module.ts` | Serialiser provider, model registration, worker-only processor. |
| `packages/nestjs-neo4jsonapi/src/foundations/user/repositories/user.repository.ts` | `AbstractRepository` subclassing and the descriptor-as-field rule. |
| `packages/nestjs-neo4jsonapi/src/common/handlers/crud.handlers.ts` | Every handler signature, with a worked example in the docblock. |
| `packages/nestjs-neo4jsonapi/src/common/registries/registry.ts` | The three indexes a registration populates. |

## Gaps and drift

- `apps/api/src/features/essentials/search/dtos/search.dto.ts` declares
  `SearchQueryDTO` but no file imports it. `SearchController.search` takes bare
  `@Query()` parameters, so the global `ValidationPipe` never validates the
  query string and the controller repeats the empty-term check by hand.
- `searchMeta` declares `nodeName` and `labelName` for a `:Search` node that is
  never created. Only `endpoint` is read.
- `EXPECTED_SEARCH_LABELS` is empty, so the fulltext index is never created and
  `SearchRepository.find` returns nothing on a fresh app. This is intentional —
  the app has no searchable entity yet — but `GET /searches` answering
  `{"data":[]}` for a term that exists in Neo4j is the expected behaviour until
  you fill the constant.
- `SearchRepository` does not extend `AbstractRepository` and scopes by hand.
  Do not copy that into a module that has a descriptor.
- Not examined: `AbstractService`'s full method surface; `defineEntity()`'s
  constraint and index derivation; the polymorphic relationship support in
  `RelationshipInfo`; the generator's schema format, transformers and
  validators; the other forty-one foundations. `02-framework` and
  `05-foundations` cover those.
