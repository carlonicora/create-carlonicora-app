---
title: nextjs-jsonapi tooling
section: 02-framework
---

How `@carlonicora/nextjs-jsonapi` is built, what it generates, what it tests, and
what it demands of the app that consumes it. Written against version 4.0.4; a
generated app tracks `master` rather than the pin in `versions.production.json`.

## The build

`packages/nextjs-jsonapi/package.json` defines the build as:

```
rm -rf dist && NODE_OPTIONS='--max-old-space-size=8192' tsup && tsc -p scripts/generate-web-module/tsconfig.json
```

Three steps: clear the output, bundle the library with tsup, then compile the
CLI separately with `tsc`. The 8 GB heap is not decorative — the dts build
resolves types across the whole tree.

### The sixteen entries

`packages/nextjs-jsonapi/tsup.config.ts` declares one entry per exported subpath,
plus the stub `./cached-get` resolves to outside the `react-server` condition,
each emitted in both `cjs` and `esm`:

| Entry key | Source |
|---|---|
| `index` | `packages/nextjs-jsonapi/src/index.ts` |
| `core/index` | `packages/nextjs-jsonapi/src/core/index.ts` |
| `server/index` | `packages/nextjs-jsonapi/src/server/index.ts` |
| `client/index` | `packages/nextjs-jsonapi/src/client/index.ts` |
| `components/index` | `packages/nextjs-jsonapi/src/components/index.ts` |
| `contexts/index` | `packages/nextjs-jsonapi/src/contexts/index.ts` |
| `testing/index` | `packages/nextjs-jsonapi/src/testing/index.ts` |
| `billing/index` | `packages/nextjs-jsonapi/src/billing/index.ts` |
| `features/help/index` | `packages/nextjs-jsonapi/src/features/help/index.ts` |
| `features/help/server` | `packages/nextjs-jsonapi/src/features/help/server-entry.ts` |
| `features/tokenusage/index` | `packages/nextjs-jsonapi/src/features/tokenusage/index.ts` |
| `features/analytics/index` | `packages/nextjs-jsonapi/src/features/analytics/index.ts` |
| `features/analytics/server` | `packages/nextjs-jsonapi/src/features/analytics/server-entry.ts` |
| `server/cachedGet` | `packages/nextjs-jsonapi/src/server/cachedGet.ts` |
| `server/cachedGet.stub` | `packages/nextjs-jsonapi/src/server/cachedGet.stub.ts` |
| `next-config/index` | `packages/nextjs-jsonapi/src/next-config/index.ts` |

### `splitting: true`

Enabled so dynamic imports stay separate chunks. The config states the reason:
it prevents server code — modules using `"use cache"` — from being inlined into
client bundles. This is the other half of the design that has `AbstractService`
reach `packages/nextjs-jsonapi/src/unified/JsonApiRequest.ts` through `await import(...)` rather than a static
import.

### `clean: false`, and the `rm -rf dist` in the script

Cleaning is done once by the npm script, never by tsup. The comment in
`packages/nextjs-jsonapi/tsup.config.ts` explains the failure it avoids:
`turbo run dev` runs this package's `build` **and** `dev` (`tsup --watch`) tasks;
if both let tsup clean the shared `dist/`, their `removeFiles` passes race and
one crashes with `ENOENT` on unlink. With `clean: false` the watcher never wipes
`dist/`, so the apps — which wait only on `build` — always see a valid `dist/`.
`turbo.json` wires this by giving `dev` a `dependsOn: ["^build"]`.

### esbuild options and aliases

`keepNames: true` and `jsx: "automatic"`, plus three aliases that resolve the
`@/`-style imports the shadcn-derived files use:

| Alias | Resolves to |
|---|---|
| `@/lib/utils` | `packages/nextjs-jsonapi/src/lib/utils.ts` |
| `@/hooks/use-mobile` | `packages/nextjs-jsonapi/src/hooks/use-mobile.ts` |
| `@/components/ui` | `packages/nextjs-jsonapi/src/shadcnui/ui/` |

### `external`

Twenty-four specifiers are left unbundled — the peers the host app owns, the
Next.js internals, two of the package's own subpaths, and the test libraries the
`/testing` entry references:

