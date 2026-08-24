---
id: frontend-03-services
title: "Frontend: Services"
applies_to: frontend
layer: service
depends_on:
  - frontend-01-models
source_files:
  - "apps/web/src/features/*/data/*Service.ts"
  - "packages/nextjs-jsonapi/src/core/AbstractService.ts"
related_docs:
  - anti-patterns
  - frontend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Frontend: Services

---

## WHEN TO USE
Read this file when:
- Creating a new frontend service
- Adding API communication methods
- Building nested/relationship endpoints
- Adding methods for relationship operations with edge properties

---

## CRITICAL RULES

1. **ALWAYS use `callApi()`** - NEVER use `fetch()` directly.
2. **NEVER use `overridesJsonApiCreation`** - Create dedicated model methods instead.
3. **Use `EndpointCreator`** for building URLs.
4. **Pass `input` for POST/PUT** - Model handles JSON:API conversion via `createJsonApi()`.
5. **Use dedicated model methods for edge properties** - Call model methods like `createAddItemJsonApi()`.

---

## ENFORCEMENT CHECKPOINT

> **STOP — Before committing service code, verify:**
> 1. Are you using `callApi()`, not `fetch()`? If using `fetch()`, **STOP**.
> 2. Are you using `EndpointCreator` for URLs? If hardcoding endpoint strings, **STOP**.
> 3. If you need `overridesJsonApiCreation`, does the model have a dedicated method for it? If constructing JSON:API manually in the service, **STOP** and create a model method.
> 4. Does every `callApi()` call include `type: Modules.X`? If missing, **STOP** — rehydration will fail.

---

## DECISION MATRIX

### When to Use Which Method

| Question | Answer |
|----------|--------|
| Standard entity CRUD? | **Use `input` param - model's `createJsonApi()` handles it** |
| Relationship with edge properties? | **Use dedicated model method, pass result to `input`** |
| Nested endpoint (get by relationship)? | **Use `EndpointCreator` with `childEndpoint`** |
| Need to override JSON:API creation? | **NEVER - create model method instead** |

### HTTP Method Mapping

| Operation | HTTP Method | Endpoint Pattern |
|-----------|-------------|------------------|
| Get one | GET | `/examples/:id` |
| Get list | GET | `/examples` |
| Get by relationship | GET | `/users/:id/examples` |
| Create | POST | `/examples` |
| Update | PUT | `/examples/:id` |
| Delete | DELETE | `/examples/:id` |
| Add related with meta | POST | `/examples/:id/persons/:personId` |

---

## COMMON MISTAKES

- Using `fetch()` directly instead of `callApi()`
- Using `overridesJsonApiCreation` instead of dedicated model methods
- Hardcoding endpoint strings instead of using `EndpointCreator`
- Not passing `type` to `callApi()` for proper model rehydration
- Building JSON:API structures manually in service instead of model

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [01-models.md](01-models.md) | Model's createJsonApi() and dedicated relationship methods |
| [02-interfaces.md](02-interfaces.md) | Return type interfaces |
| [template.md](template.md) | Copy-paste ready code |

---

## Service Pattern

```typescript
// ExampleService.ts
import { AbstractService, EndpointCreator, HttpMethod } from "@carlonicora/nextjs-jsonapi";
import { ExampleInput } from "./ExampleInput";
import { ExampleInterface } from "./ExampleInterface";
import { Modules } from "@/core/registry/Modules";
import { Example } from "./Example";

export class ExampleService extends AbstractService {
  /**
   * GET single example by ID
   */
  static async findOne(params: { id: string }): Promise<ExampleInterface> {
    return this.callApi<ExampleInterface>({
      type: Modules.Example,
      method: HttpMethod.GET,
      endpoint: new EndpointCreator({
        endpoint: Modules.Example,
        id: params.id,
      }).generate(),
    });
  }

  /**
   * GET list of examples
   */
  static async findMany(params: {
    search?: string;
    fetchAll?: boolean;
  } = {}): Promise<ExampleInterface[]> {
    const endpoint = new EndpointCreator({ endpoint: Modules.Example });

    if (params.fetchAll) endpoint.addAdditionalParam("fetchAll", "true");
    if (params.search) endpoint.addAdditionalParam("search", params.search);

    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.GET,
      endpoint: endpoint.generate(),
    });
  }

  /**
   * GET examples by owner (nested endpoint)
   */
  static async findManyByOwner(params: { ownerId: string }): Promise<ExampleInterface[]> {
    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.GET,
      endpoint: new EndpointCreator({
        endpoint: Modules.User,
        id: params.ownerId,
        childEndpoint: Modules.Example,
      }).generate(),
    });
  }

  /**
   * POST create new example
   */
  static async create(params: ExampleInput): Promise<ExampleInterface> {
    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.POST,
      endpoint: new EndpointCreator({ endpoint: Modules.Example }).generate(),
      input: params,  // Model.createJsonApi() handles conversion
    });
  }

  /**
   * PUT update example
   */
  static async update(params: ExampleInput): Promise<ExampleInterface> {
    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.PUT,
      endpoint: new EndpointCreator({
        endpoint: Modules.Example,
        id: params.id,
      }).generate(),
      input: params,  // Model.createJsonApi() handles conversion
    });
  }

  /**
   * DELETE example
   */
  static async delete(params: { id: string }): Promise<void> {
    await this.callApi({
      type: Modules.Example,
      method: HttpMethod.DELETE,
      endpoint: new EndpointCreator({
        endpoint: Modules.Example,
        id: params.id,
      }).generate(),
    });
  }

  /**
   * POST add person with edge properties (code, expiresAt)
   * Uses dedicated model method - NEVER use overridesJsonApiCreation
   */
  static async addPerson(params: {
    exampleId: string;
    personId: string;
    code: string;
    expiresAt?: string;
  }): Promise<ExampleInterface> {
    const example = new Example();
    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.POST,
      endpoint: new EndpointCreator({
        endpoint: Modules.Example,
        id: params.exampleId,
        childEndpoint: Modules.Person,
        childId: params.personId,
      }).generate(),
      input: example.createAddPersonJsonApi({
        personId: params.personId,
        code: params.code,
        expiresAt: params.expiresAt,
      }),
      overridesJsonApiCreation: true,  // OK - model method provides proper structure
    });
  }

  /**
   * POST add item with position (edge property)
   * Uses dedicated model method
   */
  static async addItem(params: {
    exampleId: string;
    itemId: string;
    position: number;
  }): Promise<ExampleInterface> {
    const example = new Example();
    return this.callApi({
      type: Modules.Example,
      method: HttpMethod.POST,
      endpoint: new EndpointCreator({
        endpoint: Modules.Example,
        id: params.exampleId,
        childEndpoint: Modules.Item,
        childId: params.itemId,
      }).generate(),
      input: example.createAddItemJsonApi({
        itemId: params.itemId,
        position: params.position,
      }),
      overridesJsonApiCreation: true,  // OK - model method provides proper structure
    });
  }
}
```

