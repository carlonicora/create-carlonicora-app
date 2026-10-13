---
title: Bootstrap and the module registry
section: 04-frontend
---

Nothing in the frontend can fetch, serialise or rehydrate a resource until the module
registry is populated. `apps/web/src/config/Bootstrapper.ts` is that registry's single
source of truth: one object literal naming every resource the app knows about, one
function that registers them, and one type derived from the object so no list is ever
written twice.

## The local module factory

The bootstrapper declares its own `moduleFactory`, matching the package's
`ModuleFactory` type. It does exactly two things:

1. **Mutates the model class.** `params.model.identifierFields = params.identifier ?? ["name"]`.
   This is a static assignment on the class, not on an instance, and it is why every
   model defaults to being identified by its `name` attribute.
2. **Returns a plain `ModuleWithPermissions`** carrying `pageUrl`, `name`, `model`,
   `feature`, `moduleId`, `cache`, `icon` and `inclusions` (defaulted to `{}`).

Every entry in `allModules` is a package-supplied module function applied to this
factory, so the app controls the shape of every registry entry even for modules whose
models live in the package.

## The `allModules` object

```ts
const allModules = {
  AiConnection: AiConnectionModule(moduleFactory),
  // …
  ...tokenUsageModules(moduleFactory),
  ...analyticsModules(moduleFactory),
} satisfies Record<string, ModuleWithPermissions>;
```

Fifty-four named entries plus two six-key spreads — **66 registry keys**, of which 65
come from `@carlonicora/nextjs-jsonapi` and exactly one, `Search`, is local. The file groups
them with comments:

| Group | Keys | Count |
|---|---|---|
| Foundation | `AiConnection`, `AssistantAction`, `Referral`, `ReferralStats`, `AuditLog`, `Auth`, `Company`, `Feature`, `Module`, `ModulePaths`, `Notification`, `PermissionMapping`, `RbacMatrix`, `Push`, `Role`, `S3`, `User`, `Author`, `Content` | 19 |
| Billing | `StripeCustomer`, `StripePaymentMethod`, `StripeSubscription`, `StripeProduct`, `StripePrice`, `StripeInvoice`, `Billing`, `StripeUsage`, `StripePromotionCode` | 9 |
| OAuth | `OAuth` | 1 |
| Waitlist | `Waitlist`, `WaitlistStats` | 2 |
| Two-factor | `TotpAuthenticator`, `TotpSetup`, `TotpVerify`, `TotpVerifyLogin`, `Passkey`, `PasskeyRegistrationOptions`, `PasskeyRegistrationVerify`, `PasskeyRename`, `PasskeyVerifyLogin`, `PasskeyAuthenticationOptions`, `TwoFactorEnable`, `TwoFactorChallenge`, `TwoFactorStatus`, `BackupCodeVerify` | 14 |
| Search | `Search` — the app's own | 1 |
| How-to | `HowTo` | 1 |
| Handbook | `HandbookPage`, `HandbookSection`, `HandbookThread`, `HandbookThreadMessage` | 4 |
| Assistant | `Assistant`, `AssistantMessage`, `Chunk` | 3 |
| Token usage | spread from `tokenUsageModules(moduleFactory)` | 6 |
| Analytics | spread from `analyticsModules(moduleFactory)` | 6 |

The Handbook and Analytics features are registered but not used: no route renders
them and nothing mounts `AnalyticsTracker`. They are registered because the
package's own code dereferences their `Modules.X` keys, and the generator's
`bootstrapper-modules` check requires every such key to be registered.

### Why the token-usage and analytics six are spreads

The comment in the bootstrapper is load-bearing, and the package's
token-usage module bundle explains the other half. Registration is the app's job —
`allModules` is both what `ModuleRegistry.register` walks and what
`DataClassRegistry.bootstrap` reads — so the package cannot self-register. But
`FoundationModuleDefinitions` in the package already declares all six keys, so a
forgotten name is **not a compile error**: `Modules.TokenUsageReportSummary` typechecks
and is `undefined` at runtime. Six named entries is six chances to forget one; one
spread cannot be partially done.

The factory returns the six keys with `satisfies Record<string, ModuleWithPermissions>`
rather than that type directly. If it returned the index-signature type, spreading it
into `allModules` would give the whole object a string index signature and every
`Modules.<anything>` lookup would typecheck.

## The type seam

```ts
export type AllModuleDefinitions = typeof allModules;
```

`apps/web/src/types/modules.d.ts` then declaration-merges that type into the package's
`AppModuleDefinitions`:

```ts
declare module "@carlonicora/nextjs-jsonapi/core" {
  interface AppModuleDefinitions extends Omit<AllModuleDefinitions, keyof FoundationModuleDefinitions> {}
}
```

The `Omit` matters: the foundation keys are already declared by the package, so the app
contributes only its own. The package's `ModuleDefinitions` is
`FoundationModuleDefinitions & AppModuleDefinitions`, which is what `Modules.X` resolves
against. Adding a key to `allModules` is therefore enough to make `Modules.<key>`
typecheck everywhere — there is no second list to maintain.

