---
title: The {json:api} contract
section: 01-architecture
---

{json:api} is the only protocol between `apps/web` and `apps/api`. Every
response the API produces and every body it accepts is a {json:api} document,
and neither side builds one by hand: the backend derives it from an entity
descriptor and the frontend derives it from a model class. This page is the
wire-level reference — what a document looks like, which knob in the descriptor
moved which part of it, and the two or three places where this stack's dialect
is narrower than the specification.

## The envelope

A successful response has at most five top-level members, assembled by
`JsonApiService.serialise` in
`packages/nestjs-neo4jsonapi/src/core/jsonapi/services/jsonapi.service.ts`:

```json
{
  "links": { "self": "…", "next": "…", "prev": "…" },
  "meta":  { "total": 42 },
  "data":  { "…": "…" },
  "included": [ { "…": "…" } ]
}
```

- `links.self` is the request URL when `LoggingInterceptor` has put one in CLS,
  and the model's endpoint otherwise. `next` and `prev` appear only for lists
  and only when the paginator produced them.
- `meta.total` is the count from the automatic COUNT query, picked up from the
  CLS key `queryTotal`. It is absent when pagination totals are switched off or
  the query carried no cursor placeholder.
- `data` is one resource object for `buildSingle`, an array for `buildList`.
- `included` is a flat, de-duplicated array keyed on `type` + `id`; it is
  omitted when empty.

A resource object carries `type`, `id`, `links.self`, `attributes`, `meta` and
`relationships`. Three meta keys are always present because
`AbstractJsonApiSerialiser` seeds them: `createdAt`, `updatedAt` and
`recordCount`.

## The content-type

`bootstrap()`
(`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts`) registers a Fastify
content-type parser before any route:

```ts
fastifyInstance.addContentTypeParser(
  "application/vnd.api+json",
  { parseAs: "string" },
  fastifyInstance.getDefaultJsonParser("ignore", "ignore"),
);
```

So a client may send either `application/json` or `application/vnd.api+json`;
both parse identically. The frontend client sends `application/json` —
`packages/nextjs-jsonapi/src/client/request.ts` and
`packages/nextjs-jsonapi/src/server/request.ts` both set that header — so the
parser exists for third-party callers and for strict clients, not for the app's
own traffic. The API does not set `application/vnd.api+json` on responses
either.

## What the descriptor decides

Everything about the wire shape of an entity comes from its descriptor. See the
entity-descriptors page for the full option list; these are the options that are
visible to a client.

| Descriptor input | Wire effect |
|---|---|
| `type` | the `type` member of every resource object and resource identifier |
| `endpoint` | the path segment, and the `links.self` template `{apiUrl}{endpoint}/{id}` |
| `fields.<name>` | an entry in `attributes`, under the field's own name |
| `fields.<name>.meta: true` | moves that field from `attributes` to the resource's `meta` |
| `fields.<name>.excludeFromJsonApi: true` | drops it from both |
| `fields.<name>.serialise: false` | drops it from both, while keeping it readable in Cypher |
| `fields.<name>.transform` | the attribute becomes an async function of the entity and the injected services — how a stored key becomes a signed URL |
| `computed.<name>` / `virtualFields.<name>` | an attribute (or meta entry, with `meta: true`) computed from the Neo4j record rather than a stored property |
| `relationships.<key>` | an entry in `relationships`, whose `data` is a resource identifier or an array of them |
| `relationships.<key>.dtoKey` | **renames the wire key.** `key` stays the internal name; `dtoKey` is what appears in `relationships` and what an incoming DTO must use |
| `relationships.<key>.fields` | edge properties, surfaced as per-item `meta` on the relationship's resource identifiers |
| `relationships.<key>.contextKey` | the relationship is filled from CLS, never from the request body |
| `relationships.<key>.readOnly` | serialised, never written by any generic path |

`dtoKey` is the one to be careful with: two relationships whose effective keys
collide silently overwrite one another, because the serialiser writes
`relationships[rel.name ?? key]` into a plain object.

## Query parameters

`JsonApiPaginator`
(`packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/jsonapi.paginator.ts`)
parses the query string with `qs` and owns everything the wire can ask for:

| Parameter | Effect |
|---|---|
| `include=a,b` | restricts `included` to those relationship names, compared case-insensitively. Omitting the parameter includes everything the query returned; sending `include=` (empty) includes nothing |
| `fields[type]=x,y` | sparse fieldsets. Applied per resource type in `serialiseData`; an attribute not listed is skipped |
| `page[size]=n` | page size, default 25 |
| `page[offset]=n` | offset into the result set |
| `page[forcedNext]=…` | forces the `next` link's offset, for cursor schemes a repository computes itself |
| `fetchAll=true` | disables pagination entirely: no cursor, no links beyond `self` |

