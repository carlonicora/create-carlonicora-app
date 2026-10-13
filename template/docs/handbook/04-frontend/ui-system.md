---
title: The UI system
section: 04-frontend
---

Almost none of the user interface lives in `apps/web`. The primitives, the page shells,
the tables, the editors, the selectors and the error surfaces are all exported by
`@carlonicora/nextjs-jsonapi`; the app supplies a stylesheet, a handful of containers, and
a sidebar. Before writing a component, search the package — the working discipline in
`CLAUDE.md` says so, and it is right more often than not.

## Page shells

| Component | Entry point | What it owns |
|---|---|---|
| `PageContainer` | `/components` | The app `Header` (fed by four header contexts) and a `<main>` with standard padding |
| `RoundPageContainer` | `/components` | The full page frame: header, title strip, breadcrumb, optional tabs, an optional details rail, and a mobile navigation bar |
| `RoundPageContainerTitle` | `/components` | The title strip `RoundPageContainer` renders. Reads `useSharedContext()` |
| `TabsContainer` | `/components` | A standalone tab set, permission-aware through each `Tab`'s `key`/`modules` |
| `EntityHero`, `EntityHeroLayout`, `EntityHeroAvatar`, `EntityHeroMetaRow`, `EntitySection` | `/components` | The hero band on a detail page |

`RoundPageContainer` takes `module`, `id`, `details`, `tabs`, `children`, `fullWidth`,
`forceHeader`, `header` and `layout` (`"tabs"` or `"rail"`). A `Tab` carries `label`,
`content`, an optional `key` module and `modules` list for gating, a `group` for the rail
layout, a `sectionKey` for the URL's `?section=` value, and `fillHeight`.

**A container that brings its own shell must not be wrapped in another.** Two shipped
routes carry a comment saying so, because the mistake renders two header bars:
`/administration` and `/users/[id]`. `/administration/products` and
`/administration/companies` say only that their container owns the page shell.

The app's own containers live under `apps/web/src/features/common/components/`:

| Component | Role |
|---|---|
| `containers/IndexContainer` | The signed-in home page. A `RoundPageContainer` with a heading and nothing else — the surface an app replaces first |
| `containers/SettingsContainer` | The settings rail: five sections, each with its own visibility gate, plus the section-actions registry |
| `containers/UserProfileContainer` | The profile section, composing the package's `UserContent` and `UserEditor` |
| `containers/OAuthClientListContainer` | The OAuth client list, mounted both at `/settings/oauth` and as the settings rail's developer section |
| `details/LayoutDetails` | The authenticated frame: sidebar, header left content, trial banner, the trial overlay around the content column, `useNotificationSync`, `usePageTracker` |
| `banners/TrialExpiringBanner` | Grace-period warning, driven by `useSubscriptionStatus` |
| `wrappers/TrialBlockingWrapper` | Covers the content column with a `PageSkeleton` overlay while the subscription status loads or blocks, and redirects a blocked subscription away from the app |
| `navigations/QuickCreateMenu` | The header's create menu |
| `navigations/VersionDisplay` | Reads the **root** `package.json` version — the one semantic-release bumps |

## Lists and tables

`ContentListTable` is the one list component. It takes a `DataListRetriever`, a
`tableGeneratorType` (a module), a `fields` array, and optional search, filters, grouping,
expansion and selection.

It does **not** take a column definition. Columns come from a registry:

```ts
registerTableGenerator("users", useUserTableStructure);
// …
const { data, columns } = useTableGenerator(props.tableGeneratorType, params);
```

`useTableGenerator` looks the hook up by `module.name`. **A module with no registered
generator cannot be rendered in a table** — registering one is an obligation, not an
option, and `pnpm generate-web-module` emits `hooks/use<Entity>TableStructure.tsx` for
exactly this reason.

