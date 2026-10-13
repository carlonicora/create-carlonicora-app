---
title: Conventions
section: 08-workflow
---

The conventions a file in this repository is expected to follow. Every one of
them is readable off the code that ships; where the code and a shipped
instruction file disagree, this page says so and the known-drift page records it.

## Naming

| Thing | Convention | Example in the template |
|---|---|---|
| Backend file | kebab-case, role-suffixed | `apps/api/src/features/essentials/search/repositories/search.repository.ts` |
| Backend metadata | `<entity>.meta.ts`, exporting `<entity>Meta` | `apps/api/src/features/essentials/search/entities/search.meta.ts` |
| Backend DTO | `<entity>[-verb].dto.ts` | `apps/api/src/features/essentials/search/dtos/search.dto.ts` |
| Backend NestJS module | `<feature>.module.ts` | `apps/api/src/features/essentials/search/search.module.ts` |
| Migration | `<YYYYMMDD>_<NNN>.ts` | `apps/api/src/neo4j.migrations/20250901_001.ts` |
| Frontend model / service / factory | PascalCase, matching the class | `apps/web/src/features/essentials/search/data/SearchService.ts` |
| Frontend module factory | `<Entity>Module.ts` | `apps/web/src/features/essentials/search/SearchModule.ts` |
| Frontend component | PascalCase, role-suffixed, .tsx | `apps/web/src/features/common/components/containers/IndexContainer.tsx` |
| Frontend interface | `<Entity>Interface.ts` | `apps/web/src/features/essentials/search/data/SearchInterface.ts` |

Backend directories are kebab-case; frontend directories are kebab-case too,
while the files inside `data/` and `components/` are PascalCase. The split is
consistent: NestJS names by file, React names by exported component.

`searchMeta` is the pattern for identifiers: `type`, `endpoint`, `nodeName` and
`labelName` in one exported `DataMeta` object, imported wherever an endpoint
string would otherwise be typed by hand. Never write the endpoint literal.

## Backend feature layout

Every backend feature lives under `apps/api/src/features/<group>/<entity>/`:

```
entities/          <entity>.meta.ts, <entity>.ts (entity class + EntityDescriptor)
dtos/              <entity>-post.dto.ts, <entity>-put.dto.ts, <entity>-patch.dto.ts
repositories/      <entity>.repository.ts    extends AbstractRepository
services/          <entity>.service.ts       extends AbstractService
controllers/       <entity>.controller.ts    calls the service, never the repository
<entity>.module.ts the NestJS module: controllers, providers, exports
```

`apps/api/src/features/essentials/search/` is the one worked example the
template ships and follows this layout exactly. Feature modules are collected in
`apps/api/src/features/features.modules.ts`, which `apps/api/src/main.ts` passes
to `bootstrap()` as `appModules`.

The directory-per-layer form above is what `pnpm generate-module` emits and what
the template contains. `apps/api/CLAUDE.md` still draws the older flat form,
with the repository, service, controller and module sitting directly in the
feature root. Follow the directories.

## Frontend feature layout

Every frontend feature lives under `apps/web/src/features/<group>/<entity>/`:

```
data/              <Entity>.ts (extends AbstractApiData)
                   <Entity>Interface.ts
                   <Entity>Service.ts (extends AbstractService)
<Entity>Module.ts  the ModuleFactory call
components/        <Entity>Container.tsx (fetches) and presentational components
__tests__/         <Entity>.spec.tsx
```

`apps/web/src/features/essentials/search/` ships its data directory and its
module factory only — that feature has no UI of its own and no tests, so neither
a components directory nor a __tests__ directory exists there. Both are still the
convention for a feature you add, and both are what `pnpm generate-web-module`
emits.

Containers fetch and hold state; components render. Cross-component state goes
in a Jotai atom (`<Entity>Atom.ts`), not in a presentational component.

Every module factory call registers itself in `apps/web/src/config/Bootstrapper.ts`.
A model that is not registered there cannot be rehydrated.

## Imports

| Rule | Where it comes from |
|---|---|
| `apps/api` imports its own code as `src/...` | `paths` in `apps/api/tsconfig.json` |
| `apps/web` imports its own code as `@/...` | `paths` in `apps/web/tsconfig.json` |
| Both import shared identifiers from the shared package | `paths` in `tsconfig.base.json` |
| Server-side and registration code imports the frontend package from its `/core` entry | `apps/web/src/config/Bootstrapper.ts` |