Two more are read by controllers rather than by the paginator, and passed into
`AbstractService.find`:

| Parameter | Effect |
|---|---|
| `search=…` | a full-text term; switches the repository onto its fulltext branch |
| `orderBy=…` | a raw `property DIRECTION` string appended to `ORDER BY` |

Structured filtering and sorting are **not** wire parameters. `FilterCriterion[]`
and `SortCriterion[]` are repository-level arguments built in application code
and compiled by `buildFilterClauses` and `buildOrderByClause`
(`packages/nestjs-neo4jsonapi/src/core/neo4j/helpers/build-filter-clauses.ts`,
`packages/nestjs-neo4jsonapi/src/core/neo4j/helpers/build-order-by.ts`). Both
validate every identifier against `/^[A-Za-z_][A-Za-z0-9_]*$/` and bind every
value as a parameter. Supported operators: `eq`, `ne`, `in`, `like`, `gt`,
`gte`, `lt`, `lte`, `isNull`, `isNotNull`.

The search term is not passed through raw either.
`packages/nestjs-neo4jsonapi/src/core/neo4j/helpers/build-fulltext-term.ts`
tokenises it on non-alphanumerics and AND-joins one contains-wildcard per token,
because Lucene's classic parser treats a dozen punctuation characters as syntax
and the index analyser has already split the stored text on the same
boundaries. Escaping alone parses but matches nothing.

On the fulltext branch the repository does **not** call `buildDefaultMatch()` —
it calls `db.index.fulltext.queryNodes` and applies its own
`WHERE (node)-[:BELONGS_TO]->(company)` for company-scoped entities. The tenancy
predicate is preserved; the shape is different.

On the frontend, URLs are assembled by `EndpointCreator`
(`packages/nextjs-jsonapi/src/core/endpoint/EndpointCreator.ts`), whose
`limitToType(["actor"])` emits `include=` and `limitToFields([...])` emits
`fields[type]=`. It concatenates `key=value` pairs without URL-encoding them.

## Cursor pagination

The framework paginates by offset over a stable `ORDER BY`, and calls the
offset a cursor. Repositories never write `SKIP`/`LIMIT`; they write the literal
token `{CURSOR}` where the page boundary belongs, and `Neo4jService` substitutes
it.

The rules, from `readMany` in
`packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts`:

1. `JsonApiPaginator.generateCursor()` returns `{ cursor: offset, take: size }`
   where `size` is **`page[size]` plus one**. The extra row is the lookahead
   that decides whether a `next` link exists.
2. With no offset, `{CURSOR}` becomes `LIMIT toInteger($take)`.
3. With an offset, it becomes `SKIP toInteger($cursor) LIMIT toInteger($take)`.
4. Under `fetchAll`, `{CURSOR}` is replaced with the empty string.
5. `generateLinks` compares the row count against `size`; if they match it emits
   `next` and then `data.splice(size, 1)` drops the lookahead row before
   serialisation.

The `+ 1` is the trap. Any code outside `buildList` that wants exactly *n* rows
must pass a literal cursor (`{ cursor: 0, take: n }`) rather than going through
the paginator.

### The COUNT query

When the merged config's `neo4j.computePaginationTotal` is not `false` — it
defaults to true, and there is no environment variable for it, only the config
object in `apps/api/src/config/config.ts` — and the query's serialiser has a
`nodeName`, `readMany` builds a **second** query and runs it in parallel with
the first. `buildCountQuery` takes everything before `{CURSOR}`, strips a
trailing `ORDER BY`, and appends
`RETURN count(DISTINCT {nodeName}) AS total`. The result is stashed in the CLS
key `queryTotal`, which `JsonApiService.serialise` reads to emit `meta.total`.

Two consequences. Every paginated read costs two Neo4j round trips. And a query
whose pre-`{CURSOR}` half does not stand alone as a valid statement — one that
depends on clauses written after the placeholder — produces a broken COUNT
query. `readManyWithoutCount` is the escape hatch: same cursor substitution, no
second query, no `meta.total`.

## Include depth

Nesting beyond one hop is opt-in per relationship, through
`RelationshipDef.include`: an array of dot-paths relative to that
relationship's **target** descriptor.

```ts
messages: {
  model: assistantMessageMeta,
  direction: "out",
  relationship: "HAS_MESSAGE",
  cardinality: "many",
  include: ["actor", "actor.company"],
}
```

`MAX_INCLUDE_DEPTH` is 6, exported from
`packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts`. It counts dot
segments in a single entry, and `defineEntity()` throws at module load when a
path exceeds it. It also throws when a relationship declares both `include` and
edge `fields` — nested include on an edge-property relationship is not
supported. Because every path is finite and declared, there is no cycle risk and
no runtime depth counter.

