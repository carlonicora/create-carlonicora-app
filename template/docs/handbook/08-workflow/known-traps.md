---
title: Known traps
section: 08-workflow
---

Failures this stack produces whose error message points somewhere other than the
cause. Every entry below is documented in the code that ships — usually as a
comment written by whoever paid for the lesson. **This is a seed page:** it
opens with the traps the template and both framework packages already carry, and
it is meant to grow. Add yours as you find them, in the shape the last section
describes.

## `pnpm build` clobbers a running dev server

`next build` and `next dev` share one output directory, the .next tree under
`apps/web`. A build run while a dev server is up overwrites the dev manifests
with production output, and the still-running server then answers 404 for every
route that exists on disk. Nothing in the 404 says a build caused it.

`scripts/dev.sh` is the mitigation, not a cure. It detects two states on start —
a stale lock file, meaning the previous run died uncleanly, and the presence of
required-server-files.json, which only `next build` writes — and clears that
tree before launching. The running server stays broken until you restart it. The
`.husky/pre-push` hook runs `pnpm build`, so this fires more often than you
would expect.

*Proof:* `scripts/dev.sh`, header comment.

## `Modules.X` at module scope crashes the build

`Modules` is a proxy over a registry that `bootstrap()` populates during
application init — after imports have been evaluated. Dereferencing
`Modules.HowTo` at module scope therefore reads an empty registry.

The production build makes this worse: Next.js collects a Route Handler's config
exports without running `apps/web/src/instrumentation.ts`, which is the only
other thing that calls `bootstrap()`. The build fails with
`Module "HowTo" not registered. No bootstrapper registered.` The fix is to
import `@/config/env` first, for its side effect, or to store the module name as
a string and resolve it lazily inside a `useMemo` or a render-time function.

*Proof:* the header comment in
`apps/web/src/app/help/sitemap.xml/route.ts`.

## The `"use client"` barrel split — server files import from `/core`

`packages/nextjs-jsonapi/tsup.config.ts` appends a `"use client"` banner to the
built `client`, `components`, `contexts`, `testing`, `billing` and feature
entries. The root entry and `core` get no banner.

A server file — a Route Handler, a Server Component, `apps/web/src/proxy.ts`,
`apps/web/src/config/Bootstrapper.ts` — that reaches for a registry, a factory
or a model base class through the root barrel drags a client boundary into
server code. Import those from `/core`; import components from `/components`.
`apps/web/src/config/Bootstrapper.ts` shows the correct form: fifty-odd module
factories, all from `@carlonicora/nextjs-jsonapi/core`.

*Proof:* the `clientEntries` list in `packages/nextjs-jsonapi/tsup.config.ts`.

## The bootstrap flag must stay module-level

`apps/web/src/config/Bootstrapper.ts` guards `bootstrap()` with a plain
module-scope `let bootstrapped = false`. Moving that flag onto `globalThis`
looks like an improvement and breaks server rendering.

Next.js evaluates several separate server module graphs. `ModuleRegistry` and
the bootstrap store are pinned to `globalThis` under `Symbol.for` keys, so they
are shared across graphs — but `DataClassRegistry` holds a plain
`private static _map`, which is per-graph. A `globalThis` flag lets the first
graph set it and short-circuit `bootstrap()` in every other graph, leaving that
graph's `DataClassRegistry` empty and server rendering throwing
`Class not registered for key: X`. A module-level flag lets each graph bootstrap
its own registry exactly once.

*Proof:* `packages/nextjs-jsonapi/src/core/registry/DataClassRegistry.ts`
(plain static map) against
`packages/nextjs-jsonapi/src/core/registry/ModuleRegistry.ts` and
`packages/nextjs-jsonapi/src/core/registry/bootstrapStore.ts` (both
`globalThis`-pinned).

## Base UI has no `asChild`

This project uses Base UI, not Radix. `asChild` does not exist; passing it does
nothing and the composition you expected silently does not happen. Compose with
the `render` prop instead, and never wrap a `<Button>` inside a trigger
component — nest the children directly.

*Proof:* `packages/nextjs-jsonapi/src/shadcnui/ui/button.tsx` builds on
`@base-ui/react/button`; the rule is stated in `CLAUDE.md` and again in
`apps/web/CLAUDE.md`.

