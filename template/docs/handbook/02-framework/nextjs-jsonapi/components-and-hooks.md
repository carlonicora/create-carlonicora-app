---
title: nextjs-jsonapi components and hooks
section: 02-framework
---

`@carlonicora/nextjs-jsonapi` ships the whole UI layer the app renders: layout
containers, a form system built on react-hook-form, a table system driven by a
registry, a BlockNote rich-text editor, a set of typography roles and about fifty
UI primitives. Everything here is reachable from `@carlonicora/nextjs-jsonapi/components`
(providers from `…/contexts`, hooks from `…/client`), and every one of those
entry points carries a `"use client"` banner. Written against version 4.0.4.

Before writing any component in the app, look here first. The package already has
a selector, a multi-selector, an editor sheet, a deleter, a list, a table and a
grid; a hand-rolled variant is drift.

## Containers and page shells

| Export | Source | Role |
|---|---|---|
| `PageContainer` | `packages/nextjs-jsonapi/src/components/containers/PageContainer.tsx` | the app-frame shell: renders `Header` from the four header contexts, then `<main>` |
| `RoundPageContainer`, `RoundPageContainerTitle` | `packages/nextjs-jsonapi/src/components/containers/` | the rounded card surface used for detail pages |
| `TabsContainer`, `partitionTabs` | same | tab shell plus the helper that splits tabs into visible and overflow groups |
| `ReactMarkdownContainer` | same | markdown rendering with `remark-gfm`, `rehype-slug` and autolinked headings |
| `PageContainerContentDetails`, `PageContentContainer` | `packages/nextjs-jsonapi/src/components/pages/` | the detail-page body layouts |
| `Breadcrumb`, `ContentTitle`, `Header`, `MobileNavigationBar`, `ModeToggleSwitch`, `PageSection`, `RecentPagesNavigator` | `packages/nextjs-jsonapi/src/components/navigations/` | chrome |
| `AttributeElement` | `packages/nextjs-jsonapi/src/components/contents/` | one labelled attribute |
| `AllowedUsersDetails` | `packages/nextjs-jsonapi/src/components/details/` | the ACL summary block |
| `ErrorDetails`, `errorToast` | `packages/nextjs-jsonapi/src/components/errors/` | error surfaces |
| `EntityAvatar`, `EditableAvatar`, `TableCellAvatar`, `getInitials` | `packages/nextjs-jsonapi/src/components/` | avatars |

## The form system

Every export of `packages/nextjs-jsonapi/src/components/forms/`:

| Export | Kind | What it is |
|---|---|---|
| `FormFieldWrapper` | shell | the one wrapper every field goes through |
| `FormInput`, `FormTextarea`, `FormPassword`, `PasswordInput` | field | text entry |
| `FormSelect`, `FormCheckbox`, `FormSwitch`, `FormSlider` | field | choice and toggles |
| `FormDate`, `FormDateTime`, `DatePickerPopover`, `DateRangeSelector` | field | dates |
| `CurrencyInput` | field | money |
| `FormPlaceAutocomplete` | field | Google Places autocomplete, gated on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| `FormBlockNote` | field | the rich-text field — wraps the BlockNote editor |
| `GdprConsentCheckbox` | field | consent, with its own copy |
| `FormLayout` | layout | the grid a form body sits in |
| `EditorSheet` | shell | the create/edit sheet |
| `useEditorDialog` | hook | the open/close and dirty-guard state machine behind `EditorSheet` |
| `CommonEditorHeader`, `CommonEditorButtons`, `CommonEditorTrigger`, `CommonEditorDiscardDialog` | shell parts | the pieces `EditorSheet` assembles |
| `CommonAssociationForm` | shell | the relationship-editing form |
| `CommonDeleter` | shell | the confirm-and-delete flow |
| `EntitySelector` (default export) | selector | single-entity picker |
| `EntityMultiSelector` | selector | multi-entity picker |
| `FileUploader`, `FileUploaderContent`, `FileUploaderItem`, `FileInput`, `useFileUpload`, type `DropzoneOptions` | uploader | the dropzone primitive set |
| `MultiFileUploader` (default export) | uploader | the assembled multi-file control |
| `FormFeatures` | field | re-exported from the feature foundation's form |

### FormFieldWrapper

