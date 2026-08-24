---
id: frontend-02-interfaces
title: "Frontend: Interfaces"
applies_to: frontend
layer: interface
depends_on:
  - core-principles
source_files:
  - "apps/web/src/features/*/data/*Interface.ts"
related_docs:
  - frontend-01-models
  - frontend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Frontend: Interfaces

---

## WHEN TO USE
Read this file when:
- Creating a new frontend model (interface first)
- Adding new properties to existing models
- Defining edge property interfaces for relationships

---

## CRITICAL RULES

1. **Match backend nullability** - If backend can return null/undefined, make it optional in interface.
2. **Use getter syntax** - `get propertyName(): Type` for all properties.
3. **Extend `ApiDataInterface`** - All interfaces extend the base interface.
4. **Define edge property interfaces separately** - Create dedicated interface for relationship metadata.
5. **Type date/datetime fields as `Date`** — when the backend descriptor declares `type: "date"` or `"datetime"`, the interface getter MUST be `Date` (or `Date | undefined`), never `string`. The wire format is a string; the model's `rehydrate()` is responsible for converting it. See [../date-handling.md](../date-handling.md).

---

## DECISION MATRIX

### Optional vs Required Properties

| Backend Returns | Interface |
|-----------------|-----------|
| Always has value | `get name(): string;` |
| Can be null/undefined | `get description(): string \| undefined;` |
| Array (can be empty) | `get items(): ItemInterface[];` |
| Relationship (may not be included) | `get owner(): UserInterface \| undefined;` |

### When to Create Edge Property Interface

| Question | Answer |
|----------|--------|
| Relationship has edge properties in entity descriptor? | **Yes** - Create separate interface |
| Simple relationship without metadata? | **No** - Just use entity interface |

---

## COMMON MISTAKES

- Making required fields optional
- Making optional fields required
- Forgetting to extend `ApiDataInterface`
- Not defining edge property interface for relationships with metadata

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [01-models.md](01-models.md) | Model implements interface |
| [template.md](template.md) | Copy-paste ready code |

---

## Interface Pattern

```typescript
// ExampleInterface.ts
import { ApiDataInterface } from "@carlonicora/nextjs-jsonapi";
import { PersonInterface } from "../../person/data/PersonInterface";
import { ItemInterface } from "../../item/data/ItemInterface";
import { UserInterface } from "../../user/data/UserInterface";

// Edge metadata for person relationship
export interface PersonRelationshipMeta {
  code: string;
  completed: boolean;
  expiresAt?: string;
}

export interface ExampleInterface extends ApiDataInterface {
  // Required attribute - always has value
  get name(): string;

  // Optional attribute - can be undefined
  get description(): string | undefined;

  // Array attribute - always returns array (may be empty)
  get sampleItems(): string[];

  // Computed property
  get itemCount(): number;

  // Single relationship - may not be included
  get owner(): UserInterface | undefined;

  // Array relationship - always returns array (may be empty)
  get items(): ItemInterface[];

  // Relationship with edge properties - merged with edge metadata
  get persons(): (PersonInterface & PersonRelationshipMeta)[];
}
```

---

## Input Type Pattern

Input types define the structure for create/update operations.

```typescript
// ExampleInput.ts
export type ExampleInput = {
  id: string;                    // Always required for JSON:API
  name: string;                  // Required attribute
  description?: string;          // Optional attribute
  ownerId: string;               // Required relationship
  itemIds?: string[];      // Optional relationship
  personIds?: string[];          // Optional relationship
};
```

---

## Edge Property Interface Pattern

When a relationship has edge properties (defined in backend entity descriptor's `fields` array):

```typescript
// Define edge property interface
export interface PersonRelationshipMeta {
  code: string;           // Required edge property
  completed: boolean;     // Required edge property
  expiresAt?: string;     // Optional edge property
}

// Use in interface with intersection type
get persons(): (PersonInterface & PersonRelationshipMeta)[];
```

This allows accessing both entity properties and edge properties:

```typescript
const person = example.persons[0];
console.log(person.name);       // From PersonInterface
console.log(person.code);       // From PersonRelationshipMeta
console.log(person.completed);  // From PersonRelationshipMeta
```

---

## Relationship Input for Edge Properties

For operations that add related entities with edge properties:

```typescript
// ExampleInput.ts - for standard create/update
export type ExampleInput = {
  id: string;
  name: string;
  ownerId: string;
  itemIds?: string[];  // Simple array of IDs
};

// ExampleAddItemInput.ts - for add item with position
export type ExampleAddItemInput = {
  exampleId: string;
  itemId: string;
  position: number;  // Edge property
};

// ExampleAddPersonInput.ts - for add person with access code
export type ExampleAddPersonInput = {
  exampleId: string;
  personId: string;
  code: string;           // Edge property
  expiresAt?: string;     // Edge property
};
```

---

**Next**: See [03-services.md](./03-services.md) for API communication patterns
