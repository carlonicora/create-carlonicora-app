# Core Principles

---

## WHEN TO USE
Read this file **first** before working on any entity. These principles apply to ALL code in this architecture.

---

## CRITICAL RULES

1. **ALWAYS use framework abstractions** - No exceptions. If you're manually constructing JSON:API structures, you have a bug.
2. **NEVER return raw Neo4j records** - Repositories return typed objects via `readOne`/`readMany`.
3. **NEVER bypass company filtering** - Use `buildDefaultMatch()` which auto-injects company scope.
4. **NEVER use `fetch()` directly in frontend** - Use `callApi()` which handles rehydration.
5. **NEVER use `overridesJsonApiCreation`** - Create dedicated relationship methods in models instead.

---

## DECISION MATRIX

| Question | Answer |
|----------|--------|
| Should I manually construct JSON:API? | **NO** - Framework handles it |
| Should I write raw Cypher without `buildDefaultMatch()`? | **NO** - Security risk |
| Should I use `fetch()` in frontend services? | **NO** - Use `callApi()` |
| Should I return `result.records` from repository? | **NO** - Use `readOne`/`readMany` |
| Should I use `overridesJsonApiCreation`? | **NO** - Create dedicated model method |

---

## COMMON MISTAKES

- Returning raw Neo4j records instead of typed objects
- Manually filtering by company instead of using `buildDefaultMatch()`
- Using `fetch()` instead of `callApi()` in frontend
- Manually constructing JSON:API payloads
- Using `overridesJsonApiCreation` instead of proper model methods

---

## RELATED FILES

| File | When to read |
|------|--------------|
| [backend/01-entity-basics.md](backend/01-entity-basics.md) | Creating/modifying entity definitions |
| [backend/02-dtos.md](backend/02-dtos.md) | Creating/modifying request validation |
| [backend/03-repositories.md](backend/03-repositories.md) | Writing data access queries |
| [backend/04-services.md](backend/04-services.md) | Adding business logic |
| [backend/05-controllers.md](backend/05-controllers.md) | Adding HTTP endpoints |
| [frontend/01-models.md](frontend/01-models.md) | Creating/modifying frontend models |
| [frontend/03-services.md](frontend/03-services.md) | Writing API calls |
| [anti-patterns.md](anti-patterns.md) | Reviewing code for mistakes |

---

## Architecture Overview

This architecture provides **automatic, type-safe JSON:API compliance** for both backend and frontend.

### Principles Explained

1. **JSON:API Spec Compliance**: All API responses follow the JSON:API specification automatically through Entity Descriptors and serializers.

2. **Type Safety**: TypeScript types flow from entity definitions through DTOs, services, and API responses. The types are defined once and enforced everywhere.

3. **Security by Default**: Company-scoped queries are automatically filtered via `ClsService`. You cannot accidentally query another company's data.

4. **No Manual Serialization**: Entity Descriptors define the shape. The framework serializes/deserializes automatically.

5. **Repositories Return Objects**: `readOne` and `readMany` return typed objects, never raw Neo4j records.

### How It Works

**Backend Flow:**
```
HTTP Request → Controller → Service → Repository → Neo4j
                                         ↓
HTTP Response ← Controller ← Service ← Typed Object
```

**Frontend Flow:**
```
callApi() → HTTP Request → API
              ↓
Typed Object ← Model.rehydrate() ← JSON:API Response
```

---

**Next**: Read the relevant backend or frontend files based on your task. See [INDEX.md](./INDEX.md) for navigation.