`@tanstack/react-table` · `@stripe/react-stripe-js` · `@stripe/stripe-js` ·
`react` · `react-dom` · `next` · `next/headers` · `next/cache` ·
`@carlonicora/nextjs-jsonapi/analytics` · `@carlonicora/nextjs-jsonapi/cached-get` ·
`cookies-next` · `next-intl` · `next-intl/server` · `react-hook-form` ·
`next-themes` · `jotai` · `jotai/utils` · `jotai/react` · `jotai-family` ·
`vitest` · `@testing-library/react` · `@testing-library/dom` ·
`@testing-library/jest-dom` · `@testing-library/user-event`

Listing `jotai` and its two subpaths separately matters: a second copy of jotai
in the bundle would give the package its own atom store and the app's providers
would not see its writes.

The two self-references are deliberate. `serverRequest` imports the cached GET
through `@carlonicora/nextjs-jsonapi/cached-get` so that the `react-server`
condition picks the real `"use cache"` function on the server and the stub
everywhere else; bundling it would put `"use cache"` into client bundles. The
analytics server pages reach their client containers through
`@carlonicora/nextjs-jsonapi/analytics` so the built server entry crosses into the
`"use client"` bundle instead of inlining client code.

### The `"use client"` banner

`onSuccess` reads each file in a fixed `clientEntries` array and, if it does not
already start with `"use client"`, rewrites it with the directive prepended.
**Exactly eighteen files** — nine entries, each in both formats:

| `.mjs` | `.js` |
|---|---|
| `packages/nextjs-jsonapi/dist/client/index.mjs` | `packages/nextjs-jsonapi/dist/client/index.js` |
| `packages/nextjs-jsonapi/dist/components/index.mjs` | `packages/nextjs-jsonapi/dist/components/index.js` |
| `packages/nextjs-jsonapi/dist/contexts/index.mjs` | `packages/nextjs-jsonapi/dist/contexts/index.js` |
| `packages/nextjs-jsonapi/dist/testing/index.mjs` | `packages/nextjs-jsonapi/dist/testing/index.js` |
| `packages/nextjs-jsonapi/dist/billing/index.mjs` | `packages/nextjs-jsonapi/dist/billing/index.js` |
| `packages/nextjs-jsonapi/dist/features/help/index.mjs` | `packages/nextjs-jsonapi/dist/features/help/index.js` |
| `packages/nextjs-jsonapi/dist/features/tokenusage/index.mjs` | `packages/nextjs-jsonapi/dist/features/tokenusage/index.js` |
| `packages/nextjs-jsonapi/dist/features/analytics/index.mjs` | `packages/nextjs-jsonapi/dist/features/analytics/index.js` |

Seven entries are deliberately left without a banner, and stay server-safe:
`index`, `core/index`, `server/index`, `features/help/server`,
`features/analytics/server`, `server/cachedGet` (with its stub) and
`next-config/index`. The help `server-entry.ts` file says so in its header comment
— server components import `HELP_MODES` and `HelpMode` from it precisely so they
do not pull the client bundle. This is the split that makes the `/core` rule work:
a bootstrapper, a server component and `apps/web/src/proxy.ts` may only reach the
unbannered entries.

### dts and the missing `baseUrl`

`dts: { resolve: true, compilerOptions: { ignoreDeprecations: "6.0" } }`, unless
`TSUP_NO_DTS` is set: the package's dev watcher (`packages/nextjs-jsonapi/scripts/dev-watch.mjs`)
sets it and emits per-file declarations with `tsc` instead, because the bundled
dts pass peaks near 7 GB on every save. The release build always bundles the
types. The
suppression is tsup's, not the package's:  tsup's dts build sets
`baseUrl: compilerOptions.baseUrl || "."` unconditionally, and TypeScript 6 makes
`baseUrl` a hard error (TS5101). `packages/nextjs-jsonapi/tsconfig.json` no
longer sets `baseUrl` — it carries `paths` alone — so the suppression is scoped
to the tool that reintroduces it. The comment adds that tsup must be replaced
before TypeScript 7 regardless, because 7 deleted the JavaScript compiler API
the dts build depends on. `packages/shared/tsup.config.ts` carries the same
workaround for the same reason.

