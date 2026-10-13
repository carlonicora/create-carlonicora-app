---
title: Entity descriptors
section: 01-architecture
---

An entity in this stack is one file. `defineEntity<T>()` takes a declarative
schema and derives from it the Neo4j mapper, the Cypher constraints and indexes,
the {json:api} serialiser, the relationship tokens and the `DataModelInterface`
that the repository, the service and the controller all consume. Nothing in that
list is written twice, and nothing is written by hand.

The predecessor was a five-file layout — `*.entity.ts`, `*.map.ts`, `*.meta.ts`,
`*.model.ts` and a serialiser — where a new field meant four coordinated edits.
Several foundations still carry it; a migration tool converts them.

## The curried call

```ts
export const UserDescriptor = defineEntity<User>()({ /* schema */ });
```

Two calls, not one. TypeScript cannot partially infer type arguments, so
`defineEntity<T>()` fixes the entity type and returns a function that infers `R`
— the relationships record — from the schema object. That inference is what makes
`UserDescriptor.relationships.company` and
`UserDescriptor.relationshipKeys.company` type-safe without a second type
parameter at the call site.

The implementation is
`packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts`; the types are
`packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts`.

## `EntitySchemaInput` — every option

### Identity

| Option | Type | Meaning |
|---|---|---|
| `type` | `string` | the {json:api} resource type, e.g. `"users"` |
| `endpoint` | `string` | the URL path segment, usually identical to `type` |
| `nodeName` | `string` | the Cypher variable and the `modelRegistry` key, e.g. `"user"` |
| `labelName` | `string` | the Neo4j node label, e.g. `"User"` |

These four are a `DataMeta`, so a descriptor normally spreads a `*.meta.ts`
export (`...userMeta`) rather than repeating them. The meta file exists so that
a relationship can name a target entity without importing its descriptor, which
would be circular.

### Scope

| Option | Type | Default | Meaning |
|---|---|---|---|
| `isCompanyScoped` | `boolean` | `true` | when false, no `company` token is derived, no `BELONGS_TO` edge is written and `buildDefaultMatch()` emits an unfiltered match |

### `fields` — `{ [K in keyof Partial<T>]?: FieldDef }`

Keys must be properties of `T`. Every `FieldDef` key:

| Key | Type | Meaning |
|---|---|---|
| `type` | `CypherType` | one of `string`, `number`, `boolean`, `date`, `datetime`, `json` and their `[]` variants. Drives both the read-time conversion and the Cypher cast on write |
| `required` | `boolean` | collected into `requiredFields` |
| `default` | `any` | collected into `fieldDefaults`; applied when a create/PUT DTO omits the field |
| `meta` | `boolean` | moves the field from {json:api} `attributes` to the resource's `meta` |
| `transform` | `(data, services) => any` | replaces the attribute with an async function of the whole entity and the resolved `injectServices`. How a stored object key becomes a signed URL |
| `excludeFromJsonApi` | `boolean` | drops the field from attributes and meta both. Passwords, one-time codes |
| `excludeFromSearch` | `boolean` | keeps a `string` field out of the derived FULLTEXT index. Set it on machine-readable strings — serialised JSON, UUID references, status enums, tokens — so a term matching inside a config blob does not return an unrelated entity |
| `serialise` | `boolean` | `false` suppresses the field from the wire while keeping it readable in Cypher. For storage-only backing fields |
| `immutable` | `boolean` | never written by the generic PUT path: the stored value is preserved and a client-supplied value is ignored. For server-generated fields a client edit form does not carry |
| `description` | `string` | required for the field to be visible to the chatbot layer |
| `kind` | `FieldKind` | `{ type: "money", minorUnits? }` or `{ type: "richtext" }`. `money` is stored as an integer in minor units and cast with `toInteger()` on write |

### `relationships` — `R extends Record<string, RelationshipDef>`

| Key | Type | Meaning |
|---|---|---|
| `model` | `DataMeta` | the target entity's meta |
| `direction` | `"in" \| "out"` | `out` is `(this)-[:REL]->(related)`; `in` is `(related)-[:REL]->(this)` |
| `relationship` | `string` | the Neo4j relationship type |
| `cardinality` | `"one" \| "many"` | `many` always uses `OPTIONAL MATCH` |
| `required` | `boolean` | `false` makes a to-one relationship use `OPTIONAL MATCH` too |
| `contextKey` | `string` | the value comes from that CLS key rather than from the DTO. `contextKey: "userId"` is how an `author` relationship fills itself |
| `dtoKey` | `string` | **renames the relationship on the wire.** The map key stays the internal name; `dtoKey` is what appears in `relationships` and what an incoming DTO must send |
| `fields` | `RelationshipFieldDef[]` | edge properties: `{ name, type, required?, default? }`. Carried in per-item `meta` on the wire |
| `polymorphic` | `PolymorphicConfig` | candidate models plus a discriminator function, for a relationship whose target spans several types or labels |
| `immutable` | `boolean` | set only on creation; PUT skips it |
| `readOnly` | `boolean` | serialised, never written. `create`/`put`/`patch` skip it and the relationship handlers reject it with a 400 |
| `reverse` | `{ name, description }` | opts in traversal from the target entity. Omit to keep the relationship one-way |
| `include` | `string[]` | dot-paths, relative to this relationship's **target** descriptor, to fetch and nest. At most `MAX_INCLUDE_DEPTH` (6) segments per entry, and not allowed alongside edge `fields` |
| `description` | `string` | required for chatbot visibility |

