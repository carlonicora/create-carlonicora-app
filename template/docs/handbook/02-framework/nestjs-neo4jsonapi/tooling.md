---
title: nestjs-neo4jsonapi tooling
section: 02-framework
---

The backend package ships three command-line tools, a runtime migrator, its own
build chain and its own test setup. This page is about all of them: what each
one does, where it writes, and what it assumes about the app that runs it.

## `generate-module`

Turns one JSON file into a complete backend feature module. Declared as a `bin`
in `packages/nestjs-neo4jsonapi/package.json`, and wired at the app root as:

```json
"generate-module": "node ./packages/nestjs-neo4jsonapi/dist/scripts/generate-module/index.js"
```

Note the path: the root script runs `dist` directly rather than going through
the `bin` link, so the package must be built first.

```bash
pnpm generate-module structure/comment.json
pnpm generate-module structure/comment.json --dry-run
```

### Flags

| Flag | Default | Effect |
|---|---|---|
| `<json-file>` | required | path to the JSON schema, resolved against the current directory |
| `--dry-run` | off | print what would be written, write nothing |
| `--force` | off | overwrite existing files |
| `--no-register` | registers | skip adding the module to its parent module file |
| `--shared-scope <scope>` | auto-detected | override the shared package scope that exports `ModuleId` |

The input may be a single object or an array of them, so one file can define
several modules; each is validated and generated in turn, and a validation
failure skips that module rather than aborting the run.

### The JSON input

The contract is `JsonModuleDefinition` in
`packages/nestjs-neo4jsonapi/scripts/generate-module/types/`:

| Key | Meaning |
|---|---|
| `moduleId` | the UUID of the `(Module)` node this entity belongs to |
| `moduleName` | PascalCase entity name; every other casing is derived |
| `endpointName` | the {json:api} type and route base |
| `targetDir` | must start with `features` or `foundations` |
| `isCompanyScoped` | default `true`; `false` produces a global entity |
| `languages` | the locales to scaffold |
| `fields[]` | `name`, `type`, `nullable`, plus optional `description`, `kind`, `computed`, `readOnly` |
| `relationships[]` | `name`, `directory`, `single`, `relationshipName`, `toNode`, `nullable`, plus optional `alias`, `variant`, `fields`, `immutable`, `dtoKey`, `description` |
| `description`, `chat` | the LLM-facing copy that makes the entity visible to the agents |
| `requiresS3`, `exportService` | wiring switches |

`relationships[].fields` — properties stored on the edge — is only supported
when `single: true`.

### What it emits

Up to fourteen files per module, under `<targetDir>/<kebab-name>/`:

| File | Template |
|---|---|
| `entities/<name>.meta.ts` | `meta.template.ts` |
| `entities/<name>.ts` | `entity.template.ts` |
| `<name>.module.ts` | `module.template.ts` |
| `services/<name>.service.ts` | `service.template.ts` |
| `repositories/<name>.repository.ts` | `repository.template.ts` |
| `controllers/<name>.controller.ts` | `controller.template.ts` |
| `dtos/<name>.dto.ts` | `dto.base.template.ts` |
| `dtos/<name>.post.dto.ts` | `dto.post.template.ts` |
| `dtos/<name>.put.dto.ts` | `dto.put.template.ts` |
| `dtos/<name>.relationship.dto.ts` | `dto.relationship.template.ts`, only when the entity has relationships |
| `services/<name>.service.spec.ts` | `service.spec.template.ts` |
| `repositories/<name>.repository.spec.ts` | `repository.spec.template.ts` |
| `controllers/<name>.controller.spec.ts` | `controller.spec.template.ts` |
| `dtos/<name>.dto.spec.ts` | `dto.spec.template.ts` |

The last four are the point worth repeating: **the generator writes four spec
files for every module it creates.** A generated module arrives with test
coverage, and deleting those specs rather than filling them in is how a module
silently loses it.

All fourteen templates live in
`packages/nestjs-neo4jsonapi/scripts/generate-module/templates`. The support
code around them is in sibling directories: `transformers/` for name casing,
relationship mapping, import resolution and nested-route generation,
`validators/` for the JSON schema check, and `utils/` for the file writer,
type mapping, class-validator import pruning and shared-scope detection.

### The module registrar

Unless `--no-register` is passed, `registerModule()` in
`packages/nestjs-neo4jsonapi/scripts/generate-module/utils/module-registrar.ts`
adds an import and an `imports:` entry to one file, chosen from the first
segment of `targetDir`:

| `targetDir` starts with | File edited |
|---|---|
| `features` | `apps/api/src/features/features.modules.ts` |
| `foundations` | the app-side `foundations/foundations.modules.ts`, which a generated app does not have until it creates one |