Five generators are registered as a side effect of importing the package's `/client`
barrel — `roles`, `users`, `companies`, `stripe-products` and `stripe-prices`. The
how-to generator registers itself at the bottom of its own hook file instead. Content has
no package-level registration on purpose: its cell rendering is app-specific.

Six cell renderers are exported from `/components`: `cell.component`, `cell.date`,
`cell.dateTime`, `cell.id`, `cell.link` and `cell.url`. `ContentListGrid` is the card
equivalent of the table, and `ContentTableSearch` is the search control the table mounts.

### Pagination

`useDataListRetriever` is the client-side pagination hook. It wraps a retriever function
and returns `{ data, total, meta, next, previous, search, refresh, addAdditionalParameter,
removeAdditionalParameter, setRefreshedElement, removeElement, isSearch, pageInfo }`.

Paging is driven entirely by the JSON:API `links` the API returns: the hook keeps the
`next` and `previous` URLs and parses `page[offset]` and `page[size]` out of them to
compute `pageInfo`. It never constructs a page URL itself. It also carries an
`AbortController` and a request-id ref so a fast typist's earlier search cannot overwrite
a later result.

## Editors

`EditorSheet` is the editor shell: a Base UI `Sheet` opening on the inline end, wrapping a
react-hook-form `Form`, with `CommonEditorHeader`, `CommonEditorButtons` and
`CommonEditorDiscardDialog`. Schemas are zod, resolved through
`@hookform/resolvers/zod`. Sizes run `sm` through `2xl`, and each is declared for both
physical sides because the sheet's side is resolved from the writing direction.

`useEditorDialog(isFormDirty, options)` is the discard guard. Closing a sheet with a dirty
form opens a confirmation instead of discarding. Two details in it are load-bearing:

- **An Escape stack.** Every open editor attaches its own `keydown` listener to
  `document`, and listeners on the same node all run regardless of `stopPropagation`. The
  module-level `openEditorStack` array records open dialogs in order so Escape closes only
  the topmost — without it, one Escape closes a nested create dialog *and* the editor that
  opened it.
- **A `syncingFromProp` ref.** The prop-to-state and state-to-prop effects would otherwise
  form an unguarded two-way binding and exceed the update depth on mount.

The form field set: `FormInput`, `FormTextarea`, `FormSelect`, `FormCheckbox`,
`FormSwitch`, `FormSlider`, `FormDate`, `FormDateTime`, `FormPassword`, `FormBlockNote`,
`FormLayout`, `FormFieldWrapper`, `CurrencyInput`, `PasswordInput`,
`FormPlaceAutocomplete`, `GdprConsentCheckbox`. Plus `CommonDeleter` and
`CommonAssociationForm` for the two operations every entity needs.

## Rich text

Rich text is **BlockNote**. Three components:

| Component | Use |
|---|---|
| `BlockNoteEditorContainer` | The editable surface |
| `FormBlockNote` | The editor bound to a react-hook-form field |
| `BlockNoteViewerContainer` | Read-only rendering — used by `/help/[mode]/[slug]` |

Supporting pieces cover mentions (`BlockNoteEditorMentionInlineContent`,
`BlockNoteEditorMentionHoverCard`), the suggestion menu, the formatting toolbar and a
diff inline content type. `apps/web/src/app/globals.css` carries a block of `.BlockNoteView`
overrides — heading sizes, editor padding, suggestion-menu styling and scrollbars — which
is where BlockNote's own CSS is reconciled with the design tokens.

A BlockNote field holds stringified JSON. The module generator excludes such fields from
table columns for that reason.

## Selectors — check this list before building one

The package already exports all of these. "I'll build a quick selector" is almost always
wrong.

