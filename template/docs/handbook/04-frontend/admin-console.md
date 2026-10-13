---
title: The administration console
section: 04-frontend
---

Everything under `/administration` is the platform console: cross-tenant surfaces for
someone operating the installation rather than using it. Fourteen routes, all of them
composition — the containers, providers and forms are in
`@carlonicora/nextjs-jsonapi`.

## The gate

The gate is per page. `apps/web/src/app/[locale]/(admin)/layout.tsx` reads nothing: it
validates the locale and renders the shared session shell (see the app shell page). Every
`page.tsx` under `(admin)` calls `requireAdministrator` from
`apps/web/src/features/common/components/session/requireAdministrator.ts` as its first
statement:

```ts
export async function requireAdministrator(locale: string): Promise<void> {
  if (!(await ServerSession.isLogged())) redirect(getPathname({ href: "/login", locale }));
  if (!(await ServerSession.hasRole(RoleId.Administrator))) notFound();
}
```

A visitor without a session never gets that far: `apps/web/src/proxy.ts` sends them to
`/login` first, and the guard's redirect is the fallback. An authenticated
non-administrator gets `notFound()`, which `apps/web/src/app/[locale]/(admin)/not-found.tsx`
renders as the `errors.404` copy inside the app frame. A page that forgets the call is
open to every signed-in user, so the generator's `admin-gate` integrity check fails the
template when any `(admin)` page does not `await requireAdministrator(`, or when the guard
stops checking `hasRole(RoleId.Administrator)`.

`apps/web/tests/smoke/app.smoke.spec.ts` calls the refusal the highest-value test in the
template and proves it against a real non-administrator session, on both the index and a
child route.

The layout renders `<Suspense fallback={<AppFrameSkeleton />}><AppShell>`, the same shell as
the main app, so the console shares the sidebar, the header and the notification plumbing.
That includes `TrialBlockingWrapper`, which `LayoutDetails` wraps around the content column;
it never blocks here, because `useSubscriptionStatus` exempts an administrator.

## The landing page

`AdminIndexContainer` is the console's index, rendered both at `/administration` and at
`/` for an administrator. It is a grid of section cards, each a `Link` with a
`data-testid` of `admin-index-<key>`.

Its platform group is fixed in the package and is the same for every application built on
it:

| Key | Label key | Destination |
|---|---|---|
| `companies` | `entities.companies` | `/administration/companies` |
| `users` | `entities.users` | `/administration/users` |
| `token-usage` | `token_usage.admin.title` | `/administration/token-usage` |
| `ai-connections` | `ai_connections.admin.title` | `/administration/ai-connections` |
| `rbac` | `entities.rbac` | `/administration/rbac` |
| `billing` | `billing.admin.products.title` | `/administration/products` |

`billing` is the only conditional entry: it appears when a Stripe publishable key is
configured. The check is `getStripePublishableKey()` from the package's `/client` entry
rather than `isStripeConfigured()` from `/billing`, because the latter lives in a module
that imports `@stripe/stripe-js` at module scope and `/billing` exists precisely to keep
that out of the global bundle.

The component takes `additionalGroups` for an application's own console sections and
`hiddenSections` for platform entries a given backend does not wire. The hrefs are
constants, not props: the path convention **is** the contract that makes the component
reusable.

`AdminIndexGrid` is the same grid without the page shell, exported so the package's own
specs can render it without pulling in the header and its four contexts.

## The administration context

`AdministrationProvider` supplies the page chrome for administration surfaces. It publishes
`{ breadcrumbs: [], title: { type: t("administration.title") } }` through `SharedProvider`.

It exists because `RoundPageContainerTitle` and the header breadcrumb both read
`useSharedContext()`, and that context is provided far up the tree. An administration page
that provides nothing of its own therefore inherits whatever the **previously rendered**
page left there — a company name, a "Notifications" title. Mounting the provider replaces
it.

Two routes mount it and two deliberately do not:

- `/administration/ai-connections` and `/administration/token-usage` mount it, because
  their containers read the title from `SharedContext`.
- `/administration/companies/[id]` does not: `CompanyProvider` already feeds the chrome,
  and on a company detail page the title must be the company.
- `/administration` does not need it either — `AdminIndexContainer` mounts it internally.

## The route table

| Route | Drives | Backed by |
|---|---|---|
| `/administration` | The console index | `administration` in the package |
| `/administration/companies` | Every tenant, with search and creation | `company` |
| `/administration/companies/[id]` | One tenant: profile, features, users, subscription | `company`, `feature`, `user` |
| `/administration/users` | Every user across **all** companies, with a company column | `user` |
| `/administration/rbac` | The permission matrix, edited by module | `rbac`, `module`, `role` |
| `/administration/rbac/roles` | The same matrix, pivoted by role | `rbac`, `module`, `role` |
| `/administration/token-usage` | LLM token consumption: summary, timeline, breakdown | `tokenusage` |
| `/administration/ai-connections` | Provider connections and the fallback chains | `ai-connection` |
| `/administration/products` | Stripe products | `stripe-product` |
| `/administration/products/[id]` | One product and its prices | `stripe-product`, `stripe-price` |
| `/administration/prices/[id]` | One price | `stripe-price` |
| `/administration/howtos` | The help articles the public reader serves | `how-to` |
| `/administration/howtos/[id]` | One article, edited in BlockNote | `how-to` |
| `/administration/waitlist` | Waitlist entries and their statistics | `waitlist` |