### Derived values

| Option | Type | Meaning |
|---|---|---|
| `computed` | `{ [K in keyof Partial<T>]?: ComputedFieldDef }` | `compute({ data, record, entityFactory, name })`, evaluated per row against the whole Neo4j record. Keys must exist on `T`. Takes `meta`, `excludeFromJsonApi`, `description` |
| `virtualFields` | `Record<string, VirtualFieldDef>` | the same, but the key need not exist on `T`. This is how `avatarUrl` can sit beside `avatar` |

### Overrides and metadata

| Option | Type | Meaning |
|---|---|---|
| `serialiser` | `new (...args) => any` | a hand-written serialiser class, used only when the derived one cannot express the transformation |
| `injectServices` | `Type<any>[]` | NestJS providers made available to `transform` functions, keyed by class name. Resolved lazily on first serialisation, never at construction |
| `description` | `string` | the entity's purpose. Required for the entity to be visible to the LLM catalogue |
| `chat` | object | LLM presentation hints: `summary`, `textSearchFields`, `list`, `scope`, `writable`, `related` |
| `bridge` | `{ materialiseTo: string[] }` | marks a junction node whose listed relationships are auto-fetched one hop and inlined for tool results. Validated at definition time: each name must be a relationship key, and the entity must carry a top-level `description` |

## What `defineEntity()` derives

Three of the schema's rules are checked at module load, and throw:
`bridge.materialiseTo` must be a non-empty array of real relationship keys on an
entity that has a `description`; an `include` path must not exceed
`MAX_INCLUDE_DEPTH`; and a relationship must not declare both `include` and edge
`fields`.

Then it computes, into the `EntityDescriptor`:

| Derived | From |
|---|---|
| `fieldNames` | the keys of `fields` |
| `stringFields` | fields with `type: "string"` and not `excludeFromSearch` |
| `requiredFields` | fields with `required: true` |
| `fieldDefaults` | fields with a `default` |
| `relationshipKeys` | the keys of `relationships`, as a typed identity map |
| `constraints` | always exactly `[{ property: "id", type: "UNIQUE" }]` |
| `indexes` | one `FULLTEXT` entry over `stringFields`, named `{nodeName}_search_index` — or an empty array when no string field survives |
| `fulltextIndexName` | that name, or the empty string when there is no index |
| `defaultOrderBy` | the literal `"updatedAt DESC"`, for every entity |
| `singleChildrenTokens` | `"company"` when company-scoped, plus the `model.nodeName` of every `cardinality: "one"` relationship |
| `childrenTokens` | the `model.nodeName` of every `cardinality: "many"` relationship |
| `singleChildrenRelationships` / `childrenRelationships` | the same, as `RelationshipInfo` records carrying direction, relationship type, cardinality, required flag and polymorphic config — the form self-referential relationships need |
| `computed` | the schema's `computed`, **merged over** an auto-generated entry per edge field of every to-one relationship with `fields` |
| `mapper` | a function that reads the Neo4j node, converts each field by its `CypherType`, evaluates computed and virtual fields, and initialises each relationship placeholder (`[]` for many, `undefined` for one) |
| `model` | the `DataModelInterface`: the four meta values plus `mapper`, `serialiser`, and the four token arrays |

The auto-generated computed fields deserve a note. For a to-one relationship
carrying edge properties, the repository returns each property as an aliased
column named `{nodeName}_{relName}_relationship_{fieldName}`.
`defineEntity()` generates a computed field per property that reads exactly that
column and runs it through `convertFieldValue`. A user-supplied `computed` entry
of the same name wins.

If no `serialiser` was supplied, `createSerialiserForDescriptor` builds an
`@Injectable()` subclass of `DescriptorBasedSerialiser` with the descriptor
pre-bound, names it `{labelName}AutoSerialiser` for readable DI errors, and puts
it on `model.serialiser`.

## `defineEntityAlias()`

```ts
export const OwnerDescriptor = defineEntityAlias(UserDescriptor, ownerMeta);
```