## `bootstrap()` and the dedup flag

```ts
let bootstrapped = false;

export function bootstrap(): void {
  if (bootstrapped) return;
  Object.entries(allModules).forEach(([name, module]) => ModuleRegistry.register(name, module));
  DataClassRegistry.bootstrap(allModules);
  bootstrapped = true;
}
```

The flag is a **module-level** `let`, and that is the point. The registry itself is not:
the package keeps the module map on `globalThis` under
`Symbol.for("nextjs-jsonapi:modules")`, and the bootstrapper reference under
`Symbol.for("nextjs-jsonapi:bootstrapper")`, precisely so both survive a hot reload
(the package's registry and bootstrap-store modules both say so).

The app's flag must have the **opposite** lifetime. It guards a specific evaluation of
`allModules` — a specific set of model class objects. A hot reload re-evaluates
the bootstrapper and rebuilds `allModules` with fresh class identities, while the
`globalThis` map still holds the previous ones. A module-scope flag is reset by exactly
the same re-evaluation, so registration runs again and the map is overwritten with the
current classes. A `globalThis` flag would outlive the objects it guards: it would still
read `true`, `bootstrap()` would return early, and the registry would keep serving the
previous evaluation's classes — so rehydration would produce instances of a class the
running code no longer references. Each JavaScript module graph (server, client, and the
proxy runtime) evaluates the bootstrapper separately and each needs its own registration
pass, which a shared flag would also suppress.

## `setBootstrapper` and self-healing

The last line of the file runs on import:

```ts
setBootstrapper(bootstrap);
```

`ModuleRegistry.get(name)` then has a recovery path: if a name is missing it calls
`tryBootstrap()` once and retries the lookup. `findByName` does the same when the
registry is empty. `configureJsonApi({ bootstrapper: bootstrap })` in
`apps/web/src/config/instrumentation-env.ts` registers the same function a second time through the
package's own config path.

Self-healing is a safety net, not a design. The error message distinguishes the two
failure modes: "Bootstrap was called but module still not found" (a genuine registration
gap) versus "No bootstrapper registered" (nothing ever imported the bootstrapper in this
module graph).

## Where bootstrap is triggered

| Entry point | Runtime | How |
|---|---|---|
| `apps/web/src/config/instrumentation-env.ts` | both | Calls `bootstrap()` at module scope, immediately after importing it |
| `apps/web/src/config/env.ts` | both | Imports `apps/web/src/config/instrumentation-env.ts`, then adds `configureI18n` |
| `apps/web/src/instrumentation.ts` | server | `register()` awaits `import("@/config/instrumentation-env")` before any route is handled — never `env.ts`, see below |
| `apps/web/src/instrumentation-client.ts` | browser | Imports `@/config/env` as the first client code to run |
| `apps/web/src/config/BootstrapProvider.tsx` | browser | Imports `@/config/env` for its side effects; mounted by the root layout |
| `apps/web/src/app/[locale]/layout.tsx` | server | Imports `@/config/env` at module scope |
| `apps/web/src/app/help/sitemap.xml/route.ts` | build | Imports `@/config/env` explicitly, and says why |

The sitemap route is the one that needs the explicit import. Next collects a route
handler's config during the production build **without** running
`apps/web/src/instrumentation.ts`, and its data module
`apps/web/src/app/[locale]/(public-help)/help/_data/publicHowTo.ts` dereferences
`Modules.HowTo` at module scope to build its `cache: "help"` module key. Without the import the build fails
with an unregistered-module error.

## The `Modules.X` module-scope crash

`Modules` is a proxy over a registry populated during app initialisation, which happens
**after** module evaluation. Reading `Modules.Something` at module scope in a file that
is evaluated before bootstrap throws. `apps/web/CLAUDE.md` lists it as a common mistake:
store the module *name* as a string and resolve it lazily inside `useMemo` or a
render-time function.

The two places the template does dereference at module scope both compensate: the
sitemap route imports `@/config/env` first, and the help data module is only ever reached
through routes that do.

## What the configuration files configure

The configuration side effect is split across two files, because instrumentation may not
load next-intl: next-intl reaches `apps/web/src/i18n/request.ts`, which reads
`next/root-params`, a module only allowed inside the app directory.

`apps/web/src/config/instrumentation-env.ts` is everything but i18n. In order it:

1. Calls `bootstrap()`.
2. Throws if `ENV.API_URL` or `ENV.APP_URL` is unset.
3. `configureJsonApi({ apiUrl, appUrl, trackablePages: [Modules.Notification, Modules.Company, Modules.User], bootstrapper: bootstrap, stripePublishableKey })`.
4. `configureAuth({ updateToken, removeToken })` — the two server actions in `apps/web/src/server-actions/auth-cookies.ts`.
5. `configureRoles(RoleId)` — the map from `packages/shared`.
6. `configureLogin({ discordClientId, googleClientId, useInternalAuth: true, registrationMode })` — provider buttons are auto-detected from the presence of a client id.

It also imports `./waitlist.config` for its side effect
(`apps/web/src/config/waitlist.config.ts` calls `configureWaitlist` with the hero copy
and the two questionnaire fields) and re-exports `ENV`, which it takes from
`apps/web/src/config/middleware-env.ts`.

`apps/web/src/config/env.ts` imports that file, re-exports its `ENV`, and makes the one
remaining call: `configureI18n({ useRouter, useTranslations, useLocale, useDateFnsLocale, Link, usePathname, getLocale })`.
Three of the seven come from `apps/web/src/i18n/navigation.ts`, `useTranslations` and
`useLocale` from next-intl, `getLocale` from `next-intl/server`, and `useDateFnsLocale`
from `apps/web/src/i18n/useDateFnsLocale.ts`. App code keeps importing `@/config/env`;
only `apps/web/src/instrumentation.ts` imports the narrower file.

## The library-free environment module

`apps/web/src/config/middleware-env.ts` exports the `ENV` object and **nothing else**. It
has no library imports at all, which is what makes it safe in `apps/web/src/proxy.ts`,
`apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts` — none of which should pay
for `bootstrap()` or pull the client library into an edge or build-time bundle.

| Key | Source |
|---|---|
| `API_URL` | `API_INTERNAL_URL` on the server, `NEXT_PUBLIC_API_URL` otherwise |
| `PUBLIC_API_URL` | `NEXT_PUBLIC_API_URL`, never the internal override — for URLs the browser follows |
| `APP_URL` | `NEXT_PUBLIC_ADDRESS`, trimmed, trailing slashes stripped, `""` when unset |
| `VAPID_PUBLIC_KEY` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `STRIPE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| `REGISTRATION_MODE` | `NEXT_PUBLIC_REGISTRATION_MODE`, defaulting to `"open"` |
| `DISCORD_CLIENT_ID` / `GOOGLE_CLIENT_ID` | the matching `NEXT_PUBLIC_*` variables |
| `IS_PRODUCTION` / `IS_DEVELOPMENT` | `NODE_ENV`, set by the Next build rather than by the environment file |

Every `NEXT_PUBLIC_*` value is inlined at build time. Changing one means rebuilding.

## Adding a feature module in three steps

1. **Write the quartet** under `apps/web/src/features/<domain>/<entity>/` — interface,
   model, service, and `<Entity>Module.ts`. The feature-anatomy page in this section
   annotates the one complete example the template ships.
2. **Import the module function in `apps/web/src/config/Bootstrapper.ts`** and add one
   key to `allModules`, following the local `Search` entry.
3. **Add the translations** the UI will read — at minimum `entities.<name>` if the
   module appears in navigation, since the sidebar skips any module for which
   `t.has("entities." + name)` is false.

There is no fourth step. `AllModuleDefinitions` is derived from the object, so the type
follows automatically.

`pnpm generate-web-module` does steps 2 and 3 for you: after writing the files it runs
`updateBootstrapper` and then `updateI18n` once per declared language, unless you pass
`--no-register`.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/config/Bootstrapper.ts` | The factory, `allModules`, `bootstrap()`, `setBootstrapper` |
| `apps/web/src/types/modules.d.ts` | The declaration merge that makes `Modules.X` typecheck |
| `apps/web/src/config/instrumentation-env.ts` | Every `configure*` call but i18n |
| `apps/web/src/config/env.ts` | `configureI18n`, and the import app code uses |
| `apps/web/src/config/middleware-env.ts` | The library-free environment object |
| `apps/web/src/config/BootstrapProvider.tsx` | The client-side trigger |
| `apps/web/src/instrumentation.ts` | The server-side trigger |
| `apps/web/src/instrumentation-client.ts` | The earliest browser trigger, plus the dev worker teardown |
| `apps/web/src/config/waitlist.config.ts` | The one configuration call made outside the two configuration files |
| `apps/web/src/features/essentials/search/SearchModule.ts` | The only local module entry |
| `apps/web/src/app/help/sitemap.xml/route.ts` | The route that must import `@/config/env` itself |

## Gaps and drift

- `apps/web/src/config/Bootstrapper.ts` carries no comment on the `bootstrapped` flag. The reasoning above is
  reconstructed from the package's `globalThis` stores and their stated purpose, not from
  a comment in the app.
- `apps/web/src/features/essentials/search/SearchModule.ts` declares
  `moduleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"`. That UUID appears nowhere else in
  the template — not in `packages/shared`'s `ModuleId`, not in
  `apps/api/src/rbac/permissions.ts`, not in any migration. Any permission check against
  `Modules.Search` therefore fails.
- `configureJsonApi` receives `bootstrapper: bootstrap`, and `setBootstrapper(bootstrap)`
  runs at the bottom of the bootstrapper. The two paths are redundant; neither is
  documented as the canonical one.
- I did not examine `DataClassRegistry.bootstrap`'s internals, the `cache` profile
  strings a module may carry, or `inclusions` resolution — those belong to the package's
  data-layer chapter.