`FormFieldWrapper` is the shell. It takes `form`, `name`, and a `children`
**render function** receiving `(field, fieldState)` from react-hook-form's
`Controller`, and wraps the result in the `Field` primitive with, in order: the
`FieldLabel` (plus a `*` when `isRequired`), the rendered control, a
`FieldDescription`, and a `FieldError` carrying `fieldState.error.message`. It
also sets `data-invalid` and an optional `data-testid`. `orientation` accepts
`"vertical"` (default), `"horizontal"` or `"responsive"`.

Every `Form*` component in the table above is a thin call to `FormFieldWrapper`
with a specific control inside. A new field type is a new wrapper call, never a
new label-and-error layout.

### EditorSheet and the dirty guard

`EditorSheet<T extends FieldValues>` takes the form (`form`, `onSubmit`,
`onReset`, `isFormDirty`), the entity identity (`entityType`, `entityName`,
`title`, `description`, `isEdit`, `module`), the lifecycle callbacks
(`propagateChanges`, `onSuccess`, `onRevalidate`, `onNavigate`, `onSaved`), the
presentation (`size`, `disabled`, `hideSubmit`, `centerButtons`, `renderFooter`,
`actions`) and the open-state controls (`trigger`, `forceShow`, `onClose`,
`dialogOpen`, `onDialogOpenChange`).

`useEditorDialog(isFormDirty, options)` returns `{ open, setOpen,
handleOpenChange, discardDialogProps }` and does four things worth knowing:

- **The dirty guard.** `handleOpenChange(false)` does not close a dirty form; it
  raises the discard confirmation instead, and only `onDiscard` actually closes.
- **A guarded two-way binding.** The `dialogOpen` prop and the internal `open`
  state sync through two effects with a `syncingFromProp` ref between them.
  Without the guard they chase each other on mount and blow the render depth.
  `onDialogOpenChange` is held in a ref so an unmemoised callback cannot re-fire
  the notify effect every render and emit a stray `false`.
- **An open-dialog stack.** Every open editor pushes an identity onto a
  module-level array. Escape is handled by a capture-phase `keydown` listener on
  `document`, and each dialog ignores the key unless it is the last entry —
  because listeners on the same node all run regardless of `stopPropagation()`,
  so without the stack one Escape closes a nested create dialog *and* its parent.
- **Unmount safety.** The stack entry is removed in the effect cleanup, so a
  dialog whose parent stops rendering it cannot strand Escape at the top.

### Selectors

`EntitySelector<T>` is the single-entity picker and takes a `retriever` function
rather than data: it drives `useDataListRetriever` internally, so it searches
server-side. Its props cover label rendering (`getLabel`,
`getSelectedItemDisplay`, `renderOption`), filtering (`filterData`), form
integration (`form`, `id`, `toFormValue`, `useFormWatch`), inline creation
(`onCreateNew`, `createNewLabel`) and `autoSelectSingle`. `EntityMultiSelector<T>`
is the array-valued sibling.

Note the two traps these encode: inline creation is **async**, so a caller must
wait for the created entity before submitting; and the underlying `cmdk`
`CommandItem` needs a unique `value` or two identically named entries select
together.

### Uploaders

`FileUploader` is a `react-dropzone` wrapper exposed as four composable pieces
plus a `useFileUpload()` hook that reads the surrounding context.
`MultiFileUploader` is the assembled control: `{ files, setFiles, multiple,
className }`, with `multiple` **opt-in and defaulted to false** — a comment in
the file records that flipping the default would change behaviour in every
consuming app to suit whichever one asked last.

## The table system

### ContentListTable

`packages/nextjs-jsonapi/src/components/tables/ContentListTable.tsx` is a
`memo`ised `@tanstack/react-table` wrapper.

| Prop | Purpose |
|---|---|
| `data` | a `DataListRetriever<any>` — the table does not fetch |
| `tableGeneratorType` | the `ModuleWithPermissions` whose generator builds the columns |
| `fields` | the column field names to render |
| `title`, `titleActions`, `titleSize` | header; `titleSize` is opt-in and defaults to `fullWidth ? "lg" : "sm"` |
| `checkedIds`, `toggleId` | row selection |
| `functions`, `filters`, `allowSearch` | header slots; `allowSearch` renders `ContentTableSearch` |
| `context` | extra values handed to the generator |
| `expandable`, `getSubRows`, `defaultExpanded` | tree rows |
| `groupBy`, `groupLabel`, `groupOrder` | grouping by a relationship or attribute |
| `fullWidth` | drops the rounded outer border |
| `hideHeader`, `emptyState` | presentation |
| `hidePagination` | suppresses the prev/next footer even when the API returned `links.next` — for capped lists whose header links to the full page |
| `onRowClick` | row activation |
| `tableGenerator` | typed `never`; the prop exists only to reject the older API |