| Component | Entry point | Selects |
|---|---|---|
| `EntitySelector` | `/components` | One record of any module, with search, debounce, an optional inline create, and optional auto-select-when-single |
| `EntityMultiSelector` | `/components` | Several records of any module |
| `UserSelector` | `/components` | One user |
| `UserMultiSelect` | `/components` | Several users |
| `HowToSelector` | `/components` | One how-to article |
| `HowToMultiSelector` | `/components` | Several how-to articles |
| `FormSelect` | `/components` | A fixed option list, bound to a form field |
| `Select`, `Combobox` | `/components` | The Base UI primitives underneath |
| `DatePickerPopover` | `/components` | A single date |
| `DateRangeSelector` | `/components` | A date range |
| `OAuthScopeSelector` | `/components` | OAuth scopes |
| `RbacPermissionPicker` | `/components` | One permission value in the RBAC matrix |
| `FormFeatures` | `/components` | Company features |
| `WizardStepPlanSelection` | `/billing` | A subscription plan |

`EntitySelector` is the generic one and covers most cases: give it a `module`, a
`retriever`, and optionally `getLabel`, `renderOption`, `filterData`, `onCreateNew` and
`toFormValue`. The module generator emits a per-entity `<Entity>Selector` and
`<Entity>MultiSelector` that are thin wrappers over it.

## Files

`FileUploader` (react-dropzone based, with `FileInput`, `FileUploaderContent`,
`FileUploaderItem` and a `useFileUpload` hook) and `MultiFileUploader` (a tile grid over
`FileUploader`, single-file by default, `multiple` opt-in, 100 MB cap).

Uploads never stream through the API. `S3Service` brokers a presigned URL:

1. `S3Service.getPreSignedUrl({ key, contentType, isPublic? })` → a URL the browser PUTs
   the bytes to directly.
2. `S3Service.getSignedUrl({ key, isPublic? })` → a time-limited read URL.
3. `S3Service.deleteFile({ key })`.

The upload itself is a direct request to object storage, so the hostname must appear in
`IMAGE_SOURCES`. `createNextConfig`, the package's helper that `apps/web/next.config.js`
calls, turns that list into the `next/image` remote patterns and splices it into both the
`img-src` and `connect-src` directives of the CSP it builds.

## Errors

`ErrorDetails({ code, title, message })` renders the error card: the logo, the status
code, a title and a message. It special-cases 403 with its own fixed English copy. It is
what both error boundaries and `apps/web/src/features/common/contexts/ErrorContext.tsx`
render. A non-administrator on an administration page no longer sees it: the per-page
guard calls `notFound()`, and `apps/web/src/app/[locale]/(admin)/not-found.tsx` renders
the 404 copy in plain markup.

`errorToast({ title?, error })` is the transient form — a sonner toast whose description
is `error.message` for an `Error` and `String(error)` otherwise.

`apps/web/src/features/common/contexts/ErrorContext.tsx` is a local context exposing
`showError(status, message)` and `clearError()` for components that need to raise an error
surface imperatively.

## Dates

Two helpers, exported from the package's root and `/core`:

- `formatLocalDate(date)` → `YYYY-MM-DD` from the **local** components. Use it for every
  JSON:API attribute whose backend type is a calendar date. `JSON.stringify` on a `Date`
  calls `toISOString()`, which UTC-shifts and can lose a day west of UTC.
- `formatDate(date, option, locale = "en-GB")` → `"date" | "time" | "dateTime" |
  "timeSince" | "default"`. `default` picks `timeSince` inside 24 hours and `dateTime`
  beyond it.

For datetime attributes — instants rather than calendar dates — `toISOString()` is
correct and the UTC shift is intended.

`apps/web/src/utils/dateFormatters.ts` adds two app-local helpers, `formatShortDate` and
`formatLongDate`, both hard-coded to `en-US`.

## Typography

Three components carry the roles, and they are the whole system:

| Component | Renders | Class |
|---|---|---|
| `SectionHeader` | `h2` at `level={2}`, `h3` otherwise | `text-xl font-semibold` / `text-lg font-semibold` |
| `MicroLabel` | `h4` by default, or `h3`/`span` via `as` | `text-muted-foreground text-xs font-semibold tracking-wider uppercase` |
| `DetailField` | A label/value pair, stacked or `horizontal` | `text-xs` label, `text-sm` value |

