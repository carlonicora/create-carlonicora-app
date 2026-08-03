---
id: backend-04-services
title: "Backend: Services"
applies_to: backend
layer: service
depends_on:
  - backend-03-repositories
source_files:
  - "apps/api/src/features/*/services/*.ts"
  - "packages/nestjs-neo4jsonapi/src/core/AbstractService.ts"
related_docs:
  - backend-05-controllers
  - backend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Backend: Services

---

## WHEN TO USE
Read this file when:
- Creating a new service
- Adding custom business logic methods
- Understanding inherited CRUD methods
- Exposing repository custom queries

---

## CRITICAL RULES

1. **Use inherited methods for CRUD** - `find`, `findById`, `createFromDTO`, `putFromDTO`, `delete` are inherited.
2. **Add custom methods when repository has custom queries** - Service exposes repository methods to controller.
3. **ALWAYS extend `AbstractService`** - Get JSON:API response building for free.
4. **Return JSON:API responses** - Use `jsonApiService.buildSingle()` or `buildList()`.

---

## DECISION MATRIX

### When to Add Custom Service Methods

| Question | Answer |
|----------|--------|
| Does repository have a custom query method? | **Yes** - Create matching service method |
| Is it standard CRUD (find, create, update, delete)? | **No** - Use inherited methods |
| Need to combine multiple repository calls? | **Yes** - Create service method |
| Need business logic before/after repository call? | **Yes** - Create service method |

### Inherited Methods Reference

| Method | Purpose | Parameters |
|--------|---------|------------|
| `find()` | List entities with pagination | `{ query, term?, fetchAll?, orderBy? }` |
| `findById()` | Get single entity by ID | `{ id }` |
| `findByRelated()` | Get entities by relationship | `{ relationship, id, query?, ... }` |
| `createFromDTO()` | Create entity from DTO | `{ data: JsonApiDTOData }` |
| `putFromDTO()` | Full update entity | `{ data: JsonApiDTOData }` |
| `patchFromDTO()` | Partial update entity | `{ data: JsonApiDTOData }` |
| `delete()` | Delete entity | `{ id }` |

---

## COMMON MISTAKES

- Writing custom methods for standard CRUD operations
- Forgetting to use `JsonApiPaginator` for list responses
- Not using `jsonApiService.buildSingle/buildList` for responses
- Bypassing repository and calling Neo4j directly

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [03-repositories.md](03-repositories.md) | Repository custom methods to expose |
| [05-controllers.md](05-controllers.md) | Controllers call service methods |
| [template.md](template.md) | Copy-paste ready code |

---

## Service Pattern

```typescript
// <entity>.service.ts
import { AbstractService, JsonApiPaginator, JsonApiService } from "@carlonicora/nestjs-neo4jsonapi";
import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { Example, ExampleDescriptor } from "../entities/example";
import { ExampleRepository } from "../repositories/example.repository";

@Injectable()
export class ExampleService extends AbstractService<Example, typeof ExampleDescriptor.relationships> {
  protected readonly descriptor = ExampleDescriptor;

  constructor(
    jsonApiService: JsonApiService,
    private readonly exampleRepository: ExampleRepository,
    clsService: ClsService,
  ) {
    super(jsonApiService, exampleRepository, clsService, ExampleDescriptor.model);
  }

  // Inherited methods available:
  // - find({ query, term?, fetchAll?, orderBy? })
  // - findById({ id })
  // - findByRelated({ relationship, id, query?, term?, fetchAll?, orderBy? })
  // - createFromDTO({ data: JsonApiDTOData })
  // - putFromDTO({ data: JsonApiDTOData })
  // - patchFromDTO({ data: JsonApiDTOData })
  // - delete({ id })

  /**
   * Custom business logic: Find examples by status
   * Exposes the repository's findByStatus method
   */
  async findByStatus(params: { status: string; query: any }): Promise<any> {
    const paginator = new JsonApiPaginator(params.query);
    const data = await this.exampleRepository.findByStatus({
      status: params.status,
      cursor: paginator.generateCursor(),
    });
    return this.jsonApiService.buildList(ExampleDescriptor.model, data, paginator);
  }
}
```

---

## Custom Method Patterns

### Exposing a Repository Custom Query

```typescript
async findByStatus(params: { status: string; query: any }): Promise<any> {
  // 1. Create paginator from query params
  const paginator = new JsonApiPaginator(params.query);

  // 2. Call repository method with cursor
  const data = await this.exampleRepository.findByStatus({
    status: params.status,
    cursor: paginator.generateCursor(),
  });

  // 3. Build JSON:API list response
  return this.jsonApiService.buildList(ExampleDescriptor.model, data, paginator);
}
```

### Business Logic Before Repository Call

```typescript
async createWithDefaults(params: { data: JsonApiDTOData }): Promise<any> {
  // Business logic: set defaults, validate, etc.
  if (!params.data.attributes.description) {
    params.data.attributes.description = "Default description";
  }

  // Use inherited method
  return this.createFromDTO({ data: params.data });
}
```

### Combining Multiple Repository Calls

```typescript
async archiveWithChildren(params: { id: string }): Promise<void> {
  // Get parent
  const parent = await this.exampleRepository.findById({ id: params.id });

  // Archive all children (call another repository)
  await this.childRepository.archiveByParent({ parentId: params.id });

  // Archive parent
  await this.exampleRepository.archive({ id: params.id });
}
```

---

## Error Handling

Services should:
- Let repository `NotFoundException` propagate
- Throw business logic errors (e.g., `BadRequestException`)
- Use framework exception classes from `@nestjs/common`

---

**Next**: See [05-controllers.md](./05-controllers.md) for HTTP handler patterns