## `cmdk`'s `CommandItem` needs a unique `value`

Without an explicit `value`, cmdk derives the item's value from its rendered
text. Two items with the same label then share one value, so they highlight
together and selecting one selects the other. Always pass the entity id:
`value={item.id}`.

*Proof:* `packages/nextjs-jsonapi/src/features/help/components/HelpSearchResultRow.tsx`
passes `value={result.id}` for exactly this reason.

## `dtoKey` renames the relationship on the wire

A relationship declared on an `EntityDescriptor` with `dtoKey` is serialised
under that key, not under its own name, and is read back from the request body
under that key too. Two relationships whose *effective* keys collide — one named
`x`, another with `dtoKey: "x"` — resolve to whichever the lookup finds, with no
warning at build or boot.

*Proof:* `packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts`
sets `relationship.name = relDef.dtoKey`;
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.service.ts`
resolves the incoming key with `(def.dtoKey || key) === dtoKey`.

## `modelRegistry` is keyed by `nodeName`

`ModelRegistry.register()` stores each model under `model.nodeName` in one flat
map, with secondary indexes on the lowercased label and the lowercased type. Two
models sharing a `nodeName` collide, and the last registration wins — silently.
The symptom is an `include:` that resolves to the wrong serialiser, or a 500
with no useful stack.

The serialiser already works around it by preferring `getByType()` and falling
back to `get(nodeName)`. Give every entity a distinct `nodeName`.

*Proof:* `packages/nestjs-neo4jsonapi/src/common/registries/registry.ts`, and
the comment above the lookup in
`packages/nestjs-neo4jsonapi/src/core/jsonapi/serialisers/descriptor.based.serialiser.ts`.

## A second descriptor of a label must declare `isProjection`

The relationship write check reads one tenancy rule per Neo4j label, filled by
`defineEntity()` at import time. A second descriptor over a label another
descriptor owns — a portal view, a count, a lookup — that declares different
tenancy stops the API at boot, and fails any spec that imports it, with
`entityTenancyRegistry: label "Order" is registered by "orders" and "portal-orders" with different tenancy.`
Before nestjs-neo4jsonapi 6.6.1 the same mistake raised nothing: the last
descriptor loaded won and the label's writes were checked for existence only.

Mark the descriptor that is not the owner `isProjection: true`, with a comment
naming the owner. Do not change the owner's tenancy to match the projection's;
that silences the error by loosening the check.
[The relationship write check](../01-architecture/multi-tenancy-and-security.md#the-relationship-write-check)
has the full rule.

*Proof:* the conflict check in `register()` and its header comment in
`packages/nestjs-neo4jsonapi/src/common/registries/entity-tenancy.registry.ts`.

## `{CURSOR}` runs a second COUNT query

When a query contains the `{CURSOR}` placeholder and `fetchAll` is not set,
`Neo4jService.readMany` builds a second query — everything before the
placeholder, with the `ORDER BY` stripped and
`RETURN count(DISTINCT <nodeName>) AS total` appended — and runs it in parallel
with the data query so that `meta.total` can be populated.

That count query has **no LIMIT**, so every `OPTIONAL MATCH` in the prefix runs
across all matching rows. A cheap paginated endpoint can become an expensive one
purely because its query happens to project a lot. The `computePaginationTotal`
config flag turns the count off for applications that never read `meta.total`.

*Proof:* `buildCountQuery` in
`packages/nestjs-neo4jsonapi/src/core/neo4j/services/neo4j.service.ts`.

## Worker and cron code must run inside `cls.run()`

The worker has no HTTP request, so the CLS store is empty. `userHasAccess()`
reads `isAutomatedJob` from CLS and, finding nothing, runs the validator against
a context that does not exist. Every processor and cron must wrap its work:

```ts
await this.cls.run(async () => {
  this.cls.set("isAutomatedJob", true);
  this.cls.set("userId", input.userId);
  this.cls.set("companyId", input.companyId);
  await this.repository.doTheWork(input);
});
```

*Proof:* `packages/nestjs-neo4jsonapi/src/foundations/user-activity/processors/user-activity.processor.ts`
is the canonical shape; `userHasAccess` is in
`packages/nestjs-neo4jsonapi/src/core/security/services/security.service.ts`.

## `@UseGuards` guards instantiate in the host module

A guard applied with `@UseGuards(SomeGuard)` is instantiated by the injector of
the module that declares the *controller*, not by the module that declares the
guard. A guard that constructor-injects a service from its own module therefore
crashes with an unresolved dependency the moment a different module uses it —
and only a real boot catches it, never a unit test with a mocked injector.

The fix is to resolve the cross-module dependency at call time with
`ModuleRef.get(Token, { strict: false })`.

*Proof:* `packages/nestjs-neo4jsonapi/src/common/guards/jwt.or.oauth.guard.ts`
resolves `JwtAuthGuard` exactly this way rather than injecting it.

## `NEXT_PUBLIC_*` is baked at build time

Next.js substitutes `NEXT_PUBLIC_*` textually during the build, so the values in
the browser bundle are whatever the environment file held when the image was
built. Changing one and restarting the container changes nothing.

`docker-compose.web.yml` passes them as build `args` and says so in its header:
after changing a `NEXT_PUBLIC_*` value you must rebuild with
`docker compose -f docker-compose.web.yml build --no-cache`. The same
substitution is why the frontend's environment reads must be literal
`process.env.NEXT_PUBLIC_X` expressions rather than computed lookups.

*Proof:* the header comment and the `args` block in `docker-compose.web.yml`;
the rationale in `packages/nextjs-jsonapi/src/core/env.ts`.

## `.pnpmfile.cjs` prevents a duplicate `@nestjs/core`

`supports-color` is an optional peer of `debug`, and it propagates into the peer
fingerprint of `@nestjs/common`, `bullmq`, `@nestjs/bullmq` and `@nestjs/core`.
The submodules' own devDependencies provide `supports-color` where the apps do
not, so the same packages materialise twice under different fingerprints. Two
`@nestjs/core` instances crash boot with
`UnknownDependenciesException ... ModuleRef ... BullModule` on any fresh
install — and a stale install directory can mask it entirely.

`.pnpmfile.cjs` strips that optional peer at the root so the fingerprint
variance disappears. Never remove the hook without re-checking that
the pnpm store holds exactly one copy of `@nestjs/core`.

*Proof:* `.pnpmfile.cjs`, header comment.

## `oxc: false` in the Vitest configs

Vitest 4 replaced esbuild with Oxc as its built-in TypeScript transformer. Oxc
does not implement `emitDecoratorMetadata`, and it runs after `unplugin-swc`,
overwriting SWC's `design:paramtypes` with an array of `undefined`s. Every
NestJS constructor injection resolved through `Reflect.getMetadata` then fails,
pointing at DI rather than at the transform. `unplugin-swc`'s own
`esbuild: false` is inert against this.

Any new Vitest config that must run decorated NestJS code needs `oxc: false` at
the top level.

*Proof:* the comment blocks in `apps/api/vitest.config.ts` and
`apps/api/vitest.e2e.config.ts`.

## Two Tailwind `@source` directives, not one

Tailwind v4 only emits classes it can see. The frontend package's components
live outside `apps/web`, so `apps/web/src/app/globals.css` declares two
`@source` globs: one relative glob into `packages/nextjs-jsonapi` for the
workspace submodule, and one into the installed `@carlonicora/nextjs-jsonapi`
package for the published npm build. Development resolves through the first,
production Docker builds through the second.

Delete either and package components render unstyled in that environment only —
which usually means it is found in production.

*Proof:* the two `@source` lines at the top of `apps/web/src/app/globals.css`.

## `--color-success` and the pointer cursor are the app's job

The frontend package documents two things it does **not** ship and the consuming
app must add to its global stylesheet:

- **`--color-success`.** The package styles success states with `text-success`,
  `bg-success/15` and `border-success/30`. Tailwind v4 resolves those from
  `--color-success`, which the package never defines; without it the classes
  compile to nothing and the text inherits the surrounding foreground — on a
  dark theme, invisible text on a light panel.
- **The pointer cursor.** Tailwind v4 dropped the v3 Preflight rule
  `button { cursor: pointer }`. The package's own primitives carry `cursor-*`
  classes, but raw `<button>` elements inside its feature components rely on a
  base-layer rule the app provides.

`apps/web/src/app/globals.css` in this template has **neither**. Both blocks are
printed in full in `packages/nextjs-jsonapi/CLAUDE.md`.

*Proof:* the two "Consumer requirement" sections of
`packages/nextjs-jsonapi/CLAUDE.md`, against `apps/web/src/app/globals.css`.

## A to-one relationship cannot be cleared with PATCH

Sending `{ "data": null }` for a to-one relationship does not remove the edge.
`AbstractService` maps a null to-one to `undefined`, and
`AbstractRepository.update` filters relationships with
`params[name] !== undefined` — so the relationship is simply skipped and the old
edge survives. A to-many with an empty array clears correctly, because the same
branch maps it to `[]`.

Model an optional, single-choice relationship as `many` and enforce "exactly
one" in the UI, or expose a dedicated endpoint for the removal.

*Proof:* the final `else` branch in
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.service.ts`, and
the `!== undefined` filter in
`packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts`.

