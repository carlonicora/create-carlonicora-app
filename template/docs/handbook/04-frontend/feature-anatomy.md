---
title: Feature anatomy
section: 04-frontend
---

A frontend feature is four files: an interface, a model, a service, and a module factory.
The template ships exactly one complete example — `apps/web/src/features/essentials/search/` —
and everything below is annotated on it. Every other feature the app renders lives inside
`@carlonicora/nextjs-jsonapi`; `search` is the only one whose source is in the app.

```
apps/web/src/features/essentials/search/
├── data/
│   ├── SearchInterface.ts
│   ├── Search.ts
│   └── SearchService.ts
└── SearchModule.ts
```

## The interface

`apps/web/src/features/essentials/search/data/SearchInterface.ts` extends the package's
`ApiDataInterface` and declares **getters only**:

```ts
export interface SearchInterface extends ApiDataInterface {
  get name(): string;
  get entityType(): string;
  get score(): number;
}
```

Getters rather than properties, because the model exposes backing fields behind getters
with defaults; a property declaration would let a consumer assign to it.

## The model

`apps/web/src/features/essentials/search/data/Search.ts` extends `AbstractApiData` and
implements the interface. Four rules, all visible in the file:

**Backing fields are private and optional.** `_name`, `_entityType`, `_score` — the
underscore prefix is the convention across both the app and the package.

**Every getter supplies a default.** `this._name ?? ""`, `this._score ?? 0`. A model is
rehydrated from whatever the API sent, and a missing attribute must not throw at render
time.

**`rehydrate` calls `super.rehydrate(data)` first, then returns `this`.** The base
implementation sets `_jsonApi`, `_included`, `_type`, `_id`, `_createdAt`, `_updatedAt`
and `_self` from the JSON:API document; reading `data.jsonApi.attributes` before that
call would work by accident, but skipping the call entirely leaves the model with no id.
The return type is `this`, so subclass chaining stays typed.

**`createJsonApi()` throws, because the resource is read-only.**

```ts
createJsonApi(): never {
  throw new Error("Search is read-only");
}
```

The base class already throws "Method not implemented"; declaring it `never` with an
explicit message states the intent. A writable model implements it and returns the
JSON:API payload — never hand-built at a call site.

`AbstractApiData` also gives every model `dehydrate()`, which returns
`{ jsonApi, included }` and is the wire format for the server-to-client handoff described
at the bottom of this page.

## The service

`apps/web/src/features/essentials/search/data/SearchService.ts` extends `AbstractService`
and exposes static methods. Three things it demonstrates:

**Build the URL with `EndpointCreator`, never a string literal.** The constructor takes
the module itself, and `generate()` derives the path from `module.name`:

```ts
const endpoint = new EndpointCreator({ endpoint: Modules.Search });
endpoint.addAdditionalParam("term", params.term);
if (params.types?.length) endpoint.addAdditionalParam("types", params.types.join(","));
```

`addAdditionalParam` appends to a query-string list and returns the builder, so calls
chain. `EndpointCreator` also offers `id`, `childEndpoint`, `childId`, `limitToType` and
`limitToFields`.

**Call `this.callApi` with an explicit `type`.**

```ts
return this.callApi({ type: Modules.Search, method: HttpMethod.GET, endpoint: endpoint.generate() });
```

`type` is what the response translator uses to pick the model class for rehydration.
Omitting it does not fail loudly — it fails by handing back untyped data.

**Never call `fetch` directly.** `apps/web/CLAUDE.md` lists it first among the core
rules. `callApi` carries the JSON:API content type, the auth token, the company scope,
pagination refs and error handling.

## The module factory

`apps/web/src/features/essentials/search/SearchModule.ts` is four lines:

```ts
export const SearchModule = (factory: ModuleFactory) =>
  factory({
    pageUrl: "/searches",
    name: "searches",
    model: Search,
    moduleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  });
```

| Field | Meaning |
|---|---|
| `name` | The API path segment. `EndpointCreator` builds every URL from it |
| `model` | The class `rehydrate` instantiates |
| `pageUrl` | The app route for this resource. `matchUrlToModule` and the sidebar use it; a module without one is not navigable |
| `moduleId` | The RBAC module UUID. See the access-control page |
| `feature` | Optional feature id gating the whole module |
| `icon`, `cache`, `identifier`, `inclusions` | Optional; `identifier` defaults to `["name"]` inside the app's factory |

The function takes the factory as a parameter rather than importing it, so
`apps/web/src/config/Bootstrapper.ts` decides how modules are constructed.

## The full feature tree

`apps/web/CLAUDE.md` documents the shape a real feature grows into:

```
src/features/{domain}/
├── data/
│   ├── {Entity}.ts
│   ├── {Entity}Interface.ts
│   └── {Entity}Service.ts
├── {Entity}Module.ts
├── {Entity}Atom.ts          # jotai atoms, when cross-component state is needed
├── components/
│   ├── {Entity}Container.tsx   # fetches, holds state
│   └── {Entity}Component.tsx   # pure presentation
└── __tests__/
    └── {Entity}.spec.tsx
```

The split is the rule the file states as "containers fetch, components render". State
belongs in a container or an atom, never in a presentational component.

## What `pnpm generate-web-module` emits

The generator ships inside the package and is wired at the repo root as
`generate-web-module`. It reads a JSON schema describing one or more modules and writes
nineteen files per module (twenty when the schema declares aliased relationships),
under `apps/web/src/features/<subdir>/<kebab-name>/`:

