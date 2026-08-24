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
5. **Use `@IsDateString()` for date/datetime attributes** — never `@IsString()`. The descriptor declares the field as `"date"` or `"datetime"`; the DTO is the wire-format guard. See [../date-handling.md](../date-handling.md).

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
| e.g. adding an Item with a position to an Example | Create `ExampleItemsAddSingleDTO` |

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
// example.dto.ts
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
// example.post.dto.ts
import { UserDataDTO } from "@carlonicora/nestjs-neo4jsonapi";
import { Type } from "class-transformer";
import {
  Equals, IsDefined, IsNotEmpty, IsOptional,
  IsString, IsUUID, ValidateNested,
} from "class-validator";
import { exampleMeta } from "../entities/example.meta";

// Attributes for creation
export class ExamplePostAttributesDTO {
  @IsDefined()       // Required in entity = @IsDefined()
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()      // Optional in entity = @IsOptional()
  @IsString()
  description?: string;
}

// Relationships for creation
export class ExamplePostRelationshipsDTO {
  @ValidateNested()
  @IsDefined()       // Required relationship
  @Type(() => UserDataDTO)
  owner: UserDataDTO;
}

// Complete data structure
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

// Top-level wrapper
export class ExamplePostDTO {
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePostDataDTO)
  data: ExamplePostDataDTO;
}
```

---

## PUT DTO (Full Update)

```typescript
// example.put.dto.ts
import { UserDataDTO } from "@carlonicora/nestjs-neo4jsonapi";
import { Type } from "class-transformer";
import {
  Equals, IsDefined, IsNotEmpty, IsOptional,
  IsString, IsUUID, ValidateNested,
} from "class-validator";
import { exampleMeta } from "../entities/example.meta";

export class ExamplePutAttributesDTO {
  @IsDefined()       // Same as POST - full replacement
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ExamplePutRelationshipsDTO {
  @ValidateNested()
  @IsDefined()
  @Type(() => UserDataDTO)
  owner: UserDataDTO;
}

export class ExamplePutDataDTO {
  @Equals(exampleMeta.endpoint)
  type: string;

  @IsUUID()
  id: string;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePutAttributesDTO)
  attributes: ExamplePutAttributesDTO;

  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePutRelationshipsDTO)
  relationships: ExamplePutRelationshipsDTO;
}

export class ExamplePutDTO {
  @ValidateNested()
  @IsNotEmpty()
  @Type(() => ExamplePutDataDTO)
  data: ExamplePutDataDTO;
}
```

---

## Relationship DTOs (for Edge Properties)

When a relationship has edge properties (defined in entity descriptor's `fields` array), create dedicated DTOs for add/update operations.

### Example: adding an Item to an Example with a position

```typescript
// example.relationship.dto.ts
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

### Example: adding a Person with an access code

```typescript
// example.person.relationship.dto.ts
import { Type } from "class-transformer";
import { IsDefined, IsOptional, IsString, ValidateNested } from "class-validator";

export class ExamplePersonMetaDTO {
  @IsDefined()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ExamplePersonAddSingleDataDTO {
  @ValidateNested()
  @IsOptional()
  @Type(() => ExamplePersonMetaDTO)
  meta?: ExamplePersonMetaDTO;
}

export class ExamplePersonAddSingleDTO {
  @ValidateNested()
  @IsOptional()
  @Type(() => ExamplePersonAddSingleDataDTO)
  data?: ExamplePersonAddSingleDataDTO;
}
```

### Using Relationship DTOs in Controller

```typescript
// In example.controller.ts
@Post(`${exampleMeta.endpoint}/:exampleId/${itemMeta.endpoint}/:itemId`)
async addItem(
  @Param("exampleId") exampleId: string,
  @Param("itemId") itemId: string,
  @Body() body: ExampleItemsAddSingleDTO,
) {
  // body.data.meta contains the edge properties
  const position = body.data?.meta?.position ?? 0;
  // ... add relationship with edge properties
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