The rest of `packages/nextjs-jsonapi/tsconfig.json` is unremarkable except that
it is `strict: true` with `noUnusedLocals`/`noUnusedParameters` off,
`moduleResolution: "bundler"`, and `isolatedModules: true`.

## The `next-config` helper

`packages/nextjs-jsonapi/src/next-config/index.ts` exports `createNextConfig`,
which `apps/web/next.config.js` calls through `require`. It holds what every app
in the fleet used to copy into its own config:

- `cacheComponents: true` and `partialPrefetching: true`;
- `experimental.serverActions.bodySizeLimit: "5mb"`, `authInterrupts` (default
  on) and `turbopackGc`;
- `allowedDevOrigins` from `devOrigins`, `pageExtensions` with `mdx` when asked,
  `images.remotePatterns` parsed from `IMAGE_SOURCES`, `poweredByHeader: false`,
  `reactStrictMode: false`, the four `NEXT_PUBLIC_*` env passthroughs, and the
  Turbopack alias that pins `yjs` to one instance;
- `serverExternalPackages: ["esbuild", "esbuild-wasm"]` when `serwist` is on,
  which is all the serwist plugin wrapper used to add;
- `distDir: ".next-e2e"` when `E2E_BUILD` is `"true"`, so an e2e production build
  cannot clobber a running `next dev`;
- the security headers from `packages/nextjs-jsonapi/src/next-config/headers.ts`:
  the CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS (dropped under `E2E_BUILD`),
  the referrer policy and the permissions policy.

The CSP is built in `packages/nextjs-jsonapi/src/next-config/csp.ts`. Its base
holds `'self'`, inline and eval scripts, `data:`/`blob:` images and the hosts
derived from the env (`NEXT_PUBLIC_API_URL` and its websocket form,
`NEXT_PUBLIC_ADDRESS`, `IMAGE_SOURCES`). Every third party is opt-in through
`services` — `stripe`, `googleMaps`, `turnstile`, `discord`, `googleFonts` — and
anything else goes into `csp`, per directive. 4.0 removed the old `cspRemove`
option. `upgrade-insecure-requests` is added in production except under
`E2E_BUILD`.

Plugin wrapping stays in the app: the template wraps the result as
`withNextIntl(withMDX(createNextConfig({...})))` and passes its `/sw.js`
`rewrites` through. The helper imports only Node built-ins at runtime, because
`next.config.js` is loaded by `next start` in an image installed with `--prod`.

## The `generate-web-module` CLI

Declared as the package's `bin`, compiled by `tsc` to
`packages/nextjs-jsonapi/dist/scripts/generate-web-module/index.js`, and reachable
from the app root as `pnpm generate-web-module` (the root `package.json` maps the
script to that file). It turns a JSON schema file into a complete frontend
module.

### Flags

| Flag | Default | Effect |
|---|---|---|
| `<json-path>` | required | the schema file; relative paths resolve against the cwd |
| `-d`, `--dry-run` | false | build every file in memory and print the plan; write nothing |
| `-f`, `--force` | false | overwrite files that already exist |
| `-n`, `--no-register` | **not set** | skip the `Bootstrapper.ts` and message-catalogue edits |

`--no-register` is an **opt-out**, so the default behaviour edits the app. Unless
you pass it, every run also rewrites `apps/web/src/config/Bootstrapper.ts` and
appends keys to the message catalogue for each language the schema names
(defaulting to `["en"]`). Commander models this as `options.register`, which the
CLI inverts into `noRegister`.

### What it emits

The generator resolves the web app root by walking up for an `apps/web`
directory, then writes 19 or 20 files per module under
`apps/web/src/features/<subdir>/<kebab-name>/` and
`apps/web/src/app/[locale]/(main)/(features)/<plural-kebab>/`:

| Group | Files |
|---|---|
| Data (4, plus 1 conditional) | `<Name>Interface.ts`, `<Name>.ts`, `<Name>Service.ts`, `<Name>Fields.ts`, and `<Name>Aliases.ts` only when the module has aliased relationships |
| Forms (4) | `<Name>Editor.tsx`, `<Name>Deleter.tsx`, `<Name>Selector.tsx`, `<Name>MultiSelector.tsx` |
| Display (4) | `<Name>List.tsx`, `<Name>Content.tsx`, `<Name>Container.tsx`, `<Name>ListContainer.tsx` |
| Context and hook (2) | `<Name>Context.tsx`, `use<Name>TableStructure.tsx` |
| Module (1) | `<Name>Module.ts` |
| Pages (4) | the list `page.tsx` and the detail page under `[id]`, each with a `loading.tsx` rendering `PageSkeleton` from `@/features/common/components/skeletons/PageSkeleton` — every data-fetching segment needs one under Cache Components |

Written files are then run through Prettier. With `--dry-run` nothing is written
and nothing is formatted.

### Field-mapping rules

`packages/nextjs-jsonapi/scripts/generate-web-module/types/field-mapping.types.ts`
holds the whole mapping.

| JSON `type` | TypeScript | Zod base | Default form component |
|---|---|---|---|
| `string` | `string` | `z.string()` | `FormInput` |
| `number` | `number` | `z.number()` | `FormInputNumber` |
| `boolean` | `boolean` | `z.boolean()` | `Checkbox` |
| `date` | `Date` | `z.date()` | `DatePicker` |
| `any` | `any` | `z.any()` | `FormInput` |
| `blocknote` | `any` | `z.any()` | `BlockNoteEditor` |

On top of the type mapping:

- **Four field names override the component**: `content` → `BlockNoteEditor`,
  and `description` / `abstract` / `body` → `FormTextarea`. The `content`
  override only applies when the type is non-primitive; a field literally named
  `content` typed `string` stays a `FormInput`.
- **Rich text has two markers.** The canonical one is `type: "blocknote"`, which
  works on any field name and allows several per module. The legacy one is a
  field named `content` with a non-primitive type.
- **Required strings get a message.** A non-nullable `string` becomes
  `z.string().min(1, { message: t(\`features.<module>.fields.<field>.error\`) })`;
  every other non-nullable type is the bare base; `nullable` appends
  `.optional()`. Dates use `z.date()` rather than `z.coerce.date()` to avoid
  react-hook-form inference problems.
- **Content inheritance.** `extendsContent` (explicit, or inferred from the
  presence of `name` / `tldr` / `abstract`) removes `name`, `tldr`, `abstract`
  and `content` from the generated form, because the Content foundation supplies
  them, and adds `authors` to the table columns.
- **Table columns** are `<module>Id`, `name`, optionally `authors`, then every
  custom field except `id`, `name`, `tldr`, `abstract`, `content`, `createdAt`
  and `updatedAt`, then `createdAt` and `updatedAt`. Fields typed `blocknote`
  are excluded outright — they hold stringified JSON and would render as noise.
- **Relationships** map to `userObjectSchema` for the `Author` variant and
  `entityObjectSchema` otherwise; aliases that collide (two aliases pointing at
  the same entity) are detected and disambiguated in the generated service
  methods.
- **Default icon** is `FileTextIcon`; `displayProp` defaults to `name` when the
  module has one, otherwise `id`.

The generator also scans every `.json` file beside the input to build a
`moduleName → hasNameField` map, so cross-module relationship code knows whether
the target has a `name` to display.

## `check-rtl-classes.mjs`

`packages/nextjs-jsonapi/scripts/check-rtl-classes.mjs` runs as the second half
of the package's `lint` script. It walks `src/`, and fails the lint on any
physical directional Tailwind class or CSS property:

`ml-`/`mr-`/`pl-`/`pr-` · `left-`/`right-` (including negatives) ·
`text-left`/`text-right` · `rounded-l`/`-r`/`-tl`/`-tr`/`-bl`/`-br` ·
`border-l`/`border-r` · `float-left`/`float-right` · `scroll-ml-`/`-mr-`/`-pl-`/`-pr-` ·
`marginLeft` / `marginRight` / `paddingLeft` / `paddingRight`

