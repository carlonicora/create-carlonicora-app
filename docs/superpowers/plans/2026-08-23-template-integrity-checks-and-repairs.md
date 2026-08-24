# Template Integrity Checks & Phase 1 Repairs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable integrity-check harness for `template/`, and use each new check as the failing test that drives one of the Phase 1 repairs.

**Architecture:** `scripts/integrity/` holds one module per check, each exporting `{ id, title, run(ctx) }` and returning a list of failure strings. `scripts/integrity/index.js` runs them all and exits non-zero on any failure — that runner *is* the test cycle for this repo, which has no test framework. Every task adds one check, watches it fail against the current template, applies the repair, and watches it pass. The harness outlives this plan: Plan B's `compare-template` and Plan C's merge both gate on it.

**Tech Stack:** Node 22 (plain ESM, no new dependencies), TypeScript only for the existing CLI in `src/`.

**Spec:** `docs/superpowers/specs/2026-08-23-template-multi-source-alignment-design.md`

## Global Constraints

- Library versions of record: `@carlonicora/nestjs-neo4jsonapi` **3.1.0**, `@carlonicora/nextjs-jsonapi` **3.3.8**.
- Package manager: `pnpm@11.18.0`, declared **only** at repo root; no nested `packageManager` field.
- Node engine: `>=22.0.0`.
- Checks add **no npm dependencies** — plain Node ESM only.
- Template app code is **Base UI, never Radix**: no `asChild`, never wrap `<Button>` in a trigger, use the `render` prop (`references/frontend/04-components.md` § "TRIGGER COMPOSITION").
- Text styling follows the 17 typography roles; admin/settings sub-pages take the **role-3 muted eyebrow**, never a role-1 page title (`references/frontend/05-typography.md` § "THE 17 ROLES", row 3).
- **NO git commits at any point** — not in any task, not at the end. The user commits after manual verification.
- Checks operate on `template/`, never on a generated app.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/integrity/index.js` | Runner: loads every check, prints results, exits 1 on failure. Supports `--strict`. |
| `scripts/integrity/lib/walk.js` | Shared: recursive file walk with an ignore set. Single source of traversal. |
| `scripts/integrity/lib/config.js` | Shared: loads `integrity.config.json`, resolves library paths. |
| `integrity.config.json` | Declares where the two library packages are checked out. |
| `scripts/integrity/checks/junk.js` | No `.DS_Store` / `*.log` inside `template/`. |
| `scripts/integrity/checks/manifests.js` | Script refs resolve; no nested `packageManager`. |
| `scripts/integrity/checks/placeholder-urls.js` | No `new URL()` on a schemeless placeholder literal. |
| `scripts/integrity/checks/production-versions.js` | `versions.production.json` matches the libraries on disk. |
| `scripts/integrity/checks/bootstrapper-modules.js` | Every `Modules.X` the library uses is registered in the template Bootstrapper. |
| `scripts/integrity/checks/env-required.js` | `env.example` declares every required key; no retired keys. |
| `scripts/integrity/checks/email-templates.js` | Every auth flow that mails has a template. |
| `scripts/integrity/checks/admin-gate.js` | The `(admin)` subtree enforces the Administrator role. |
| `scripts/integrity/checks/orphan-modules.js` | No zero-importer modules under `features/common`. |

Each check is standalone so a reviewer can reject one and accept its neighbours.

---

## Task 1: Check harness + junk sweep

**Files:**
- Create: `scripts/integrity/index.js`, `scripts/integrity/lib/walk.js`, `scripts/integrity/checks/junk.js`
- Modify: `package.json` (add `check:template` script)
- Modify: `src/utils/files.ts:36-60` (add copy skip-list)
- Delete: `template/.DS_Store`, `template/apps/web/public/.DS_Store`

**Interfaces:**
- Produces: `walk(dir, out?)` → `string[]` of absolute paths, accumulated into `out`. Directory names in an internal `ALWAYS_SKIP` set are never descended; there is NO caller-supplied ignore option. Every later check imports this.
- Produces: check module shape `{ id: string, title: string, run(ctx) => string[] }` where `ctx = { repoRoot, templateDir, config }`. Every later task implements this shape.
- Produces: `pnpm check:template` — the command every later task runs.

- [ ] **Step 1: Write the shared walker**

Create `scripts/integrity/lib/walk.js`:

```js
import fs from "fs";
import path from "path";

const ALWAYS_SKIP = new Set(["node_modules", ".git", "dist", ".next", ".turbo", "coverage"]);

/** Recursively list files under `dir`. Directory names in ALWAYS_SKIP are never descended. */
export function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}
```

- [ ] **Step 2: Write the junk check**

Create `scripts/integrity/checks/junk.js`:

```js
import path from "path";
import { walk } from "../lib/walk.js";

const JUNK = [/(^|\/)\.DS_Store$/, /\.log$/, /(^|\/)Thumbs\.db$/];

export default {
  id: "junk",
  title: "template/ contains no OS or build junk",
  run({ templateDir }) {
    return walk(templateDir)
      .map((f) => path.relative(templateDir, f))
      .filter((rel) => JUNK.some((re) => re.test(rel)))
      .map((rel) => `junk file shipped in template: ${rel}`);
  },
};
```

- [ ] **Step 3: Write the runner**

Create `scripts/integrity/index.js`:

```js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const templateDir = path.join(repoRoot, "template");
const strict = process.argv.includes("--strict");

