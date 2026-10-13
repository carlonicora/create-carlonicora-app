---
title: nestjs-neo4jsonapi public surface
section: 02-framework
---

Everything `apps/api` is allowed to import from
`@carlonicora/nestjs-neo4jsonapi`, and the file inside the package that declares
it. Read against version 4.2.0 on `master`; a generated app tracks `master`, not
the pin in `versions.production.json`.

## Entry points

`packages/nestjs-neo4jsonapi/package.json` declares nine entries in its
`exports` map. The root entry re-exports almost all of the others, so most app
code imports from the bare package name and the subpaths exist for the cases
where a narrower import matters.

| Specifier | Resolves to | Declared by |
|---|---|---|
| `@carlonicora/nestjs-neo4jsonapi` | `dist/index.js` | `packages/nestjs-neo4jsonapi/src/index.ts` |
| `…/common` | `dist/common/index.js` | `packages/nestjs-neo4jsonapi/src/common/index.ts` |
| `…/config` | `dist/config/index.js` | `packages/nestjs-neo4jsonapi/src/config/index.ts` |
| `…/core` | `dist/core/index.js` | `packages/nestjs-neo4jsonapi/src/core/index.ts` |
| `…/core/*` | `dist/core/*.js` | any file under `packages/nestjs-neo4jsonapi/src/core` |
| `…/foundations` | `dist/foundations/index.js` | `packages/nestjs-neo4jsonapi/src/foundations/index.ts` |
| `…/foundations/*` | `dist/foundations/*.js` | any file under `packages/nestjs-neo4jsonapi/src/foundations` |
| `…/agents` | `dist/agents/index.js` | `packages/nestjs-neo4jsonapi/src/agents/index.ts` |
| `…/bootstrap` | `dist/bootstrap/index.js` | `packages/nestjs-neo4jsonapi/src/bootstrap/index.ts` |
| `…/mcp` | `dist/mcp/index.js` | `packages/nestjs-neo4jsonapi/src/mcp/index.ts` |

Three CLIs are declared under `bin`:

| Command | Implementation |
|---|---|
| `neo4jsonapi-migrate` | `packages/nestjs-neo4jsonapi/tools/migrate-entity/index.ts` |
| `generate-module` | `packages/nestjs-neo4jsonapi/scripts/generate-module/index.ts` |
| `generate-rbac-paths` | `packages/nestjs-neo4jsonapi/tools/generate-rbac-paths/index.ts` |

The tooling page in this section covers all three.

The root barrel re-exports `./common`, `./config`, `./core`, `./core/pdf`,
`./core/document`, `./foundations`, `./agents`, `./mcp`, `./bootstrap` and
`./openapi`, plus one symbol by hand — `RedisLockService`, from
`packages/nestjs-neo4jsonapi/src/core/redis/services/redis.lock.service.ts`,
because `core/redis/index.ts` does not list it. `./openapi` has no entry in the
`exports` map: it is reachable only through the root.

## Bootstrap

| Symbol | Declared in |
|---|---|
| `bootstrap` | `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` |
| `BootstrapOptions`, `I18nOptions`, `OpenApiOptions` | `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.options.ts` |
| `createAppModule` | `packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts` |
| `getAppMode`, `getAppModeConfig`, `defaultFastifyOptions`, `defaultMultipartOptions` | `packages/nestjs-neo4jsonapi/src/bootstrap/defaults.ts` |
| `AppMode`, `AppModeConfig` | `packages/nestjs-neo4jsonapi/src/core/appmode/constants/app.mode.constant.ts` |
| `RAW_BODY_ROUTES`, `setupRawBodyCapture` | `packages/nestjs-neo4jsonapi/src/bootstrap/raw-body.config.ts` |

`apps/api/src/main.ts` is a single `bootstrap()` call. The chapter
`03-backend/bootstrap.md` walks every option.

## Core abstractions