### Notes on individual routes

**Users.** `PlatformUsersContainer`, not the company-scoped `AllUsersListContainer`. The
route's comment explains: the company-scoped list resolves the current user's company, and
a platform administrator has none, so it would render an empty table.

**RBAC.** Both RBAC routes invert `RoleId` and `ModuleId` from `@{{name}}/shared` into
UUID-to-name maps and pass them to `RbacProvider` along with
`outputPath="apps/api/src/rbac/permissions.ts"`. The backend serialiser uses the maps to
emit `RoleId.X` / `ModuleId.X` references into that file rather than raw UUIDs — so the
matrix edited in the browser is written back as readable TypeScript.

**Token usage.** The route imports from the package's `/tokenusage` **client** subpath.
The package ships no server entry for the feature on purpose: `tsup` stamps `"use client"`
only on its declared client entries, and with code splitting a package-side server page
would put the provider and container into a directive-less shared chunk — Next would then
treat them as Server Components and every `createContext` in the transitive graph would
fail to compile. The same trap is documented on the AI connections route.

**Stripe detail routes.** `/administration/products/[id]` and `/administration/prices/[id]`
each wrap their fetch in a `try`/`catch` that returns `null` and call `notFound()` when it
does — so a missing record and a missing role (refused by `requireAdministrator`) look the
same from outside.

**Waitlist.** The only administration route that uses the plain `PageContainer` shell
rather than a container-owned one.

## The missing prices index

There is no `/administration/prices` route — only `/administration/prices/[id]`. Prices
are reached from their product's detail page, which is the only place the parent product
is known.

`apps/web/tests/smoke/admin.smoke.spec.ts` documents this explicitly: its route list
carries a comment saying no index route exists in the template and that it 404s by design,
so it is not smoked. Nine of the fourteen routes are covered by that file. The five that
are not are `/administration/rbac/roles` and the four detail routes —
`companies/[id]`, `howtos/[id]`, `products/[id]` and `prices/[id]`.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/app/[locale]/(admin)/layout.tsx` | The shell, with no check of its own |
| `apps/web/src/features/common/components/session/requireAdministrator.ts` | The gate every page awaits |
| `apps/web/src/app/[locale]/(admin)/not-found.tsx` | The in-frame 404 a refused member sees |
| `apps/web/src/app/[locale]/(admin)/administration/page.tsx` | The index, and why it must not be double-wrapped |
| `apps/web/src/app/[locale]/(admin)/administration/users/page.tsx` | Why the platform list, not the company list |
| `apps/web/src/app/[locale]/(admin)/administration/rbac/page.tsx` | The UUID-to-name maps and the output path |
| `apps/web/src/app/[locale]/(admin)/administration/token-usage/page.tsx` | The client-subpath rule, stated in full |
| `apps/web/src/app/[locale]/(admin)/administration/ai-connections/page.tsx` | The same rule, and why `AdministrationProvider` stays |
| `apps/web/src/app/[locale]/(admin)/administration/companies/[id]/page.tsx` | Why no `AdministrationProvider` |
| `apps/web/src/app/[locale]/(admin)/administration/prices/[id]/page.tsx` | The detail-only Stripe price route |
| `apps/web/tests/smoke/admin.smoke.spec.ts` | Which routes are smoked, and the note on the missing index |
| `apps/web/src/features/common/components/navigations/CommonSidebar.tsx` | The administration group that mirrors the index |

## Gaps and drift

- The sidebar's administration group and `AdminIndexContainer`'s platform group are
  maintained separately and already differ: the sidebar omits RBAC. Its comment claims the
  entries mirror the index in the same order.
- Nothing in the console links to `/administration/howtos` or `/administration/waitlist` —
  neither appears in the index grid nor in the sidebar. Both are reachable only by typing
  the URL.
- `/administration/rbac/roles` has no entry point either; the module-oriented RBAC page
  does not link to its role-oriented twin in any code this page examined.
- `apps/web/tests/smoke/app.smoke.spec.ts` still expects the old layout gate: it asserts
  the 403 "unauthorised" copy, and its comment credits the layout's `hasRole` check. A
  refused member now gets the in-frame 404, so that assertion no longer matches.
- A refused member sees the 404 under the page's own title, because `generateMetadata`
  runs without the gate.
- I did not examine the package containers themselves — `CompaniesListContainer`,
  `AdminCompanyContainer`, `RbacContainer`, `TokenUsageAdminContainer`,
  `AiConnectionsContainer`, `ProductsListContainer`, `HowToListContainer` or
  `WaitlistList` — nor the API endpoints behind them.