Use the logical equivalents (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`).
Three escapes exist: a line containing `rtl-ok`, the line *after* one containing
`rtl-ok`, and any line containing `data-[side=` (already a resolved physical
side). Test and `__tests__` files are skipped entirely. The script also guards
its own direct-invocation check with `realpathSync`, because `process.argv[1]` is
not symlink-resolved while `import.meta.url` is — without it the CLI silently
does nothing. It has its own spec at
`packages/nextjs-jsonapi/scripts/check-rtl-classes.test.ts`.

## The testing kit

Everything below is exported from `@carlonicora/nextjs-jsonapi/testing`. The
entry carries a `"use client"` banner.

| Symbol | Signature |
|---|---|
| `MockJsonApiProvider` | `({ children, config?: Partial<JsonApiConfig> }) => JSX.Element` |
| `defaultMockConfig` | `JsonApiConfig` — `apiUrl: "https://api.test.com"`, a token getter returning `"mock-token-for-testing"`, an `"en"` language getter, no-op `onError`, `cacheConfig.defaultProfile: "default"` |
| `MockJsonApiProviderProps` | `{ children: ReactNode; config?: Partial<JsonApiConfig> }` |
| `createMockModule` | `(options: { name: string; cache?: string; inclusions? }) => ApiRequestDataTypeInterface` — synthesises a `MockModel` class as the module's `model` |
| `CreateMockModuleOptions` | the options type above |
| `createMockResponse` | `(options?: { data?, ok?, response?, error?, meta?, self?, next?, prev? }) => ApiResponseInterface` |
| `createMockErrorResponse` | `(statusCode: number, errorMessage: string) => ApiResponseInterface` |
| `CreateMockResponseOptions` | the options type above |
| `createMockService` | `(options?: { defaultResponse?: ApiResponseInterface }) => MockService` |
| `createMockErrorService` | `(statusCode = 500, errorMessage = "Error") => MockService` |
| `MockService` | `{ get, post, put, patch, delete }`, each a `MockApiMethod` |
| `MockApiMethod` | `Mock<(...args: any[]) => Promise<ApiResponseInterface>>` |
| `CreateMockServiceOptions` | the options type above |
| `createMockApiData` | `(options: { type, id?, attributes?, relationships?, included?, createdAt?, updatedAt?, self? }) => ApiDataInterface` |
| `createMockApiDataList` | `(type: string, count: number, attributesFactory?: (index: number) => Record<string, any>) => ApiDataInterface[]` |
| `CreateMockApiDataOptions` | the options type above |
| `jsonApiMatchers` | five matchers: `toBeValidJsonApi`, `toHaveJsonApiType`, `toHaveJsonApiAttribute`, `toHaveJsonApiRelationship`, `toHaveJsonApiLength` |
| `extendExpectWithJsonApiMatchers` | `() => void` — calls `expect.extend(jsonApiMatchers)` |
| `renderWithProviders` | `(ui: ReactElement, options?: RenderWithProvidersOptions) => RenderResult` |
| `RenderWithProvidersOptions` | `RenderOptions` minus `wrapper`, plus `jsonApiConfig?: Partial<JsonApiConfig>` and its own `wrapper?: ComponentType<{ children }>` |
| `render`, `screen`, `waitFor`, `fireEvent`, `within`, `userEvent` | re-exported from Testing Library so a spec needs one import |

`createMockService` returns Vitest `Mock`s, so the kit only works inside Vitest —
which is why `vitest` and the four Testing Library packages sit in the tsup
`external` list.

## The package's own tests

`packages/nextjs-jsonapi/vitest.config.ts` uses `@vitejs/plugin-react`, a `jsdom`
environment, `globals: true`, and the same four `@/` aliases the tsup build
defines. Two details are deliberate:

- `include` is `["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.{ts,tsx}"]`.
  The second pattern is what stops the CLI's own specs from being silently
  skipped.
- `testTimeout: 15000` and `hookTimeout: 30000`. The comment explains that
  Vitest's 5-second default is a wall-clock budget, and under the monorepo-wide
  `pnpm test` this jsdom suite competes with the Node suites for CPU, so a click
  that resolves in under a second standalone can blow the budget purely from
  scheduling delay.

164 spec files ship with the package. The heaviest clusters are the component
library (18), the analytics feature (14), the core layer (12), the assistant
feature (12), the handbook feature (11), the generator CLI (9), the utilities (7),
the UI primitives (7) and the help feature (7). Both the client hooks and the core
abstracts, factories, endpoint and translation layers have coverage, and
`packages/nextjs-jsonapi/src/next-config/` has its own.

## Consumer obligations

Every rule the package places on an app, with the mechanism that enforces it and
whether this template already satisfies it.

| Obligation | Mechanism | In this template |
|---|---|---|
| Call `configureJsonApi({ apiUrl, bootstrapper })` before anything reads a module | `ModuleRegistry.get` throws `No bootstrapper registered. Ensure configureJsonApi({ bootstrapper }) is called…` | yes — `apps/web/src/config/instrumentation-env.ts` |
| Register every module and call `setBootstrapper` | `DataClassRegistry.get` throws `Class not registered for key: …` | yes — `apps/web/src/config/Bootstrapper.ts` |
| Declaration-merge `AppModuleDefinitions` | without it `Modules.X` for an app module is a type error | yes — `apps/web/src/types/modules.d.ts` |
| Import module registration from `/core` only | the other barrels carry a `"use client"` banner; a server-evaluated file importing one fails the build | yes — `apps/web/src/config/Bootstrapper.ts` imports `@carlonicora/nextjs-jsonapi/core` |
| Register a table generator per module before rendering its table | `TableGeneratorRegistry.get` throws, naming the registered types | partly — the package registers six via its `/client` barrel; the app registers its own |
| Add both Tailwind `@source` directives | Tailwind v4 scans only what it is told; unscanned classes compile to nothing | yes — `apps/web/src/app/globals.css` |
| Define the shadcn CSS variables | the primitives style from `--background`, `--foreground`, `--primary` and the rest | yes — `apps/web/src/app/globals.css` |
| Define `--color-success` and `--color-success-foreground` | `text-success` / `bg-success/15` / `border-success/30` resolve from them; absent, the classes compile to nothing and the text inherits the surrounding foreground — invisible on a dark panel | **no** |
| Add the pointer-cursor base layer | Tailwind v4 dropped Preflight's `button { cursor: pointer }`; the package's primitives carry their own `cursor-*`, but raw `<button>` elements inside its feature components do not | **no** |
| Own RTL: set `<html dir>` and mount `DirectionProvider` with the same value | without the provider, Base UI popups resolve `align="start"/"end"` as LTR even though the CSS mirrors; without `<html dir>` nothing mirrors | **no** — the template ships LTR only, so nothing breaks until an RTL locale is added |
| Use logical side values on side-positioned components | `Sidebar` defaults to `"start"`, `SheetContent` to `"end"`, `Drawer` accepts `"start"`/`"end"`; an explicit `"left"`/`"right"` stays physical and will not mirror | n/a while LTR |
| Configure i18n, auth, roles and login | `getRoleId`, `getTokenHandler` and the i18n hooks return nothing until the matching `configure*` call has run; a server `callApi` throws `i18n not configured` without `getLocale` | yes — `apps/web/src/config/instrumentation-env.ts`, plus `configureI18n` with `getLocale` in `apps/web/src/config/env.ts` |
| Keep next-intl out of instrumentation | `getLocale` reaches `apps/web/src/i18n/request.ts`, which reads `next/root-params`; Next allows that only inside the app directory | yes — `apps/web/src/instrumentation.ts` imports `@/config/instrumentation-env`, never `env.ts` |
| Build `next.config.js` with `createNextConfig` and name every third party in `services` | the CSP allows no third-party host otherwise; a missing service shows up as CSP violations on first load | yes — `apps/web/next.config.js`, with `stripe`, `discord` and `googleMaps` |
| Pass the session as a promise and never await it on the path to `{children}` | under Cache Components an awaited session in a layout drops every page below it from the static shell | yes — `apps/web/src/features/common/components/session/AppShell.tsx` |
| Inline the package in the app's Vitest config | otherwise CI resolves a pre-built npm copy instead of the workspace source | yes — `apps/web/vitest.config.ts` |
| Rebuild the package after editing it | the app resolves the `exports` map, which points at `dist/`; `turbo.json` gives `dev` and `test` a `dependsOn: ["^build"]` | yes — `turbo.json` |

## How `apps/web` consumes the package

Three concrete wires.

**The dependency.** `apps/web/package.json` declares
`"@carlonicora/nextjs-jsonapi": "workspace:*"`, so pnpm links the submodule at
`packages/nextjs-jsonapi` rather than fetching from npm. Resolution goes through
the `exports` map to `dist/`, not `src/` — an edit to the package is invisible
until it is rebuilt.

**Tailwind.** `apps/web/src/app/globals.css` carries two `@source` directives,
one for each way the package can be present:

```css
/* Development: workspace package */
@source "../../../../packages/nextjs-jsonapi/src/**/*.{ts,tsx}";
/* Production: npm package in node_modules (2 levels from apps/web/src/app/) */
@source "../../node_modules/@carlonicora/nextjs-jsonapi/src/**/*.{ts,tsx}";
```

Both must stay. Tailwind v4 only generates classes it finds in scanned files, and
every class the package's components use lives in the package's `src/`, not in
the app's. Dropping either line produces an app that renders unstyled package
components in whichever mode that line covered. This is also why the package's
`files` array in `packages/nextjs-jsonapi/package.json` ships `src` alongside
`dist`.

**Vitest.** `apps/web/vitest.config.ts` sets
`server.deps.inline: [/@carlonicora\/nextjs-jsonapi/]` so the workspace source is
transformed by Vite rather than loaded as a pre-bundled external. Without it, CI
runs the app's component specs against whichever build happened to be in
`node_modules`.

## Where to look

| File | Why |
|---|---|
| `packages/nextjs-jsonapi/tsup.config.ts` | the entries, `splitting`, `clean: false`, the aliases, `external`, the banner list |
| `packages/nextjs-jsonapi/src/next-config/index.ts` | everything `createNextConfig` sets |
| `packages/nextjs-jsonapi/src/next-config/csp.ts` | the base CSP and the hosts each service adds |
| `apps/web/next.config.js` | the template's call: `services`, `mdx`, `serwist`, the `/sw.js` rewrites |
| `packages/nextjs-jsonapi/package.json` | the build script, the `bin`, the `files` array, the peer dependencies |
| `packages/nextjs-jsonapi/tsconfig.json` | `paths` without `baseUrl`, and the rest of the compiler settings |
| `packages/nextjs-jsonapi/scripts/generate-web-module/index.ts` | the CLI flags |
| `packages/nextjs-jsonapi/scripts/generate-web-module/generator.ts` | the artefact list and the registration steps |
| `packages/nextjs-jsonapi/scripts/generate-web-module/types/field-mapping.types.ts` | every field-mapping rule |
| `packages/nextjs-jsonapi/scripts/check-rtl-classes.mjs` | the forbidden patterns and the escapes |
| `packages/nextjs-jsonapi/src/testing/index.ts` | the testing kit surface |
| `apps/web/src/app/globals.css` | the two `@source` directives |
| `apps/web/vitest.config.ts` | `server.deps.inline` |

## Gaps and drift

- `apps/web/src/app/globals.css` defines neither `--color-success` nor
  `--color-success-foreground`, and carries no pointer-cursor base layer.
  `packages/nextjs-jsonapi/CLAUDE.md` states both as hard requirements for any
  consuming app. Success-state text in the billing components will render in the
  inherited foreground colour, and raw `<button>` elements inside the package's
  feature components will not show a pointer.
- Nothing in `apps/web/src` mounts `DirectionProvider`, so an app that adds an
  RTL locale gets mirrored CSS with LTR-resolved Base UI popups until it does.
- Not examined: the generator's template files themselves (the nineteen
  `*.template.ts` modules under
  `packages/nextjs-jsonapi/scripts/generate-web-module/templates/`), the JSON
  schema validators, and the `bootstrapper-updater.ts` / `i18n-updater.ts`
  edit strategies — all read at call-site level only. The package's ESLint
  configuration was not examined.