| Symbol | Declared in | What you subclass it for |
|---|---|---|
| `AbstractRepository` | `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts` | every repository — supplies `buildDefaultMatch()`, `readOne()`, `readMany()`, cursor pagination |
| `AbstractService` | `packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.service.ts` | every service — CRUD over a repository plus {json:api} serialisation |
| `AbstractJsonApiSerialiser` | `packages/nestjs-neo4jsonapi/src/core/jsonapi/abstracts/abstract.jsonapi.serialiser.ts` | the rare entity whose wire form needs custom transformation |
| `AbstractTools` | `packages/nestjs-neo4jsonapi/src/core/llm/abstracts/abstract.tools.ts` | a class whose `@Tool`-decorated methods become LLM tools |
| `AbstractDocumentGeneratorService` | `packages/nestjs-neo4jsonapi/src/core/document/services/abstract-document-generator.service.ts` | generating `.docx` output from a template |
| `ModeAwareService` | `packages/nestjs-neo4jsonapi/src/common/decorators/conditional-service.decorator.ts` | a service that must resolve differently in api and worker mode |

**There is no `AbstractController`.** Controllers are plain NestJS classes that
delegate to `createCrudHandlers()` and `createRelationshipHandlers()`. Nothing
in the package declares or exports a controller base class, and no app code
should look for one. `packages/nestjs-neo4jsonapi/CLAUDE.md` lists one in its
entry-point table; that table is wrong.

## Handlers

| Symbol | Declared in |
|---|---|
| `createCrudHandlers`, `ListQueryParams` | `packages/nestjs-neo4jsonapi/src/common/handlers/crud.handlers.ts` |
| `createRelationshipHandlers`, `RelatedQueryParams` | `packages/nestjs-neo4jsonapi/src/common/handlers/relationship.handlers.ts` |

Both are factories taking a `() => TService` thunk and returning the handler
functions a controller's decorated methods call. They exist so a controller
carries routing and guards and nothing else.

## Decorators

All under `packages/nestjs-neo4jsonapi/src/common/decorators/`.

| Symbol | File |
|---|---|
| `Audit` | `audit.decorator.ts` |
| `CacheInvalidate` | `cache-invalidate.decorator.ts` |
| `AppMode`, `AppModeConfig`, `APP_MODE_TOKEN`, `createConditionalProvider`, `createWorkerProvider`, `ModeAwareService` | `conditional-service.decorator.ts` |
| `ModuleACL`, `ModuleDefinition` | `module.decorator.ts` |
| `OAuthScopes`, `OAUTH_SCOPES_KEY` | `oauth.scopes.decorator.ts` |
| `NoRateLimit`, `StrictRateLimit`, `CustomRateLimit`, `HeavyOperationRateLimit` | `rate-limit.decorator.ts` |
| `Roles` | `roles.decorator.ts` |
| `Tool`, `ToolMetadata`, `TOOL_METADATA_KEY` | `tool.decorator.ts` |
| `ValidateId` | `validate-id.decorator.ts` |

`createWorkerProvider()` is the mechanism behind "worker-only" services: it
wraps a class in a provider that resolves to a no-op outside worker mode. The
migrator uses it.

## Guards, filters and interceptors

Guards, all under `packages/nestjs-neo4jsonapi/src/common/guards/`:

| Symbol | File |
|---|---|
| `JwtAuthGuard` | `jwt.auth.guard.ts` |
| `AdminJwtAuthGuard` | `jwt.auth.admin.guard.ts` |
| `OptionalJwtAuthGuard` | `jwt.auth.optional.guard.ts` |
| `AnyScopeAuthGuard` | `jwt.auth.any-scope.guard.ts` |
| `JwtOrOAuthGuard` | `jwt.or.oauth.guard.ts` |
| `CustomThrottlerGuard` | `custom-throttler.guard.ts` |

The JWT strategy behind them is
`packages/nestjs-neo4jsonapi/src/common/strategies/jwt.strategy.ts`.
`CustomThrottlerGuard` is registered globally as an `APP_GUARD` by
`packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts` when rate
limiting is enabled, so apps do not wire it themselves.

Filters, under `packages/nestjs-neo4jsonapi/src/common/filters/`:
`HttpExceptionFilter` in `http-exception.filter.ts` and
`ThrottlerExceptionFilter` in `throttler-exception.filter.ts`.

Interceptors are not in `common/`; each belongs to the core module it serves:

