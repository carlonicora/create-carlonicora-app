---
id: frontend-01-models
title: "Frontend: Models"
applies_to: frontend
layer: model
depends_on:
  - core-principles
  - frontend-02-interfaces
source_files:
  - "apps/web/src/features/*/data/*.ts"
  - "packages/nextjs-jsonapi/src/core/AbstractApiData.ts"
related_docs:
  - frontend-03-services
  - frontend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Frontend: Models

---

## WHEN TO USE
Read this file when:
- Creating a new frontend model
- Adding rehydration for new fields/relationships
- Creating JSON:API payloads for create/update
- Adding dedicated relationship methods

---

## CRITICAL RULES

1. **ALWAYS implement `rehydrate()`** - Deserializes JSON:API response to typed object.
2. **ALWAYS implement `createJsonApi()`** - Serializes input to JSON:API request.
3. **Use `_readIncluded()` for simple relationships** - Single or array relationships without edge properties.
4. **Use `_readIncludedWithMeta()` ONLY for edge properties** - When relationship has metadata (position, code, etc.).
5. **Create dedicated methods for relationship operations** - Instead of using `overridesJsonApiCreation` in services.
6. **Date/datetime fields:** in `rehydrate()`, parse wire strings with `new Date(...)`. In `createJsonApi()`, emit dates with `formatLocalDate(d)` (`YYYY-MM-DD`) and datetimes with `d.toISOString()`. **Never pass a raw `Date` to a JSON:API attribute** - `JSON.stringify` UTC-shifts and can lose a day. See [../date-handling.md](../date-handling.md).

---

## DECISION MATRIX

### `_readIncluded()` vs `_readIncludedWithMeta()`

| Question | Method |
|----------|--------|
| Simple relationship without edge properties? | `_readIncluded()` |
| Relationship has edge properties (position, code, timestamp)? | `_readIncludedWithMeta()` |

### When to Create Dedicated Relationship Methods

| Question | Answer |
|----------|--------|
| Need to add related entity with edge properties? | **Create method like `createAddItemJsonApi()`** |
| Service would need `overridesJsonApiCreation`? | **Create dedicated model method instead** |
| Standard entity create/update? | **Use standard `createJsonApi()`** |

---

## COMMON MISTAKES

- Using `_readIncludedWithMeta()` when there are no edge properties
- Using `overridesJsonApiCreation` in service instead of dedicated model method
- Forgetting to call `super.rehydrate(data)` at start of rehydrate()
- Forgetting to return `this` from rehydrate()
- Passing a raw `Date` through `createJsonApi()` for a `"date"` field - `JSON.stringify` UTC-shifts. Wrap in `formatLocalDate(d)`. See [../date-handling.md](../date-handling.md).

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [02-interfaces.md](02-interfaces.md) | Define interface before model |
| [03-services.md](03-services.md) | Services call model methods |
| [template.md](template.md) | Copy-paste ready code |

---

## Model Pattern

```typescript
// Example.ts
import { AbstractApiData } from "@carlonicora/nextjs-jsonapi";
import { JsonApiHydratedDataInterface } from "@carlonicora/nextjs-jsonapi";
import { ExampleInput } from "./ExampleInput";
import { ExampleInterface, ItemRelationshipMeta } from "./ExampleInterface";
import { Modules } from "@/core/registry/Modules";
import { ItemInterface } from "../../<domain>/data/ItemInterface";
import { UserInterface } from "../../user/data/UserInterface";

export class Example extends AbstractApiData implements ExampleInterface {
  private _name?: string;
  private _description?: string;
  private _itemCount?: number;
  private _owner?: UserInterface;
  private _items?: (ItemInterface & ItemRelationshipMeta)[];

  // Getters
  get name(): string { return this._name ?? ""; }
  get description(): string | undefined { return this._description; }
  get itemCount(): number { return this._itemCount ?? 0; }
  get owner(): UserInterface | undefined { return this._owner; }
  get items(): (ItemInterface & ItemRelationshipMeta)[] { return this._items ?? []; }

  /**
   * Deserialize JSON:API response into typed object
   */
  rehydrate(data: JsonApiHydratedDataInterface): this {
    super.rehydrate(data);  // ALWAYS call super first

    // Simple attributes
    this._name = data.jsonApi.attributes.name;
    this._description = data.jsonApi.attributes.description;
    this._itemCount = data.jsonApi.meta?.itemCount;

    // Single relationship - use _readIncluded
    this._owner = this._readIncluded(data, "owner", Modules.User) as UserInterface;

    // Relationship WITH edge metadata - use _readIncludedWithMeta
    this._items = this._readIncludedWithMeta<ItemInterface, ItemRelationshipMeta>(
      data,
      "items",
      Modules.Item,
    ) as (ItemInterface & ItemRelationshipMeta)[];

    return this;  // ALWAYS return this
  }

  /**
   * Serialize TypeScript object to JSON:API for POST/PUT
   */
  createJsonApi(data: ExampleInput) {
    const response: any = {
      data: {
        type: Modules.Example.name,
        id: data.id,
        attributes: {},
        relationships: {},
      },
      included: [],
    };

    if (data.name !== undefined) response.data.attributes.name = data.name;
    if (data.description !== undefined) response.data.attributes.description = data.description;

    if (data.ownerId) {
      response.data.relationships.owner = {
        data: {
          type: Modules.User.name,
          id: data.ownerId,
        },
      };
    }

    return response;
  }

  /**
   * Dedicated method for adding item with position (edge property)
   * Use this INSTEAD of overridesJsonApiCreation in service
   */
  createAddItemJsonApi(params: { itemId: string; position: number }) {
    return {
      data: {
        type: Modules.Item.name,
        id: params.itemId,
        meta: {
          position: params.position,
        },
      },
    };
  }
}
```

---

## Rehydration Patterns

### Simple Attributes

```typescript
rehydrate(data: JsonApiHydratedDataInterface): this {
  super.rehydrate(data);

  this._name = data.jsonApi.attributes.name;
  this._description = data.jsonApi.attributes.description;
  this._itemCount = data.jsonApi.meta?.itemCount;
  this._tags = data.jsonApi.attributes.tags ?? [];

  return this;
}
```

### Single Relationship (no edge properties)

```typescript
this._owner = this._readIncluded(data, "owner", Modules.User) as UserInterface;
```

### Array Relationship (no edge properties)

```typescript
this._items = this._readIncluded(data, "items", Modules.Item) as ItemInterface[];
```

### Relationship with Edge Properties

```typescript
this._items = this._readIncludedWithMeta<ItemInterface, ItemRelationshipMeta>(
  data,
  "items",
  Modules.Item,
) as (ItemInterface & ItemRelationshipMeta)[];
```

---

**Next**: See [02-interfaces.md](./02-interfaces.md) for type contracts
