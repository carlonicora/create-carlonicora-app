# AI Architecture Guide: NestJS + Neo4j + JSON:API

> **For AI Assistants**: This guide explains the architecture patterns for this codebase. Read only the files relevant to your current task.

## Quick Reference

| Task Type | Files to Read |
|-----------|---------------|
| Backend entity | `00-core-principles.md` → `backend/01-entity-basics.md` → `backend/template.md` |
| Backend DTOs | `backend/02-dtos.md` |
| Backend data access | `backend/03-repositories.md` |
| Backend business logic | `backend/04-services.md` |
| Backend HTTP handlers | `backend/05-controllers.md` |
| Frontend model | `00-core-principles.md` → `frontend/01-models.md` → `frontend/template.md` |
| Frontend API calls | `frontend/03-services.md` |
| Frontend types | `frontend/02-interfaces.md` |
| Avoid mistakes | `anti-patterns.md` |

---

## When to Read What

### Creating a new backend entity?
Read in order:
1. `00-core-principles.md` - Core architecture rules
2. `backend/01-entity-basics.md` - Metadata & Entity Descriptors
3. `backend/02-dtos.md` - Data Transfer Objects
4. `backend/03-repositories.md` - Data access layer
5. `backend/04-services.md` - Business logic
6. `backend/05-controllers.md` - HTTP handlers
7. `backend/template.md` - Copy-paste ready code

### Modifying an existing backend entity?
Read only the relevant section:
- Adding/changing fields? → `backend/01-entity-basics.md`
- Validation changes? → `backend/02-dtos.md`
- Custom queries? → `backend/03-repositories.md`
- Business logic? → `backend/04-services.md`
- New endpoints? → `backend/05-controllers.md`

### Creating a new frontend entity?
Read in order:
1. `00-core-principles.md` - Core architecture rules
2. `frontend/02-interfaces.md` - Type contracts
3. `frontend/01-models.md` - Model pattern
4. `frontend/03-services.md` - API communication
5. `frontend/template.md` - Copy-paste ready code

### Working on frontend API calls?
Read:
1. `frontend/03-services.md` - Service patterns & callApi usage
2. `anti-patterns.md` - Common mistakes to avoid

### Debugging or reviewing code?
Read:
1. `anti-patterns.md` - What patterns indicate bugs

---

## File Descriptions

### Shared Files
| File | Description |
|------|-------------|
| `00-core-principles.md` | Foundational rules: JSON:API compliance, type safety, security defaults |
| `anti-patterns.md` | Common mistakes and how to avoid them |

### Backend Files (`backend/`)
| File | Description |
|------|-------------|
| `01-entity-basics.md` | Entity metadata (.meta.ts) and Entity Descriptors (fields, relationships, computed properties) |
| `02-dtos.md` | Data Transfer Objects for POST/PUT request validation |
| `03-repositories.md` | AbstractRepository, Neo4j queries, company filtering, pagination |
| `04-services.md` | AbstractService, business logic, JSON:API response building |
| `05-controllers.md` | HTTP handlers, authentication guards, cache invalidation |
| `template.md` | Complete copy-paste template for new backend entities |

### Frontend Files (`frontend/`)
| File | Description |
|------|-------------|
| `01-models.md` | AbstractApiData, rehydrate(), createJsonApi() patterns |
| `02-interfaces.md` | TypeScript interface definitions for models |
| `03-services.md` | AbstractService, callApi(), EndpointCreator patterns |
| `template.md` | Complete copy-paste template for new frontend entities |

---

## Key Rule

> **If you're manually constructing JSON:API response structures, you're doing it wrong.**

The architecture handles all serialization/deserialization automatically through:
- **Backend**: Entity Descriptors + AbstractService + AbstractRepository
- **Frontend**: Model.rehydrate() + Model.createJsonApi() + AbstractService.callApi()