| Interceptor | File |
|---|---|
| cache | `packages/nestjs-neo4jsonapi/src/core/cache/interceptors/cache.interceptor.ts` |
| logging | `packages/nestjs-neo4jsonapi/src/core/logging/interceptors/logging.interceptor.ts` |
| tracing | `packages/nestjs-neo4jsonapi/src/core/tracing/interceptors/tracing.interceptor.ts` |
| user activity | `packages/nestjs-neo4jsonapi/src/foundations/user-activity/interceptors/user-activity.interceptor.ts` |

## The entity and descriptor system

One descriptor per entity replaces the five-file entity of older NestJS
codebases. The descriptor is the single source of truth for the Neo4j mapping,
the {json:api} wire form, the OpenAPI schema and the LLM tool catalogue.

| Symbol | Declared in |
|---|---|
| `defineEntity`, `defineEntityAlias`, `convertFieldValue`, `MAX_INCLUDE_DEPTH` | `packages/nestjs-neo4jsonapi/src/common/helpers/define-entity.ts` |
| `EntitySchemaInput`, `EntityDescriptor`, `FieldDef`, `FieldKind`, `ComputedFieldDef`, `VirtualFieldDef`, `RelationshipDef`, `RelationshipFieldDef`, `PolymorphicConfig`, `CypherType` | `packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts` |
| the descriptor type re-exports | `packages/nestjs-neo4jsonapi/src/common/interfaces/entity.descriptor.interface.ts` |
| `DataMeta`, `DataModelInterface` | `packages/nestjs-neo4jsonapi/src/common/interfaces/datamodel.interface.ts` |
| `Entity`, `mapEntity` | `packages/nestjs-neo4jsonapi/src/common/abstracts/entity.ts` |
| `EntityFactory` | `packages/nestjs-neo4jsonapi/src/core/neo4j/factories/entity.factory.ts` |
| `DescriptorBasedSerialiser` | `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts` |
| `JsonApiPaginator` | `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/jsonapi.paginator.ts` |
| `JsonApiSerialiserFactory`, `DynamicRelationshipFactory` | `packages/nestjs-neo4jsonapi/src/core/jsonapi/factories/` |
| `orderBy`, `updateRelationshipQuery`, `buildFulltextTerm`, `escapeLuceneTerm`, `TokenResolverService` | `packages/nestjs-neo4jsonapi/src/core/neo4j/` |
| `FilterCriterion`, `FilterOperator`, `SortCriterion` | `packages/nestjs-neo4jsonapi/src/core/neo4j/types/filter.criterion.ts` |

A descriptor's optional `chat` block is what makes the entity visible to the
agents; see the agents page in this directory.

## Registries and DI tokens

| Symbol | Declared in | Keyed by / purpose |
|---|---|---|
| `ModelRegistry`, `modelRegistry` | `packages/nestjs-neo4jsonapi/src/common/registries/registry.ts` | the descriptor registry, keyed by `nodeName` |
| `EntityServiceRegistry` | `packages/nestjs-neo4jsonapi/src/common/registries/entity.service.registry.ts` | entity type to its service, used by the generic write paths |
| `SYSTEM_ROLES`, `SystemRolesInterface` | `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | the app's role identifiers |
| `AUTH_CONTEXT_HOOK`, `AuthContextHookInterface` | `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | optional hook `JwtAuthGuard` calls after a successful authentication |
| `TOKEN_USAGE_RECORDER`, `TokenUsageRecorderInterface` | `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | redirects package-side token-usage writes to the app |
| `CREDIT_VALIDATOR`, `CreditValidatorInterface` | `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | optional gate consulted before a billable operation |
| `JOB_NAMES`, `QUEUE_IDS`, `CONTENT_TYPES`, `ROLE_IDS`, `COMPANY_CONFIGURATIONS_FACTORY` | `packages/nestjs-neo4jsonapi/src/config/tokens.ts` | app-specific enums the package reads back |
| `CONTENT_EXTENSION_CONFIG`, `CONTENT_DESCRIPTOR` | `packages/nestjs-neo4jsonapi/src/foundations/content/interfaces/content.extension.interface.ts` | the resolved content configuration |
| `REFERRAL_CONFIG` | `packages/nestjs-neo4jsonapi/src/foundations/referral/interfaces/referral.config.interface.ts` | the resolved referral configuration |
| `USER_ACTIVITY_CONFIG`, `USER_ACTIVITY_QUEUE` | `packages/nestjs-neo4jsonapi/src/foundations/user-activity/interfaces/user-activity.config.interface.ts` | the resolved activity configuration and its queue |
| `MODULE_USER_PATHS_TOKEN` | `packages/nestjs-neo4jsonapi/src/foundations/rbac/rbac.constants.ts` | the generated module-to-user relationship paths |
| `OPERATOR_TOOLS` | `packages/nestjs-neo4jsonapi/src/agents/operator/interfaces/operator.tool.interface.ts` | app-contributed operator tools |
| `MCP_TOOLS` | `packages/nestjs-neo4jsonapi/src/mcp/interfaces/mcp.tool.interface.ts` | app-contributed MCP tools |
| `ONNX_RUNTIME_OPTIONS` | `packages/nestjs-neo4jsonapi/src/core/onnx-runtime/onnx-runtime.constants.ts` | local model runtime options |