An alias is the same entity reached under a different name. `User` is the
canonical example: a `PUT /owners/:id/…` route and an `author` relationship both
point at `User` nodes, but the {json:api} resource type and the Cypher variable
need to differ so a query can bind two of them at once without a collision.

`defineEntityAlias` spreads the base descriptor, spreads the base model, and
overrides only `type`, `endpoint`, `nodeName` and `labelName` from the alias
meta. Fields, computed fields, relationships, constraints, indexes and the
mapper are **shared by reference** — an alias can never drift from its base. In
practice the aliases in `packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.meta.ts`
keep `labelName: "User"` and change only `endpoint` and `nodeName`, so they
resolve to the same nodes under different variable names.

## `convertFieldValue()`

Exported from `define-entity.ts` because repositories that map scalar rollup
rows by hand cannot go through the descriptor's `mapper` — `EntityFactory` only
maps record columns that are real Neo4j nodes — and must not reimplement
temporal formatting. There is one implementation of it, and this is it.

It switches on the `CypherType` and delegates to three converters. `string`,
`boolean`, `json` and their array forms pass through untouched.

**`number` → `convertNeo4jNumber`.** The driver returns 64-bit integers as
`{ low, high }` objects, because a JavaScript number cannot hold the full range.
The converter returns `value.low` when that shape is present. It is deliberately
lossy above 2^31: the alternative, `.toNumber()`, throws on overflow, and the
values this stack stores as integers are counts, positions and minor currency
units.

**`date` → `convertNeo4jDate`.** Returns a `YYYY-MM-DD` **string**, not a `Date`.
A Neo4j `Date` has no time and no zone; turning it into a `Date` object gives it
both, and JSON serialisation then shifts it by the server's UTC offset — a
birthday lands on the previous day west of Greenwich. Three input shapes are
handled: the driver's `{ year: { low }, month: { low }, day: { low } }`, a JS
`Date` (read with the local-time getters, to match what was written), and a
string (truncated to its first ten characters).

**`datetime` → `convertNeo4jDateTime`.** Returns `new Date(value)` and nothing
else. That looks lazy and is the opposite: the driver's `DateTime` and
`ZonedDateTime` classes implement `toString()` as ISO 8601 with the original
offset preserved, so coercion through the `Date` constructor produces the
correct instant. Reconstructing from `{ year.low, month.low, … }` by hand
discards `timeZoneOffsetSeconds` and silently shifts every timestamp by the API
server's local offset.

## The registries the descriptor feeds

### `modelRegistry`

`packages/nestjs-neo4jsonapi/src/common/registries/registry.ts` is a plain
module-level singleton, deliberately **not** `@Injectable()`: models must be
registered before NestJS bootstraps, because services resolve them during
construction.

`register(model)` writes three entries — the map keyed by `nodeName`, a
lower-cased `labelName` index and a lower-cased `type` index — and
`resolveModel(identifier)` tries them in that order. Registration happens in
each foundation's module constructor, e.g.
`modelRegistry.register(RoleDescriptor.model)` in
`packages/nestjs-neo4jsonapi/src/foundations/role/role.module.ts`.

The primary key is `nodeName`, and the map is last-write-wins. That is what
makes the narrowed-extend pattern work: an application registers an extended
descriptor under the same `nodeName` and every read path that resolves through
the registry picks it up. It is also the sharp edge — two unrelated descriptors
that happen to share a `nodeName` shadow each other, and the symptom is an
`include:` that returns the wrong shape rather than an error.

### `EntityServiceRegistry`

`packages/nestjs-neo4jsonapi/src/common/registries/entity.service.registry.ts`
is `@Injectable()` and builds itself in `onModuleInit` by walking
`DiscoveryService.getProviders()`, keeping every provider that is an
`instanceof AbstractService`, and indexing it by `instance.model.type`. First
registration wins; a duplicate logs a warning. `get(type)` and `listTypes()` are
what the agent tools, the MCP surface and the operator write tools use to reach
a service generically, without importing it.

## A worked example

`packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.ts`, trimmed to
the parts that show each mechanism:

```ts
export const UserDescriptor = defineEntity<User>()({
  ...userMeta,                     // type "users", endpoint "users",
                                   // nodeName "user", labelName "User"
  injectServices: [S3Service],

  fields: {
    email:    { type: "string", required: true },
    name:     { type: "string" },
    password: { type: "string", excludeFromJsonApi: true, excludeFromSearch: true },
    avatar: {
      type: "string",
      transform: async (data, services) => {
        if (!data.avatar) return undefined;
        if (data.avatar.startsWith("~")) return data.avatar.substring(1);
        return await services.S3Service.generateSignedUrl({ key: data.avatar, isPublic: true });
      },
    },
    isActive:  { type: "boolean",  meta: true },
    lastLogin: { type: "datetime", meta: true },
    code:      { type: "string", excludeFromJsonApi: true, excludeFromSearch: true },
  },

  virtualFields: {
    avatarUrl: { compute: (params) => params.data.avatar },
  },

  relationships: {
    role:    { model: roleMeta,   direction: "out", relationship: "HAS_MEMBERSHIP",
               cardinality: "many", dtoKey: "roles", readOnly: true },
    company: { model: CompanyDescriptor.model, direction: "out",
               relationship: "BELONGS_TO", cardinality: "one" },
    module:  { model: moduleMeta, direction: "out", relationship: "RELATED_TO",
               cardinality: "many", dtoKey: "modules" },
  },
});

export const OwnerDescriptor = defineEntityAlias(UserDescriptor, ownerMeta);
```

Reading it against the derivation table:

- `stringFields` is `["email", "name", "avatar"]` — `password` and `code` opted
  out — so the FULLTEXT index `user_search_index` covers three properties and no
  credential is searchable.
- `avatar` serialises as a signed URL through `S3Service`, while `avatarUrl`
  returns the raw stored key beside it. Two attributes, one stored property.
- `isActive` and `lastLogin` appear under `meta`, not `attributes`.
- `role` is on the wire as `roles` and is **never written**: there is no
  single-hop `(user)-[:HAS_MEMBERSHIP]->(:Role)` edge, so a generic write would
  create a bogus one and a generic read would return nothing. `readOnly: true`
  makes the generic paths skip it and the relationship handlers reject it.
- `singleChildrenTokens` is `["company", "company"]` — the derived company token
  plus the explicit `company` relationship — and `childrenTokens` is
  `["role", "module"]`.
- The three aliases give `owners`, `assignees` and `authors` endpoints over the
  same `User` label.

## Migrating a five-file entity

`packages/nestjs-neo4jsonapi/tools/migrate-entity` is a Commander CLI that reads
an old-style module folder, parses its `*.entity.ts`, `*.map.ts`, `*.meta.ts`
and `*.model.ts`, and emits a single descriptor file. The root script is
`pnpm neo4jsonapi-migrate`; it takes `--path <module-folder>`, `--entity <name>`
when a folder holds several, `--all`, `--dry-run`, `--backup` and `--verbose`,
and prints a per-entity summary. Run it with `--dry-run` first, and always
type-check the result: the parser infers `CypherType` from the map file's
conversions and cannot recover a field's `required`, `meta` or `excludeFrom*`
intent when the old serialiser expressed it in code. Its own
`MIGRATION-GUIDE.md` and `README.md` sit beside it, and the framework section's
nestjs-neo4jsonapi tooling page covers the generators in full.

## Where to look

| File | What it settles |
|---|---|
| `packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts` | every schema option and its documented intent |
| `packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts` | the derivation, the three conversions, `defineEntityAlias`, `MAX_INCLUDE_DEPTH` |
| `packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts` | `DataMeta`, `DataModelInterface`, `RelationshipInfo` |
| `packages/nestjs-neo4jsonapi/src/common/registries/registry.ts` | `modelRegistry` and its three indexes |
| `packages/nestjs-neo4jsonapi/src/common/registries/entity.service.registry.ts` | service discovery by resource type |
| `packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.ts` | the richest shipped descriptor |
| `packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.meta.ts` | a meta file and its three aliases |
| `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts` | how the descriptor becomes a serialiser, and why `injectServices` resolves lazily |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | how the descriptor becomes Cypher |
| `packages/nestjs-neo4jsonapi/tools/migrate-entity/README.md` | the migration CLI |

## Gaps and drift

- `defaultOrderBy` is the hard-coded string `"updatedAt DESC"` for every entity;
  the descriptor cannot override it, only the caller's `orderBy` argument can.
- `convertNeo4jNumber` returns `value.low`, so an integer outside the 32-bit
  range is silently truncated.
- `injectServices` resolution logs `console.warn` and hands the transformer
  `undefined` when a service is not reachable, rather than failing.
- `EntityServiceRegistry` keys on `model.type` while `modelRegistry` keys on
  `nodeName`. The two registries can disagree about what a name means.
- Roughly a third of the shipped foundations still use the five-file layout —
  `atomicfact`, `audit`, `community`, `keyconcept`, `module`, `oauth` (partly),
  `push`, `rbac`, `s3` and the `stripe-*` family. They work, but their fields
  are not descriptor-derived and the tables above do not describe them.
- Not examined here: `PolymorphicConfig` and the discriminator machinery; the
  `chat` and `bridge` blocks, which belong to the AI section; the module and
  web-module generators; and how a descriptor is registered in a feature module,
  which the backend section's module-anatomy chapter owns.
