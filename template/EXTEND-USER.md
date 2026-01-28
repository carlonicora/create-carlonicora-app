# Extending UserModule from nestjs-neo4jsonapi

## Executive Summary

This document explains how to extend the `UserModule` from `@carlonicora/nestjs-neo4jsonapi` in your application **without modifying the base package**. The solution uses a **Model Registry Replacement Pattern** that allows you to add new properties and relationships to the User entity while keeping the same API endpoints.

---

## The Problem

You want to extend the `UserModule` functionality to:
1. Add new properties to the User entity
2. Add new relationships from User to other entities
3. Have the existing `/users` endpoints return the extended data
4. Not modify the base `nestjs-neo4jsonapi` package

### Why This Is Challenging

The base `UserModule` in `nestjs-neo4jsonapi`:
- Registers its own `UserController` with routes like `GET /users`, `GET /users/:id`
- Uses `UserService` which serializes data using `UserModel`
- Is imported via `FoundationsModule` which is loaded **before** your app modules

In NestJS, you cannot easily override controllers from imported modules. The base routes are registered first and take precedence.

### The Initial (Wrong) Approach

Creating new endpoints like `/users/:id/extended` would:
- Require frontend changes everywhere users are fetched
- Not truly "extend" the module - it creates a parallel system
- Break the frontend's existing user handling in `nextjs-jsonapi`

---

## The Solution: Model Registry Replacement Pattern

### How It Works

> **`modelRegistry.register()` replaces any existing model with the same `nodeName`**

When you register an `ExtendedUserModel` with `nodeName: "user"`, it **replaces** the base `UserModel`. The base `UserController` continues to work, but now uses your extended serializer!

```
1. FoundationsModule loads → UserModule registers UserModel in modelRegistry
   ↓
2. Your FeaturesModules loads → ExtendedUserModule registers ExtendedUserModel
   ↓
3. ExtendedUserModel REPLACES UserModel (same nodeName: "user")
   ↓
4. Request comes to GET /users/:id
   ↓
5. Base UserController handles it → calls UserService
   ↓
6. UserService uses JsonApiService.buildSingle(model, data)
   ↓
7. JsonApiService looks up model in modelRegistry → gets ExtendedUserModel!
   ↓
8. ExtendedUserSerialiser.create() is called
   ├─ super.create() → base attributes + relationships
   └─ adds YOUR new relationships
   ↓
9. Response includes extended data in JSON:API format
   ↓
10. Frontend User.rehydrate() parses the extended relationships
```

**Result: Same `/users` endpoints, extended data, no base package modifications!**

---

## Implementation Guide

### File Structure

```
apps/api/src/features/extended-user/
├── extended-user.module.ts
├── entities/
│   ├── extended-user.entity.ts
│   ├── extended-user.model.ts
│   └── extended-user.map.ts
└── serialisers/
    └── extended-user.serialiser.ts

apps/web/src/features/user/
├── data/
│   ├── User.ts
│   └── UserInterface.ts
└── UserModule.ts
```

### Backend Implementation

**Step 1:** Create `extended-user.entity.ts`
```typescript
import { User } from "@carlonicora/nestjs-neo4jsonapi";
// Import your relationship entities

export type ExtendedUser = User & {
  // Add your new relationships here
};
```

**Step 2:** Create `extended-user.map.ts`
```typescript
import { EntityFactory, mapUser } from "@carlonicora/nestjs-neo4jsonapi";
import { ExtendedUser } from "./extended-user.entity";

export const mapExtendedUser = (params: {
  data: any;
  record: any;
  entityFactory: EntityFactory
}): ExtendedUser => {
  return {
    ...mapUser(params),
    // Initialize new relationships as empty arrays
  };
};
```