## `tsup`'s `clean: false` is deliberate

`packages/nextjs-jsonapi/tsup.config.ts` sets `clean: false`, and the package's
`build` script starts with `rm -rf dist` instead. The dev launcher runs both the
package's `build` and its `dev` (`tsup --watch`) tasks; if both let tsup clean
the shared output directory, their file-removal passes race and one crashes with `ENOENT`
on unlink. With `clean: false` the watcher never wipes the directory, so the
apps — which wait only on `build` — always see a valid output tree.

Moving the clean back into tsup reintroduces the race.

*Proof:* the `clean` comment in `packages/nextjs-jsonapi/tsup.config.ts` and the
`build` script in `packages/nextjs-jsonapi/package.json`.

## Never kill a process by name

Several projects run on one machine and their command lines are identical, so
`pkill -f node`, `pkill -f "next dev"` and `killall node` destroy unrelated
work. `scripts/e2e.sh` states the rule in its teardown section and obeys it: it
kills only PIDs it captured (`killtree`), or PIDs listening on one of its own
ports.

The port idiom is:

```bash
lsof -ti tcp:"${port}" -sTCP:LISTEN | xargs kill -9
```

`-sTCP:LISTEN` is load-bearing. Without it, `lsof -i tcp:<port>` also matches
sockets whose *foreign* port is that number — a browser tab, a keep-alive curl —
and `free_ports` runs before the stack boots as well as on teardown.