The wire-level `include` query parameter is a *filter* over what the query
already fetched, not an instruction to fetch more. Adding a relationship name to
`include=` that the descriptor never declared changes nothing.

## The DTO shape

Write bodies are typed by two interfaces in
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.service.ts`:

```ts
interface JsonApiDTORelationshipItem {
  id: string;
  type: string;
  meta?: Record<string, any>;   // edge properties, per item
}

interface JsonApiDTOData {
  id: string;
  type: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, {
    data: JsonApiDTORelationshipItem[] | JsonApiDTORelationshipItem | null;
    meta?: Record<string, any>;  // relationship-level; carries edgeOnly
  }>;
}
```

`id` is required on create as well as update: the client generates the UUID.

Edge properties travel in per-item `meta`. `mapDTOToParams` collects them into a
`{ [itemId]: { field: value } }` map named `<relationshipKey>EdgeProps`, applying
each field's `default` when the item omits it and throwing a 400 when a
`required` edge field is missing. Item-level `meta` wins over relationship-level
`meta`; the latter is a backwards-compatible fallback for to-one relationships.

`meta.edgeOnly: true` on a to-many relationship means "change the edge
properties of these items, leave the membership of the set alone".
`mapDTOToPatchParams` then produces `<relationshipKey>EdgePropsUpdate` instead of
a replacement id list, and `AbstractRepository.patch` writes only the edge
properties.

Requests are validated by `class-validator` DTOs behind a global
`ValidationPipe` with `whitelist: true` and `transform: true`, so any member the
DTO does not declare is stripped before the service sees it. `createCrudHandlers`
(`packages/nestjs-neo4jsonapi/src/common/handlers/crud.handlers.ts`) is what
turns a validated body into a service call.

## Sideposting

A `POST` or `PUT` body may carry a top-level `included` array.
`createCrudHandlers` forwards it verbatim as `body.included` into
`createFromDTO` / `putFromDTO`, which pass it to `create` / `put`. The abstract
implementations **ignore it**. It exists so that a service subclass can consume
it — creating related resources in the same transaction — without the controller
or the handler needing to know. An application that does nothing special sees
`undefined` and unchanged behaviour.

## Clearing a to-one relationship

A `PATCH` cannot clear a to-one relationship in this framework, and the failure
is silent. Two independent reasons:

1. The DTOs reject `{ "data": null }`. Every shipped relationship DTO validates
   the nested object with `@ValidateNested()` and `@IsNotEmpty()`, so `null`
   never survives the `ValidationPipe`.
2. Even if it did, `mapDTOToPatchParams` maps a falsy to-one `data` to
   `undefined`, and `AbstractRepository.patch` filters its relationship list
   with `params[name] !== undefined`. The relationship is skipped entirely and
   the edge stays.

The response is a 200 with the old edge still attached.

**What to do instead:** model an optional single-choice relationship as
`cardinality: "many"`. An array relationship is set and cleared by sending
`{ "data": [] }`, which `patch` handles, and "exactly one" becomes a UI
constraint plus a data-health check rather than a protocol one.

## A worked exchange

Request:

```http
GET /notifications?page[size]=2&include=actor HTTP/1.1
Host: api.{{name}}.test:4050
Authorization: Bearer <jwt>
x-language: en
```

Response:

```json
{
  "links": {
    "self": "http://api.{{name}}.test:4050/notifications?page[size]=2&include=actor",
    "next": "http://api.{{name}}.test:4050/notifications?page[size]=2&include=actor&page[offset]=2"
  },
  "meta": { "total": 7 },
  "data": [
    {
      "type": "notifications",
      "id": "0195c1e2-7f3a-7c21-9c4e-4f6c2b8d5a10",
      "links": { "self": "http://api.{{name}}.test:4050/notifications/0195c1e2-7f3a-7c21-9c4e-4f6c2b8d5a10" },
      "attributes": {
        "notificationType": "MENTION",
        "isRead": false,
        "message": "You were mentioned",
        "actionUrl": "/records/9f2c"
      },
      "meta": { "createdAt": "2026-09-11T08:30:00.000Z", "updatedAt": "2026-09-11T08:30:00.000Z" },
      "relationships": {
        "actor": { "data": { "type": "users", "id": "a63553fb-5d3c-11ee-9dc3-0242ac120003" } }
      }
    }
  ],
  "included": [
    {
      "type": "users",
      "id": "a63553fb-5d3c-11ee-9dc3-0242ac120003",
      "attributes": { "name": "Administrator" }
    }
  ]
}
```

Every part of that document is traceable to
`packages/nestjs-neo4jsonapi/src/foundations/notification/entities/notification.ts`:
the four attributes are its `fields`, `actor` is its single relationship with
`dtoKey: "actor"`, and the `meta` timestamps come from the abstract serialiser's
defaults.

A write against the same resource:

```http
PATCH /notifications HTTP/1.1
Content-Type: application/vnd.api+json