The root sets `font-size: 14px` on `:root` in `apps/web/src/app/globals.css`, so every
Tailwind size step is scaled from 14px rather than 16px.

## Navigation

`apps/web/src/features/common/components/navigations/CommonSidebar.tsx` builds a
`Map<string, { items, hasTitle }>` of navigation groups and renders it. Groups, in order:

| Key | Contents |
|---|---|
| `"/"` | Home, plus a `RecentPagesNavigator` entry once the user has a company and recent pages |
| `favourites` | Modules named in `currentUser.sidebarFavourites`, alphabetised, skipping any the user cannot read or has no `entities.<name>` translation for |
| `features` | One entry per `getFeatureSidebarItems()` feature the company holds, with its permitted modules as a hover-card submenu |
| `administration` | Companies, users, token usage, AI connections, and — only when Stripe is configured — products. Gated on `hasRole(RoleId.Administrator)` |

`apps/web/src/features/common/components/navigations/sidebar.items.tsx` is **the
registration point for an app's own entries**. It exports `NavigationItem`,
`FeatureSidebarItem`, an empty `getFeatureSidebarItems()`, a `sidebarItems()` builder, and
an `addSidebarItems` hook that is deliberately a no-op. Its comment states the rule: do
not push administration links here, because `CommonSidebar` already owns that group and a
duplicate `testId` breaks strict-mode locators.

The footer is `apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx`: the how-to command palette, the onboarding trigger,
the notification bell (`NotificationModal`, hidden from administrators), a settings link,
and the user dropdown with `VersionDisplay`, the theme toggle and logout.

## Base UI, not Radix

The primitives under the package's `shadcnui` tree are built on `@base-ui/react`. The
differences that break code written for Radix:

- **There is no `asChild`.** Composition uses a `render` prop instead:
  `<Button render={<Link href="/x" />} nativeButton={false}>`.
- **`nativeButton` must match the element that actually reaches the DOM.** Base UI logs an
  error in both directions. `EditorSheet` derives the flag from the trigger element rather
  than hard-coding it, because the package has two live conventions: a `<Button>` renders a
  native `<button>`, while `<Button render={<div/>} nativeButton={false}>` renders a `div`.
- **Never wrap a `<Button>` inside a trigger component.** Put the trigger's own props on
  the button, or use `render`.
- **`CommandItem` needs an explicit unique `value`.** cmdk otherwise derives the value
  from the item's text, so two identically named items highlight and select together.
- **Base UI menus and popovers portal out of their container.** Inside a canvas or any
  component that intercepts pointer events, they open empty or not at all; move the
  control out, or use plain elements.

## Styling

Tailwind v4, CSS-first. There is **no `tailwind.config`** anywhere in `apps/web`;
`apps/web/postcss.config.mjs` loads `@tailwindcss/postcss` and everything else is declared
in `apps/web/src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

@source "../../../../packages/nextjs-jsonapi/src/**/*.{ts,tsx}";
@source "../../node_modules/@carlonicora/nextjs-jsonapi/src/**/*.{ts,tsx}";
```

**Two `@source` directives, both required.** Tailwind only emits classes it can see in
source, and almost every class in this app is written inside the package. The first path
resolves when the package is a workspace submodule; the second when it is installed from
npm. Only one will exist in a given checkout, and a missing one means the package's
components render unstyled.

`@custom-variant dark (&:is(.dark *))` defines the dark variant, matching
`next-themes`' class strategy — the root layout mounts `ThemeProvider` with
`attribute="class"`, `defaultTheme="light"` and `enableSystem`.

The token block is `@theme inline`, mapping every Tailwind colour name onto a CSS
variable, with the variables themselves defined twice: once on `:root` and once on
`.dark`. The palette is **oklch** throughout. Tokens: `background`, `foreground`, `card`,
`popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`,
`ring`, `chart-1` … `chart-5`, the eight `sidebar-*` tokens, `warning`, plus `--radius`
(0.6rem) and `--shadow-opacity`.