`TOKEN_USAGE_RECORDER` and `CREDIT_VALIDATOR` both fail open: with no provider
registered, the package falls back to its own behaviour rather than refusing the
operation. `packages/nestjs-neo4jsonapi/src/common/tokens.ts` explains why each
seam exists and which package callers are obliged to use it.

## The AI-scoping seams

Four symbols, all in `packages/nestjs-neo4jsonapi/src/common/repositories/`,
control what an agent is allowed to retrieve.

| Symbol | File | Role |
|---|---|---|
| `AI_SOURCE_QUERY`, `AiSourceQueryProvider`, `AiSourceQueryResult` | `ai-source-query.provider.ts` | the app's override point for the Cypher that binds the retrievable set |
| `aiSourceQuery` | `ai.source.query.ts` | the package default the override replaces |
| `DefaultAiSourceQueryProvider` | `default.ai-source-query.provider.ts` | the provider registered when no app override is given |
| `AgentScopeFilterService`, `AgentScopeFilter` | `agent-scope.filter.ts` | applies the scope predicate **on top of** whatever the provider returned |
| `SCOPE_PREDICATE_SOURCE`, `ScopePredicateSource` | `scope-predicate.source.ts` | where the compiled predicates come from |

The separation is deliberate and is a security property: the scope filter is
applied at the call sites rather than inside the default provider, so an app
that supplies its own `aiSourceQuery` cannot silently opt out of scope
enforcement. `AgentScope` and `AGENT_SCOPE_CLS_KEY` are declared in
`packages/nestjs-neo4jsonapi/src/common/types/agent.scope.ts`; `DataLimits` in
`packages/nestjs-neo4jsonapi/src/common/types/data.limits.ts`.

## Core modules

`CoreModule.forRoot()` in
`packages/nestjs-neo4jsonapi/src/core/core.module.ts` imports the whole
infrastructure tier in one call. Each module is also exported individually.