{ "data": [ { "type": "notifications", "id": "0195c1e2-…", "attributes": { "isRead": true } } ] }
```

## Errors

Errors do not go through the serialiser. `HttpExceptionFilter`
(`packages/nestjs-neo4jsonapi/src/common/filters/http-exception.filter.ts`)
catches everything and emits:

```json
{
  "message": "Unauthorised",
  "errors": [
    {
      "status": "401",
      "title": "UNAUTHORIZED",
      "detail": "Unauthorised",
      "source": { "pointer": "/notifications" },
      "meta": {
        "timestamp": "2026-09-11T08:30:00.000Z",
        "path": "/notifications",
        "method": "GET",
        "requestId": "req-1"
      }
    }
  ]
}
```

The top-level `message` duplicates `errors[0].detail` so a client can read
either. `code` appears when a structured exception payload carried one, and
`meta.context` carries the rest of that payload. In production a 5xx detail is
replaced with a generic sentence and the structured payload is withheld;
stack traces are path-stripped before logging and never sent. Only `requestId`
is echoed — never `userId` or `companyId`. Two paths bypass the envelope: any
URL starting with `/health`, which returns the Terminus shape, and a rate-limit
rejection, which `ThrottlerExceptionFilter` renders as a flat 429 body.

## The client side

`translateResponse`
(`packages/nextjs-jsonapi/src/core/utils/translateResponse.ts`) is the inverse.
It looks the model class up in `DataClassRegistry` by the `type` the caller
passed, constructs one instance per `data` entry, and calls
`rehydrate({ jsonApi, included, allData })` on each. Pagination is handed back
as `nextPage()` / `prevPage()` closures over `links.next` / `links.prev`.

Four behaviours matter when debugging:

- A 204, and a success with an empty body, return an empty success rather than
  throwing.
- A response whose body has no top-level `data` member is passed through raw.
  That is how non-{json:api} endpoints (a presigned URL, a client secret) reach
  the caller.
- On a failure it reads `data.message`, then `data.error`, then `statusText` —
  in that order, because HTTP/2 has no reason phrase.
- **The rehydration loop is wrapped in `try`/`catch` whose handler is
  `console.error(e)`.** A model whose `rehydrate` throws yields
  `ok: true` with `data` left at `[]`. An empty list where rows were expected is
  a rehydration bug, not an empty query.

## Where to look

| File | What it settles |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/jsonapi/services/jsonapi.service.ts` | the envelope, `included` de-duplication, `include` filtering |
| `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/jsonapi.paginator.ts` | every query parameter, the `size + 1` cursor, link generation |
| `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts` | how descriptor options become attributes, meta and relationships |
| `packages/nestjs-neo4jsonapi/src/core/jsonapi/interfaces/jsonapi.data.interface.ts` | the resource-object type |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.service.ts` | `JsonApiDTOData`, edge properties, `edgeOnly`, the to-one PATCH gap |
| `packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts` | `{CURSOR}` substitution and the COUNT query |
| `packages/nestjs-neo4jsonapi/src/common/handlers/crud.handlers.ts` | the standard controller-to-service wiring, including `included` |
| `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` | the content-type parser and the global validation pipe |
| `packages/nextjs-jsonapi/src/core/utils/translateResponse.ts` | deserialisation, pagination closures, the swallowed error |
| `packages/nextjs-jsonapi/src/core/endpoint/EndpointCreator.ts` | URL construction, `include` and `fields[type]` |

## Gaps and drift

- Neither side sends `Content-Type: application/vnd.api+json` in practice. The
  parser is registered; the app's own clients send `application/json`, and
  responses carry Fastify's default JSON content type.
- `EndpointCreator.generate()` does not URL-encode parameter values. A filter
  value containing `&`, `=` or a space corrupts the query string.
- `translateResponse` swallows rehydration errors to `console.error`.
- `JsonApiPaginator._additionalParams` is rebuilt from the raw query object and
  appended only when the CLS request URL had no query string, so link
  construction has two code paths.
- `ThrottlerExceptionFilter` hard-codes `Retry-After: 60` regardless of the
  configured TTL.
- Not examined here: the sparse-fieldset interaction with `included` resources
  of a different type; the polymorphic relationship factory; the many-to-many
  `a__b` key convention in `serialiseData`; OpenAPI document generation; and the
  frontend model/rehydrate contract, which the frontend section owns.
