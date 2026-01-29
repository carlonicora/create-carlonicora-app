# Backend (NestJS + Neo4j) - CLAUDE.md

This file provides guidance specific to the API backend. See also the [root CLAUDE.md](../../CLAUDE.md) for general project rules.

## Architecture Documentation

| Task | Read |
|------|------|
| Core principles | [docs/architecture/00-core-principles.md](../../docs/architecture/00-core-principles.md) |
| New entity | [docs/architecture/backend/01-entity-basics.md](../../docs/architecture/backend/01-entity-basics.md) |
| DTOs | [docs/architecture/backend/02-dtos.md](../../docs/architecture/backend/02-dtos.md) |
| Repository | [docs/architecture/backend/03-repositories.md](../../docs/architecture/backend/03-repositories.md) |
| Service | [docs/architecture/backend/04-services.md](../../docs/architecture/backend/04-services.md) |
| Controller | [docs/architecture/backend/05-controllers.md](../../docs/architecture/backend/05-controllers.md) |
| Template | [docs/architecture/backend/template.md](../../docs/architecture/backend/template.md) |
| Anti-patterns | [docs/architecture/anti-patterns.md](../../docs/architecture/anti-patterns.md) |

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

## Key Patterns

### Meta File Pattern
```typescript
export const photographMeta: DataMeta = {
  type: "photographs",           // JSON:API type (plural, kebab-case)
  endpoint: "photographs",       // URL segment
  nodeName: "photograph",        // Cypher variable name
  labelName: "Photograph",       // Neo4j node label
};
```

### Entity Descriptor Pattern
```typescript
export const PhotographDescriptor: EntityDescriptor<Photograph, PhotographRelationships> = {
  fields: {
    id: { type: "string", generator: "uuid" },
    title: { type: "string" },
    createdAt: { type: "date", generator: "createdAt" },
  },
  relationships: {
    roll: { type: "one", target: rollMeta, direction: "out", relationshipType: "BELONGS_TO" },
    metadata: { type: "many", target: metadataMeta, direction: "out" },
  },
  computedFields: {
    displayName: (entity) => entity.title || "Untitled",
  },
};
```

### Repository Query Pattern
```typescript
// Always use parameterized queries
const query = `
  MATCH (${meta.nodeName}:${meta.labelName})
  WHERE ${meta.nodeName}.id = $photographId
  RETURN ${meta.nodeName}
`;
const result = await this.neo4jService.run(query, { photographId });
```

## Testing

```bash
# Run API tests
pnpm --filter {{name}}-api test

# Run E2E tests
pnpm --filter {{name}}-api test:e2e

# Run with coverage
pnpm --filter {{name}}-api test:coverage
```

## Common Mistakes

| Mistake | Correct Approach |
|---------|------------------|
| Returning raw Neo4j records | Use `readOne()` / `readMany()` to deserialize |
| Manual company filtering | Use `buildDefaultMatch()` - filtering is automatic |
| Hardcoded pagination | Use `{CURSOR}` placeholder in queries |
| String interpolation in Cypher | Use parameterized queries with `$paramName` |
| Bypassing AbstractService | Always extend and use inherited methods |
| Missing relationship definitions | Define ALL relationships in EntityDescriptor |