### Two consumer requirements the package states

`packages/nextjs-jsonapi/CLAUDE.md` documents two things the consuming app must supply,
because the package cannot:

1. **A `success` colour token.** The package styles success states with `text-success`,
   `bg-success/15` and `border-success/30`. Tailwind v4 resolves those from
   `--color-success`, which the package does not define. Without it the classes compile to
   nothing and the text silently inherits the surrounding foreground.
2. **A pointer-cursor base rule.** Tailwind v4 dropped Preflight's
   `button { cursor: pointer }`. The package's own primitives carry `cursor-*` classes
   where Base UI renders a non-button element, and `buttonVariants` carries
   `cursor-pointer`, but raw `<button>` elements inside its feature components rely on the
   app's stylesheet.

The package's own file carries the exact CSS for both.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/app/globals.css` | The two `@source` lines, the token block, the BlockNote overrides, the PWA safe-area rules |
| `apps/web/postcss.config.mjs` | The whole Tailwind build configuration |
| `apps/web/src/features/common/components/navigations/sidebar.items.tsx` | Where an app registers navigation |
| `apps/web/src/features/common/components/navigations/CommonSidebar.tsx` | The group order and every gate the rail applies |
| `apps/web/src/features/common/components/details/LayoutDetails.tsx` | The authenticated frame |
| `apps/web/src/features/common/components/containers/SettingsContainer.tsx` | The rail pattern and the section-actions registry |
| `apps/web/src/features/common/components/containers/IndexContainer.tsx` | The home surface to replace first |
| `apps/web/src/utils/cn.ts` | The class merger — `clsx` then `tailwind-merge` |
| `apps/web/src/utils/dateFormatters.ts` | The two app-local date helpers |
| `packages/nextjs-jsonapi/CLAUDE.md` | The consumer requirements and the common-mistakes table |

## Gaps and drift

- **`apps/web/src/app/globals.css` satisfies neither consumer requirement.** There is no
  `--color-success` or `--success` token and no `cursor: pointer` base rule anywhere in
  the file. Success-styled copy compiles to nothing, and raw buttons in the package's
  feature components show a default cursor.
- **`apps/web/components.json` aliases directories that do not exist.** It points
  `components` at `@/components`, `ui` at `@/components/ui`, `utils` at `@/lib/utils`,
  `lib` at `@/lib` and `hooks` at `@/hooks`. Only `apps/web/src/hooks` exists; the app has
  no components or lib directory under `src`. Running `npx shadcn add` would create those
  directories and install a **second, parallel set of primitives** alongside the
  package's, with a second `cn` and a second `Button`. Do not run it; add components to
  the package instead.
- `apps/web/src/app/globals.css` contains a commented-out duplicate of its own
  `@layer base` block, and the `@theme inline` block maps `--font-sans` and `--font-mono`
  to `--font-geist-sans` / `--font-geist-mono`, which nothing defines — the root layout
  loads Inter and sets `--font-sans` on the body instead.
- `tw-animate-css` is declared in both `dependencies` and `devDependencies` of
  `apps/web/package.json`, and `tailwindcss-animate` is declared alongside it though the
  stylesheet imports only `tw-animate-css`.
- The package ships `packages/nextjs-jsonapi/src/components/tables/cells/cell.text.tsx`
  but its barrel does not export it and nothing imports it; the file is dead.
- `apps/web/vitest.setup.ts` mocks pointer-capture methods "for Radix UI compatibility",
  and `apps/web/src/features/onboarding/config/tours.config.ts` mentions Radix. Both are
  leftovers; the codebase is Base UI.
- The package's `EditorSheet` and `RoundPageContainer` are large enough that this page
  describes their contract, not their implementation. I did not examine the chart, drawer,
  resizable, carousel or input-otp primitives, the `fiscal` components, or
  `useCustomD3Graph`.