Anything else is an error. The leaf module is added to that file **regardless of
how deep `targetDir` is** — per-domain sub-aggregators were tried and produced
orphan `*.modules.ts` files and double registration. If the target file is
missing the registrar warns and carries on, leaving you to register by hand.

## `neo4jsonapi-migrate`

Converts an old five-file entity into one descriptor file. Wired at the app
root as `pnpm neo4jsonapi-migrate`.

Before:

```
feature/entities/
├── entity.ts            # type definition only
├── entity.meta.ts       # meta object
├── entity.model.ts      # DataModelInterface
├── entity.map.ts        # Neo4j record → entity mapper
└── entity.serialiser.ts # JSON:API serialiser
```

After: `entity.ts`, containing the type and a `defineEntity()` descriptor that
generates the other four.

| Flag | Effect |
|---|---|
| `-p, --path <module-path>` | the module folder to migrate |
| `-e, --entity <name>` | pick one entity when the module has several |
| `-a, --all` | migrate every entity in the codebase |
| `-d, --dry-run` | preview without writing |
| `--backup` | write `.bak` copies before overwriting |
| `-v, --verbose` | detailed output |

With neither `--path` nor `--all` it prints help. It exits non-zero if any
entity failed.

The migration is five steps: parse the old files, generate the descriptor,
rewrite every external reference to the old exports, update the module's
providers and registry calls, then delete the four redundant files. The
reference rewrite is the part that makes it worth running rather than doing by
hand — `articleMeta.labelName` becomes `ArticleDescriptor.model.labelName`,
`modelRegistry.register(ArticleModel)` becomes
`modelRegistry.register(ArticleDescriptor.model)`, and so on across the whole
tree. Entities that already contain `defineEntity<` are detected and skipped.

Two cases need review afterwards, both documented in
`packages/nestjs-neo4jsonapi/tools/migrate-entity/README.md`: entities with no
serialiser at all, and entities whose serialiser carried custom logic — those
usually need `injectServices` and a field `transform` added to the descriptor by
hand.

## `generate-rbac-paths`

Derives, for every module, the relationship path from that module's entity back
to a `User`. The RBAC layer uses those paths at runtime to answer "does this user
own this record". Run from `apps/api`:

```bash
pnpm --filter {{name}}-api generate:rbac-paths
```

which expands to `pnpm build-module-id-map` followed by the CLI. The first half
matters: `apps/api/scripts/build-module-id-map.ts` reads the `ModuleId` enum from
`packages/shared` and writes `apps/api/src/rbac/module-id.map.json`, a
`labelName` → UUID map. The CLI needs it to emit UUID-keyed output; without
`--module-id-map` it refuses to run.

| Flag | Default in `apps/api/package.json` |
|---|---|
| `--dir <path>` | `dist/features` |
| `--output <path>` | `src/features/rbac/module-relationships.map.ts` |
| `--skip <names>` | empty, on top of the built-in skip list |
| `--max-depth <n>` | `4` |
| `--module-id-map <path>` | `src/rbac/module-id.map.json` |

**It scans compiled JavaScript, not TypeScript.** `--dir` defaults to
`dist/features`, and the scanner `require()`s each `.js` file and looks for
exports carrying both `model.labelName` and `relationships`. Run it against a
stale `dist` and you generate a stale map; run it before `pnpm build` and you
generate an empty one.

The built-in skip list drops fourteen entity labels that have no meaningful
owner path — `Entity`, `Auth`, `AuthCode`, `Push`, `S3`, `OneTimeToken`,
`Configuration`, `Module`, `Feature`, `Role`, `Company`, `Audit`,
`Notification`, `Webhook`. `--skip` adds to it.

The search is a breadth-first walk of the relationship graph toward `User`,
bounded at depth 4. The output is
`apps/api/src/features/rbac/module-relationships.map.ts`, exporting
`MODULE_USER_PATHS` keyed by module UUID plus its `ModuleUserPathsType`, with a
header saying not to edit it by hand.

### The reverse direction: `rbac-dump.ts`

`apps/api/scripts/rbac-dump.ts`, run as `pnpm --filter {{name}}-api rbac:dump`,
goes the other way: it reads the **live** RBAC state out of Neo4j and writes
`apps/api/src/rbac/permissions.ts`. The heavy lifting is `dumpRbacMatrix()` in
the package; the script supplies the environment, the driver, the `ModuleId` and
`RoleId` enums from `packages/shared`, and the output path.

Two moments call for it, per the script's own header: setting up a new
environment that has no `permissions.ts` yet, and after editing permissions
directly in Neo4j during development — because the worker's reconciler runs on
every worker bootstrap and will otherwise revert those edits. It writes a source
file into the repository, so it is a developer tool and must never be wired into
an endpoint or a deploy pipeline.