| Group | Files |
|---|---|
| Data (4, or 5) | `<Entity>Interface.ts`, `<Entity>.ts`, `<Entity>Service.ts`, `<Entity>Fields.ts`, and `<Entity>Aliases.ts` only when relationships carry aliases |
| Forms (4) | `components/forms/<Entity>Editor.tsx`, `<Entity>Deleter.tsx`, `<Entity>Selector.tsx`, `<Entity>MultiSelector.tsx` |
| Display (4) | `components/lists/<Entity>List.tsx`, `components/details/<Entity>Content.tsx`, `components/containers/<Entity>Container.tsx`, `components/containers/<Entity>ListContainer.tsx` |
| Context and hooks (2) | `contexts/<Entity>Context.tsx`, `hooks/use<Entity>TableStructure.tsx` |
| Module (1) | `<Entity>Module.ts` |
| Pages (4) | a list page and an `[id]` detail page under the app router, each with a `loading.tsx` that renders `PageSkeleton` |

After writing, it formats with Prettier, then — unless `--no-register` is passed — calls
`updateBootstrapper` to add the import and the `allModules` key, and `updateI18n` once
per declared language to add the message keys. The generated i18n set covers, per field
and per relationship, a `label`, a `placeholder` and an `error`, plus a pluralised list
label for relationships.

Two generator behaviours worth knowing before you write a schema:

- Fields of type `blocknote` are excluded from the table column list, because they hold
  stringified JSON.
- `containerTabs.activity` is opt-in: the Activity tab imports an app-level feed that
  most apps do not have, so it is emitted only when the schema asks for it.

## The context and provider pattern

Every generated feature gets a `contexts/<Entity>Context.tsx` holding the entity, a
setter and a reload function, and wrapping its children in the package's
`SharedProvider` so the page chrome — the title strip and the breadcrumb — reads from the
same place. The package's own features follow the identical shape: `UserProvider`,
`CompanyProvider`, `RoleProvider`, `HowToProvider`, `ProductProvider`, `PriceProvider`,
`RbacProvider`, `AdministrationProvider`, `TokenUsageAdminProvider`.

Two consequences are visible in the shipped routes:

- A provider that supplies page chrome **replaces** whatever the previously rendered page
  left in `SharedContext`. The package's administration context says so explicitly:
  an administration page that provides nothing inherits the last page's title. That is why
  `/administration/token-usage` and `/administration/ai-connections` both mount
  `AdministrationProvider` even though the container inside does the real work.
- A container that brings its own `RoundPageContainer` must **not** be wrapped in a second
  shell. `/administration` and `/users/[id]` carry a comment saying so; wrapping stacks
  two header bars. `/administration/products` and `/administration/companies` note only
  that their container owns the page shell.

## Crossing the server-client boundary: `dehydratedX`

A Server Component can fetch an entity, but it cannot hand a model instance to a Client
Component — only plain serialisable data crosses. The convention is a prop named
`dehydrated<Entity>`, holding the result of `model.dehydrate()`:

```tsx
const user: UserInterface = await getCachedUser(params.id);

return (
  <CompanyProvider dehydratedCompany={user.company?.dehydrate()}>
    <UserProvider dehydratedUser={user.dehydrate()}>
      <UserContainer />
    </UserProvider>
  </CompanyProvider>
);
```

`dehydrate()` returns `{ jsonApi, included }`; the provider calls `rehydrate` on the
client to rebuild a real model. The template uses the prop on `CompanyProvider`,
`UserProvider`, `HowToProvider`, `RoleProvider`, `ProductProvider`, `PriceProvider` and
the `Cookies` component, and the generated `<Entity>Context.tsx` declares it too. Every
provider also works with no prop at all, for list pages that have nothing to seed.

The same boundary explains a second pattern in the shipped routes: a Server Component
cannot pass `Modules.X` to a Client Component either, because a registry entry carries an
icon component and a model class. `CompaniesListPage` and `ProductsListPage` are
therefore one line each — the *container* passes the module, from inside the client
bundle.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/features/essentials/search/data/SearchInterface.ts` | Getter-only interface |
| `apps/web/src/features/essentials/search/data/Search.ts` | Backing fields, defaults, `rehydrate`, read-only `createJsonApi` |
| `apps/web/src/features/essentials/search/data/SearchService.ts` | `EndpointCreator`, `addAdditionalParam`, `callApi` with `type` |
| `apps/web/src/features/essentials/search/SearchModule.ts` | The four factory fields |
| `apps/web/CLAUDE.md` | The feature tree, the core rules and the common-mistakes table |
| `apps/web/src/app/[locale]/(main)/(foundations)/users/[id]/page.tsx` | The `dehydratedX` handoff, two providers deep |
| `apps/web/src/features/common/components/containers/UserProfileContainer.tsx` | A local container composing package providers |
| `apps/web/src/features/common/contexts/SettingsSectionActionsContext.tsx` | A local context publishing upward through a registry |
| `apps/web/src/config/Bootstrapper.ts` | Where a new module is registered |
| `package.json` | The `generate-web-module` script |

## Gaps and drift

- `search` is the only app-owned feature, and it is read-only. The template ships no
  example of a writable model's `createJsonApi`, no `<Entity>Atom.ts`, no
  `components/` directory and no `__tests__/` directory under `apps/web/src/features`.
- The generator writes its detail and list pages under a `(features)` route group that
  the template does not contain; the first generated module creates it.
- `EndpointCreator.generate()` concatenates `key=value` pairs without URL-encoding. A
  parameter value containing `&`, `=` or a space produces a malformed query string.
- `apps/web/CLAUDE.md` says "All models must implement **static** `rehydrate()`". The
  base class and `Search` both implement it as an **instance** method returning `this`.
  The code is right; the table entry is stale.
- I did not examine the generator's individual templates beyond their file list and the
  i18n key shapes, nor the package's `RehydrationFactory`, `DataClassRegistry` or field
  selectors, which belong to the framework section.