*Proof:* the teardown block of `scripts/e2e.sh`.

## `EndpointCreator` does not URL-encode its parameters

`EndpointCreator.generate()` joins additional parameters as
`` `${param.key}=${param.value}` `` with no encoding whatsoever. A value
containing `&`, `#`, `+`, `=` or a space corrupts the query string, and a
user-typed value is exactly where that happens.

`apps/web/src/features/essentials/search/data/SearchService.ts` passes a raw
search term straight into `addAdditionalParam("term", params.term)` — the
shipped example carries the trap. Encode the value yourself before handing it
over.

*Proof:* `generate()` in
`packages/nextjs-jsonapi/src/core/endpoint/EndpointCreator.ts`.

## `translateResponse` swallows rehydration errors

The whole rehydration loop in `translateResponse` sits inside a `try` whose
`catch` does nothing but `console.error(e)`. A model whose `rehydrate()` throws
therefore produces a response with `ok: true`, the real HTTP status, and
`data: []`.

The symptom is an empty list where the network tab shows a full payload. There
is no error state to check and no exception to catch upstream — the only signal
is a browser console message. When a list is inexplicably empty, read the
console before reading the query.

*Proof:* the `catch` at the end of
`packages/nextjs-jsonapi/src/core/utils/translateResponse.ts`.

## `ServerSession.hasRole` and `hasFeature` match substrings

Both read a cookie and test it with `String.prototype.includes`:

```ts
if (!roles || !roles.includes(roleId)) return false;
```

The cookie is a serialised list, not a parsed one, so any role id that is a
substring of another id — or of any other text in that cookie — returns a false
positive. `hasPermissionToModule` checks the feature cookie the same way. Keep
role and feature identifiers full UUIDs, where accidental containment is
vanishingly unlikely, and never introduce short or prefixed ids.

*Proof:* `hasRole`, `hasFeature` and `hasPermissionToModule` in
`packages/nextjs-jsonapi/src/server/ServerSession.ts`.

## `hasPermissionToPath` returns true for an unmapped route