The component tracks which pagination direction is in flight so it can show a
spinner on that button, and clears it when `data.isLoaded` flips.

### Cells

`packages/nextjs-jsonapi/src/components/tables/cells/` exports seven column
builders, each returning a `ColumnDef<any>`: `cellComponent`, `cellText`,
`cellDate`, `cellDateTime`, `cellId`, `cellLink` and `cellUrl`. A table
generator composes its columns from these.

### The registry, and the obligation

`TableGeneratorRegistry`
(`packages/nextjs-jsonapi/src/hooks/TableGeneratorRegistry.ts`) is a singleton
`Map<string, UseTableStructureHook>` exposed as `tableGeneratorRegistry`, with
`register`, `get`, `isRegistered`, `getRegisteredTypes`, `unregister` and
`clear`.

Two functions in `packages/nextjs-jsonapi/src/hooks/useTableGenerator.ts` are the
public face:

- `registerTableGenerator(type, hook)` — `type` may be a string or a module; a
  module is reduced to its `name`.
- `useTableGenerator(module, params)` — looks the hook up by `module.name` and
  calls it.

**A table cannot render for a module whose generator is not registered.**
`TableGeneratorRegistry.get` throws
`Table generator for type "<x>" is not registered. Available types: …`. The
package registers six in the side effect of its `./client` barrel — `roles`,
`users`, `companies`, `stripe-products`, `stripe-prices`, `waitlists` — and deliberately
leaves `contents` to the app so the app can supply its own cell topic. Every
module the app adds must register its own generator, at client-module scope,
before the first render of its table.

## Grids

`ContentListGrid<T>` (`packages/nextjs-jsonapi/src/components/grids/ContentListGrid.tsx`)
is the card-layout sibling of `ContentListTable`. It takes the same
`DataListRetriever` and `tableGeneratorType` (used only for the header icon and
consistency), plus an `ItemComponent` receiving `{ item }`, and the same
`title` / `functions` / `filters` / `allowSearch` / `fullWidth` header contract.
`gridClassName` replaces the default responsive grid classes entirely.

## BlockNote

The editor lives in `packages/nextjs-jsonapi/src/components/editors/`. The barrel
exports `BlockNoteEditorContainer` (the mounted editor),
`BlockNoteEditorMentionHoverCard`, `BlockNoteEditorMentionInlineContent`,
`BlockNoteEditorSuggestionMenuController`, and the two types. The viewer is
`BlockNoteViewerContainer` from `packages/nextjs-jsonapi/src/components/viewers/`.

```ts
export type BlockNoteAiConfig = {
  endpoint: string;
  entityType: string;
  entityId?: string;
};

export type BlockNoteEditorProps = {
  id: string;
  type: string;
  initialContent?: PartialBlock[];
  onChange?: (content: any, isEmpty: boolean, hasUnresolvedDiff: boolean) => void;
  size?: "sm" | "md";
  className?: string;
  markdownContent?: string;
  diffContent?: PartialBlock[];
  placeholder?: string;
  bordered?: boolean;
  inlineContentSpecs?: Record<string, any>;
  renderOverlays?: (editor: any) => React.ReactNode;
  enableMentions?: boolean;
  disableMentions?: boolean;
  mentionSearchFn?: (query: string, params?: Record<string, string>) => Promise<MentionItem[]>;
  mentionSearchParams?: Record<string, string>;
  mentionResolveFn?: MentionResolveFn;
  suggestionMenuComponent?: React.FC<SuggestionMenuProps<DefaultReactSuggestionItem>>;
  mentionNameResolver?: MentionNameResolver;
  onWarmMentions?: (blocks: PartialBlock[]) => void;
  aiConfig?: BlockNoteAiConfig;
  stretch?: boolean;
  aiEnabled?: boolean;
};
```