The `/core` rule is load-bearing. `packages/nextjs-jsonapi/tsup.config.ts` lists
the built entries that get a `"use client"` banner: `client`, `components`,
`contexts`, `testing`, `billing` and the two feature entries. `core` and the
root entry do not. Import a registry, a model base class or a factory from
`/core`; import a component from `/components`. Pulling `ModuleFactory` out of
the root barrel drags a client boundary into a server file.

Never import a foundation component in order to edit it. Copy it into your own
feature directory and change the copy — `apps/web/CLAUDE.md` states this as a
rule, and it is the reason `apps/web/src/features/common/` exists.

## Configuration access

**`process.env` is read in exactly three places, and nowhere else.**

| Tier | The only file allowed to read `process.env` |
|---|---|
| Backend | `packages/nestjs-neo4jsonapi/src/config/base.config.ts` |
| Frontend, middleware-safe | `apps/web/src/config/middleware-env.ts` |
| Frontend, inside the package | `packages/nextjs-jsonapi/src/core/env.ts` |

Everything else reads `ConfigService` on the backend, or the exported `ENV`
object on the frontend. `apps/api/src/config/config.ts` spreads `baseConfig` and
adds the app's own keys; `apps/api/src/load-env.ts` populates `process.env` from
the root .env file and must stay the first import of every entry point.

On the frontend there is a second constraint on top of the first: the reads must
be **literal** `process.env.NEXT_PUBLIC_X` expressions. Next.js inlines
`NEXT_PUBLIC_*` by textual substitution at build time, so a computed lookup
(`process.env[key]`) is never substituted and reads as `undefined` in the
browser bundle. `packages/nextjs-jsonapi/src/core/env.ts` documents this at
length and spells every variable out in full; `apps/web/src/config/middleware-env.ts`
does the same and carries no library imports at all, because Next.js middleware
runs with restricted module support.

The app's runtime is configured in two files. `apps/web/src/config/instrumentation-env.ts`
re-exports `ENV`, calls `bootstrap()` on import, and runs `configureJsonApi`,
`configureAuth`, `configureRoles` and `configureLogin`; `apps/web/src/instrumentation.ts`
loads it. `apps/web/src/config/env.ts` imports it, re-exports the same `ENV` and
adds `configureI18n`, which `instrumentation.ts` must not reach because next-intl
loads `next/root-params`. App code imports `@/config/env`.

## JSON:API payloads

{json:api} is the only wire format between the two apps, and a payload is never
assembled by hand.

- **Backend.** The serialiser derives the document from the `EntityDescriptor`.
  Repositories return typed objects through `readOne()` / `readMany()`, never
  raw driver records. Queries go through `buildDefaultMatch()`, which injects
  the company filter; a hand-written `MATCH` without it is a tenancy hole.
  Pagination uses the `{CURSOR}` placeholder, never `SKIP`/`LIMIT`.
- **Frontend.** Every model extends `AbstractApiData` and implements
  `rehydrate()` for reads and `createJsonApi()` for writes.
  `apps/web/src/features/essentials/search/data/Search.ts` is the shipped
  example — it implements `rehydrate()` and throws from `createJsonApi()`,
  because the resource is read-only. Requests go through `callApi()` with an
  explicit `type: Modules.X`; URLs are built with `EndpointCreator`, as
  `apps/web/src/features/essentials/search/data/SearchService.ts` shows.

`overridesJsonApiCreation` exists and is banned without a dedicated model
method: the model owns serialisation or nothing does.

The rulebook copies under `docs/handbook/02-framework/rulebook/` carry the
layer-by-layer form of these rules, with canonical examples for entities, DTOs,
repositories, services, controllers, models, interfaces, services and
components.

## Language

Everything user-visible goes through `next-intl`. Components call
`useTranslations()`; server components call `getTranslations()`. Keys live in
`apps/web/messages/en.json`, the only message file the template ships, and
`apps/web/src/i18n/routing.ts` declares one locale, `en`, with
`localePrefix: "as-needed"`.