**Step 3:** Create `extended-user.model.ts`
```typescript
import {
  companyMeta,
  DataModelInterface,
  moduleMeta,
  roleMeta,
  userMeta
} from "@carlonicora/nestjs-neo4jsonapi";
import { ExtendedUser } from "./extended-user.entity";
import { mapExtendedUser } from "./extended-user.map";
import { ExtendedUserSerialiser } from "../serialisers/extended-user.serialiser";

export const ExtendedUserModel: DataModelInterface<ExtendedUser> = {
  ...userMeta,
  entity: undefined as unknown as ExtendedUser,
  mapper: mapExtendedUser,
  serialiser: ExtendedUserSerialiser,
  childrenTokens: [
    roleMeta.nodeName,
    moduleMeta.nodeName,
    // Add your new relationship nodeNames
  ],
  singleChildrenTokens: [companyMeta.nodeName],
};
```

**Step 4:** Create `extended-user.serialiser.ts`
```typescript
import { JsonApiDataInterface, UserSerialiser } from "@carlonicora/nestjs-neo4jsonapi";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ExtendedUserSerialiser extends UserSerialiser {
  create(): JsonApiDataInterface {
    const response = super.create();

    // Add your new relationships here
    // response.relationships[`yourrelation`] = {
    //   name: `yourrelations`,
    //   data: this.serialiserFactory.create(YourRelationModel),
    // };

    return response;
  }
}
```

**Step 5:** Create `extended-user.module.ts`
```typescript
import { modelRegistry, S3Module, UserModule } from "@carlonicora/nestjs-neo4jsonapi";
import { Module, OnModuleInit } from "@nestjs/common";
import { ExtendedUserModel } from "./entities/extended-user.model";
import { ExtendedUserSerialiser } from "./serialisers/extended-user.serialiser";

@Module({
  providers: [ExtendedUserSerialiser],
  exports: [ExtendedUserSerialiser],
  imports: [UserModule, S3Module],
})
export class ExtendedUserModule implements OnModuleInit {
  onModuleInit() {
    modelRegistry.register(ExtendedUserModel);
  }
}
```

**Step 6:** Register in `features.modules.ts`
```typescript
import { ExtendedUserModule } from "src/features/extended-user/extended-user.module";

@Module({
  imports: [
    ExtendedUserModule,
    // ... other modules
  ],
})
export class FeaturesModules {}
```

### Frontend Implementation

**Step 1:** Create/Update `User.ts`
```typescript
import { JsonApiHydratedDataInterface, Modules } from "@carlonicora/nextjs-jsonapi/core";
import { User as OriginalUser } from "@carlonicora/nextjs-jsonapi/core";
import { UserInterface } from "./UserInterface";

export class User extends OriginalUser implements UserInterface {
  // Add private properties for new relationships

  // Add getters

  rehydrate(data: JsonApiHydratedDataInterface): this {
    super.rehydrate(data);

    // Extract new relationships using _readIncluded()

    return this;
  }
}
```

**Step 2:** Create/Update `UserInterface.ts`
```typescript
import { UserInterface as OriginalUserInterface } from "@carlonicora/nextjs-jsonapi/core";

export interface UserInterface extends OriginalUserInterface {
  // Declare getters for new relationships
}
```

**Step 3:** Update `UserModule.ts` inclusions
```typescript
inclusions: {
  lists: {
    fields: [
      createJsonApiInclusion("users", [`name`, `email`, `avatar`]),
      // Add inclusions for new relationships
    ],
  },
},
```

---

## Verification

1. **Start API:** `pnpm --filter {{name}}-api dev`
2. **Test endpoint:** `GET /users/:id` - should return extended data
3. **Check response:** New relationships should appear in JSON:API `included` array
4. **Frontend test:** User objects should have new relationship getters populated

---

## Benefits of This Pattern

| Benefit | Description |
|---------|-------------|
| **Non-invasive** | Base package remains unchanged |
| **Same endpoints** | `/users` routes work as before |
| **Frontend compatible** | Just extend the User class |
| **Type-safe** | Full TypeScript support |
| **Maintainable** | Clear separation of concerns |

---

## Key Concepts Recap

1. **Model Registry** - Global singleton that stores all entity models by `nodeName`
2. **Model Replacement** - Calling `modelRegistry.register()` with same `nodeName` replaces the existing model
3. **Serializer Extension** - Extend base serializer, call `super.create()`, add relationships
4. **Frontend Rehydration** - Override `rehydrate()` to parse extended data from JSON:API includes
5. **Inclusions** - Tell the API which relationships to include in responses