Two of those carry recorded reasoning. `stretch` exists because the editor
otherwise grows to fit its content and pushes the surrounding form to scroll; set
it when the parent gives the editor a real height. `aiEnabled` gates AI on top of
`aiConfig` — credit availability and the like — and defaults to `true` so
existing callers that pass only `aiConfig` are unaffected; `false` creates no AI
extension and hides both the toolbar button and the AI slash items.

`onChange` reports emptiness itself: the file's `isBlockEmpty`/`isDocumentEmpty`
pair treats a document of blank paragraphs as empty, so callers must not
re-derive that from the JSON.

The viewer reads `next-themes`' `resolvedTheme`, and handles being rendered
outside a theme provider (a public page) rather than assuming one.

## Typography and hero

`packages/nextjs-jsonapi/src/components/typography/` exports exactly three
components and their prop types: `SectionHeader`, `MicroLabel` and `DetailField`.
They are the text roles — a heading above a block, a small uppercase label, and a
label/value pair. Styling text with ad-hoc Tailwind classes instead of these is
what the typography reference in the rulebook exists to prevent.

`packages/nextjs-jsonapi/src/components/hero/` exports five:
`EntityHeroLayout`, `EntityHero`, `EntityHeroAvatar`, `EntityHeroMetaRow` and
`EntitySection` — the detail-page banner and its parts.

`packages/nextjs-jsonapi/src/components/fiscal/` exports `ItalianFiscalData` with
its `FiscalDataHandle` and props type, plus `ItalianFiscalDataDisplay` and
`FiscalDataDisplay`. They are optional locale-specific controls; an app that does
not need them simply never imports them.

## The UI primitives — Base UI, not Radix

`packages/nextjs-jsonapi/src/shadcnui/index.ts` re-exports 48 primitives from
`packages/nextjs-jsonapi/src/shadcnui/ui/` and four custom components from
`packages/nextjs-jsonapi/src/shadcnui/custom/`:

> accordion · alert · alert-dialog · avatar · badge · breadcrumb · button ·
> calendar · card · carousel · chart · checkbox · collapsible · combobox ·
> command · confirm-dialog · context-menu · dialog · drawer · dropdown-menu ·
> empty-state · field · form · hover-card · input · input-group · input-otp ·
> label · navigation-menu · popover · progress · radio-group · resizable ·
> scroll-area · select · separator · sheet · sidebar · skeleton · slider ·
> sonner · spinner · switch · table · tabs · textarea · toggle · tooltip —
> plus custom `kanban`, `link`, `multi-select`, `multiple-selector`.

These look like shadcn/ui components and are named like them, but **they are
built on Base UI (`@base-ui/react`), not Radix**. Twenty-eight of the 48 files under
`packages/nextjs-jsonapi/src/shadcnui/ui/` import `@base-ui/react` directly; the rest
are composed from those or are plain styled elements. Exactly one
file in the whole package imports a Radix package:
`packages/nextjs-jsonapi/src/shadcnui/custom/kanban.tsx`, which uses
`Slot` from `@radix-ui/react-slot`.

Four consequences follow, and they are the most common source of broken UI code
in a new app:

1. **There is no `asChild`.** Base UI composes with a `render` prop instead:
   `render={<Button variant="ghost" />}`. The package uses it throughout — see
   `alert-dialog.tsx` and `combobox.tsx` under
   `packages/nextjs-jsonapi/src/shadcnui/ui/`.
2. **Never wrap a `<Button>` inside a trigger component.** The trigger *is* the
   button; pass the styling through `render`.
3. **Base UI renders non-button elements for several controls.** `Checkbox`,
   `Switch` and `RadioGroupItem` render a `span`; menu and listbox items render a
   `div`. Because Tailwind v4 dropped the Preflight `button { cursor: pointer }`
   rule, each of those primitives carries its own `cursor-pointer` class, and
   `buttonVariants` carries one too so `<Button render={<div/>} nativeButton={false}>`
   still shows a pointer. Raw `<button>` elements inside the package's feature
   components rely on the **consuming app** adding a base-layer rule — see the
   tooling page's consumer obligations.
4. **RTL needs a provider.** `DirectionProvider` from `…/contexts` wraps Base
   UI's own `DirectionProvider` and also publishes the direction through
   `useDir()`. Without it, Base UI popups resolve `align="start"`/`"end"` as LTR
   even when the CSS mirrors. Direction is app-owned: the package never derives
   it from the locale.

