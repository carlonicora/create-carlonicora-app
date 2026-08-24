---
id: backend-01-entity-basics
title: "Backend: Entity Basics"
applies_to: backend
layer: entity
depends_on:
  - core-principles
source_files:
  - "apps/api/src/features/*/entities/*.ts"
  - "apps/api/src/features/*/entities/*.meta.ts"
related_docs:
  - backend-02-dtos
  - backend-03-repositories
  - backend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Backend: Entity Basics

---

## WHEN TO USE
Read this file when:
- Creating a new entity
- Adding/modifying fields on an existing entity
- Adding/modifying relationships
- Adding computed properties or transforms

---

## CRITICAL RULES

1. **Entity Descriptor is the single source of truth** - Fields, relationships, and computed properties are all defined here.
2. **Metadata file is separate** - JSON:API type, endpoint, Neo4j label in `.meta.ts` file.
3. **Export both the type and the descriptor** - `export type Example = ...` and `export const ExampleDescriptor = ...`

---

## ENFORCEMENT CHECKPOINT

> **STOP — Before committing entity code, verify:**
> 1. Is the Descriptor exported alongside the type? If no, **STOP**.
> 2. Are computed values in `computed`, not `fields`? If a derived value is in `fields`, **STOP**.
> 3. Are relationship directions correct from THIS entity's perspective? If unsure, **STOP** and check the Decision Matrix below.
> 4. Is the model registered in the module's `onModuleInit()`? If no, **STOP**.

---

## DECISION MATRIX

### Field vs Computed Property

| Question | Answer |
|----------|--------|
| Is the value stored directly in Neo4j node? | **Field** |
| Is it derived from query results (count, sum, aggregation)? | **Computed** |
| Does it come from related nodes collected in query? | **Computed** |
| Is it a simple atomic value (string, number, boolean)? | **Field** |

### Relationship Direction