| Module | Directory | Notable exports |
|---|---|---|
| `Neo4JModule` | `packages/nestjs-neo4jsonapi/src/core/neo4j` | `Neo4jService`, `CypherService`, `EntityFactory` |
| `JsonApiModule` | `packages/nestjs-neo4jsonapi/src/core/jsonapi` | `JsonApiService`, the serialiser factories |
| `SecurityModule` | `packages/nestjs-neo4jsonapi/src/core/security` | `SecurityService` |
| `RedisModule` | `packages/nestjs-neo4jsonapi/src/core/redis` | `RedisMessagingService`, `RedisClientStorageService`, `RedisLockService` |
| `CacheModule` | `packages/nestjs-neo4jsonapi/src/core/cache` | `CacheService`, the cache interceptor |
| `QueueModule` | `packages/nestjs-neo4jsonapi/src/core/queue` | BullMQ registration driven by the configured queue ids |
| `WebsocketModule` | `packages/nestjs-neo4jsonapi/src/core/websocket` | `WebSocketService`, `PresenceService`, `PresenceCronService` |
| `EmailModule` | `packages/nestjs-neo4jsonapi/src/core/email` | `EmailService`, the email helpers |
| `LLMModule` | `packages/nestjs-neo4jsonapi/src/core/llm` | `LLMService`, `EmbedderService`, `VisionLLMService`, `ImageLLMService`, `AudioLLMService`, `DocumentAiService`, `ModelService`, `AiConnectionResolverService` |
| `LoggingModule` | `packages/nestjs-neo4jsonapi/src/core/logging` | `AppLoggingService` |
| `TracingModule` | `packages/nestjs-neo4jsonapi/src/core/tracing` | `TracingService`, `TracingContext`, the OTel setup |
| `HealthModule` | `packages/nestjs-neo4jsonapi/src/core/health` | the health controller and the Neo4j, Redis, S3 and disk indicators |
| `VersionModule` | `packages/nestjs-neo4jsonapi/src/core/version` | `VersionService` and its controller |
| `CorsModule` | `packages/nestjs-neo4jsonapi/src/core/cors` | `CorsService` |
| `MigratorModule` | `packages/nestjs-neo4jsonapi/src/core/migrator` | `MigratorService`, `MigrationInterface`, `MigrationStep` |
| `BlockNoteModule` | `packages/nestjs-neo4jsonapi/src/core/blocknote` | `BlockNoteService`, `BlockNoteToDocxService` |
| `DocumentModule` | `packages/nestjs-neo4jsonapi/src/core/document` | `AbstractDocumentGeneratorService`, `DocxTemplateService` |
| `PdfModule` | `packages/nestjs-neo4jsonapi/src/core/pdf` | `DocxToPdfService` |
| `ModelManagerModule` | `packages/nestjs-neo4jsonapi/src/core/model-manager` | `ModelManagerService`, `getModelLoader` |
| `OnnxRuntimeModule` | `packages/nestjs-neo4jsonapi/src/core/onnx-runtime` | `OnnxRuntimeService` |
| `AppModeModule` | `packages/nestjs-neo4jsonapi/src/core/appmode` | `AppMode`, `AppModeConfig` |
| `DebugModule` | `packages/nestjs-neo4jsonapi/src/core/debug` | `DebugLoggerService` |

`core/index.ts` narrows two re-exports on purpose: the model-manager
configuration types are withheld because they collide with the Neo4j
`ModelRegistry`, and `TracingContext` and `JsonApiCursorInterface` are each
exported from exactly one module to avoid duplicate type exports.

## Foundations

`FoundationsModule.forRoot()` in
`packages/nestjs-neo4jsonapi/src/foundations/foundations.modules.ts` registers 37
of the 43 foundation directories; `foundations/index.ts` re-exports 35 of them by
name. Each foundation is its own directory with the usual entity, repository,
service, controller, DTO layering. The foundations page in this directory is the
complete inventory.

## Agents

`AgentsModule` in
`packages/nestjs-neo4jsonapi/src/agents/agents.modules.ts` imports and exports
eight agent modules. `packages/nestjs-neo4jsonapi/src/agents/index.ts` exports
those plus `OperatorModule`, the graph search services, the five graph tool
builders, the scope services, the default prompts, and the `OPERATOR_TOOLS`
contribution token. The agents page in this directory covers all of it.

## MCP

`packages/nestjs-neo4jsonapi/src/mcp/index.ts` exports `McpModule`, the
`MCP_TOOLS` token and the four contribution types (`McpToolContribution`,
`McpToolDefinition`, `McpToolResult`, `McpUserContext`). The module is mounted
only when `bootstrap({ mcp: true })`. `packages/nestjs-neo4jsonapi/docs/mcp-server.md`
is the package's own write-up.

## OpenAPI

Reachable through the root barrel only, from
`packages/nestjs-neo4jsonapi/src/openapi/index.ts`:

| Group | Directory |
|---|---|
| `OpenApiModule`, `OpenApiService` | `packages/nestjs-neo4jsonapi/src/openapi/module` |
| `createEntitySchemas`, `createRequestSchemas` | `packages/nestjs-neo4jsonapi/src/openapi/factories` |
| `ApiJsonApiResponse`, `ApiJsonApiListQuery`, `ApiJsonApiInclude`, `ApiJsonApiPagination`, `ApiJsonApiFilter`, the `ApiJsonApi*Errors` family | `packages/nestjs-neo4jsonapi/src/openapi/decorators` |
| the base and error {json:api} schemas | `packages/nestjs-neo4jsonapi/src/openapi/schemas` |
| the Cypher-to-OpenAPI and example generators | `packages/nestjs-neo4jsonapi/src/openapi/utils` |