The client-side check resolves a path to a module by prefix-matching every
registered module's `pageUrl`, and then:

```ts
const selectedModule = matchUrlToModule({ path });
if (!selectedModule) return true;
```

A route with no module behind it is **allowed**, not denied. Adding a page
without registering its module in `apps/web/src/config/Bootstrapper.ts` gives it
an open client-side gate. The server-side guard still applies, so this is a UI
leak rather than a data leak — but the navigation will show links the user
cannot use.

*Proof:* `hasPermissionToPath` in
`packages/nextjs-jsonapi/src/features/user/contexts/CurrentUserContext.tsx`.

## `CREDIT_VALIDATOR` and `TOKEN_USAGE_RECORDER` fail open

Both are optional injection tokens the application binds, and both do nothing
useful when it does not.

`hasAvailableCreditsVia` returns `true` when no `CREDIT_VALIDATOR` is bound, so
an application that intends to enforce credits but forgets the binding runs
entirely ungated and silently. `isAiEnabledVia` fails open on every uncertain
case — unbound, unimplemented, or throwing. `TOKEN_USAGE_RECORDER` falls back to
the package's own module-local `TokenUsageService`, so an app that subclasses
the service without binding the token has its LLM usage written somewhere it
does not bill from.

The binding must come from a `@Global()` module: a library module can never
import an application feature module, so package-internal code can only see an
application-wide provider. **The template binds neither token.**

*Proof:* the two fail-open tables in
`packages/nestjs-neo4jsonapi/src/common/tokens.ts`, and
`packages/nestjs-neo4jsonapi/src/common/helpers/credit-gate.ts`.

## Adding a trap

A trap belongs here when the error message does not name the cause, and when
someone could reasonably hit it again. Use the same shape every entry above
uses:

1. **An H2 that states the trap, not the symptom.** "`{CURSOR}` runs a second
   COUNT query", not "slow list endpoints".
2. **Two to five sentences.** What happens, why, and what the symptom looks
   like — because the symptom is how the next person arrives here.
3. **What to do instead**, concretely enough to act on.
4. **A `*Proof:*` line naming the file**, and the symbol or comment inside it.
   No line numbers; they rot. If you cannot name a file, it is not a trap yet —
   it is a hypothesis.

If the trap is that shipped documentation disagrees with shipped code, it
belongs on the known-drift page instead.

## Where to look

| File | Trap it proves |
|---|---|
| `scripts/dev.sh` | The Next.js output-directory clobber and its automatic repair |
| `scripts/e2e.sh` | The ban on name-pattern kills, and the `lsof` idiom |
| `.pnpmfile.cjs` | The duplicate `@nestjs/core` and the peer strip |
| `apps/api/vitest.config.ts` | `oxc: false` and the decorator-metadata failure |
| `apps/web/src/app/globals.css` | The two Tailwind `@source` globs |
| `apps/web/src/config/Bootstrapper.ts` | The module-level bootstrap flag and the `/core` imports |
| `docker-compose.web.yml` | The build-time `NEXT_PUBLIC_*` bake |
| `packages/nextjs-jsonapi/CLAUDE.md` | The two consumer requirements the app must satisfy |
| `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | Both fail-open AI seams |
| `packages/nestjs-neo4jsonapi/src/common/registries/entity-tenancy.registry.ts` | The boot error for a second descriptor without `isProjection` |
| `packages/nextjs-jsonapi/src/core/utils/translateResponse.ts` | The swallowed rehydration error |

## Gaps and drift

- The bootstrap-flag trap is proved by the registries' implementations rather
  than by a comment in `apps/web/src/config/Bootstrapper.ts`; the file states
  the rule by example only. If you refactor that file, the reason is here and
  nowhere in the code.
- `apps/web/src/app/globals.css` does not carry either consumer requirement the
  frontend package documents. That is a defect in the template, recorded on the
  known-drift page as well as here.
- The `cmdk` entry is proved by a package component that does the right thing,
  not by a comment explaining why. It is cmdk's documented behaviour rather than
  anything this stack introduces.
- Not examined: traps in the Stripe foundations, the LLM provider adapters, the
  socket layer, or the Docker build beyond the `NEXT_PUBLIC_*` bake. Those
  subsystems are documented elsewhere in the handbook; nothing here claims their
  trap list is complete.