---

## WRONG vs RIGHT Examples

### fetch() vs callApi()

```typescript
// ❌ WRONG - Using fetch directly
static async findOne(id: string) {
  const response = await fetch(`/api/examples/${id}`);
  const json = await response.json();
  return json.data;  // Raw JSON:API, not typed!
}

// ✅ CORRECT - Using callApi
static async findOne(params: { id: string }): Promise<ExampleInterface> {
  return this.callApi<ExampleInterface>({
    type: Modules.Example,
    method: HttpMethod.GET,
    endpoint: new EndpointCreator({
      endpoint: Modules.Example,
      id: params.id,
    }).generate(),
  });
}
```

### Edge Properties: Manual vs Dedicated Model Method

```typescript
// ❌ WRONG - Manual JSON:API construction in service
static async addItem(exampleId: string, itemId: string, position: number) {
  return this.callApi({
    method: HttpMethod.POST,
    endpoint: `examples/${exampleId}/items/${itemId}`,
    input: {
      data: {
        type: "items",
        id: itemId,
        meta: { position },
      }
    },
    overridesJsonApiCreation: true,  // BAD - manual construction
  });
}

// ✅ CORRECT - Use dedicated model method
static async addItem(params: {
  exampleId: string;
  itemId: string;
  position: number;
}): Promise<ExampleInterface> {
  const example = new Example();
  return this.callApi({
    type: Modules.Example,
    method: HttpMethod.POST,
    endpoint: new EndpointCreator({
      endpoint: Modules.Example,
      id: params.exampleId,
      childEndpoint: Modules.Item,
      childId: params.itemId,
    }).generate(),
    input: example.createAddItemJsonApi({
      itemId: params.itemId,
      position: params.position,
    }),
    overridesJsonApiCreation: true,  // OK - model handles structure
  });
}
```

### Standard CRUD: overridesJsonApiCreation vs input

```typescript
// ❌ WRONG - Unnecessary overridesJsonApiCreation
static async create(data: ExampleInput) {
  return this.callApi({
    method: HttpMethod.POST,
    endpoint: "examples",
    input: {
      data: {
        type: "examples",
        id: data.id,
        attributes: { name: data.name },
      }
    },
    overridesJsonApiCreation: true,  // UNNECESSARY!
  });
}

// ✅ CORRECT - Let model handle JSON:API
static async create(params: ExampleInput): Promise<ExampleInterface> {
  return this.callApi({
    type: Modules.Example,
    method: HttpMethod.POST,
    endpoint: new EndpointCreator({ endpoint: Modules.Example }).generate(),
    input: params,  // Model.createJsonApi() handles it
  });
}
```

---

## Error Handling

Services handle errors through the framework:
- API errors are caught and transformed by `callApi()`
- 404 responses result in `undefined` or empty arrays
- Network errors propagate as exceptions

```typescript
// Error handling in components
try {
  const example = await ExampleService.findOne({ id: exampleId });
  if (!example) {
    // Handle not found
  }
} catch (error) {
  // Handle network or server errors
}
```

---

**Next**: See [template.md](./template.md) for copy-paste ready code
