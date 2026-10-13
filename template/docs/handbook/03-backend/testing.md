---
title: Testing the API
section: 03-backend
---

The API is configured for Vitest with SWC handling the TypeScript transform, and
ships **zero specs**. This page documents the configuration you will be writing
against, the one transform setting that must not change, the conventions the
generator already follows, and the failure mode that makes running the suite —
rather than trusting `tsc` — the only real verification.

## `apps/api/vitest.config.ts`

### The SWC plugin

```ts
plugins: [
  swc.vite({
    jsc: {
      parser: { syntax: "typescript", decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  }),
],
```

`unplugin-swc` replaces Vitest's built-in transformer with SWC. The two
`transform` flags are the reason:

- **`legacyDecorator: true`** selects the TypeScript experimental decorator
  semantics that NestJS is built on, rather than the TC39 standard decorators.
- **`decoratorMetadata: true`** emits the `design:type`, `design:paramtypes` and
  `design:returntype` metadata that Nest's dependency injection reads through
  `reflect-metadata`. Without it, `@Injectable()` classes resolve no
  constructor dependencies.

### `oxc: false`

```ts
// Vitest 4 replaced esbuild with Oxc as the built-in transformer, so
// unplugin-swc's `esbuild: false` is now inert and Oxc would transform TS
// instead — emitting a `design:paramtypes` array of `undefined`s and breaking
// every DI token resolved through reflection. SWC must own the transform for
// `decoratorMetadata` above to have any effect.
oxc: false,
```

Read that twice before touching it. Vitest 4 swapped esbuild for Oxc as the
built-in TypeScript transformer. `unplugin-swc` disables esbuild, which is now
the wrong switch — Oxc takes the transform instead, and Oxc does not emit
decorator metadata. The failure is not a transform error: the files compile, the
tests run, and `design:paramtypes` is an array of `undefined`s, so every DI token
resolved by reflection comes back undefined and every `Test.createTestingModule`
fails with a dependency it cannot resolve. `oxc: false` is what hands the
transform back to SWC and makes `decoratorMetadata` mean anything.

The same block is repeated verbatim in `apps/api/vitest.e2e.config.ts`.

### The `test` block

| Setting | Value | Effect |
|---|---|---|
| `globals` | `true` | `describe`, `it`, `expect` and `vi` without an import. |
| `environment` | `"node"` | No DOM. The web app uses `jsdom`; the API must not. |
| `setupFiles` | `["./vitest.setup.ts"]` | See below. |
| `include` | `["src/**/*.{test,spec}.ts"]` | **Both** suffixes run, co-located anywhere under `src`. Note this differs from the web app, which is stricter. |
| `passWithNoTests` | `true` | An empty run exits 0. This is what makes `pnpm test` green today. |
| `silent` | `true` | Suppresses test-level console output. |
| `onConsoleLog` | `() => false` | Drops every `console.*` call from the output entirely. Combined with `silent`, a debugging `console.log` inside a spec prints nothing — remove the two lines temporarily when you need one. |
| `reporters` | `["default"]` | Standard output. |
| `testTimeout` | `30000` | 30 s per test. Generous because some specs boot a Nest testing module. |

### Coverage

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: ["src/**/*.ts"],
  exclude: ["src/**/*.{test,spec}.ts", "src/**/*.d.ts", "src/**/index.ts", "src/main.ts"],
}
```

V8 coverage over the whole of `src`, with specs, declaration files, barrels and
the entry point excluded. `index.ts` is excluded because a re-export barrel has
no behaviour to cover and would otherwise inflate the denominator; `main.ts`
because it is not reachable from a unit test.

### The alias

```ts
resolve: { alias: { src: path.resolve(__dirname, "./src") } }
```

This mirrors the `src/...` path alias the app code uses — `apps/api/src/config/config.ts`
imports `src/config/enums/queue.id`, and the migrations import
`src/neo4j.migrations/queries/migration.queries`. Without the alias those
imports do not resolve under Vitest. Anything you add that imports through
`src/` needs it, and anything that imports relatively does not care.

## `apps/api/vitest.e2e.config.ts`

Identical to the unit config except:

| Setting | Unit | E2E |
|---|---|---|
| `include` | `src/**/*.{test,spec}.ts` | `test/**/*.e2e-spec.ts` |
| `testTimeout` | 30 000 ms | 60 000 ms |
| `coverage` | configured | absent |

**The api's `test` directory does not exist.** The config points at a directory
the template does not ship, and `passWithNoTests: true` is what keeps
`pnpm --filter {{name}}-api test:e2e` green. Creating that directory under
`apps/api` and adding an `.e2e-spec.ts` file is all it takes to start using it; the
api `devDependencies` already carry `supertest` and `testcontainers`.

The turbo task `test:e2e` depends on `build` (not `^build`) and declares
`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `PORT`, `PUBLIC_HOSTNAME` and
`E2E_*` in its environment, so an API e2e suite has a database to talk to.
End-to-end coverage of the running stack is Playwright's job and lives under
`apps/web/tests/` — see `apps/web/tests/README.md`.

