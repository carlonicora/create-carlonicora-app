# The integrity harness — nine checks

```bash
pnpm check:template            # run them all
pnpm check:template --strict   # a SKIP becomes a failure (use this in the sync workflow)
```

The harness (`scripts/integrity/index.js`) loads every `scripts/integrity/checks/*.js` in
filename order, awaits each `run({ repoRoot, templateDir, config })`, and prints one line per
check: `PASS`, `FAIL` (with each failure message indented beneath), or `SKIP`. It exits 1 if any
check failed, and — with `--strict` — also if any check was skipped.

**Always pass `--strict` during a sync run.** A `SKIP` means a check inspected nothing, and a
check that inspects nothing is indistinguishable from a check that passed.

---

## The rule that governs all nine

> **A check exists to describe a real defect. If a check fires on correct code, the check is
> wrong — fix the check, never the code.**

Bending correct code to satisfy a check converts one bad check into a permanent defect, and
destroys the only property that makes the harness worth running: that a `FAIL` means something.
The same applies to exclusion lists — adding a path to silence a check is editing the check, and
needs the same justification.

The inverse failure is worse and quieter: a check whose target path moved keeps printing `PASS`
while inspecting nothing. That is why every check that walks a fixed root calls `requireDir()`
first, which turns a missing directory into an explicit failure naming the path. If you add or
move a directory a check depends on, expect that failure and fix the path — do not delete the
guard.

---

## The checks

### 1. `admin-gate` — the `(admin)` subtree enforces the Administrator role

Requires `template/apps/web/src/app/[locale]/(admin)/` to exist, `layout.tsx` to be present,
that layout to contain `hasRole(RoleId.Administrator)`, and at least one `page.tsx` beneath it.

**Why it exists:** the `(admin)` layout is the only thing between an ordinary authenticated user
and every administration page — the routes beneath carry no auth of their own. The template once
gated on `isLogged()` alone, with the `notFound()` doing the *locale* check, so any authenticated
user reached the admin UI. Not a data leak (the API enforces `@Roles(Administrator)` on
`GET /companies`, so the request 403s) but a UI exposure, and one that seven further admin routes
would have inherited.

**Reading a failure:** "does not check `ServerSession.hasRole(RoleId.Administrator)`" means the
regex found no such call. "contains no pages" means the path is probably wrong, not that the
subtree is empty by design.

**Where the guarantee stops — KNOWN LIMITATION:** it matches **token presence, not control-flow
position**. It catches *removal* of the role check. It does **not** catch an inverted one
(`if (hasRole(...)) notFound()`), a check whose result is discarded, or one placed after the
render. Read the layout yourself whenever you adopt or edit it.

### 2. `bootstrapper-modules` — every `Modules.X` the library uses is registered

Scans the `@carlonicora/nextjs-jsonapi` checkout's `src/` for every `Modules.X` dereference, and
compares that set against the names registered in `template/apps/web/src/config/Bootstrapper.ts`
— both the direct `Foo: FooModule(moduleFactory)` form and spreads like
`...tokenUsageModules(moduleFactory)`, which it resolves by reading the helper's
`export const … satisfies` declaration out of the library source.

**Why it exists:** nothing else catches this. `FoundationModuleDefinitions` declares the names, so
`Modules.X` **typechecks and is `undefined` at runtime**. The template shipped without
`...tokenUsageModules(moduleFactory)` and without `AiConnection: AiConnectionModule(moduleFactory)`
and every static gate passed.

**Reading a failure:** `Modules.X is used by the library but not registered` is usually a genuine
gap — but if the scan root was recently widened, a new name may be a library-internal reference
rather than something the template must register. **Report new names; do not register them
reflexively.** Whether each is a genuine gap is a judgement call for the user.

Two false-positive fixes are baked in and must not be undone: block and line comments are stripped
before scanning (the library's own prose documents this failure mode, and a naive scan turns that
sentence into a demand to register a module called `X`), and the line-comment regex guards `://`
so a URL does not truncate the line and silently drop a real `Modules.X` after it.

**Skips** when the library checkout named in `integrity.config.json` is absent.

### 3. `email-templates` — every auth flow that mails has a template

Requires `activationEmail.hbs`, `invitationEmail.hbs` and `resetEmail.hbs` under
`template/apps/api/templates/email/en/`.

**Why it exists:** `/invitation/[code]` and `/reset/[code]` shipped as routes with no templates
behind them — flows that silently send nothing.

**Where the guarantee stops — KNOWN LIMITATION:** it checks **existence only**. An empty `.hbs`
passes. So does one still carrying a target's brand colour, logo `img` or product name — the
audit's source templates carried `#167b5d`, a logo and "Wyrdli" strings. Open any email template
you adopt.

### 4. `env-required` — `env.example` declares every required key and no retired one

Requires `ENCRYPTION_KEY`, `NEXT_PUBLIC_REGISTRATION_MODE`, `CREDIT_COST`, `CREDIT_MINIMUM`.
Rejects the retired `ALLOW_REGISTRATION` and `NEXT_PUBLIC_ALLOW_REGISTRATION`.

**Why it exists:** `ENCRYPTION_KEY` stopped being optional the moment the administration
AI-connections page shipped — `AiConnectionService` throws *"ENCRYPTION_KEY is not configured —
cannot store AI connection secrets"*. The retired pair matters because two switches for one
behaviour is worse than either alone.

**Reading a failure:** the required list is a floor, not a ceiling. A missing key that is not on
the list is still a defect; this check simply does not know about it.

