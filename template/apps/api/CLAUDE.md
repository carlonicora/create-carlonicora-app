# Backend (NestJS + Neo4j) - CLAUDE.md

> **Architecture rules:** invoke the `{{name}}-architecture` skill before
> editing files under `src/features/`. The skill's routing table directs
> you to the right reference for the file you are editing.

See [root CLAUDE.md](../../CLAUDE.md) for monorepo structure and the architecture skill pointer.

## Core Rules

1. **Always extend AbstractRepository/AbstractService** - Never bypass the framework
2. **Company filtering is automatic** - Use `buildDefaultMatch()`, never filter manually
3. **Use Meta constants** - Never hardcode endpoints/types, use `*.meta.ts` files
4. **Descriptors are the source of truth** - Fields, relationships, computed properties all come from Descriptors
5. **Queue-based async** - Use BullMQ for heavy operations (analysis, clustering, image processing)
6. **Parameterized queries** - Never interpolate strings into Cypher queries

## File Organization

```
src/features/{domain}/
├── entities/
│   ├── {entity}.meta.ts      # JSON:API metadata (type, endpoint, nodeName)
│   └── {entity}.ts           # Entity class + EntityDescriptor
├── dtos/
│   ├── {entity}-post.dto.ts  # POST request validation
│   ├── {entity}-put.dto.ts   # PUT request validation
│   └── {entity}-patch.dto.ts # PATCH request validation
├── {entity}.repository.ts    # Data access (extends AbstractRepository)
├── {entity}.service.ts       # Business logic (extends AbstractService)
├── {entity}.controller.ts    # HTTP handlers
└── {entity}.module.ts        # NestJS module definition
```

## Key Patterns (by example)

Consult the `{{name}}-architecture` skill's reference docs under
`.claude/skills/{{name}}-architecture/references/backend/` for canonical
examples of:

- **Meta file** — `src/features/<domain>/<entity>/entities/<entity>.meta.ts`
- **Entity + Descriptor** — `src/features/<domain>/<entity>/entities/<entity>.ts`
- **Repository queries** — `src/features/<domain>/<entity>/<entity>.repository.ts`

## Testing

```bash
pnpm --filter {{name}}-api test
pnpm --filter {{name}}-api test:e2e
```

## RBAC

Declarative matrix at `src/rbac/permissions.ts` is the source of truth. The
worker reconciler reads it on bootstrap and applies any drift to Neo4j in
one transaction. The api process does NOT reconcile.

**Bootstrap a new environment / capture manual DB edits:**

```bash
pnpm --filter {{name}}-api rbac:dump
```

This is the ONLY way to (re)generate `src/rbac/permissions.ts` from live
DB state. It is developer-only; never expose as an HTTP endpoint or wire
into a deploy step. Full guide:
[`packages/nestjs-neo4jsonapi/docs/rbac-bootstrap.md`](../../packages/nestjs-neo4jsonapi/docs/rbac-bootstrap.md).

## Common Mistakes

| Mistake                                             | Correct Approach                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Returning raw Neo4j records                         | Use `readOne()` / `readMany()` to deserialize                                                                                                                                                                                                                                                                                                                                                                                          |
| Manual company filtering                            | Use `buildDefaultMatch()` - filtering is automatic                                                                                                                                                                                                                                                                                                                                                                                     |
| Hardcoded pagination                                | Use `{CURSOR}` placeholder in queries                                                                                                                                                                                                                                                                                                                                                                                                  |
| String interpolation in Cypher                      | Use parameterized queries with `$paramName`                                                                                                                                                                                                                                                                                                                                                                                            |
| Bypassing AbstractService                           | Always extend and use inherited methods                                                                                                                                                                                                                                                                                                                                                                                                |
| Missing relationship definitions                    | Define ALL relationships in EntityDescriptor                                                                                                                                                                                                                                                                                                                                                                                           |
| Storing dates as strings in Neo4j                   | All date fields MUST be native Neo4j `Date`/`DateTime` types. Entity descriptors use `type: "date"` or `type: "datetime"`. Write path uses `date(left($value, 10))` or `datetime($value)`. Read path (`convertNeo4jDate`) returns `YYYY-MM-DD` strings only for JSON serialization — storage stays native.                                                                                                                             |
| `PATCH /users/:userId` for general updates          | PATCH is mapped exclusively to `reactivateUser` and ignores the body. `PUT /users/:userId` replaces ALL fields — partial payloads wipe data. Always send the full user state.                                                                                                                                                                                                                                                          |
| Side-effect hooks in `AbstractService` or event bus | Never add framework-level hooks (AbstractService, `@nestjs/event-emitter`) for embeddings, notifications, indexing, or downstream work. Each entity service that needs a side effect calls it explicitly in its own `create`/`put`/`patch` override. Default to synchronous in-line calls; use BullMQ only for genuinely long-running jobs. Shared side effects go in a helper service the entity services call — not an auto-trigger. |