## `apps/api/vitest.setup.ts`

Two things, both small and both load-bearing.

```ts
import "reflect-metadata";
```

The `Reflect.getMetadata` polyfill every decorator-driven DI lookup needs. In the
running app it comes in through `@nestjs/core`; under Vitest a spec that
constructs a provider directly may never import Nest, so it is imported here.

```ts
vi.mock("@nestjs/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nestjs/common")>();
  return { ...actual, Logger: class MockLogger { /* static and instance no-ops */ } };
});
```

A **silent `Logger`**. The real `@nestjs/common` module is loaded and spread, so
every decorator, exception class and interface behaves normally; only `Logger`
is replaced by a class whose five level methods are `vi.fn()` both statically
and per instance. Services that construct `new Logger(Something.name)` as a
class field — `SearchRepository` does — then produce no output during a run.

Two consequences:

- `Logger` is a `vi.fn()` mock, so you can assert on it:
  `expect(Logger.prototype.error).toHaveBeenCalled()` style assertions work
  without extra wiring.
- A spec that needs the *real* logger has to unmock it deliberately. Nothing in
  the template does.

## Spec conventions

Follow what `pnpm generate-module` emits and what the package's own foundations
do:

| Rule | Detail |
|---|---|
| **Co-located** | The spec sits beside the file it tests, not in a mirror tree. The generator writes `services/<name>.service.spec.ts` next to `services/<name>.service.ts`. The package uses both that form and a `__tests__/` subdirectory beside the source; either is picked up by the include glob. |
| **One per layer** | Service, repository, controller and DTO each get their own spec. A service spec mocks the repository; a controller spec mocks the service. Layers are never tested together in a unit spec. |
| **Named after the file under test** | `role.service.ts` → `role.service.spec.ts`. The name is how a reader finds it and how the include glob catches it. |
| **`.spec.ts`, not `.test.ts`** | Both suffixes run in the API's config, but only `spec` is used anywhere in this codebase. Stay consistent — the web app's tooling is not as forgiving. |

`pnpm generate-module` already generates four of them per module:
`services/<name>.service.spec.ts`, `repositories/<name>.repository.spec.ts`,
`controllers/<name>.controller.spec.ts` and `dtos/<name>.dto.spec.ts`. They are
real tests, not stubs — the service spec covers `find`, `findById`, `create`,
`update`, `delete` and one `findByRelated` case per declared relationship,
referring to relationships through `Descriptor.relationshipKeys.<name>` rather
than string literals. Generate a module and read them before writing your first
spec by hand.

## The `useValue` pitfall

Every spec in this codebase builds its subject with a Nest testing module and
hand-written mocks:

```ts
const module = await Test.createTestingModule({
  providers: [
    RoleService,
    { provide: JsonApiService, useValue: createMockJsonApiService() },
    { provide: RoleRepository, useValue: createMockRoleRepository() },
  ],
}).compile();
```

`useValue` accepts **any** object. It is not checked against the class it
replaces, at compile time or at run time. So when the real `RoleRepository`
grows a method, changes a parameter, or renames one, the mock does not have to
follow — and nothing tells you:

- `tsc --noEmit` passes, because the mock is only ever typed as the token's
  value and `useValue` is `any`.
- The suite passes, because the spec only calls the methods the mock has.
- The production code breaks, because it calls the method the mock never
  acquired.

The drift is invisible in a diff of the source file. The only thing that catches
it is **running the specs after changing a provider's shape** — a green `tsc` is
not evidence. Two habits limit the damage: type the mock factory's return as
`Partial<Record<keyof RealClass, ReturnType<typeof vi.fn>>>` or similar so a
rename shows up, and assert on arguments (`toHaveBeenCalledWith`) rather than
only on call counts, so a changed signature fails loudly.