## Providers

Everything below is exported from `@carlonicora/nextjs-jsonapi/contexts`.

| Provider | Hook | Source |
|---|---|---|
| `CommonProvider` | `useCommonContext` | `packages/nextjs-jsonapi/src/contexts/CommonContext.tsx` |
| `SharedProvider` | `useSharedContext` | `packages/nextjs-jsonapi/src/contexts/SharedContext.tsx` |
| `SessionProvider` | `useSession` | `packages/nextjs-jsonapi/src/contexts/SessionContext.tsx` |
| `SocketProvider` | `useSocketContext` | `packages/nextjs-jsonapi/src/contexts/SocketContext.tsx` |
| `DirectionProvider` | `useDir` | `packages/nextjs-jsonapi/src/contexts/DirectionContext.tsx` |
| `HeaderChildrenProvider` | `useHeaderChildren`, `useHeaderMobileChildren`, `useHeaderRootLabel` | `packages/nextjs-jsonapi/src/contexts/HeaderChildrenContext.tsx` |
| `HeaderLeftContentProvider` | `useHeaderLeftContent` | `packages/nextjs-jsonapi/src/contexts/HeaderLeftContentContext.tsx` |
| `HeaderLogoProvider` | `useHeaderLogo` | `packages/nextjs-jsonapi/src/contexts/HeaderLogoContext.tsx` |
| `MobileNavigationProvider` | `useMobileNavigationItems` | `packages/nextjs-jsonapi/src/contexts/MobileNavigationContext.tsx` |
| `ViewportProvider` | `useIsMobile` (from `…/core`) | `packages/nextjs-jsonapi/src/contexts/ViewportContext.tsx` |
| `ActionBarProvider` | `useIsInActionBar` | `packages/nextjs-jsonapi/src/contexts/ActionBarContext.tsx` |
| `BreadcrumbRootProvider` | `useIsBreadcrumbRootHidden` | `packages/nextjs-jsonapi/src/contexts/BreadcrumbRootContext.tsx` |
| `AdministrationProvider` | `useAdministrationContext` | `packages/nextjs-jsonapi/src/features/administration/contexts/` |
| `CompanyProvider` | `useCompanyContext` | `packages/nextjs-jsonapi/src/features/company/contexts/CompanyContext.tsx` |
| `NotificationContextProvider` | `useNotificationContext` | `packages/nextjs-jsonapi/src/features/notification/contexts/NotificationContext.tsx` |
| `OnboardingProvider` | `useOnboarding` | `packages/nextjs-jsonapi/src/features/onboarding/contexts/OnboardingContext.tsx` |
| `RoleProvider` | `useRoleContext` | `packages/nextjs-jsonapi/src/features/role/contexts/RoleContext.tsx` |
| `CurrentUserProvider` | `useCurrentUserContext` | `packages/nextjs-jsonapi/src/features/user/contexts/CurrentUserContext.tsx` |
| `UserProvider` | `useUserContext` | `packages/nextjs-jsonapi/src/features/user/contexts/UserContext.tsx` |
| `HowToProvider` | `useHowToContext` | `packages/nextjs-jsonapi/src/features/how-to/contexts/HowToContext.tsx` |
| `RbacProvider` | `useRbacContext` | `packages/nextjs-jsonapi/src/features/rbac/contexts/RbacContext.tsx` |
| `AssistantProvider` | `useAssistantContext` | `packages/nextjs-jsonapi/src/features/assistant/contexts/AssistantContext.tsx` |
| `JsonApiProvider` | — | `packages/nextjs-jsonapi/src/client/context/JsonApiProvider.tsx` (exported from `…/client`) |
| `HelpProvider` | `useHelp` | exported from `…/help` |
| `TokenUsageAdminProvider`, `TokenUsageReportProvider` | `useTokenUsageAdmin`, `useTokenUsageReport` | exported from `…/tokenusage` |
| `MockJsonApiProvider` | — | exported from `…/testing` |

The barrel also re-exports the Jotai atoms from
`packages/nextjs-jsonapi/src/atoms/index.ts` (`recentPagesAtom`).

### The session promise

Since 4.0 four providers can take the session as a promise from
`ServerSession.read()` (`…/server`) instead of a resolved value, so a layout can
render its children before the session arrives:

| Provider | `session` prop replaces | What it derives |
|---|---|---|
| `SessionProvider` | — (new) | stores the promise; `useSession()` unwraps it with `use()` |
| `ViewportProvider` | `initialIsMobile` | `isMobile`, until the first client measurement replaces it |
| `SocketProvider` | `token` | the socket token, resolved in an effect |
| `SidebarProvider` (from `…/components`) | `defaultOpen` | the open state from the `sidebar_state` cookie, and `isMobile` |

The old props still work. None of the providers awaits the promise. Whatever
**reads** from it suspends instead: `useSession()`, `useIsMobile()` under a
promise-seeded `ViewportProvider`, and `useSidebar().isMobile` under a
promise-seeded `SidebarProvider`. Each such caller must sit behind its own
`<Suspense>`. Anything between a layout and its `{children}` that only needs to
toggle the sidebar uses `useSidebarControls()`, which is `useSidebar()` without
`isMobile` and never suspends.

A promise handed from a server component to a client component arrives as
React's wire chunk, whose `then()` returns nothing. The library's providers derive
from it through the internal `mapThenable` helper
(`packages/nextjs-jsonapi/src/utils/map-thenable.ts`); app code that chains off the
session promise in a client component needs the same `new Promise` adoption.

The template mounts all four in
`apps/web/src/features/common/components/session/AppShell.tsx`; the shell is
described in `docs/handbook/04-frontend/app-shell-and-routing.md`.

**The package ships no ThemeProvider.** `BlockNoteViewer` and the mode toggle
read `next-themes`' `useTheme`, but mounting `next-themes`' own provider is the
app's job. The same is true of `NextIntlClientProvider` and of `DirectionProvider`,
which the app must mount with the same value it puts on `<html dir>`.

## Hooks

From `@carlonicora/nextjs-jsonapi/client`.

| Hook | Signature | What it gives you |
|---|---|---|
| `useDataListRetriever<T>` | `(params: { ready?, retriever, retrieverParams?, search?, addAdditionalParameter?, requiresSearch?, module }) => DataListRetriever<T>` | a paginated, searchable list |
| `useJsonApiGet<T>` | `(params) => { data, loading, error, response, refetch, hasNextPage, hasPreviousPage, … }` | one-off client fetch |
| `useJsonApiMutation<T>` | `(config) => { data, loading, error, response, mutate, reset }` | client-side POST/PUT/PATCH/DELETE |
| `useRehydration<T>` | `(classKey, data \| null) => T \| null` | rebuild a model from a `dehydrate()` payload |
| `useRehydrationList<T>` | `(classKey, data[] \| null) => T[]` | the list form |
| `useTableGenerator<T, U>` | `(module, params) => UseTableStructureHookReturn<T>` | resolve a registered table generator |
| `registerTableGenerator<T, U>` | `(type: string \| ModuleWithPermissions, hook) => void` | register one |
| `usePageUrlGenerator` | `() => (params: { page?, id?, childPage?, childId?, additionalParameters?, language? }) => string` | build an app URL from a module |
| `useUrlRewriter` | `() => (params: { page, id?, childPage?, childId?, … }) => string` | the module-typed wrapper over the above |
| `useDebounce<T>` | `(callback: T, delay: number) => T & { cancel: () => void }` | a cancellable debounce |
| `useSocket` | `({ token }) => { socket, isConnected, messages, socketNotifications, sendMessage, removeMessage, removeSocketNotification, clearMessages, clearSocketNotifications }` | the socket.io client |
| `useNotificationSync` | `() => void` | drains socket notifications into the notification context |
| `usePageTracker` | `() => void` | records visited pages into `recentPagesAtom` |
| `useCustomD3Graph` | `(nodes, links, onNodeClick, visibleNodeIds?, options?) => …` | the force/layered D3 graph |
| `computeLayeredLayout`, `fitLayeredLayoutToAspectRatio` | plain functions | dagre-based layout for the above |
| `useI18nTranslations` | `(namespace?) => (key, values?) => string` | the configured translator |
| `useI18nLocale` | `() => string` | the current locale |
| `useI18nRouter` | `() => I18nRouter` | the configured router |
| `useI18nDateFnsLocale` | `() => any` | the configured date-fns locale |
| `getI18nLink` | function | the configured `Link` component |
| `useContentTableStructure`, `useRoleTableStructure`, `useUserTableStructure`, `useUserSearch` | feature hooks | the shipped table generators and user search |
| `useOAuthClients`, `useOAuthClient`, `useOAuthConsent` | feature hooks | the OAuth consent flow |
| `useSubscriptionStatus` | feature hook | the company's Stripe subscription state |