Two checks enforce it. `eslint-plugin-i18next`'s `no-literal-string` rule runs
in `jsx-text-only` mode at `warn` in `apps/web/eslint.config.mjs`, and
`apps/web/scripts/validate-translations.mjs` fails the lint when a key used in
code is missing from that file. Adding a locale means adding a message file,
adding the code to `apps/web/src/i18n/routing.ts`, and adding the `date-fns` locale to
`apps/web/src/i18n/useDateFnsLocale.ts`.

Code, comments, commit messages, identifiers and prompts are English. The
handbook ships in English only.

## Dates

Dates are native Neo4j types, never strings.

| Layer | Rule |
|---|---|
| Descriptor | `type: "date"` or `type: "datetime"` |
| Write path | `date(left($value, 10))` or `datetime($value)` in Cypher |
| Read path | `convertNeo4jDate` returns `YYYY-MM-DD` for JSON only; storage stays native |
| Frontend, date-only payloads | `formatLocalDate` from the package's `/core` entry |

`formatLocalDate` is not optional politeness: a raw JavaScript `Date` passed
through `JSON.stringify()` is UTC-shifted, so a date-only field silently moves a
day. `apps/web/CLAUDE.md` lists this among its common mistakes, and the rulebook
page `docs/handbook/02-framework/rulebook/date-handling.md` is the long form.

## Typography and UI

`docs/handbook/02-framework/rulebook/frontend/05-typography.md` holds the role
table; read it before styling any text. Two structural rules sit above it:

- **Base UI, not Radix.** There is no `asChild` prop. Compose with `render`, and
  never wrap a `<Button>` inside a trigger. `packages/nextjs-jsonapi/src/shadcnui/ui/button.tsx`
  builds on `@base-ui/react/button`.
- **Use the package's primitives.** `Select`, `Button`, `FormInput`,
  `AlertDialog`, `Dialog`, `UserAvatar`, `Badge` and the rest come from the
  package's `/components` entry. A raw `<input>` or `<select>` renders unstyled,
  which usually reads as invisible.

Before writing a component, search for it. `apps/web/src/features/common/components/`
and the package's own component tree already carry containers, navigation,
dialogs, tables and form controls; duplicating one is the most common avoidable
change in this codebase.

## Where to look

| File | What it settles |
|---|---|
| `CLAUDE.md` | The non-negotiable guardrails for both tiers |
| `apps/api/CLAUDE.md` | Backend core rules, the common-mistakes table, the RBAC workflow |
| `apps/web/CLAUDE.md` | Frontend core rules and its own common-mistakes table |
| `apps/api/src/features/essentials/search/search.module.ts` | The shipped backend feature, layout and all |
| `apps/web/src/features/essentials/search/SearchModule.ts` | The shipped frontend module factory |
| `apps/web/src/config/Bootstrapper.ts` | Where every model and module is registered |
| `apps/web/src/config/middleware-env.ts` | The frontend's only sanctioned `process.env` reads |
| `packages/nestjs-neo4jsonapi/src/config/base.config.ts` | The backend's only sanctioned `process.env` reads |
| `tsconfig.base.json` | Shared compiler settings and the shared-package path mapping |
| `docs/handbook/02-framework/rulebook/` | The layer-by-layer rulebook, copied verbatim from the architecture skill |

## Gaps and drift

- `apps/api/CLAUDE.md` documents a flat feature layout; the shipped feature and
  the generator both use directories per layer. Recorded on the known-drift page.
- The template itself reads `process.env` in three places outside the sanctioned
  file: `apps/api/src/features/features.modules.ts` and
  `apps/api/src/openapi/openapi.config.ts` for `NODE_ENV` and the two OpenAPI
  toggles, and `apps/web/src/server-actions/auth-cookies.ts` for `NODE_ENV`.
  All three read build-mode flags rather than application configuration, but the
  rule as written admits no exception.
- The typography role table lives in the copied rulebook page, not in a
  template-owned document. When the `nja` plugin's reference changes, the copy
  goes stale until it is re-copied.
- Not examined: the shadcn/ui generator config in `apps/web/components.json`
  (its aliases point at directories that do not exist — see the known-drift
  page), and the conventions inside `packages/shared`, which ships three
  constant files and no components.