### 5. `junk` — `template/` contains no OS or build junk

Walks the whole template and flags `.DS_Store`, `Thumbs.db` and `*.log`.

**Why it exists:** two `.DS_Store` files were being copied into **every generated app**.

**Note on layering:** the permanent guard is in the CLI's copy step (`src/utils/files.ts`), so
junk cannot reach a generated app regardless of what `template/` contains. This check catches
recurrences in `template/` itself. Both are wanted; neither replaces the other.

### 6. `manifests` — script refs resolve; `packageManager` is declared only at root

Two assertions. Every `scripts/…` path named in the template root `package.json` scripts block
must exist on disk (only literal `.js`/`.mjs`/`.cjs`/`.sh`/`.ts` refs are checked — a bare
directory ref is resolved by node against a package, not a file). And none of
`apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json` may pin
`packageManager`.

**Why it exists:** the root `package.json` pointed `"structure"` at
`scripts/import-structure.sh`, which had never existed. And `apps/web/package.json` pinned
`pnpm@11.1.1` against the root's `pnpm@11.18.0` — a nested pin silently changes which pnpm runs.

### 7. `orphan-modules` — no zero-importer modules under `features/common`

Walks `template/apps/web/src`, and for each candidate under `features/common` looks for any live
file importing it. Elimination is **iterative to a fixpoint**, because dead code arrives in
clusters: `AccountContext`'s only importer was `AccountContainer`, itself an orphan — a single
pass would have cleared `AccountContainer` and pronounced `AccountContext` live.

`index.ts` / `index.tsx` are allowlisted (wired by convention, not by import).

**Where the guarantee stops — KNOWN LIMITATION:** it **cannot distinguish dead code from
intentional unwired scaffolding**, which is precisely why `INTENTIONAL_STUBS` exists. The template
ships some things *on purpose* for the generated app's author to wire up; for those, "no importer"
does not mean "dead", and deleting them removes a feature the template exists to provide.

Current entries and their evidence — `CreationDropDown.tsx` (designated a lift-as-stub, with its
wiring sitting commented-in-place in `CommonSidebar.tsx`) and `ErrorContext.tsx` (a complete
`ErrorProvider`/`useErrorHandler` pair meant to be mounted in the app's own layout).

**Add to `INTENTIONAL_STUBS` only with that same class of evidence: a stub designation, or
commented-in-place wiring showing intent.** "It looks useful" is not evidence.

### 8. `placeholder-urls` — no single-argument `new URL()` on a schemeless literal

Scans `apps/web/src` and `apps/api/src` for `new URL(...)` and flags a one-argument call whose
trailing string literal carries no scheme.

**Why it exists:** `metadataBase: new URL(ENV.APP_URL ?? "{{name}}.com")` scaffolds to
`new URL("myapp.com")` → `TypeError: Invalid URL`. `generateSpecificMetadata` backs nearly every
`generateMetadata`, so with `APP_URL` unset **every page 500s**.

Four deliberate refusals to judge, each eliminating a real false positive — do not remove them:
the **two-argument** form (`new URL("/login", request.url)` is valid, idiomatic, and the
documented Next.js middleware redirect); any call containing a nested `(`, where the regex has
truncated at the inner paren so the trailing literal belongs to the inner call; template literals
containing `${…}`, where the scheme may come from the interpolated value; and any literal already
carrying a scheme — **any** scheme, since `mailto:`, `tel:` and `blob:` are all valid.

**Where the guarantee stops:** it judges the *trailing* literal, so `ENV.APP_URL ?? "fallback"`
is judged on the fallback — correct here, but it means a non-literal argument is never judged at
all.

### 9. `production-versions` — `versions.production.json` matches the libraries on disk

Compares each pinned version against the `version` in that library checkout's `package.json`.

**Why it exists:** the file pinned `2.0.0`/`2.0.0` while the actual libraries were `3.1.0` and
`3.3.8`. Production Docker builds were resolving major-version-old packages.

**Reading a failure:** it tells you the pin and the on-disk version disagree, not which is right.
The on-disk checkout is normally the truth — but confirm the checkout is on its default branch
before bumping the pin to match a feature branch.

**Skips** when a library checkout named in `integrity.config.json` is absent.

---

## What the harness does *not* cover

These were named in the design as wanted and are **not** among the nine. Do not treat a green
harness as covering them; each has a manual counterpart in the workflow:

| Not checked | Manual counterpart |
|---|---|
| Unresolved internal imports (`@/…`, `src/…`, relative) | `tsc --noEmit`, `verification.md` step 5 |
| App imports vs the library's actual `dist` exports — the `ProductsAdminContainer` class of defect | `tsc --noEmit`, `verification.md` step 5 |
| i18n keys the library's components demand vs `en.json` (the audit found a 142-key gap) | click through the adopted routes, `verification.md` step 7 |
| Brand-string leak sweep (literal `wyrdli` / `neural-erp` surviving `generalize()`) | `precedence.md` rule 7, by hand after every apply |

A naive implementation of the first three produced false positives during the audit — they need
to handle `export type { … }` blocks, namespace-scoped `useTranslations("ns")`, and star
re-exports respectively. If you write one, write it with those cases first.

---

## Adding a check

Same standard as the nine: it must describe a **real defect that was actually observed**, name
the file and the consequence in its failure message, call `requireDir()` on every fixed root it
walks, and refuse to judge shapes it cannot judge statically rather than guessing. Drop it in
`scripts/integrity/checks/` — the harness discovers it automatically — and give it a test.