`useEditorDialog` and `useFileUpload` come from
`@carlonicora/nextjs-jsonapi/components` rather than `…/client`, because they are
part of the form system rather than the data layer. `useSidebar` and
`useSidebarControls` come from `…/components` too, with the sidebar primitive.
`useIsMobile` (with `MOBILE_BREAKPOINT` and `VIEWPORT_COOKIE_NAME` beside it) is
exported from `…/core`, through `packages/nextjs-jsonapi/src/utils/index.ts`, not
from `…/client`; `useSession` comes from `…/contexts`.

The four i18n hooks are indirections, not implementations: `configureI18n` in
`apps/web/src/config/env.ts` hands the package the app's `useRouter`,
`useTranslations`, `useLocale`, `useDateFnsLocale`, `Link` and `usePathname` (the
navigation ones from `apps/web/src/i18n/navigation.ts`), plus next-intl's server
`getLocale`, which 4.0 made required and which `callApi` uses for the
`x-language` header on the server. The package calls back into them. That is how the package stays independent of
which i18n library the app chose.

## Where to look

| File | Why |
|---|---|
| `packages/nextjs-jsonapi/src/components/index.ts` | the component surface in one file |
| `packages/nextjs-jsonapi/src/components/forms/index.ts` | every form export |
| `packages/nextjs-jsonapi/src/components/forms/FormFieldWrapper.tsx` | the shell every field goes through |
| `packages/nextjs-jsonapi/src/components/forms/useEditorDialog.ts` | the dirty guard, the two-way-binding guard and the Escape stack |
| `packages/nextjs-jsonapi/src/components/tables/ContentListTable.tsx` | the table props and pagination behaviour |
| `packages/nextjs-jsonapi/src/hooks/useTableGenerator.ts` | `registerTableGenerator` and `useTableGenerator` |
| `packages/nextjs-jsonapi/src/components/editors/BlockNoteEditor.tsx` | `BlockNoteEditorProps` and the emptiness helpers |
| `packages/nextjs-jsonapi/src/shadcnui/index.ts` | the 52 exported primitives |
| `packages/nextjs-jsonapi/src/contexts/index.ts` | every provider |
| `packages/nextjs-jsonapi/src/contexts/SessionContext.tsx` | `SessionProvider` and `useSession` |
| `packages/nextjs-jsonapi/src/shadcnui/ui/sidebar.tsx` | `SidebarProvider` with `session`, and `useSidebarControls` |
| `packages/nextjs-jsonapi/src/hooks/index.ts` | every hook the client barrel re-exports |

## Gaps and drift

- `usePushNotifications` is a **default** export in
  `packages/nextjs-jsonapi/src/hooks/usePushNotifications.ts`, and
  `packages/nextjs-jsonapi/src/hooks/index.ts` re-exports that file with
  `export *`, which does not carry a default. The hook is therefore not reachable
  through `@carlonicora/nextjs-jsonapi/client`.
- The package's own `packages/nextjs-jsonapi/CLAUDE.md` describes directories
  `components/table/`, `components/form/` and `components/dialog/`. The real ones
  are `components/tables/`, `components/forms/`, and dialogs under
  `shadcnui/ui/`.
- The primitives are named after shadcn/ui and the README calls them "shadcn/ui
  components", which invites Radix idioms. They are Base UI.
- `apps/web/src/app/globals.css` in this template defines neither the
  `--color-success` token nor the pointer-cursor base layer the package's
  components assume, and nothing in the app mounts `DirectionProvider`. See the
  tooling page.
- `packages/nextjs-jsonapi/docs/migrating-to-4.0.md` calls `useIsMobile()` "not a public
  export"; it is, through `…/core`.
- Not examined: the internals of the eighteen feature component barrels
  (`auth`, `administration`, `ai-connection`, `company`, `content`, `how-to`,
  `handbook`, `assistant`, `assistant-message`, `assistant-action`, `feature`,
  `notification`, `onboarding`, `referral`, `role`, `user`, `oauth`, `waitlist`),
  read at barrel level only; the billing component set; the help and token-usage
  component sets.
