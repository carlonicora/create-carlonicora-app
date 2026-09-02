# CLAUDE.md

## What Is This

`{{display}}` — a NestJS + Next.js monorepo with Neo4j and JSON:API.

## Monorepo Structure

This is a monorepo with component-specific instructions. Read the relevant CLAUDE.md for your task:

| Component | Path | Description |
|-----------|------|-------------|
| **API** | [apps/api/CLAUDE.md](apps/api/CLAUDE.md) | NestJS backend with Neo4j |
| **Web** | [apps/web/CLAUDE.md](apps/web/CLAUDE.md) | Next.js frontend |
| **Shared** | [packages/shared/CLAUDE.md](packages/shared/CLAUDE.md) | Shared types & constants |
| **NestJS Library** | [packages/nestjs-neo4jsonapi/CLAUDE.md](packages/nestjs-neo4jsonapi/CLAUDE.md) | NestJS JSON:API framework |
| **Next.js Library** | [packages/nextjs-jsonapi/CLAUDE.md](packages/nextjs-jsonapi/CLAUDE.md) | Next.js JSON:API client |

## Architecture Reference

Architecture rules and detailed patterns live in the
**`nja-architecture` skill**, provided by the globally-installed
`nja` plugin (invoke it as `nja:nja-architecture`). Invoke that skill
BEFORE editing any TypeScript file under `apps/api/src/features`,
`apps/web/src/features`, or `packages/*/src`.

The skill's `SKILL.md` contains the full routing table (file pattern →
references). Detailed reference docs ship inside the plugin under the
skill's `references/` directory.

## Architecture Guardrails

These rules are NON-NEGOTIABLE. Violating any of them produces broken or insecure code.

### JSON:API Protocol

This system uses {json:api} as its ONLY communication protocol between frontend and backend. EVERY request and response MUST be valid JSON:API. To create a valid JSON:API payload, you MUST use a model — never construct JSON:API structures manually. If a model doesn't exist for the entity, create one first.

### Backend (NestJS + Neo4j)

- ALWAYS extend `AbstractRepository` and `AbstractService` — never bypass the framework
- ALWAYS use `buildDefaultMatch()` for queries — it auto-injects company filtering. Manual filtering is a security vulnerability
- ALWAYS use `readOne()`/`readMany()` to return typed objects — NEVER return raw `result.records`
- ALWAYS use `{CURSOR}` placeholder for paginated queries — NEVER use manual `SKIP`/`LIMIT`
- ALWAYS pass `serialiser` to `initQuery()` — without it, type mapping fails
- ALWAYS use `createCrudHandlers()`/`createRelationshipHandlers()` for standard CRUD
- ALWAYS use meta constants for endpoint paths — NEVER hardcode endpoint strings
- ALWAYS use DTOs for request validation
- ALWAYS use parameterized Cypher queries — NEVER interpolate strings
- Controllers call services, NEVER repositories directly

### Frontend (Next.js)

- ALWAYS use `callApi()` — NEVER use `fetch()` directly
- ALWAYS implement `rehydrate()` and `createJsonApi()` on every model
- ALWAYS use `EndpointCreator` for building URLs — NEVER hardcode endpoint strings
- ALWAYS pass `type: Modules.X` in every `callApi()` call — without it, rehydration fails
- NEVER use `overridesJsonApiCreation` without a dedicated model method
- NEVER construct JSON:API payloads manually — the model handles serialization
- This project uses **Base UI** (not Radix) for UI components — NEVER use `asChild`, NEVER wrap `<Button>` inside trigger components. Use the `render` prop for composition. See the `nja:nja-architecture` skill's frontend components reference

### Before Writing Code

Invoke the `nja:nja-architecture` skill — its routing table tells
you which references to read for the file you are about to edit.

## Build & Test

```bash
pnpm test                                           # all
pnpm --filter {{name}}-web test                     # web
pnpm --filter {{name}}-api test                     # api
pnpm --filter @carlonicora/nestjs-neo4jsonapi test  # nestjs lib
pnpm --filter @carlonicora/nextjs-jsonapi test      # nextjs lib
```

If anything fails, you MUST fix it, even if you think it was not created by you. Take responsibility and DON'T BE LAZY!

## Debugging

- Use `console.log` at critical points to understand runtime behavior
- When a bug is reported, add logs first — don't guess from code alone