const configPath = path.join(repoRoot, "integrity.config.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

const checksDir = path.join(here, "checks");
const files = fs.existsSync(checksDir) ? fs.readdirSync(checksDir).filter((f) => f.endsWith(".js")).sort() : [];

let failed = 0;
let skipped = 0;

for (const file of files) {
  const check = (await import(path.join(checksDir, file))).default;
  let failures;
  try {
    failures = check.run({ repoRoot, templateDir, config });
  } catch (error) {
    if (error && error.code === "SKIP") {
      skipped++;
      console.log(`SKIP  ${check.id} — ${error.message}`);
      continue;
    }
    throw error;
  }
  if (failures.length === 0) {
    console.log(`PASS  ${check.id} — ${check.title}`);
  } else {
    failed++;
    console.log(`FAIL  ${check.id} — ${check.title}`);
    for (const failure of failures) console.log(`        ${failure}`);
  }
}

if (skipped > 0 && strict) {
  console.log(`\n${skipped} check(s) skipped and --strict was passed.`);
  process.exit(1);
}
console.log(failed === 0 ? "\nAll template integrity checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 4: Register the command**

In `package.json`, add to `"scripts"`:

```json
"check:template": "node scripts/integrity/index.js"
```

- [ ] **Step 5: Run the check and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  junk` listing exactly `.DS_Store` and `apps/web/public/.DS_Store`.

- [ ] **Step 6: Apply the repair — delete the junk**

```bash
rm -f template/.DS_Store template/apps/web/public/.DS_Store
```

- [ ] **Step 7: Harden the CLI so junk can never reach a generated app**

In `src/utils/files.ts`, immediately after the `DOTFILE_RENAMES` constant, add:

```ts
// Never copy OS/editor junk into a generated project, regardless of what is
// sitting in template/ on the packaging machine. The integrity check keeps
// template/ clean; this is the second line of defence at scaffold time.
const NEVER_COPY = new Set(['.DS_Store', 'Thumbs.db']);
```

Then in `copyTemplate`, as the first statement inside the `for (const entry of entries)` loop:

```ts
    if (NEVER_COPY.has(entry.name)) continue;
```

- [ ] **Step 8: Run the check and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  junk`.

- [ ] **Step 9: Confirm the CLI still compiles**

Run: `pnpm build`
Expected: exit 0, no TypeScript errors.

---

## Task 2: Manifest checks — script refs and nested packageManager

**Files:**
- Create: `scripts/integrity/checks/manifests.js`
- Modify: `template/package.json` (remove `structure` script)
- Modify: `template/apps/web/package.json` (remove `packageManager`)

**Interfaces:**
- Consumes: `walk` from Task 1; check module shape from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/manifests.js`:

```js
import fs from "fs";
import path from "path";

/** Pull every `scripts/...` or `./scripts/...` path out of a package.json scripts block. */
function referencedScriptPaths(pkg) {
  const refs = new Set();
  for (const command of Object.values(pkg.scripts ?? {})) {
    for (const match of command.matchAll(/(?:^|\s)\.?\/?(scripts\/[A-Za-z0-9._/-]+)/g)) refs.add(match[1]);
  }
  return [...refs];
}

export default {
  id: "manifests",
  title: "package.json script refs resolve; packageManager is declared only at root",
  run({ templateDir }) {
    const failures = [];

    // Script references must point at files that exist.
    const rootPkgPath = path.join(templateDir, "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
    for (const ref of referencedScriptPaths(rootPkg)) {
      // Bare directory refs like scripts/generate-module are resolved by node at
      // runtime against a package, not a file on disk — only check literal files.
      if (!/\.(js|mjs|cjs|sh|ts)$/.test(ref)) continue;
      if (!fs.existsSync(path.join(templateDir, ref)))
        failures.push(`template/package.json references ${ref}, which does not exist`);
    }

    // Only the root manifest may pin packageManager. A stale nested pin
    // contradicts the root and silently changes which pnpm runs.
    for (const rel of ["apps/api/package.json", "apps/web/package.json", "packages/shared/package.json"]) {
      const full = path.join(templateDir, rel);
      if (!fs.existsSync(full)) continue;
      const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
      if (pkg.packageManager)
        failures.push(`${rel} pins packageManager="${pkg.packageManager}"; only the root manifest may`);
    }

    return failures;
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  manifests` with two lines — `scripts/import-structure.sh` missing, and `apps/web/package.json` pinning `pnpm@11.1.1`.

- [ ] **Step 3: Repair — drop the dead `structure` script**

In `template/package.json`, delete this line from `"scripts"`:

```json
"structure": "bash scripts/import-structure.sh",
```

The script has never existed in the template and nothing references it.

- [ ] **Step 4: Repair — remove the nested packageManager pin**

In `template/apps/web/package.json`, delete the line:

```json
"packageManager": "pnpm@11.1.1",
```

The root manifest declares `pnpm@11.18.0`.

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  manifests`.

---

## Task 3: Placeholder-URL check

**Files:**
- Create: `scripts/integrity/checks/placeholder-urls.js`
- Modify: `template/apps/web/src/utils/metadata.ts:15`, `:37`, `:40-46`

**Interfaces:**
- Consumes: `walk` from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/placeholder-urls.js`:

```js
import path from "path";
import fs from "fs";
import { walk } from "../lib/walk.js";

/**
 * `new URL("myapp.com")` throws TypeError: Invalid URL — a one-argument URL
 * needs a scheme. Placeholders are substituted verbatim at scaffold time, so a
 * bare `{{name}}.com` inside new URL() is a guaranteed runtime crash in every
 * generated app, and generateMetadata backs nearly every page.
 *
 * ONLY the one-argument form is a defect. `new URL(path, base)` is valid and
 * idiomatic with a schemeless first argument — the base supplies the origin,
 * and `new URL("/login", request.url)` is the documented Next.js middleware
 * redirect. Flagging it would push authors to rewrite correct code.
 */
const NEW_URL_CALL = /new URL\(\s*([^)]*)\)/g;

export default {
  id: "placeholder-urls",
  title: "no single-argument new URL() on a schemeless literal",
  run({ templateDir }) {
    const failures = [];
    const roots = [path.join(templateDir, "apps/web/src"), path.join(templateDir, "apps/api/src")];
    for (const root of roots) {
      for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(NEW_URL_CALL)) {
          const args = match[1];
          // Two-argument form: the base carries the origin. Not our business.
          // A nested call means `[^)]*` truncated at the inner `)`, so the
          // trailing literal we would read belongs to the inner call, not to
          // new URL — judging it produces exactly the false positive this
          // check was rewritten to eliminate. Refuse to judge either shape.
          if (args.includes(",") || args.includes("(")) continue;
          // Take the trailing literal so `ENV.APP_URL ?? "fallback"` is judged
          // on the fallback. A non-literal argument cannot be judged statically.
          const literal = args.match(/["'`]([^"'`]+)["'`]\s*$/);
          if (!literal) continue;
          if (/^https?:\/\//.test(literal[1])) continue;
          failures.push(
            `${path.relative(templateDir, file)}: new URL("${literal[1]}") has no scheme — throws Invalid URL`,
          );
        }
      }
    }
    return failures;
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  placeholder-urls` naming `apps/web/src/utils/metadata.ts` and `new URL("{{name}}.com")`.

- [ ] **Step 3: Repair — give the fallback a scheme**

In `template/apps/web/src/utils/metadata.ts`, change line 15 from:

```ts
  const url = (await headers()).get("x-full-url") ?? ENV.APP_URL ?? "{{name}}.com";
```

to:

```ts
  const url = (await headers()).get("x-full-url") ?? ENV.APP_URL ?? "https://{{name}}.com";
```

and change the `metadataBase` line from:

```ts
    metadataBase: new URL(ENV.APP_URL ?? "{{name}}.com"),
```

to:

```ts
    metadataBase: new URL(ENV.APP_URL ?? "https://{{name}}.com"),
```

- [ ] **Step 4: Repair — drop the locale alternates that do not exist**

`template/apps/web/src/i18n/routing.ts` declares `locales: ["en"]`, so advertising `it`, `fr` and `fi` alternates points crawlers at 404s. Replace the `languages` block with:

```ts
      languages: {
        en: "/en",
      },
```

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  placeholder-urls`.

---

## Task 4: Production-version check

**Files:**
- Create: `integrity.config.json`, `scripts/integrity/lib/config.js`, `scripts/integrity/checks/production-versions.js`
- Modify: `template/versions.production.json`

**Interfaces:**
- Produces: `resolveLibraryPaths(ctx)` → `{ "@carlonicora/nestjs-neo4jsonapi": string, "@carlonicora/nextjs-jsonapi": string }` of absolute directories, or throws a `SKIP` error. Tasks 5 and Plan C's library-export check both consume this.

- [ ] **Step 1: Declare where the libraries live**

Create `integrity.config.json` at repo root:

```json
{
  "libraries": {
    "@carlonicora/nestjs-neo4jsonapi": "../wyrdli/packages/nestjs-neo4jsonapi",
    "@carlonicora/nextjs-jsonapi": "../wyrdli/packages/nextjs-jsonapi"
  }
}
```

These are the submodule checkouts the template's `packages/*` placeholders stand in for. Override per-machine with `INTEGRITY_LIB_ROOT=/path/to/repo/packages`.

- [ ] **Step 2: Write the resolver**

Create `scripts/integrity/lib/config.js`:

```js
import fs from "fs";
import path from "path";

/**
 * Resolve the two library checkouts. Checks that compare template code against
 * the real library cannot run without them. When they are absent we raise a
 * SKIP rather than a failure, so the harness stays usable on a machine that has
 * only this repo cloned — `--strict` turns skips into failures for CI.
 */
export function resolveLibraryPaths({ repoRoot, config }) {
  const override = process.env.INTEGRITY_LIB_ROOT;
  const declared = config.libraries ?? {};
  const resolved = {};

  for (const [name, rel] of Object.entries(declared)) {
    const dir = override ? path.join(override, path.basename(rel)) : path.resolve(repoRoot, rel);
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      const error = new Error(`library checkout not found for ${name} (looked in ${dir})`);
      error.code = "SKIP";
      throw error;
    }
    resolved[name] = dir;
  }

  if (Object.keys(resolved).length === 0) {
    const error = new Error("integrity.config.json declares no libraries");
    error.code = "SKIP";
    throw error;
  }
  return resolved;
}
```

- [ ] **Step 3: Write the check**

Create `scripts/integrity/checks/production-versions.js`:

```js
import fs from "fs";
import path from "path";
import { resolveLibraryPaths } from "../lib/config.js";

export default {
  id: "production-versions",
  title: "versions.production.json matches the libraries on disk",
  run(ctx) {
    const libs = resolveLibraryPaths(ctx);
    const pinnedPath = path.join(ctx.templateDir, "versions.production.json");
    const pinned = JSON.parse(fs.readFileSync(pinnedPath, "utf8"));
    const failures = [];

    for (const [name, dir] of Object.entries(libs)) {
      const actual = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
      if (pinned[name] !== actual)
        failures.push(`versions.production.json pins ${name}@${pinned[name]}, library on disk is ${actual}`);
    }
    return failures;
  },
};
```

- [ ] **Step 4: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  production-versions` — pinned `2.0.0` vs actual `3.1.0` and `3.3.8`.

- [ ] **Step 5: Repair**

Replace the contents of `template/versions.production.json` with:

```json
{
  "@carlonicora/nestjs-neo4jsonapi": "3.1.0",
  "@carlonicora/nextjs-jsonapi": "3.3.8"
}
```

- [ ] **Step 6: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  production-versions`.

---

## Task 5: Bootstrapper registration check

**Files:**
- Create: `scripts/integrity/checks/bootstrapper-modules.js`
- Modify: `template/apps/web/src/config/Bootstrapper.ts` (import block ending line 53; `allModules` object opening line 89)

**Interfaces:**
- Consumes: `resolveLibraryPaths` from Task 4, `walk` from Task 1.

This is the highest-value check in the harness. The library's own comment in
`src/features/tokenusage/tokenusage.modules.ts` states the failure mode:
*"a forgotten name is not a compile error: `FoundationModuleDefinitions` declares them all, so `Modules.X` typechecks and is `undefined` at runtime."* No compiler catches this.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/bootstrapper-modules.js`:

```js
import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";
import { resolveLibraryPaths } from "../lib/config.js";

/**
 * Comments must go before scanning. The library documents this very failure
 * mode in prose — "so `Modules.X` typechecks and is `undefined` at runtime" —
 * and a naive scan turns that sentence into a demand to register a module
 * called `X`. Stripping comments is the difference between reading code and
 * reading commentary about code.
 */
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Every `Modules.X` the library's own feature code dereferences at runtime. */
function modulesUsedByLibrary(libDir) {
  const used = new Set();
  const root = path.join(libDir, "src", "features");
  for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))) {
    const source = stripComments(fs.readFileSync(file, "utf8"));
    for (const match of source.matchAll(/\bModules\.([A-Z][A-Za-z0-9]*)/g)) used.add(match[1]);
  }
  return used;
}

/**
 * Names the template registers. Two forms appear in allModules:
 *   Foo: FooModule(moduleFactory)            -> "Foo"
 *   ...tokenUsageModules(moduleFactory)      -> resolved from the library helper
 */
function modulesRegisteredByTemplate(bootstrapperSource, libDir) {
  const registered = new Set();
  for (const match of bootstrapperSource.matchAll(/^\s{2}([A-Z][A-Za-z0-9]*)\s*:/gm)) registered.add(match[1]);

  for (const match of bootstrapperSource.matchAll(/\.\.\.\s*([a-z][A-Za-z0-9]*)\s*\(/g)) {
    const helper = match[1];
    for (const file of walk(path.join(libDir, "src")).filter((f) => f.endsWith(".ts"))) {
      const source = fs.readFileSync(file, "utf8");
      const declaration = source.match(new RegExp(`export const ${helper}\\s*=[\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)?\\s*satisfies`));
      if (!declaration) continue;
      for (const key of declaration[1].matchAll(/^\s*([A-Z][A-Za-z0-9]*)\s*:/gm)) registered.add(key[1]);
      break;
    }
  }
  return registered;
}

export default {
  id: "bootstrapper-modules",
  title: "every Modules.X the library uses is registered in the template Bootstrapper",
  run(ctx) {
    const libs = resolveLibraryPaths(ctx);
    const libDir = libs["@carlonicora/nextjs-jsonapi"];
    const bootstrapperPath = path.join(ctx.templateDir, "apps/web/src/config/Bootstrapper.ts");
    const source = fs.readFileSync(bootstrapperPath, "utf8");

    const used = modulesUsedByLibrary(libDir);
    const registered = modulesRegisteredByTemplate(source, libDir);

    return [...used]
      .filter((name) => !registered.has(name))
      .sort()
      .map((name) => `Modules.${name} is used by the library but not registered in Bootstrapper.ts (undefined at runtime)`);
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  bootstrapper-modules` listing `AiConnection` and the six `TokenUsage*` names.

- [ ] **Step 3: Repair — extend the import block**

In `template/apps/web/src/config/Bootstrapper.ts`, add BOTH `AiConnectionModule,` and `tokenUsageModules,` to the alphabetical import list from `@carlonicora/nextjs-jsonapi/core` (the block ending at line 53).

**Import `tokenUsageModules` from `/core`, NOT from `/tokenusage`.** The `/tokenusage` barrel is tsup-bundled with a single top-level `"use client"` covering the whole chunk — including this plain, non-React factory. `Bootstrapper.ts` runs on the server (`instrumentation.ts` → `@/config/env` → here), so importing it from `/tokenusage` crashes the dev server at startup with:

```
Error: Attempted to call tokenUsageModules() from the server but tokenUsageModules is on the client
```

Nothing static catches this — the symbol is exported from both subpaths, so the import resolves and typechecks. Only booting the app reveals it. `/core` re-exports the same factory without the client directive, which is what wyrdli's own Bootstrapper does.

- [ ] **Step 4: Repair — register both**

In the `allModules` object, add the AI connection entry alongside the other foundation modules:

```ts
  AiConnection: AiConnectionModule(moduleFactory),
```

and spread the token-usage bundle in as the last entry, after `Chunk: ChunkModule(moduleFactory),`:

```ts
  // One spread rather than six named entries: registration is the app's job and
  // a forgotten name is not a compile error — FoundationModuleDefinitions
  // declares all six, so Modules.X typechecks and is undefined at runtime.
  ...tokenUsageModules(moduleFactory),
```

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  bootstrapper-modules`.

---

## Task 6: Required-environment check

**Files:**
- Create: `scripts/integrity/checks/env-required.js`
- Modify: `template/env.example`

**Interfaces:**
- Consumes: check module shape from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/env-required.js`:

```js
import fs from "fs";
import path from "path";

/**
 * Keys a generated app cannot function without, each tied to a feature the
 * template ships. ENCRYPTION_KEY is not optional once the administration
 * AI-connections page exists: AiConnectionService throws
 * "ENCRYPTION_KEY is not configured — cannot store AI connection secrets".
 */
const REQUIRED = [
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_EMAIL_LOGIN",
  "NEXT_PUBLIC_REGISTRATION_MODE",
  "CREDIT_COST",
  "CREDIT_MINIMUM",
];

/** Keys that were replaced and must not linger — two switches for one behaviour. */
const RETIRED = ["ALLOW_REGISTRATION", "NEXT_PUBLIC_ALLOW_REGISTRATION"];

export default {
  id: "env-required",
  title: "env.example declares every required key and no retired one",
  run({ templateDir }) {
    const source = fs.readFileSync(path.join(templateDir, "env.example"), "utf8");
    const declared = new Set([...source.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    return [
      ...REQUIRED.filter((k) => !declared.has(k)).map((k) => `env.example is missing required key ${k}`),
      ...RETIRED.filter((k) => declared.has(k)).map((k) => `env.example still declares retired key ${k}`),
    ];
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  env-required` — missing `ENCRYPTION_KEY`, `NEXT_PUBLIC_EMAIL_LOGIN`, `CREDIT_COST`, `CREDIT_MINIMUM`; retired `ALLOW_REGISTRATION` and `NEXT_PUBLIC_ALLOW_REGISTRATION` still present.

- [ ] **Step 3: Repair — add the missing keys**

In `template/env.example`, in the security section near `TOTP_ENCRYPTION_KEY`, add:

```bash
# Symmetric key for encrypting secrets stored in the database (AI connection
# API keys). Distinct from TOTP_ENCRYPTION_KEY. Without it the administration
# AI-connections page rejects every save.
ENCRYPTION_KEY=""
```

In the auth section, beside `NEXT_PUBLIC_REGISTRATION_MODE`, add:

```bash
# Show the email/password login form. When false only federated login is offered.
NEXT_PUBLIC_EMAIL_LOGIN=false
```

In the billing section, add:

```bash
# Credit pricing for metered AI usage. CREDIT_COST is the price of one credit;
# CREDIT_MINIMUM is the smallest purchasable top-up.
CREDIT_COST=""
CREDIT_MINIMUM=""
```

- [ ] **Step 4: Repair — remove the retired switches**

Delete the `ALLOW_REGISTRATION=` and `NEXT_PUBLIC_ALLOW_REGISTRATION=` lines and their comments. `NEXT_PUBLIC_REGISTRATION_MODE` is the single switch.

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  env-required`.

---

## Task 7: Email-template check

**Files:**
- Create: `scripts/integrity/checks/email-templates.js`
- Create: `template/apps/api/templates/email/en/invitationEmail.hbs`, `template/apps/api/templates/email/en/resetEmail.hbs`

**Interfaces:**
- Consumes: check module shape from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/email-templates.js`:

```js
import fs from "fs";
import path from "path";

/**
 * Each auth route that mails the user needs its template. The routes ship in
 * the template, so a missing .hbs is a flow that silently sends nothing.
 */
const REQUIRED = {
  "activationEmail.hbs": "(auth)/activation/[code]",
  "invitationEmail.hbs": "(auth)/invitation/[code]",
  "resetEmail.hbs": "(auth)/reset/[code]",
};

export default {
  id: "email-templates",
  title: "every auth flow that mails has a template",
  run({ templateDir }) {
    const dir = path.join(templateDir, "apps/api/templates/email/en");
    return Object.entries(REQUIRED)
      .filter(([file]) => !fs.existsSync(path.join(dir, file)))
      .map(([file, route]) => `missing ${file} — route ${route} ships but sends no mail`);
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  email-templates` naming `invitationEmail.hbs` and `resetEmail.hbs`.

- [ ] **Step 3: Repair — add the invitation template**

Create `template/apps/api/templates/email/en/invitationEmail.hbs`:

```handlebars
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>You have been invited to {{display}}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
    <div style="width:100%; padding:20px; background-color:#f4f4f4;">
      <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:40px; border-radius:8px;">
        {{> header}}
        <h2 style="font-size:20px; font-weight:600; margin:24px 0 12px 0;">You have been invited</h2>
        <p style="font-size:14px; line-height:1.6; margin:0 0 24px 0;">
          {{inviterName}} has invited you to join {{companyName}} on {{display}}.
          Accept the invitation to set your password and get started.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{{url}}}invitation/{{code}}"
             style="display:inline-block; padding:12px 24px; border-radius:6px; background-color:#1a1a1a; color:#ffffff; text-decoration:none; font-size:14px;">
            Accept invitation
          </a>
        </p>
        <p style="font-size:12px; color:#666666; line-height:1.6; margin:0;">
          If the button does not work, paste this link into your browser:<br>
          {{{url}}}invitation/{{code}}
        </p>
        {{> footer}}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 4: Repair — add the reset template**

Create `template/apps/api/templates/email/en/resetEmail.hbs`:

```handlebars
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Reset your {{display}} password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
    <div style="width:100%; padding:20px; background-color:#f4f4f4;">
      <div style="max-width:600px; margin:0 auto; background-color:#ffffff; padding:40px; border-radius:8px;">
        {{> header}}
        <h2 style="font-size:20px; font-weight:600; margin:24px 0 12px 0;">Reset your password</h2>
        <p style="font-size:14px; line-height:1.6; margin:0 0 24px 0;">
          We received a request to reset the password for your {{display}} account.
          This link expires shortly. If you did not ask for it, ignore this email —
          your password will not change.
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{{url}}}reset/{{code}}"
             style="display:inline-block; padding:12px 24px; border-radius:6px; background-color:#1a1a1a; color:#ffffff; text-decoration:none; font-size:14px;">
            Choose a new password
          </a>
        </p>
        <p style="font-size:12px; color:#666666; line-height:1.6; margin:0;">
          If the button does not work, paste this link into your browser:<br>
          {{{url}}}reset/{{code}}
        </p>
        {{> footer}}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  email-templates`.

---

## Task 8: Admin-subtree gate check

**Files:**
- Create: `scripts/integrity/checks/admin-gate.js`
- Modify: `template/apps/web/src/app/[locale]/(admin)/layout.tsx`

**Interfaces:**
- Consumes: check module shape from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/admin-gate.js`:

```js
import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";

/**
 * The (admin) layout is the only thing standing between an ordinary
 * authenticated user and every administration page — the routes beneath it
 * carry no auth of their own. `isLogged()` alone is not a gate.
 */
export default {
  id: "admin-gate",
  title: "the (admin) subtree enforces the Administrator role",
  run({ templateDir }) {
    const adminRoot = path.join(templateDir, "apps/web/src/app/[locale]/(admin)");
    if (!fs.existsSync(adminRoot)) return [];

    const layoutPath = path.join(adminRoot, "layout.tsx");
    if (!fs.existsSync(layoutPath)) return ["(admin)/layout.tsx is missing — the subtree has no gate at all"];

    const layout = fs.readFileSync(layoutPath, "utf8");
    const failures = [];
    if (!/hasRole\s*\(\s*RoleId\.Administrator\s*\)/.test(layout))
      failures.push("(admin)/layout.tsx does not check ServerSession.hasRole(RoleId.Administrator)");

    // Every page under (admin) must be reachable only through that layout.
    const pages = walk(adminRoot).filter((f) => f.endsWith("page.tsx"));
    if (pages.length === 0) failures.push("(admin) contains no pages — check the path");

    return failures;
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  admin-gate` — the layout checks only `isLogged()`.

- [ ] **Step 3: Repair — import the role and the error component**

In `template/apps/web/src/app/[locale]/(admin)/layout.tsx`, add `ErrorDetails` to the existing import from `@carlonicora/nextjs-jsonapi/components`, so it reads:

```ts
import { ErrorDetails, PushNotificationProvider, RefreshUser, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
```

and add the shared-package role import beside the other imports:

```ts
import { RoleId } from "@{{name}}/shared";
```

- [ ] **Step 4: Repair — gate the subtree**

Replace the line `if (await ServerSession.isLogged())` and its opening `return (` with:

```tsx
  if (await ServerSession.isLogged()) {
    // The whole (admin) subtree is administrator-only: the routes it holds carry
    // no auth code of their own, so this gate is the only thing standing between
    // an ordinary authenticated user and every administration page.
    if (!(await ServerSession.hasRole(RoleId.Administrator)))
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <ErrorDetails code={403} message="" />
        </div>
      );

    return (
```

The tail of the function must end up exactly like this — note the added `}` closing the new `if` block, before the logged-out fallback:

```tsx
                </SidebarProvider>
              </NotificationContextProvider>
            </PushNotificationProvider>
          </CurrentUserProvider>
        </OnboardingProviderWrapper>
      </SocketProvider>
    );
  }

  return <div className="flex min-h-screen w-full flex-col items-center justify-center">{children}</div>;
}
```

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  admin-gate`.

- [ ] **Step 6: Confirm the file still parses**

Run: `node --experimental-strip-types --check "template/apps/web/src/app/[locale]/(admin)/layout.tsx" 2>/dev/null || npx tsc --noEmit --jsx preserve --allowJs false --skipLibCheck "template/apps/web/src/app/[locale]/(admin)/layout.tsx" 2>&1 | head -5`
Expected: no syntax error. Module-resolution errors are expected here (the template has no `node_modules`) and are not a failure — only a parse error is.

---

## Task 9: Orphan-module check and dead-file removal

**Files:**
- Create: `scripts/integrity/checks/orphan-modules.js`
- Delete: `template/apps/web/src/features/common/components/containers/AccountContainer.tsx`, `.../components/dialogs/DeleteAccountDialog.tsx`, `.../contexts/AccountContext.tsx`, `.../contexts/HeaderContentContext.tsx`, `.../components/badges/VisibilityBadge.tsx`, `template/apps/api/jest.config.js`

**Interfaces:**
- Consumes: `walk` from Task 1.

- [ ] **Step 1: Write the check**

Create `scripts/integrity/checks/orphan-modules.js`:

```js
import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";

/**
 * A module under features/common with no importer anywhere in the template is
 * dead weight shipped into every generated app. Entry points that are wired by
 * convention rather than by import are allowlisted.
 */
const ALLOWLIST = new Set(["index.ts", "index.tsx"]);

/**
 * Scaffolding the template ships ON PURPOSE for the generated app's author to
 * wire up. These have no importer BY DESIGN, so "no importer" does not mean
 * "dead" for them — this is the one distinction the check cannot make on its
 * own, and getting it wrong deletes a feature the template exists to provide.
 *
 * CreationDropDown is designated LIFT-AS-STUB in scripts/sync-template.js and
 * its wiring sits commented-in-place in CommonSidebar.tsx. ErrorContext is a
 * complete ErrorProvider/useErrorHandler pair meant to be mounted in the app's
 * own layout.
 *
 * Add to this list only with that same evidence: a stub designation, or
 * commented-in-place wiring showing intent.
 */
const INTENTIONAL_STUBS = new Set([
  "features/common/components/navigations/CreationDropDown.tsx",
  "features/common/contexts/ErrorContext.tsx",
]);

/**
 * Elimination is ITERATIVE. Dead code arrives in clusters: AccountContext's only
 * importer is AccountContainer, which is itself an orphan. A single pass would
 * clear AccountContainer and pronounce AccountContext live. Repeat to fixpoint.
 */
export default {
  id: "orphan-modules",
  title: "no zero-importer modules under features/common",
  run({ templateDir }) {
    const webSrc = path.join(templateDir, "apps/web/src");
    const all = walk(webSrc).filter((f) => /\.(ts|tsx)$/.test(f));
    const sources = new Map(all.map((f) => [f, fs.readFileSync(f, "utf8")]));

    const commonDir = path.join("features", "common");
    const isCandidate = (f) => f.includes(commonDir) && !ALLOWLIST.has(path.basename(f));

    const dead = new Set();
    let changed = true;

    while (changed) {
      changed = false;
      for (const file of all) {
        if (dead.has(file) || !isCandidate(file)) continue;
        const stem = path.basename(file).replace(/\.(ts|tsx)$/, "");
        // Match an import specifier ending in the stem, which is how every
        // consumer in this codebase references a module.
        const importPattern = new RegExp(`from\\s+["'\`][^"'\`]*\\b${stem}["'\`]`);
        const hasLiveImporter = [...sources].some(
          ([other, source]) => other !== file && !dead.has(other) && importPattern.test(source),
        );
        if (!hasLiveImporter) {
          dead.add(file);
          changed = true;
        }
      }
    }

    return [...dead]
      .sort()
      .map((file) => `${path.relative(templateDir, file)} has no live importer — dead code in every generated app`);
  },
};
```

- [ ] **Step 2: Run and watch it FAIL**

Run: `pnpm check:template`
Expected: `FAIL  orphan-modules` naming `AccountContainer.tsx`, `DeleteAccountDialog.tsx`, `AccountContext.tsx`, `HeaderContentContext.tsx`, `VisibilityBadge.tsx`.

Note: `SettingsNav.tsx`, `SettingsPageLayout.tsx`, `SettingsContext.tsx` and `AdminIndexContainer.tsx` will **not** appear — they still have importers, and they are removed in Plan C when the settings rail lands.

- [ ] **Step 3: Repair — delete the dead modules**

```bash
rm -f "template/apps/web/src/features/common/components/containers/AccountContainer.tsx" \
      "template/apps/web/src/features/common/components/dialogs/DeleteAccountDialog.tsx" \
      "template/apps/web/src/features/common/contexts/AccountContext.tsx" \
      "template/apps/web/src/features/common/contexts/HeaderContentContext.tsx" \
      "template/apps/web/src/features/common/components/badges/VisibilityBadge.tsx"
rmdir "template/apps/web/src/features/common/components/dialogs" \
      "template/apps/web/src/features/common/components/badges" 2>/dev/null || true
```

- [ ] **Step 4: Repair — remove the dead jest config**

`template/apps/api/package.json` declares `"test": "vitest run"` and carries no jest dependency, so the jest config is inert:

```bash
rm -f template/apps/api/jest.config.js
```

- [ ] **Step 5: Run and watch it PASS**

Run: `pnpm check:template`
Expected: `PASS  orphan-modules`.

---

## Task 10 (Verification): Full harness, build, and scaffold-and-boot

This is the only task that runs the full verification suite. Run it once, after every other task is complete.

**Files:** none created or modified.

- [ ] **Step 1: Run the whole integrity harness in strict mode**

Run: `pnpm check:template --strict`
Expected: every check `PASS`, no `SKIP`, exit 0. A `SKIP` here means `integrity.config.json` does not resolve — fix the paths rather than accepting the skip.

- [ ] **Step 2: Build the CLI**

Run: `pnpm build`
Expected: exit 0, no TypeScript errors. This compiles the `src/utils/files.ts` change from Task 1.

- [ ] **Step 3: Scaffold a throwaway app**

```bash
cd /tmp && rm -rf integrity-smoke && node /Users/carlo/Development/create-carlonicora-app/bin/cli.js integrity-smoke --skip-git
```

Expected: scaffold completes. Then confirm no junk was copied and placeholders were substituted:

```bash
find /tmp/integrity-smoke -name ".DS_Store" | wc -l          # expect 0
grep -rn "{{name}}\|{{display}}" /tmp/integrity-smoke --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | wc -l   # expect 0
```

- [ ] **Step 4: Install and typecheck the generated app**

```bash
cd /tmp/integrity-smoke && pnpm install
pnpm --filter integrity-smoke-web exec tsc --noEmit
```

Expected: install succeeds. Typecheck is expected to report the **one known error** in `SettingsContainer.tsx` — `ProductsAdminContainer` is not exported by `@carlonicora/nextjs-jsonapi/billing`. That defect is repaired in Plan C by the settings rail rewrite; any *other* error is a regression from this plan and must be fixed here.

- [ ] **Step 5: Boot the API and confirm the DI graph starts**

```bash
cd /tmp/integrity-smoke && pnpm dev:api
```

Expected: Nest boots and logs its listening port with no `UnknownDependenciesException`. Lint, build and test all pass on a Nest graph that cannot start — only booting proves the module registry is sound. Stop it with the PID you started, never a name-pattern kill.

- [ ] **Step 6: Boot the web app and open the gated routes**

```bash
cd /tmp/integrity-smoke && pnpm dev:web
```

Log in as a non-administrator and open `/administration/companies`. Expected: the 403 `ErrorDetails` page from Task 8, not the companies list. Then log in as an administrator and confirm the same route renders.

- [ ] **Step 7: Architecture audit of the diff**

Compute scope with `git status --short`. For every changed file under `template/apps/web/src/**` or `template/apps/api/src/**`, match it against the `nja-architecture` routing table and check the diff against the cited reference doc. Report each finding as:

```
SEVERITY (BLOCKING | DEFENCE-IN-DEPTH | COSMETIC)
file:line
<verbatim code>
rule: <skill doc path> § "<section>"
```

Files touched by this plan and the docs that govern them:

| File | Reference doc |
|---|---|
| `template/apps/web/src/app/[locale]/(admin)/layout.tsx` | `references/frontend/04-components.md`, `references/core-principles.md` |
| `template/apps/web/src/utils/metadata.ts` | `references/core-principles.md` |
| `template/apps/web/src/config/Bootstrapper.ts` | `references/frontend/03-services.md` (module registry feeds `EndpointCreator`) |
| `scripts/integrity/**`, `src/utils/files.ts` | Outside the routing table — CLI tooling, not app code. State this explicitly rather than citing an unrelated doc. |

The audit precedes hand-off back to the user.

- [ ] **Step 8: Clean up**

```bash
rm -rf /tmp/integrity-smoke
```

- [ ] **Step 9: Hand off — do NOT commit**

Report the check output, the typecheck result, the boot result and the audit findings. The user commits after manual verification.

---

## Sub-Agent Dispatch

Tasks 2 through 9 are independent: each creates its own check file and edits a disjoint set of template files. Task 1 must complete first — it establishes `walk`, the check module shape and the runner that every other task consumes. Task 10 runs last.

Dispatch Tasks 2–9 in parallel, one sub-agent per task, in a single message. Every sub-agent brief must include, verbatim:

> "If the plan contradicts the nja-architecture skill, the skill wins. Flag the contradiction in your hand-off summary; do not silently follow either."

Each brief must also carry: the task's full text, the Global Constraints section, and the instruction that **no sub-agent may run any git command**.

> **Session note:** this session is currently configured not to dispatch sub-agents. Either lift that for execution, or run Tasks 2–9 sequentially in dependency order — the plan is correct under both.

---

## Plan compliance check

### `references/anti-patterns.md` — walked top to bottom

| Anti-pattern (quoted) | Sections checked | Result |
|---|---|---|
| "`result.records[0]` — Returning raw Neo4j records" | All tasks | N/A — no repository code in this plan |
| "`WHERE company.id = $companyId` (manual) — Manual company filtering" | All tasks | N/A — no Cypher in this plan |
| "`SKIP ${offset} LIMIT ${limit}` — Manual pagination" | All tasks | N/A — no Cypher in this plan |
| "`{ data: { type: ..., attributes: ... } }` (manual) — Manual JSON:API construction" | Tasks 3, 5, 8 | Clean — no payload construction |
| "`fetch('/api/...')` — Using fetch() directly" | Tasks 3, 5, 8 | Clean — no network calls added |
| "`overridesJsonApiCreation: true` — Bypassing model validation" | All tasks | Clean — not used |
| "`asChild`, `<DialogContent>` as single component, `<Sub>` — Using Radix API" | Task 8 (only JSX authored) | Clean — Task 8 adds `<div>` and `<ErrorDetails>`, no trigger, no `asChild` |
| "`<PopoverTrigger><Button>` or trigger wrapping Button — Nested `<button>`" | Task 8 | Clean — no trigger component authored |
| "`someDate: { type: \"string\" }` for a calendar field" | All tasks | N/A — no descriptors |
| "`SET n.due_date = $due_date` in custom Cypher" | All tasks | N/A — no Cypher |
| "`SET n.processed_at = $processed_at` in custom Cypher" | All tasks | N/A — no Cypher |
| "`response.data.attributes.date = data.date` with `data.date: Date`" | All tasks | N/A — no models |
| "`get date(): string` on a frontend interface" | All tasks | N/A — no interfaces |
| "`@IsString()` for a date attribute on a DTO" | All tasks | N/A — no DTOs |

Frontend anti-pattern table: the only rows that can apply are "Using Radix patterns" and "Wrapping `<Button>` inside trigger components" — both checked against Task 8, the sole task authoring JSX. Clean.

### `references/frontend/04-components.md` — "RADIX → BASE UI NAMING DIFFERENCES" walked

Task 8 is the only task that writes JSX. It uses `<div>` and the package's `<ErrorDetails>`. No `asChild`, no trigger component, no floating element, so `Positioner`/`Popup` structure does not apply. No Radix names used.

### `references/frontend/05-typography.md` — "COMMON MISTAKES" walked

| Mistake (quoted) | Result |
|---|---|
| "Styled `div`/`span` doing a header's job" | Task 8's `<div>` is a centring wrapper, carries no text |
| "Raw `<h1 className=\"text-2xl font-bold\">`" | None authored |
| "Role-1 page title on a settings/admin sub-page" | None authored; noted in Global Constraints for Plan C |
| "`text-gray-500` / `text-green-600` on text" | No colour classes authored |
| "`font-mono` for IDs/amounts" | Not used |
| "Hand-rolled pastel pill" | Not used |
| "Raw `<Label className=\"text-sm\">` in a form" | No forms authored |
| "Ad-hoc `<p className=\"text-sm text-destructive\">` error" | Task 8 delegates to `<ErrorDetails>` rather than hand-rolling |
| "`underline` / `hover:underline` on a link" | No links authored |

The `.hbs` email templates in Task 7 carry inline styles because email clients strip stylesheets; they are not React and the typography roles do not reach them. Stated rather than assumed.

### `references/core-principles.md` — Decision Matrix cross-check

| Question | Required answer | Plan |
|---|---|---|
| Should I manually construct JSON:API? | NO | Does not |
| Should I write raw Cypher without `buildDefaultMatch()`? | NO | No Cypher |
| Should I use `fetch()` in frontend services? | NO | No services touched |
| Should I return `result.records` from repository? | NO | No repositories touched |
| Should I use `overridesJsonApiCreation`? | NO | Not used |

### Type signatures vs Decision Matrices

This plan introduces no entity descriptor, DTO, repository method, service method, controller route, frontend model or interface — so no signature falls under a skill Decision Matrix. The two signatures it does introduce are tooling-local and outside the routing table:

- `walk(dir, out?) => string[]` — `scripts/integrity/lib/walk.js`
- `resolveLibraryPaths({ repoRoot, config }) => Record<string, string>` — `scripts/integrity/lib/config.js`

Both are declared in the Interfaces block of the task that creates them (Tasks 1 and 4) and consumed by name in later tasks. Per nja-writing-plan rule 3, no canonical example was invented for them — they are explicitly declared out-of-scope for the routing table rather than given a fabricated citation.

### `references/date-handling.md`

Not applicable — this plan adds no field of type date or datetime, to any layer.

### Result

No contradictions surfaced. Nothing unresolved.

---

## Follow-on plans

This plan is Phase 1 of a three-plan sequence. The other two are deliberately not written yet:

- **Plan B — `compare-template` v2 and the `template-sync` skill.** Fully specifiable today; blocked only on Plan A landing, because it reuses this harness's `walk`, `resolveLibraryPaths` and check-module shape.
- **Plan C — the merge and its verification.** Should be written *after* Plan B runs at least once. Its task list is "apply the judgements the report produces"; writing it now would encode my manual audit as if it were the tool's output, which is exactly the coupling the tooling exists to remove. The parts already known from the audit — admin routes, the settings rail at `(foundations)`, the 142 i18n keys, the stale bundled skill — will be in it either way.
