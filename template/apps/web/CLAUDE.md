# Frontend (Next.js) - CLAUDE.md

> **Architecture rules:** invoke the `{{name}}-architecture` skill before
> editing files under `src/features/`. The skill's routing table directs
> you to the right reference for the file you are editing.

See [root CLAUDE.md](../../CLAUDE.md) for monorepo structure and the architecture skill pointer.

## Core Rules

1. **ALWAYS use callApi()** - Never use raw `fetch()` for API calls
2. **Models implement rehydrate() and createJsonApi()** - Consistent serialization/deserialization
3. **Use ModuleFactory** - Standard resource configuration for each entity
4. **Containers fetch, components render** - Clear separation of concerns
5. **Jotai for shared state** - Use atoms for cross-component state
6. **next-intl for i18n** - All user-facing text uses `useTranslations()`

## File Organization

```
src/features/{domain}/
├── data/
│   ├── {Entity}.ts           # Model class (extends AbstractApiData)
│   ├── {Entity}Interface.ts  # TypeScript interface
│   └── {Entity}Service.ts    # API service (extends AbstractService)
├── {Entity}Module.ts         # ModuleFactory configuration
├── {Entity}Atom.ts           # Jotai atoms (if needed)
├── components/
│   ├── {Entity}Container.tsx # Data fetching, state management
│   └── {Entity}Component.tsx # Pure presentational component
└── __tests__/
    └── {Entity}.spec.tsx     # Component tests
```

## Key Patterns (by example)

Consult the `{{name}}-architecture` skill's reference docs under
`.claude/skills/{{name}}-architecture/references/frontend/` for canonical
examples of:

- **Model class** — `src/features/<domain>/<entity>/data/<Entity>.ts`
- **Service** — `src/features/<domain>/<entity>/data/<Entity>Service.ts`
- **ModuleFactory** — `src/features/<domain>/<entity>/<Entity>Module.ts`
- **Container** — `src/features/<domain>/<entity>/components/containers/<Entity>Container.tsx`

## Testing

```bash
pnpm --filter {{name}}-web test
pnpm --filter {{name}}-web test:coverage
```

### Testing Utilities

```typescript
import {
  MockJsonApiProvider,
  renderWithProviders,
  createMockApiData,
  screen,
} from "@carlonicora/nextjs-jsonapi/testing";
```

## Common Mistakes

| Mistake                                         | Correct Approach                               |
| ----------------------------------------------- | ---------------------------------------------- |
| Using `fetch()` directly                        | Use `callApi()` from service                   |
| `overridesJsonApiCreation: true` without method | Implement dedicated `createJsonApi()` in model |
| Missing `type: Modules.Entity` in service calls | Always specify the module type                 |
| State in presentational components              | Move state to containers or atoms              |
| Hardcoded strings                               | Use `useTranslations()` for i18n               |
| Missing `rehydrate()`                           | All models must implement static `rehydrate()` |
| Raw `<input>`, `<select>`, `<button>`           | Use components from `@carlonicora/nextjs-jsonapi/components` (Select, Button, FormInput, AlertDialog, Dialog, UserAvatar, Badge…). Raw inputs render as invisible/unstyled text. |
| `asChild` prop on triggers                      | Project uses BaseUI (not Radix) — `asChild` does not exist. Nest children directly, or use the `render` prop for composition. |
| Duplicating components that already exist       | Grep `apps/web/src` and `packages/nextjs-jsonapi/src` for existing components before writing new ones. Reuse with props. |
| Modifying shared/foundation components (`apps/web/src/foundations/`, `packages/`) | Never edit foundation components for a single feature. Duplicate into `features/<domain>/components/` and update the route. |
| `z.number()` for currency fields                | `FormInput type="currency"` operates on strings. Use `z.coerce.string()` in the Zod schema, then parse via `parseCurrencyInput()` / `centsToInputValue()` in submit. |
| Raw JS `Date` in JSON:API date-only payloads    | Import `formatLocalDate` from `@carlonicora/nextjs-jsonapi/core` and emit `YYYY-MM-DD` (e.g. `response.data.attributes.date = formatLocalDate(data.date)`). Otherwise `JSON.stringify()` UTC-shifts the value. Never re-implement inline — the helper is shared. |
| Resolving `Modules[name]` at import time        | The `Modules` Proxy registry is populated during app init, after imports. Store the module name as a string and resolve lazily inside `useMemo` or a render-time function. |
| Partial User PUT payload                        | `PUT /users/:userId` replaces ALL fields; missing fields get wiped. `PATCH /users/:userId` is bound to `reactivateUser` and ignores the body. Always spread full current user state. |
