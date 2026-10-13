---
title: Internationalisation and theming
section: 04-frontend
---

Translation is `next-intl`; theming is `next-themes` over CSS custom properties. Both are
configured by the app and consumed by the package through dependency injection — the
package ships no locale list and no theme provider of its own.

## Routing

`apps/web/src/i18n/routing.ts` is four lines of configuration and nothing else:

```ts
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
```

The navigation helpers live next to it, in `apps/web/src/i18n/navigation.ts`:

```ts
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

The split follows next-intl's own layout. `createNavigation` loads the request config,
which reads `next/root-params`, and that module is only allowed inside the app directory.
`apps/web/src/proxy.ts` imports `routing.ts`, so it must never reach `navigation.ts`.

**One locale, `en`.** `localePrefix: "as-needed"` means the default locale carries no
prefix — `/settings` and `/en/settings` both work, and `/settings` is what the app links
to. This matters when probing a route from the command line: a bare `curl` against a path
may redirect or 404 in ways a browser session does not.

The five navigation helpers are locale-aware wrappers over the Next.js originals. They are
what `apps/web/src/config/env.ts` hands the package through `configureI18n`, and what
app code should import from `@/i18n/navigation` rather than `next/link` or
`next/navigation` — except where a component genuinely needs the raw hook, as the
`usePathname` calls in `apps/web/src/features/common/components/navigations/CommonSidebar.tsx`
and the onboarding hooks do.

`apps/web/src/proxy.ts` runs `createMiddleware(routing)` on every matched request, and its
own `stripLocalePrefix` only strips segments that `hasLocale(routing.locales, …)`
accepts — so a two-letter route segment is never mistaken for a locale.

## Messages and the static-import rule

`apps/web/src/i18n/request.ts` loads messages through a **literal map of static imports**,
never a template-literal dynamic import:

```ts
import en from "../../messages/en.json";
const MESSAGES = { en } satisfies Record<(typeof routing.locales)[number], unknown>;
```

The file explains why at length. Next.js 16.2 replaced the dev server's "clear the whole
require cache" with Turbopack's fine-grained module-graph invalidation. A dynamic import
whose specifier is a template literal cannot be analysed statically, so after its first
resolution the JSON is no longer tracked for change detection: edits to the message files
are silently ignored until the dev server restarts. A static import is analysable, so the
file is watched and hot reload works.

`getRequestConfig` then resolves the locale, taking the first candidate that `hasLocale`
accepts: an explicit override (`getTranslations({ locale })`), the `[locale]` root param
read through `next/root-params`, the deprecated `requestLocale`, then
`routing.defaultLocale`. The root param throws in Server Actions and Route Handlers, so it
is read inside a try/catch and those callers fall through. This is why the root layout no
longer calls `setRequestLocale`; it declares `generateStaticParams` over
`routing.locales` instead, so every locale is prerendered.

**Adding a locale is three edits**, and the first two are not optional:

1. `apps/web/src/i18n/routing.ts` — add the code to `locales`.
2. `apps/web/src/i18n/request.ts` — add a static `import` and a key in `MESSAGES`. The
   `satisfies` constraint makes a missing key a compile error, which is the point.
3. `apps/web/messages/` — the message file itself.

Plus `apps/web/src/i18n/useDateFnsLocale.ts` if the new locale needs date formatting, and
a `dir` decision if it is right-to-left.

## What is in the message file

`apps/web/messages/en.json` holds **4,408 keys** in about 244 KB, across thirty top-level
namespaces:

| Namespace | Keys | Namespace | Keys |
|---|---|---|---|
| `features` | 3,387 | `waitlist` | 53 |
| `common` | 148 | `ai_connections` | 53 |
| `auth` | 120 | `howto` | 47 |
| `generic` | 105 | `rbac` | 18 |
| `billing` | 83 | `company` | 16 |
| `entities` | 80 | `subscription` | 11 |
| `ui` | 67 | `errors` | 10 |
| `token_usage` | 59 | `role` | 9 |
| `oauth` | 39 | `administration` | 9 |
| `help` | 30 | `pwa` | 8 |
| `user` | 27 | `tour` | 6 |
| `content` | 6 | `notification` | 4 |
| `offline` | 4 | `filters` | 3 |
| `referral` | 3 | `navigation` | 1 |
| `pages` | 1 | `feature-name` | 1 |

**A new app prunes `features`.** Those 3,387 keys — 77% of the file — sit under 85
sub-namespaces that describe entities the template does not ship, has no routes for, and
registers no modules for. Nothing in `apps/web/src` or in the package reads any of them.
Delete the whole `features` block and replace it with your own entity vocabulary as you
generate modules; `pnpm generate-web-module` writes into it.

The other twenty-nine namespaces are load-bearing. `entities`, `common`, `ui`, `errors`,
`auth`, `billing`, `administration`, `ai_connections`, `token_usage`, `help`, `oauth`,
`waitlist`, `rbac`, `tour`, `pwa` and `offline` are all read by shipped code — some of it
in the package, which cannot supply its own fallbacks.

## Adding a key

1. Add it to `apps/web/messages/en.json`, in the namespace whose surface it belongs to.
2. Read it with `useTranslations()` (no namespace, full dotted key) or
   `useTranslations("namespace")` plus the remainder — both forms appear across the app.
   On the server, `getTranslations()`.
3. Run `pnpm --filter {{name}}-web lint`. The validator below runs as part of it.

Two conventions the shipped code relies on: `t.has("entities." + module.name)` gates
sidebar entries, so a module without an `entities` key is invisible in navigation; and
`entities.*` values are pluralisable, called as `t("entities.users", { count: 2 })`.

## The translation validator

`apps/web/scripts/validate-translations.mjs` is wired into `apps/web/package.json` as
`validate-translations` and, crucially, as the second half of that package's `lint`
script — so a missing key fails `pnpm lint`.

**What it scans.** Two trees: `apps/web/src`, and the package's own `src` directory
(`packages/nextjs-jsonapi/src`). Scanning the package is what makes the `*_I18N_KEYS`
contracts below enforceable from the app side — a key the package reads and the app has
not defined is reported against the package file that reads it.

**How it resolves a namespace.** Purely by line position, with regexes and no parser:

1. Collect every `useTranslations("ns")`, every bare `useTranslations()` (namespace `""`)
   and every `getTranslations("ns")`, each with its line number.
2. Collect every `t("key")` call with its line number.
3. For each `t()` call, the active namespace is the **last** declaration at or above that
   line. Files with no declaration at all are treated as having one empty namespace.
4. The full key is `namespace + "." + key`, or just `key` when the namespace is empty.

A file with two `useTranslations` calls in different components therefore attributes keys
by position, not by scope — which is correct in practice because the declaration always
precedes its uses, but is not a scope analysis.

**What it skips.** Directories named `node_modules`, `.next`, `coverage`, `__tests__` and
`tests`; files ending `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` and `.d.ts`; and
any key containing `${` or `{`, because a dynamic key cannot be resolved statically.

**How it decides a key exists.** Exact match, or — for dynamic namespaces — any known key
that starts with the used key plus a dot. So `t("errors")` passes because `errors.404.title`
exists. That deliberate looseness is what lets patterns such as
`t("oauth.errors." + errorKey + ".title")` survive, at the cost of not catching a typo in
a leaf name reached dynamically.

It exits 1 with a per-file, per-line report of every missing key.

## The package's i18n contract

The package has no `next-intl` dependency of its own. `configureI18n` in
`apps/web/src/config/env.ts` injects seven things: `useRouter`, `useTranslations`,
`useLocale`, `useDateFnsLocale`, `Link`, `usePathname` and, since package 4.0, `getLocale`
from `next-intl/server`. The package reads the server locale for API requests through
that last one instead of importing next-intl: instrumentation loads the package, and
next-intl's `getLocale` reaches `apps/web/src/i18n/request.ts` and `next/root-params`,
which instrumentation may not. For the same reason `apps/web/src/instrumentation.ts`
imports `apps/web/src/config/instrumentation-env.ts`, never `env.ts`.

The accessors behave differently when nothing has been configured, and the split matters:

| Accessor | Unconfigured |
|---|---|
| `useI18nRouter()` | **Throws** — "i18n not configured. Call configureI18n() at app startup." |
| `getI18nLink()` | **Throws** with the same message |
| `useI18nTranslations()` | Falls back to an identity function: every key renders as itself |
| `useI18nLocale()` | Falls back to `"en"` |
| `useI18nDateFnsLocale()` | Falls back to `undefined`, and the calendar uses its default |
| `getI18nServerLocale()` | **Throws** — "Call configureI18n() with getLocale at app startup." |

So a missing `configureI18n` fails loudly on navigation and links, and silently on copy —
a screen full of raw dotted keys is the symptom.

### The `*_I18N_KEYS` manifests

Five package features export a frozen list of every key they read, as the explicit
contract with the consuming app:

| Export | Keys | Covers |
|---|---|---|
| `ADMINISTRATION_I18N_KEYS` | 8 | The administration index |
| `AI_CONNECTIONS_I18N_KEYS` | 54 | The AI connection administration surfaces |
| `BILLING_ADMIN_I18N_KEYS` | 83 | The Stripe product and price administration |
| `HELP_I18N_KEYS` | 28 | The public help reader |
| `TOKEN_USAGE_ADMIN_I18N_KEYS` and `TOKEN_USAGE_REPORT_I18N_KEYS` | 48 combined | The two token-usage dashboards |

Each file states the rule: the names are frozen, and an app that wants different wording
changes its translation, never the key. A package release that adds a key therefore
breaks `pnpm lint` in every consuming app until that app defines it — the manifest is the
changelog to read on a bump. The seven most recent additions are the price transfer
surface, which the prices list gained in package 3.12:

| Key | Reads as |
|---|---|
| `billing.admin.prices.fields.actions` | The header of the row-actions column |
| `billing.admin.prices.actions.clone` | The clone icon's accessible name |
| `billing.admin.prices.actions.export` | The export icon's accessible name |
| `billing.admin.prices.actions.import` | The import button next to Create New |
| `billing.admin.prices.import.errors.title` | Toast title when a chosen file will not parse |
| `billing.admin.prices.import.errors.invalid` | Toast body for the same failure |
| `billing.admin.prices.import.warnings.unknownFeatures` | Names a seeded platform feature this environment has no Feature row for. Takes a `{features}` parameter | Section labels are deliberately left out of
`ADMINISTRATION_I18N_KEYS` because they reuse keys every app already has —
`entities.companies`, `entities.users`, `entities.rbac`, `token_usage.admin.title` and
`billing.admin.products.title`.

## Theming

`next-themes` with the **class strategy**. The root layout mounts:

```tsx
<ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
```

`apps/web/src/app/globals.css` declares the matching variant,
`@custom-variant dark (&:is(.dark *))`, so every `dark:` utility keys off the `.dark`
class `next-themes` puts on `<html>`.

**The token contract.** An `@theme inline` block maps every Tailwind colour name onto a
CSS variable, and the variables are defined twice — once on `:root` for light, once on
`.dark`. The palette is **oklch** throughout, which is why the greys are written as
`oklch(0.145 0 0)` rather than hex: chroma 0 at varying lightness gives a perceptually
even scale, and the accent (`oklch(0.59 0.0775 253.92)`) keeps the same lightness in both
themes.

The tokens: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`,
`muted`, `accent`, `destructive` (each with a `-foreground` pair where it applies),
`border`, `input`, `ring`, `chart-1` through `chart-5`, eight `sidebar-*` tokens,
`warning` and `warning-foreground`, plus `--radius` and `--shadow-opacity`.

**The package ships no `ThemeProvider`.** It consumes one: `useTheme()` is called by
`ModeToggleSwitch`, the BlockNote editor and viewer, the token-usage timeline chart and
the sonner toaster. `BlockNoteViewer` carries a comment about `resolvedTheme` being
undefined outside a provider, which is the failure mode on a public page that forgets to
mount one. The app's root layout mounts it above every route group, including the public
help reader, so all of them are covered.

The theme switch in the UI is `ModeToggleSwitch`, rendered inside the user dropdown in
`apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx`.

## Direction

Direction is **app-owned**. The package never derives it from the locale — next-intl owns
locale resolution, and which locales are right-to-left is application policy. The package
exports a `DirectionProvider` wrapping Base UI's, and the contract is that the value fed
to it and the `dir` attribute on `<html>` are derived **once** and can never disagree: the
CSS logical properties in the package's components resolve against `<html dir>`, while
Base UI's popup placement resolves against the provider. Split them and popups open on the
wrong side of their triggers.

The template's root layout sets `lang` and mounts no `DirectionProvider`, which is
correct for a single left-to-right locale and is the first thing to change when a
right-to-left locale is added.

## Dates

Two layers.

`apps/web/src/i18n/useDateFnsLocale.ts` maps a locale code onto a `date-fns` locale and is
injected into the package through `configureI18n`. The package's calendar and date pickers
call `useI18nDateFnsLocale()` to get it.

The package's own helpers, exported from its root and `/core`:

- `formatLocalDate(date)` → `YYYY-MM-DD` from local components, for JSON:API attributes
  whose backend type is a calendar date. `JSON.stringify` on a `Date` calls
  `toISOString()`, which UTC-shifts and can lose a day west of UTC.
- `formatDate(date, option, locale = "en-GB")` with options `date`, `time`, `dateTime`,
  `timeSince` and `default` — the last picking `timeSince` inside 24 hours.

Note the default locale in `formatDate` is `en-GB`, not the app's active locale; callers
that care must pass one.

`apps/web/src/utils/dateFormatters.ts` adds `formatShortDate` and `formatLongDate`, both
hard-coded to `en-US`.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/i18n/routing.ts` | The locale list |
| `apps/web/src/i18n/navigation.ts` | The navigation helpers, and why they are kept apart |
| `apps/web/src/i18n/request.ts` | The static-import rule, and the locale resolution order |
| `apps/web/src/i18n/useDateFnsLocale.ts` | The date-fns locale injection |
| `apps/web/messages/en.json` | Every key, and the `features` block to prune |
| `apps/web/scripts/validate-translations.mjs` | What is scanned, skipped and how namespaces resolve |
| `apps/web/package.json` | `lint` running the validator |
| `apps/web/src/config/env.ts` | `configureI18n` and what it injects |
| `apps/web/src/app/[locale]/layout.tsx` | `NextIntlClientProvider` and `ThemeProvider` |
| `apps/web/src/app/globals.css` | The dark variant, the `@theme inline` block and the oklch palette |
| `apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx` | Where the theme toggle lives |

## Gaps and drift

- **`apps/web/global.d.ts` imports a message file that does not exist.** It does
  `import it from "./messages/it.json"` and derives `IntlMessages` from it, while
  `apps/web/messages` contains only the English file. Message-key type checking is therefore
  broken from the moment an app is scaffolded — though `apps/web/tsconfig.json` sets
  `strict: false` and `"typecheck": "eslint ."`, so nothing surfaces it.
- **`apps/web/src/i18n/useDateFnsLocale.ts` maps a locale that is not configured.** It
  registers `en` and `it`, importing `it` from `date-fns/locale`, while
  `apps/web/src/i18n/routing.ts` declares only `en`. The `it` branch is unreachable and
  the import is dead weight in the bundle.
- The `features` namespace — 3,387 of 4,408 keys — is read by nothing in the template.
- `apps/web/src/utils/metadata.ts` hard-codes `alternates.languages` to `{ en: "/en" }`;
  adding a locale means editing it too.
- `scripts/validate-translations.js` exists at the repo root and is shadowed by the
  `apps/web` copy, which is the one `lint` runs.
- `formatDate`'s default locale is `en-GB` while `apps/web/src/utils/dateFormatters.ts`
  uses `en-US`, so two date formats can appear on the same page.
- I did not examine the package's individual translated components, whether every key in
  the five `*_I18N_KEYS` manifests is present in `apps/web/messages/en.json`, or the
  right-to-left class audit the package's own lint step runs.