The pairing is worth holding in mind: `generate-rbac-paths` goes descriptors →
code, `rbac-dump` goes database → code, and the reconciler goes code →
database.

## The runtime migrator

Not a CLI. `MigratorService` in
`packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts`
runs inside the application, in `onModuleInit`, and is registered through
`createWorkerProvider()` — so it runs in the **worker** process, not in the API.

On start it creates two constraints of its own before anything else:

| Constraint | On |
|---|---|
| `migration_version` | `(migration:Migration) REQUIRE migration.version IS UNIQUE` |
| `migration_date_increment` | `(migration:Migration) REQUIRE (migration.versionDate, migration.versionIncrement) IS UNIQUE` |

Then it discovers the migration files, reads the last applied version, filters to
what has not run, and executes the remainder in transactions. Version ordering
comes from the filename — `20250901_001.ts` is a date plus an increment — and
`apps/api/src/neo4j.migrations` holds the four the template ships.

A migration file exports `migration`, an array of steps, of which there are two
kinds (`packages/nestjs-neo4jsonapi/src/core/migrator/interfaces/migration.interface.ts`):

```typescript
export type MigrationStep =
  | { kind: "cypher"; query: string; queryParams?: Record<string, any> }
  | { kind: "s3-upload"; localPath: string; s3Key: string; contentType: string };
```

`cypher` runs inside the migration transaction; `s3-upload` streams a local file
to object storage before the transaction commits. An app that only runs Cypher
can keep exporting the older `MigrationInterface[]` shape — an array of
`{ query, queryParams }` — and the migrator accepts it.

`MigratorModule` imports `S3ServiceModule` rather than `S3Module`, so the
uploader is available without mounting a second `/s3` controller.

`bootstrap({ migrator: false })` skips the package migrator entirely, for an app
that runs its own.

## The build chain

`pnpm build` in the package is five commands in sequence:

```
tsc
tsc -p tools/migrate-entity/tsconfig.json
tsc -p tools/generate-rbac-paths/tsconfig.json
tsc -p scripts/generate-module/tsconfig.json
cp -R src/core/email/templates dist/core/email/
```

The root `packages/nestjs-neo4jsonapi/tsconfig.json` compiles `src/**/*` to
`dist`, CommonJS, ES2021, declarations and source maps on, `strict: false`, with
`emitDecoratorMetadata` and `experimentalDecorators` on because NestJS DI needs
the metadata. Specs are excluded from the build.

Each CLI has its own tsconfig with its own `outDir`, matching the `bin` paths:

| tsconfig | `outDir` | Notes |
|---|---|---|
| `packages/nestjs-neo4jsonapi/tools/migrate-entity/tsconfig.json` | `dist/tools/migrate-entity` | standalone, excludes `__fixtures__` |
| `packages/nestjs-neo4jsonapi/tools/generate-rbac-paths/tsconfig.json` | `dist/tools/generate-rbac-paths` | standalone |
| `packages/nestjs-neo4jsonapi/scripts/generate-module/tsconfig.json` | `dist/scripts/generate-module` | extends the root config, but turns `strict` back **on** |

The `cp -R` at the end exists because the email templates are Handlebars files,
not TypeScript, so `tsc` leaves them behind; without that copy every templated
email fails at runtime in a built package.

There is no bundler step. `packages/nestjs-neo4jsonapi/tsup.config.ts` exists but
no script runs it.

## Tests

`packages/nestjs-neo4jsonapi/vitest.config.ts`, on vitest 4.

```ts
include: ["src/**/*.spec.ts", "tools/**/*.spec.ts", "scripts/**/*.spec.ts"]
```

365 spec files across those three trees. 327 of them sit inside a `__tests__`
directory — there are 171, one beside most `services`, `repositories`,
`controllers` and tool folders — and the remaining 38 sit directly beside the
file they test. Both layouts are used; neither is wrong.

**The naming convention is absolute: only `*.spec.ts` runs.** A file named
`*.test.ts` matches no `include` pattern and is silently never executed. The
root tsconfig excludes both patterns from the build, so a misnamed spec compiles
nowhere and runs nowhere and nothing complains.

### `oxc: false`, and why it is not optional

The config sets `oxc: false` at the top level and runs `unplugin-swc` as the
only TypeScript transform. The reason is written out in the file:

Vite transforms TypeScript with Oxc, which does not implement
`emitDecoratorMetadata`. Oxc ran **after** `unplugin-swc` and overwrote SWC's
`design:paramtypes` metadata with a same-length array of `undefined`s. Anything
reading constructor types through `Reflect.getMetadata` — NestJS's own DI, and
`resolveInjectionTokens` in
`packages/nestjs-neo4jsonapi/src/common/decorators/conditional-service.decorator.ts` —
then saw undefined tokens. `esbuild: false`, which `unplugin-swc` sets
automatically, no longer covers this; Oxc has to be switched off explicitly.

The rest of the config: `globals: true`, node environment, a 10-second test
timeout, v8 coverage excluding specs, interfaces, DTOs and barrels, silent
output with console logging suppressed, and an `@` alias onto `src`.

## The package's own documentation

Eighteen markdown files ship inside the submodule.

| File | What it is |
|---|---|
| `packages/nestjs-neo4jsonapi/README.md` | the long-form package manual, 1,600 lines |
| `packages/nestjs-neo4jsonapi/CLAUDE.md` | the AI-assistant brief: purpose, structure, entry points, patterns, common mistakes |
| `packages/nestjs-neo4jsonapi/CHANGELOG.md` | the semantic-release history |
| `packages/nestjs-neo4jsonapi/RALPH_TEST_LOOP.md` | the loop used to write the package's unit tests |
| `packages/nestjs-neo4jsonapi/TEST-COVERAGE-GAPS.md` | what the package's own suite does not cover |
| `packages/nestjs-neo4jsonapi/docs/mcp-server.md` | the MCP server: transport, auth, tool registration |
| `packages/nestjs-neo4jsonapi/docs/rbac-bootstrap.md` | how the permissions system works end to end |
| `packages/nestjs-neo4jsonapi/tools/migrate-entity/README.md` | the migration CLI: flags, steps, edge cases |
| `packages/nestjs-neo4jsonapi/tools/migrate-entity/MIGRATION-GUIDE.md` | the longer repository-and-service migration walkthrough |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/README.md` | the billing foundation, in full |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/QUICKSTART.md` | the shortest path to working billing |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/API.md` | every billing endpoint and service method |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/ARCHITECTURE.md` | how the ten Stripe modules fit together |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/EXAMPLES.md` | worked billing integrations |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/MIGRATIONS.md` | moving an existing billing setup onto the foundation |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/TESTING.md` | testing billing, including the Stripe test mode |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/WEBHOOKS.md` | webhook verification, dispatch and replay |
| `packages/nestjs-neo4jsonapi/src/foundations/stripe-subscription/README.md` | the subscription module on its own |

`CHANGELOG.md` is generated; the rest are hand-written and live with the code
they describe. Read them there rather than copying them into your app's docs —
they move with the submodule.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/package.json` | the three `bin` entries and the five-command build |
| `packages/nestjs-neo4jsonapi/scripts/generate-module/index.ts` | the generator's flags |
| `packages/nestjs-neo4jsonapi/scripts/generate-module/generator.ts` | the fourteen files it writes, in order |
| `packages/nestjs-neo4jsonapi/scripts/generate-module/utils/module-registrar.ts` | which module file gets edited, and why it is flat |
| `packages/nestjs-neo4jsonapi/tools/migrate-entity/README.md` | the five migration steps and the reference rewrites |
| `packages/nestjs-neo4jsonapi/tools/generate-rbac-paths/index.ts` | the skip list, the BFS and the output shape |
| `apps/api/package.json` | how the app invokes `generate:rbac-paths` and `rbac:dump` |
| `apps/api/scripts/rbac-dump.ts` | the reverse direction, with its own usage notes |
| `packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts` | boot-time constraints and migration discovery |
| `packages/nestjs-neo4jsonapi/vitest.config.ts` | `oxc: false` and the reasoning behind it |

## Gaps and drift

- `generate-rbac-paths` reads `dist/features`, so its output is only as fresh as
  the last `pnpm build`. Nothing in the script checks that.
- The template's generated `apps/api/src/features/rbac/module-relationships.map.ts`
  has an entry for every module and an empty path array for all of them, which
  is what a scan of a `dist` containing no app features produces.
- `packages/nestjs-neo4jsonapi/scripts/generate-module/tsconfig.json` sets
  `strict: true` while the root config sets `strict: false`. The generator is
  compiled under stricter rules than the library it generates code for.
- `packages/nestjs-neo4jsonapi/tsup.config.ts` is never run by any script.
- The package's `generate:rbac-paths` script runs the CLI with no `--module-id-map`,
  which the CLI itself rejects; only the app-level script passes one.
- Neither `packages/nestjs-neo4jsonapi/README.md` nor the Stripe documents were
  read line by line for this page; they are listed by title and first heading.
- The web package's generator, `generate-web-module`, belongs to
  `@carlonicora/nextjs-jsonapi` and is covered by that package's tooling page.
