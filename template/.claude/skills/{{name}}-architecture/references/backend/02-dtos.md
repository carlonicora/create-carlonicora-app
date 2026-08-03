---
id: backend-02-dtos
title: "Backend: DTOs"
applies_to: backend
layer: dto
depends_on:
  - backend-01-entity-basics
source_files:
  - "apps/api/src/features/*/dtos/*.ts"
related_docs:
  - backend-05-controllers
  - backend-template
enforcement: critical
last_updated: "2026-03-01"
---

# Backend: DTOs (Data Transfer Objects)

---

## WHEN TO USE
Read this file when:
- Creating DTOs for a new entity
- Adding validation to existing DTOs
- Creating relationship DTOs for edge properties

---

## CRITICAL RULES

1. **DTOs match entity definition** - Required in entity = required in POST DTO.
2. **PUT requires all fields** - Full replacement semantics.
3. **PATCH makes all fields optional** - Partial update semantics.
4. **Relationship DTOs for edge properties** - When relationship has `fields`, create dedicated DTOs.
5. **Use `@IsDateString()` for date/datetime attributes** - never `@IsString()`. The descriptor declares the field as `"date"` or `"datetime"`; the DTO is the wire-format guard. See [../date-handling.md](../date-handling.md).

---

## DECISION MATRIX

### Required vs Optional Fields

| DTO Type | Attributes | Relationships |
|----------|------------|---------------|
| **POST** | Required fields = `@IsDefined()`, Optional = `@IsOptional()` | Required relationships = `@IsDefined()` |
| **PUT** | Same as POST (full replacement) | Same as POST |
| **PATCH** | All fields `@IsOptional()` | All relationships `@IsOptional()` |

### When to Create Relationship DTOs

| Question | Answer |
|----------|--------|
| Does relationship have edge properties (fields array)? | **Yes** - Create relationship DTO |
| Is it a simple association without metadata? | **No** - Use standard entity DTO |

---

## COMMON MISTAKES

- Making required fields optional in POST DTO
- Forgetting `@Type(() => ClassName)` decorator for nested validation
- Missing `@ValidateNested()` on nested objects
- Using wrong meta type for relationship DTOs

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [01-entity-basics.md](01-entity-basics.md) | Understand entity field requirements |
| [05-controllers.md](05-controllers.md) | How DTOs are used in controllers |
| [template.md](template.md) | Copy-paste ready DTO code |

---

## JSON:API Request Structure

```json
{
  "data": {
    "type": "examples",
    "id": "uuid-here",
    "attributes": {
      "name": "My Example",
      "description": "A description"
    },
    "relationships": {
      "owner": {
        "data": { "type": "users", "id": "user-uuid" }
      },
      "items": {
        "data": [
          { "type": "items", "id": "item-1", "meta": { "position": 1 } }
        ]
      }
    }
  }
}
```

---

## Reference DTO (for relationship references)

```typescript
// <entity>.dto.ts
import { Type } from "class-transformer";
import { Equals, IsNotEmpty, IsUUID, ValidateNested } from "class-validator";
import { exampleMeta } from "../entities/example.meta";

export class ExampleDTO {
  @Equals(exampleMeta.endpoint)  // Must match type
  type: string;

  @IsUUID()
  id: string;
}

export class ExampleDataDTO {
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExampleDTO)
  data: ExampleDTO;
}

export class ExampleDataListDTO {
  @ValidateNested({ each: true })
  @IsNotEmpty()
  @Type(() => ExampleDTO)
  data: ExampleDTO[];
}
```

---

## POST DTO (Create)

```typescript
// <entity>.post.dto.ts
import { UserDataDTO } from "@carlonicora/nestjs-neo4jsonapi";
import { Type } from "class-transformer";
import {
  Equals, IsDefined, IsNotEmpty, IsOptional,
  IsString, IsUUID, ValidateNested,
} from "class-validator";
import { exampleMeta } from "../entities/example.meta";

export class ExamplePostAttributesDTO {
  @IsDefined()       // Required in entity = @IsDefined()
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()      // Optional in entity = @IsOptional()
  @IsString()
  description?: string;
}

export class ExamplePostRelationshipsDTO {
  @ValidateNested()
  @IsDefined()       // Required relationship
  @Type(() => UserDataDTO)
  owner: UserDataDTO;
}

export class ExamplePostDataDTO {
  @Equals(exampleMeta.endpoint)
  type: string;

  @IsUUID()
  id: string;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePostAttributesDTO)
  attributes: ExamplePostAttributesDTO;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePostRelationshipsDTO)
  relationships: ExamplePostRelationshipsDTO;
}

export class ExamplePostDTO {
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePostDataDTO)
  data: ExamplePostDataDTO;
}
```

---

## PUT DTO (Full Update)

Same structure as POST DTO - full replacement semantics, all required fields stay required.

---

## Relationship DTOs (for Edge Properties)

When a relationship has edge properties (defined in entity descriptor's `fields` array), create dedicated DTOs for add/update operations.

```typescript
// <entity>.relationship.dto.ts
import { Type } from "class-transformer";
import { IsDefined, IsNumber, IsOptional, ValidateNested } from "class-validator";

// Meta DTO for edge properties
export class ExampleItemsMetaDTO {
  @IsDefined()
  @IsNumber()
  position: number;
}

// Data DTO with optional meta
export class ExampleItemsAddSingleDataDTO {
  @ValidateNested()
  @IsOptional()
  @Type(() => ExampleItemsMetaDTO)
  meta?: ExampleItemsMetaDTO;
}

// Top-level wrapper
export class ExampleItemsAddSingleDTO {
  @ValidateNested()
  @IsOptional()
  @Type(() => ExampleItemsAddSingleDataDTO)
  data?: ExampleItemsAddSingleDataDTO;
}
```

---

## Error Handling

DTOs automatically throw validation errors when:
- Required fields are missing (`@IsDefined()`)
- Type validation fails (`@IsString()`, `@IsNumber()`, etc.)
- Nested validation fails (`@ValidateNested()`)
- Type mismatch (`@Equals(meta.endpoint)`)

The framework returns 400 Bad Request with validation error details.

---

**Next**: See [03-repositories.md](./03-repositories.md) for data access patterns