## Commands

| Command | Runs |
|---|---|
| `pnpm test` | Every workspace's `test` task through Turborepo, after `^build`. |
| `pnpm --filter {{name}}-api test` | `vitest run` in `apps/api`. |
| `pnpm --filter {{name}}-api test:watch` | `vitest` in watch mode. |
| `pnpm --filter {{name}}-api test:cov` | `vitest run --coverage`, writing a `coverage/` directory under `apps/api`. |
| `pnpm --filter {{name}}-api test:debug` | `vitest --inspect-brk` for a debugger. |
| `pnpm --filter {{name}}-api test:e2e` | `vitest run --config ./vitest.e2e.config.ts`. |
| `pnpm test:e2e` | The Playwright stack script, not this config. |

The Turborepo `test` task caches on `NODE_ENV` and depends on `^build`, so a
package change rebuilds before the suite runs. `test:watch` is marked
`cache: false` and `persistent: true`.

## What the suite currently proves

Nothing.

`apps/api/src` contains **zero** spec files, and the api has no `test` directory
for the e2e config to find. Both configs set `passWithNoTests: true`, so
`pnpm --filter {{name}}-api test` and `pnpm --filter {{name}}-api test:e2e` both
exit 0 having executed no assertion. `pnpm test` at the root is green for the
same reason across every workspace.

Treat a green suite on a fresh app as a statement about the configuration, not
about the code. The first spec you write is the first evidence the API has.

The framework packages are the counter-example: they ship specs beside their
sources — `packages/nestjs-neo4jsonapi/src/foundations/role/services/__tests__/role.service.spec.ts`
and its siblings — and those are the closest thing to a style guide available
until the app has its own.

For the whole-repo picture — what each suite covers, where Playwright fits, and
what "done" means before a merge — see
[Testing strategy](../08-workflow/testing-strategy.md). For the web app's
jsdom and React Testing Library setup, see
[Testing the web app](../04-frontend/testing.md).

## Where to look

| File | Why |
|---|---|
| `apps/api/vitest.config.ts` | The whole unit configuration, including the `oxc: false` comment. |
| `apps/api/vitest.e2e.config.ts` | The e2e variant and the directory it expects. |
| `apps/api/vitest.setup.ts` | `reflect-metadata` and the silent `Logger` mock. |
| `apps/api/package.json` | Every `test*` script and the `supertest`/`testcontainers` dev dependencies. |
| `turbo.json` | The `test`, `test:watch`, `test:e2e` and `test:cov` task definitions and their env allowlists. |
| `packages/nestjs-neo4jsonapi/src/foundations/role/services/__tests__/role.service.spec.ts` | A service spec with `useValue` mocks, in the house style. |
| `packages/nestjs-neo4jsonapi/src/foundations/role/repositories/__tests__/role.repository.spec.ts` | A repository spec against a mocked `Neo4jService`. |
| `packages/nestjs-neo4jsonapi/src/foundations/role/controllers/role.controller.spec.ts` | A controller spec with the service mocked. |
| `packages/nestjs-neo4jsonapi/scripts/generate-module/templates/service.spec.template.ts` | What the generator writes, and therefore the expected shape. |
| `apps/web/tests/README.md` | The Playwright suite that covers the running stack. |

## Gaps and drift

- The template ships no API spec at all, and `passWithNoTests: true` on both
  configs means neither suite can fail. A green run proves the configuration
  loads, nothing more.
- `apps/api/vitest.e2e.config.ts` targets an `.e2e-spec.ts` glob under a `test`
  directory that the api does not have.
- `silent: true` together with `onConsoleLog: () => false` removes all console
  output from a run, including deliberate debugging output inside a spec.
- The include glob accepts `*.test.ts` as well as `*.spec.ts`, and
  `apps/web/vitest.config.ts` does the same, so the two apps agree. The two
  framework packages do not: their globs are `*.spec.ts` only, so a `*.test.ts`
  file added inside a package is silently never executed. The packages'
  convention is `spec`; the apps do not enforce it, and the web app's own
  shipped specs are all `*.test.ts(x)`.
- Not examined: the package's own Vitest configuration; the Playwright
  configuration, fixtures and reporters under `apps/web/tests/`; the e2e stack
  script and its ports; how `testcontainers` would be wired for an API e2e
  suite, given nothing uses it today.
