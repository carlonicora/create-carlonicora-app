---
title: Migrations
section: 03-backend
---

Neo4j has no schema to migrate, so migrations here do two things instead: create
constraints and indexes, and seed the rows the application cannot start without
— roles, features, modules, permission grants and the first administrator. They
run automatically, in the worker, in order, once each.

## How they run

`MigratorService`
(`packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts`)
implements `OnModuleInit`:

```ts
async onModuleInit() {
  await this.createMigrationConstraints();
  await this.runMigrations();
}
```

`MigratorModule` provides it through `createWorkerProvider`, and
`CoreModule.forRoot` imports that module unless `bootstrap({ migrator: false })`.

### Worker-mode implications

`createWorkerProvider` returns `null` for the service in API mode, so
**migrations run in the worker process and nowhere else**. Three consequences:

- Start only the API against an empty database and nothing is seeded. There is
  no administrator to log in as, no `(:Module)` nodes, and the RBAC reconciler —
  also worker-only — has nothing to reconcile against. `pnpm dev` starts both.
- The worker is the deployment unit that must reach Neo4j with write
  credentials, and the one whose boot order matters on a fresh environment.
- A migration failure rethrows out of `runMigrations`, which fails
  `onModuleInit`, which fails the worker's boot. That is intended: a half-seeded
  database should not serve traffic.

### The two constraints it creates first

Before discovering anything, `createMigrationConstraints()` runs two writes:

```cypher
CREATE CONSTRAINT migration_version IF NOT EXISTS
  FOR (migration:Migration) REQUIRE migration.version IS UNIQUE

CREATE CONSTRAINT migration_date_increment IF NOT EXISTS
  FOR (migration:Migration) REQUIRE (migration.versionDate, migration.versionIncrement) IS UNIQUE
```

The first makes the version string unique; the second makes the
`(date, increment)` pair unique, which catches two files that parse to the same
ordinal even with different names. Both are `IF NOT EXISTS`, so the step is
idempotent.

A failure here is caught and logged — `Failed to create migration constraints:`
— and execution continues. Only the migrations themselves abort the boot.

### Discovery

`discoverMigrations()` looks for `dist/neo4j.migrations` relative to
`process.cwd()` first and falls back to `src/neo4j.migrations`. Under
`nest start` the cwd is `apps/api`, so development reads
`apps/api/src/neo4j.migrations/` and a built worker reads the compiled copy of it
under the api's `dist` directory. A missing directory logs a warning and yields
an empty list.

It keeps files ending in `.ts` or `.js`, excludes `.d.ts`, strips the extension
to get the migration name, and sorts the list lexicographically.

### Naming convention

`<YYYYMMDD>_<NNN>` — a date and a zero-padded increment, separated by an
underscore. `20250901_001`, `20250901_002`, and so on.

`compareVersions` splits on `_`, compares the date parts as strings and the
increment parts as **numbers**. Lexicographic date comparison is correct for a
fixed-width `YYYYMMDD`; numeric increment comparison is what lets `010` sort
after `009`. Deviating from the two-part shape breaks both comparisons —
`parseInt(undefined)` is `NaN`, and every comparison against `NaN` is false.

### The filter against applied versions

`getLastAppliedMigration()` reads:

```cypher
MATCH (m:Migration) RETURN m ORDER BY m.versionDate DESC, m.versionIncrement DESC LIMIT 1
```

`filterMigrationsToRun` then keeps every discovered migration whose version
compares **greater** than that one. With no `(:Migration)` node at all, every
discovered migration runs.

This is a high-water mark, not a set difference. A migration inserted with a
version below the last applied one is skipped permanently and silently — always
add migrations after the highest existing version, never between two.

### A transaction per migration

`executeMigrations` iterates in order. For each file it loads the module,
normalises its steps, runs the `s3-upload` steps immediately, batches the
`cypher` steps, **appends the `CREATE (m:Migration {...})` bookkeeping write to
the same batch**, and then runs the whole batch through
`neo4jService.executeInTransaction`.

So one migration is one transaction, and the record of having applied it commits
with the work. A failure rolls both back, and the next boot retries the whole
file — which is why every step has to be idempotent anyway.

Loading is done by `loadMigrationModule`, which prefers `require` via
`createRequire` and falls back to a native `import()` only on `ERR_REQUIRE_ESM`.
The reason is in the file: under `module: NodeNext` the compiled output keeps a
native `import()`, which cannot load `.ts` migrations that use tsconfig path
aliases such as `src/...` — those resolve only through the host app's CommonJS
require chain. The four shipped migrations all import from `src/...`, so this is
load-bearing in development.

## `MigrationInterface` and the two step kinds

`packages/nestjs-neo4jsonapi/src/core/migrator/interfaces/migration.interface.ts`:

```ts
export interface MigrationInterface {
  query: string;
  queryParams?: Record<string, any>;
}

export type MigrationStep =
  | { kind: "cypher"; query: string; queryParams?: Record<string, any> }
  | { kind: "s3-upload"; localPath: string; s3Key: string; contentType: string };
```

A migration file exports `migration` as an array of either shape.
`_normaliseSteps` decides which by looking for a `kind` property on the **first**
element: present means the array is already `MigrationStep[]`; absent means it
is the legacy `MigrationInterface[]` and every entry is mapped to
`{ kind: "cypher", … }`.

That means the two shapes cannot be mixed in one array — a `MigrationInterface`
first element makes the whole array legacy and any `s3-upload` after it is
treated as a cypher step with an undefined query. Pick one shape per file.

| Kind | Behaviour |
|---|---|
| `cypher` | Appended to the batch and executed inside the migration transaction. |
| `s3-upload` | Reads `localPath` with `fs.readFileSync` and calls `s3Service.uploadBufferWithKey({ buffer, key, contentType })` **before** the transaction commits, logging `Uploaded <localPath> to s3://<key>`. Not transactional: a later Cypher failure rolls back the graph but leaves the object in the bucket. |

`MigratorModule` imports `S3ServiceModule` rather than `S3Module` precisely so
the migrator gets the uploader without also registering the `/s3` controller,
which would double-declare the route in an app that already serves it.

## The four shipped migrations

All four live in `apps/api/src/neo4j.migrations/` and all four export
`MigrationInterface[]`.

**`apps/api/src/neo4j.migrations/20250901_001.ts`** seeds the identity floor: the
`Administrators` role (`isSelectable: false`, so it never appears in a role
picker), the `Company Administrator` role (`isSelectable: true`), and the
`Common` feature with `isCore: true`. Everything else depends on these three
existing, which is why they are first.

**`apps/api/src/neo4j.migrations/20250901_002.ts`** seeds the eight `(:Module)`
nodes — Auth, Company, Feature, Notification, Role, S3, User, HowTo — each with
its UUID from `packages/shared/src/const/module.id.ts`, a `permissions` JSON
string holding its **default** permission set, and an `IN_FEATURE` edge to
`Common`. The defaults written here match the `default` rows in
`apps/api/src/rbac/permissions.ts` exactly, which is what makes the first RBAC
reconciliation a no-op instead of an immediate rewrite.

**`apps/api/src/neo4j.migrations/20250901_003.ts`** seeds the
`HAS_PERMISSIONS` grants: full CRUD for the Administrator role and for the
Company Administrator role on Company, S3 and User, plus a third group of two
grants against module ids that exist in no module map — see the RBAC chapter for
why those write nothing.

**`apps/api/src/neo4j.migrations/20250901_004.ts`** seeds the platform
administrator: a `(:User)` with a fixed id, name `Administrator`, email
`admin@{{name}}.com`, a bcrypt password hash and `isActive: true`, followed by
the library's `grantPlatformRole` helper.

### Why the administrator must have no company edge

The administrator is a **platform** administrator: it holds the Administrator
role on a membership with **no `IN_COMPANY` edge**, and therefore belongs to no
company.

That shape is not incidental. `AuthRepository.createSession` branches on exactly
it — "holds Administrator and has no company" — to build a session without a
company in scope. Seed the role any other way and login takes the company
branch, which dereferences `auth.user.company.id` on a company-less user and
fails with a 500 before a token is ever issued.

The migration therefore grants the role through `grantPlatformRole` rather than
hand-written Cypher, so the seed cannot drift from the membership model the rest
of the codebase reads through `membershipRoleMatch`. The helper consumes two
params from the same object: `roleId` is the role to grant, and `membershipId`
seeds the platform membership when the user has none yet.

Change the password after the first login. The hash in the file is the same in
every app scaffolded from this template.

## The shared Cypher fragments

`apps/api/src/neo4j.migrations/queries/migration.queries.ts` exports four query
strings, and **all four are idempotent MERGE**. That is what makes re-running a
migration safe, which matters because a rolled-back transaction retries the
whole file on the next boot.

| Export | Shape |
|---|---|
| `featureQuery` | `MERGE (feature:Feature {id: $featureId})` with `ON CREATE SET` and `ON MATCH SET` for name and `isCore`. |
| `moduleQuery` | `MERGE (module:Module {id: $moduleId})`, then a conditional `MERGE (module)-[:IN_FEATURE]->(feature)`. `ON MATCH` updates `permissions` and bumps `updatedAt` **only when the permissions string actually differs**, so a no-op re-run leaves the timestamp alone. |
| `roleQuery` | `MERGE (role:Role {id: $roleId})` with name and `isSelectable` on both branches. |
| `permissionQuery` | `MATCH (role)`, `MATCH (module)`, then `MERGE (role)-[permissions:HAS_PERMISSIONS]->(module)` setting the JSON on both branches. |

Two details worth noticing:

- `moduleQuery` guards the feature link with
  `MATCH (feature:Feature) WHERE $featureId IS NOT NULL AND feature.id = $featureId`
  followed by `WHERE feature IS NOT NULL`, so a module with no feature is legal
  and simply gets no edge.
- `permissionQuery` opens with two `MATCH` clauses, not `MERGE`. A missing role
  or module means the pattern does not match, the `MERGE` never runs, and the
  migration succeeds having written nothing. That is why the two unmapped ids in
  `20250901_003.ts` are silent rather than fatal — and why a typo'd id in a
  grant you add will be equally silent.

## How to write a new one

1. Pick the name. Today's date and the next increment, `YYYYMMDD_NNN`, strictly
   above every existing file. Put it in `apps/api/src/neo4j.migrations/`.
2. Export `const migration: MigrationInterface[]` — or `MigrationStep[]` if you
   need an upload. Do not mix the shapes in one array.
3. Make every statement idempotent: `MERGE` over `CREATE`, `IF NOT EXISTS` on
   every constraint and index, `SET` guarded by a comparison where a timestamp
   would otherwise churn. The file will re-run if any later step in the same
   transaction fails.
4. Parameterise everything. Put shared fragments in
   `apps/api/src/neo4j.migrations/queries/migration.queries.ts` and pass values
   through `queryParams`; never interpolate a value into the query string.
5. If you seed a module, add its UUID to
   `packages/shared/src/const/module.id.ts` in the same change, then run
   `pnpm --filter {{name}}-api build-module-id-map` and
   `pnpm --filter {{name}}-api generate:rbac-paths`, and declare it in
   `apps/api/src/rbac/permissions.ts`. A module seeded without a `ModuleId`
   entry is invisible to the RBAC layer.
6. Restart the **worker**. Watch for `Applied migration: <name>` and
   `Successfully applied N migrations` in its log. `No migrations to run` means
   your version did not sort above the high-water mark.

Constraints and fulltext indexes derived from an entity descriptor do **not**
belong in a migration: `AbstractRepository.onModuleInit` creates them from
`defineEntity()`'s declarations. Write a migration for what the descriptor
cannot express — extra uniqueness constraints, seeded rows, data backfills.

## `bootstrap({ migrator: false })`

Setting it skips `MigratorModule` inside `CoreModule.forRoot`, so no constraints
are created, no directory is scanned and no `(:Migration)` node is ever written.

Use it when the app runs its own migration mechanism — a separate job, a
deployment step, a different tool — and wants no second writer. Do not use it to
"turn migrations off" in an environment: an unseeded database has no roles, no
modules and no administrator, and the RBAC reconciler will abort the worker boot
with `RBAC reconcile aborted - referenced entities not found in DB`.

The template leaves it unset, so the default `true` applies.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/migrator/services/migrator.service.ts` | Discovery, ordering, the high-water filter, the transaction. |
| `packages/nestjs-neo4jsonapi/src/core/migrator/interfaces/migration.interface.ts` | `MigrationInterface` and the two step kinds. |
| `packages/nestjs-neo4jsonapi/src/core/migrator/migrator.module.ts` | Worker-only provider and why it imports `S3ServiceModule`. |
| `apps/api/src/neo4j.migrations/queries/migration.queries.ts` | The four idempotent MERGE fragments. |
| `apps/api/src/neo4j.migrations/20250901_001.ts` | Roles and the `Common` feature. |
| `apps/api/src/neo4j.migrations/20250901_002.ts` | The eight modules and their default permissions. |
| `apps/api/src/neo4j.migrations/20250901_003.ts` | The permission grants. |
| `apps/api/src/neo4j.migrations/20250901_004.ts` | The platform administrator and why it has no company. |
| `packages/shared/src/const/module.id.ts` | The UUIDs `20250901_002.ts` seeds, with the sync instructions. |
| `apps/api/src/rbac/permissions.ts` | The matrix whose `default` rows must match `20250901_002.ts`. |

## Gaps and drift

- `_normaliseSteps` decides the array shape from the first element only, so a
  file mixing `MigrationInterface` and `MigrationStep` entries silently
  mistreats every entry after the first.
- `filterMigrationsToRun` is a high-water mark, not a set difference. A
  migration whose version sorts below the newest applied one never runs and
  nothing reports it.
- `s3-upload` steps execute before the transaction commits, so a later Cypher
  failure rolls back the graph and leaves the uploaded object behind.
- `permissionQuery` opens with `MATCH`, so a grant naming a non-existent role or
  module writes nothing and reports success. `20250901_003.ts` contains two such
  grants today.
- The seeded administrator's bcrypt hash is identical in every app scaffolded
  from this template.
- Not examined: `Neo4jService.executeInTransaction`'s retry and error mapping;
  `S3Service.uploadBufferWithKey`; `grantPlatformRole` and `membershipRoleMatch`
  beyond their role in the seed; how the e2e stack seeds its separate database.