| Question | Use Direction |
|----------|---------------|
| Does this entity OWN/CREATE/CONTAIN the related entity? | `direction: "out"` |
| Is this entity OWNED_BY/BELONGS_TO the related entity? | `direction: "in"` |
| e.g. Example CONTAINS Items | `direction: "out"` |
| e.g. User CREATED Example | `direction: "in"` (from Example's perspective) |

### When to Use Edge Properties

| Question | Answer |
|----------|--------|
| Does the relationship need metadata (position, code, timestamp)? | Add `fields` array |
| Is it just a simple association? | No `fields` array needed |
| e.g. position of an Item inside an Example | `fields: [{ name: "position", type: "number" }]` |

---

## COMMON MISTAKES

- Putting computed values in `fields` instead of `computed`
- Wrong relationship direction (remember: from THIS entity's perspective)
- Missing `dtoKey` on relationships (defaults to relationship name)
- Forgetting to export the descriptor type

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [02-dtos.md](02-dtos.md) | After defining entity, create DTOs |
| [03-repositories.md](03-repositories.md) | When computed properties need custom queries |
| [template.md](template.md) | Copy-paste ready code |

---

## Entity Metadata

Every entity has a metadata file defining its JSON:API type and Neo4j labels.

```typescript
// example.meta.ts
import { DataMeta } from "@carlonicora/nestjs-neo4jsonapi";

export const exampleMeta: DataMeta = {
  type: "examples",        // JSON:API type (plural, kebab-case)
  endpoint: "examples",    // HTTP endpoint path
  nodeName: "example",      // Neo4j query variable name
  labelName: "Example",     // Neo4j node label (PascalCase)
};
```

---

## Entity Type Definition

```typescript
// example.ts
import { Company, defineEntity, Entity, ownerMeta, S3Service, User } from "@carlonicora/nestjs-neo4jsonapi";
import { exampleMeta } from "./example.meta";
import { Item } from "../../item/entities/item";
import { itemMeta } from "../../item/entities/item.meta";
import { Person } from "../../person/entities/person";
import { personMeta } from "../../person/entities/person.meta";

/**
 * Entity Type - TypeScript type definition
 * Extends Entity base type with entity-specific properties
 */
export type Example = Entity & {
  name: string;
  description?: string;
  sampleItems?: string[];  // Computed - derived from query
  itemCount?: number;           // Computed - count from query
  company: Company;
  owner: User;
  item?: Item[];
  person?: Person[];
};
```

---

## Entity Descriptor Definition

```typescript
export const ExampleDescriptor = defineEntity<Example>()({
  ...exampleMeta,  // Spread metadata

  // Services available in transforms
  injectServices: [S3Service],

  // Field definitions (atomic properties stored in Neo4j node)
  fields: {
    name: { type: "string", required: true },
    description: { type: "string" },
    sampleItems: {
      type: "string[]",
      // Transform: convert S3 keys to signed URLs
      transform: async (data, services) => {
        if (!data.sampleItems?.length) return [];
        return Promise.all(
          data.sampleItems.map((url: string) =>
            services.S3Service.generateSignedUrl({ key: url })
          )
        );
      },
    },
    itemCount: { type: "number" },
  },

  // Computed properties (derived from Neo4j query results)
  computed: {
    sampleItems: {
      compute: (params) => {
        if (!params.record.has("sampleItems")) return [];
        const items = params.record.get("sampleItems") || [];
        return items.map((p: any) => p?.properties?.url).filter(Boolean);
      },
    },
    itemCount: {
      compute: (params) => {
        if (!params.record.has("itemCount")) return params.data?.itemCount;
        const count = params.record.get("itemCount");
        if (count?.toNumber) return count.toNumber();
        return Number(count) || 0;
      },
    },
  },

  // Relationship definitions
  relationships: {
    owner: {
      model: ownerMeta,
      direction: "in",           // User CREATED Example → incoming to Example
      relationship: "CREATED",   // Neo4j relationship type
      cardinality: "one",        // Single relationship
      dtoKey: "owner",           // Key in DTOs
    },
    item: {
      model: itemMeta,
      direction: "out",          // Example CONTAINS Items → outgoing from Example
      relationship: "CONTAINS",
      cardinality: "many",       // Collection
      required: false,
      dtoKey: "items",
      // Edge properties (stored on the relationship)
      fields: [{ name: "position", type: "number", required: true }],
    },
    person: {
      model: personMeta,
      direction: "in",           // Person HAS_ACCESS_TO Example → incoming to Example
      relationship: "HAS_ACCESS_TO",
      cardinality: "many",
      required: false,
      dtoKey: "persons",
      // Edge properties for access control
      fields: [
        { name: "code", type: "string", required: true },
        { name: "expiresAt", type: "datetime", required: false },
      ],
    },
  },
});

export type ExampleDescriptorType = typeof ExampleDescriptor;
```

---

## Field Types

| Type | Description | Neo4j Type |
|------|-------------|------------|
| `"string"` | Text | String |
| `"number"` | Numeric | Integer/Float |
| `"boolean"` | True/false | Boolean |
| `"date"` | Date only | Date |
| `"datetime"` | Date and time | DateTime |
| `"string[]"` | Array of strings | List<String> |
| `"number[]"` | Array of numbers | List<Integer> |

### Dates and DateTimes — non-negotiable

A field that represents a calendar date MUST be `type: "date"`. A field that
represents an instant in time MUST be `type: "datetime"`. **Never declare a
temporal field as `"string"`** — the framework reads the descriptor to emit
the correct Cypher cast (`date(left($v, 10))` / `datetime($v)`), and if the
type is wrong the value lands in Neo4j as a `String` and Cypher temporal
operators silently break.

Full lifecycle (descriptor → DTO → repository → frontend) and verification
checklist: **[../date-handling.md](../date-handling.md)**.

---

**Next**: See [02-dtos.md](./02-dtos.md) for Data Transfer Objects