Schemas are derived from the descriptors handed to
`OpenApiOptions.entityDescriptors`, so documentation follows the entity
definition rather than being written twice.

## Config

| Symbol | Declared in |
|---|---|
| `createBaseConfig`, `baseConfig`, `BaseConfigOptions`, `CHUNK_QUEUE_CONCURRENCY` | `packages/nestjs-neo4jsonapi/src/config/base.config.ts` |
| `QueueId`, `JobName` | `packages/nestjs-neo4jsonapi/src/config/enums/` |
| 36 `Config*Interface` types plus `BaseConfigInterface` | `packages/nestjs-neo4jsonapi/src/config/interfaces/` |
| the five app-supplied tokens | `packages/nestjs-neo4jsonapi/src/config/tokens.ts` |

Config values are read through `baseConfig` or NestJS's `ConfigService`, never
from `process.env` directly. An app extends the shape by passing a loader as
`BootstrapOptions.config`, which is merged over `baseConfig`.

## How the package is actually built

`pnpm build` in the package runs `tsc`, three further `tsc` invocations for the
CLI tsconfigs, and one `cp -R` for the email templates. There is no bundler in
the build:

- The output is **CommonJS only**. `tsconfig.json` sets `"module": "NodeNext"`
  with a `target` of ES2021, and the `exports` map has no `import` condition —
  every entry is `types` plus `default`.
- `packages/nestjs-neo4jsonapi/tsup.config.ts` exists, declares six entries and
  both `cjs` and `esm` formats, and is **dead configuration**. No script runs
  `tsup`; `tsup` is a devDependency that the build never invokes. Reading it as
  a description of the published artifact will mislead you: it lists entries
  the `exports` map does not have and a module format the package does not ship.
- `"files"` limits the npm tarball to `dist` and `README.md`.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/package.json` | the nine exports, the three CLIs, the peers, the build script |
| `packages/nestjs-neo4jsonapi/src/index.ts` | the root barrel and the one hand-added symbol |
| `packages/nestjs-neo4jsonapi/src/common/index.ts` | the fourteen groups under `common` |
| `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | the four DI seams, each with its rationale |
| `packages/nestjs-neo4jsonapi/src/core/index.ts` | the core modules and the two narrowed re-exports |
| `packages/nestjs-neo4jsonapi/src/core/core.module.ts` | what `CoreModule.forRoot()` actually assembles |
| `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.options.ts` | every `BootstrapOptions` field, documented inline |
| `packages/nestjs-neo4jsonapi/src/common/interfaces/entity.schema.interface.ts` | the descriptor contract |
| `packages/nestjs-neo4jsonapi/src/common/handlers/crud.handlers.ts` | the controller-side CRUD factory |
| `packages/nestjs-neo4jsonapi/src/agents/index.ts` | the agent surface in one file |

## Gaps and drift

- `packages/nestjs-neo4jsonapi/CLAUDE.md` lists `AbstractController` as a main
  export and shows a five-entry table where `package.json` declares nine. No
  `AbstractController` exists anywhere in the package.
- `packages/nestjs-neo4jsonapi/tsup.config.ts` is never executed by any script.
  It advertises ESM output and a different entry list from the real one.
- `./openapi` is re-exported from the root barrel but has no `exports` entry, so
  `@carlonicora/nestjs-neo4jsonapi/openapi` does not resolve.
- `BootstrapOptions.rbac` is declared and typed but is not read by
  `packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts`.
- Symbols are listed by group and by declaring file. This page does not
  enumerate every individual type exported by every barrel — notably the
  interface and enum files under `core/llm`, `core/jsonapi` and the foundations,
  which run to hundreds of names. The barrels named in each section are
  authoritative.
- The behaviour of each abstraction is out of scope here; `03-backend` covers
  repositories, services and controllers, and the rulebook in this section
  carries the rules.
