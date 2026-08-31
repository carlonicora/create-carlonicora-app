# Dependency Upgrade Playbook for {{name}}-family Projects

> **Audience:** Claude (or any coding agent) executing a dependency upgrade
> sweep on a project built with the
> `@carlonicora/nestjs-neo4jsonapi` + `@carlonicora/nextjs-jsonapi` stack.
>
> **You are reading this because the user dropped this file into the
> project and asked you to upgrade dependencies.** Treat every section as
> mandatory unless explicitly marked optional. The "DECISION POINTS"
> headers mark places where you MUST stop and ask the user via the
> `AskUserQuestion` tool — do not proceed unilaterally past them.
>
> Last refined: 2026-08-09, based on the {{name}} monorepo upgrade. Each
> recommendation is paired with the concrete failure mode that taught us
> the lesson; read those failure modes before deviating.

> **2026-08-09 governance update:** shared versions live once in the
> `catalog:` block of `pnpm-workspace.yaml`; `autoInstallPeers` is off (a
> missing peer is a loud install problem, not a silent second copy); and
> `scripts/check-dep-drift.js` runs inside `pnpm lint` to enforce all of the
> invariants this guide describes — including that no override undercuts a
> declared floor. If the drift check fails, fix the drift; do not weaken the
> check.

---

## 0. TL;DR — The five rules that matter most

1. **Tag every repo (including submodules) BEFORE touching anything.** This
   is your only reliable rollback.
2. **Tests passing is NOT proof the upgrade is safe.** Unit tests usually
   mock NestJS dependency injection. The user must smoke-test
   `pnpm dev` end-to-end before you call the work done.
3. **Never bump these to the next major without explicit user approval:**
   `eslint`, `typescript`, `class-validator`, `class-transformer`,
   `reflect-metadata`, `rxjs`, `react`, `react-dom`. See §3 for why each
   is special.
4. **pnpm 11 stopped reading `pnpm.*` from `package.json`.** All
   `overrides`, `allowBuilds`, `ignoredBuiltDependencies`,
   `peerDependencyRules` must live in `pnpm-workspace.yaml`. Silently
   missing this turns overrides into no-ops, which then spawns
   dual-instance peer trees and runtime failures that look unrelated.
5. **If something looks weird in `node_modules/.pnpm/`** — e.g. two
   variants of `@nestjs/common@SAMEVERSION_class-validator@X` and
   `@nestjs/common@SAMEVERSION_class-validator@Y` — **stop and pin the
   peer.** That's the signature of an upcoming runtime DI break.

---

## 1. Project shape this guide assumes

Verify the target project matches BEFORE proceeding. If it diverges
significantly, stop and ask the user. The expected shape:

```
<repo-root>/
├── package.json                       # root, has pnpm + turbo + shared dev deps
├── pnpm-workspace.yaml                # workspace globs (and pnpm 11 config)
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json                 # shared compiler options
├── tsconfig.json                      # root project references
├── apps/
│   ├── api/                           # NestJS + Neo4j backend
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                           # Next.js frontend
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/                        # internal shared TS package
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── nestjs-neo4jsonapi/            # ← GIT SUBMODULE — published library
│   │   ├── package.json               #   peer-deps declared here matter
│   │   └── tsconfig.json
│   └── nextjs-jsonapi/                # ← GIT SUBMODULE — published library
│       ├── package.json
│       └── tsconfig.json
└── scripts/
    ├── update.sh                      # the project's ncu sweep entrypoint
    └── check-update.sh                # the dry-run variant
```

Run these preflight commands and confirm:

```bash
# Confirm clean working tree (must be empty)
git -C <repo-root> status --short

# Confirm submodules exist and check their branch
git -C <repo-root>/packages/nestjs-neo4jsonapi status --short
git -C <repo-root>/packages/nestjs-neo4jsonapi branch --show-current
git -C <repo-root>/packages/nextjs-jsonapi status --short
git -C <repo-root>/packages/nextjs-jsonapi branch --show-current

# Confirm baseline build + tests pass BEFORE you touch anything
pnpm lint
pnpm build
pnpm test
```

**DECISION POINT 1:** If the baseline already fails, STOP and ask the
user whether to fix the baseline first or proceed (you usually want to
fix the baseline first — you cannot tell upgrade-caused failures from
pre-existing ones otherwise).

---

## 2. Tag every repo for safety

This is non-negotiable. Tags are the only fast rollback.

```bash
TAG="pre-deps-update-$(date +%Y-%m-%d)"

git -C <repo-root> tag "$TAG"
git -C <repo-root>/packages/nestjs-neo4jsonapi tag "$TAG"
git -C <repo-root>/packages/nextjs-jsonapi tag "$TAG"

# Verify
git -C <repo-root> show-ref --tags "$TAG"
git -C <repo-root>/packages/nestjs-neo4jsonapi show-ref --tags "$TAG"
git -C <repo-root>/packages/nextjs-jsonapi show-ref --tags "$TAG"
```

If the project has prior `pre-deps-update-*` tags, that's a clue about
the user's preferred convention — match it. The user may also have their
own naming style (e.g. `pre-elk-radial`).

After all work is done and verified, the user can roll back any repo with:

```bash
git reset --hard "$TAG" && rm -rf node_modules pnpm-lock.yaml && pnpm install
```

---

## 3. Hold-back list — packages that MUST NOT cross a major boundary

Each entry here has been verified to break this stack when bumped. Ask the
user before crossing any of these boundaries.

### 3.1 `eslint` — keep at `^9.x`

**Why:** `@typescript-eslint` v8 (latest 8.x) advertises `eslint ^10.0.0`
in its peer ranges, but its transitive `@typescript-eslint/utils@8.49.0`
crashes at runtime with
`TypeError: Class extends value undefined is not a constructor or null`
on `FlatESLint` — ESLint 10 removed/relocated the `FlatESLint` export.

**Unblock condition:** wait for a `@typescript-eslint` release that
supports ESLint 10 in actual runtime (not just peer ranges). Verify by
running ESLint directly against a TS file before bumping the whole repo.

**Pinned in:** root, apps/api, apps/web `devDependencies`. The libraries
(nestjs-neo4jsonapi, nextjs-jsonapi) pin their own copies inside the
submodule package.jsons.

### 3.2 `typescript` — on `^6.0.x` (migration done)

**Status:** the template is on TypeScript 6 with **no**
`ignoreDeprecations` hatch. The three deprecations TS 6 turned into hard
errors were each fixed at the source:

- **`alwaysStrict`** — the explicit `true`/`false` settings were removed.
  `alwaysStrict` defaults to the value of `strict`, so every config now
  inherits it and resolves exactly as before. Note the order matters: if
  the base sets `alwaysStrict: true`, deleting only an app's `false`
  override silently flips that app to `true`. Remove the base's first, and
  confirm with `tsc --showConfig`.
- **`baseUrl`** — gone from every config. Each `paths` target now starts
  with `./` and resolves relative to the tsconfig that declares it.
  Re-verify against the EMITTED `dist`, not just `--noEmit`: `nest build`
  rewrites path aliases, so a mistake here shows up as an unrewritten
  `require("src/…")` in the output rather than as a type error.
- **`moduleResolution: node10`** — the base is now `module: nodenext` +
  `moduleResolution: nodenext`.

**A correction to earlier guidance in this file:** the backend does *not*
need `.js` extensions on every relative import. `apps/api` stays
CommonJS (no `"type": "module"`), and `nodenext` models Node's
`require(esm)` — so it imports the ESM-only `@nestjs/*` v12 packages with
zero `TS1479`. The real cost of the migration was `import type` on a
handful of type-only symbols used in decorated method signatures
(`TS1272`), not a whole-tree rewrite.

`nodenext` also honours each package's `exports` map, which is why the
deep-subpath `paths` mappings that `node10` needed (`@langchain/*`) are
gone. Deep imports that remain are declared inside the ambient shim at
`apps/api/src/types/langchain.d.ts`, which needs no resolution.

**Watch out for `TS5011`:** TS 6 requires `rootDir` to be explicit
whenever `outDir` is set. Without it `tsc` emits `dist/src/main.js`
instead of a flat `dist/main.js` — and it still **emits** despite the
diagnostic, so a broken layout is left behind silently and
`node dist/main` fails at runtime.

**Pinned in:** root `devDependencies` and **the
`pnpm-workspace.yaml` `overrides` block** (overrides are necessary
because transitives like `tsup` resolve typescript independently).

**TypeScript 7 is not yet possible** — and not because of this codebase.
`typescript@7` deleted the JavaScript compiler API, so `@typescript-eslint`
(peer `<6.1.0`, tracking issue open and "blocked by external API") and
`tsup`'s `--dts` cannot load it. The unblock is TypeScript **7.1**, which
is to ship the stable programmatic API. Microsoft publishes
`@typescript/typescript6` as a compat shim for tools that need the old API
in the meantime.

### 3.3 `class-validator` — keep at `^0.14.x`

**Why:** This is the single most important pin in the entire upgrade.
`class-validator` is part of `@nestjs/common`'s peer fingerprint. If
your app resolves `class-validator@0.15.x` but the
`nestjs-neo4jsonapi` submodule's `package.json` still lists
`class-validator: ^0.14.3` as a dependency, pnpm creates **two
parallel `@nestjs/common@11.1.x` resolutions** in `.pnpm/`:

```
node_modules/.pnpm/
  @nestjs+common@11.1.19_class-transformer@0.5.1_class-validator@0.14.4_…
  @nestjs+common@11.1.19_class-transformer@0.5.1_class-validator@0.15.1_…
```

NestJS DI is class-identity-based. Modules registered against one copy
of `@nestjs/common` are **invisible** to services resolved through the
other. The failure mode is at runtime:

```
UnknownDependenciesException: Nest can't resolve dependencies of the
DiscordEchoService (?). Please make sure that the argument
ConfigService at index [0] is available in the DiscordEchoModule
module.
```

even though `ConfigModule.forRoot({ isGlobal: true })` is correctly
configured. **Unit tests pass** because they mock `ConfigService`.

**How to detect** (run after every install):
```bash
ls node_modules/.pnpm | grep -E "^@nestjs\+(common|core)@" | sort -u
```
If you see more than one variant of the SAME version, you have a peer
fingerprint conflict.

**Pin in:** `pnpm-workspace.yaml` overrides — and match whatever range the
submodule currently declares (read `packages/nestjs-neo4jsonapi/package.json`;
do NOT trust any version number written in this guide). The invariant is
lockstep with the submodule, not a specific version.

### 3.4 `class-transformer`, `rxjs`, `reflect-metadata`

Same reasoning as `class-validator`. These are all part of the
`@nestjs/common` peer fingerprint. If you bump any of them past what the
submodule library declares, you'll spawn duplicate `@nestjs/common`
instances and break DI at runtime.

**How to find the library's current pins:** read
`packages/nestjs-neo4jsonapi/package.json` and grep its `dependencies`
block. Whatever versions appear there are the floor; the app should be
in the same major.

### 3.5 `react`, `react-dom` — match what `nextjs-jsonapi` expects

**Why:** Same shape of bug as class-validator, applied to the frontend.
React is part of `react-hook-form`, `@hookform/resolvers`, and the JSX
runtime's peer fingerprint. If `apps/web` resolves `react@19.2.6` while
the `nextjs-jsonapi` library resolves `react@19.2.4`, you get two
parallel `react-hook-form` instances with different `UseFormReturn<T>`
types. Build fails with:

```
Type 'UseFormReturn<{ id: string; image: string; name?: string; }, …>'
is not assignable to type 'UseFormReturn<{ id?: string; image?: string;
name?: string; }>'.
```

The error message is about form types, but the real cause is the React
duplication.

**How to detect:**
```bash
readlink apps/web/node_modules/react
readlink packages/nextjs-jsonapi/node_modules/react
# Both should point to the same .pnpm directory.
```

**Pin ONCE in the `catalog:` block of `pnpm-workspace.yaml`** (exact version,
not caret), and have both `apps/web` and the `overrides:` block reference it
as `'catalog:'`. One catalog entry then moves the declared range and the
forced resolution together, so they cannot drift apart.

### 3.6 `@types/react`, `@types/react-dom`

Same reasoning. The library and app must see the same types. Pin in
`pnpm-workspace.yaml` overrides.

### 3.7 `@nestjs/*`

All NestJS packages must stay on the same minor as
`nestjs-neo4jsonapi`'s peer. Mismatched `@nestjs/core` ↔ `@nestjs/common`
also breaks DI. The versions live ONCE in the `catalog:` block of `pnpm-workspace.yaml`
(kept equal to the submodule's peer floors), and both `apps/api` and the
`overrides:` block reference them as `'catalog:'`:
```yaml
catalog:
  '@nestjs/common': ^11.1.28   # = the submodule's current peer floor
  # ...core, config, platform-fastify, platform-socket.io, websockets
overrides:
  '@nestjs/common': 'catalog:'
  # ...same for the other five
```
CRITICAL: a pnpm override REPLACES every declared range — it does not
intersect. An override carrying a literal that is lower than what the
manifests declare silently resolves BELOW the declared floor with no peer
warning. That is why these overrides must reference the catalog instead of
repeating literals, and why `scripts/check-dep-drift.js` (which runs inside
`pnpm lint`) checks every override directionally against every declared
range. When the submodule raises its peer floors, bump the catalog entry —
the drift check will refuse to pass until you do.

### 3.8 Anything else listed as `dependencies` in either submodule

Open `packages/nestjs-neo4jsonapi/package.json` and
`packages/nextjs-jsonapi/package.json`. Anything in their `dependencies`
or `peerDependencies` blocks should be kept on the same major as the
library — bumping past it risks the dual-instance bug if the package
participates in any framework's peer fingerprint.

---

## 4. The bump procedure

### 4.1 Confirm the project's update scripts cover all workspaces

Look at `scripts/update.sh` (or equivalent). It should `cd` into every
workspace package and run `ncu -u && pnpm install` in each. **If it
skips the submodule packages, extend it** — drift in those libraries
silently rots over time.

The template, for reference:

```bash
#!/bin/bash
# Update all dependencies in the monorepo

ncu -u
pnpm install

cd apps/api
ncu -u
pnpm install

cd ../web
ncu -u
pnpm install

cd ../../packages/shared
ncu -u
pnpm install

cd ../nestjs-neo4jsonapi
ncu -u
pnpm install

cd ../nextjs-jsonapi
ncu -u
pnpm install

cd ../../
```

The `check-update.sh` variant uses `ncu` (without `-u`) for a dry run.

### 4.2 Run the dry-run first

```bash
bash scripts/check-update.sh
```

Read the output. **For every package on the hold-back list (§3), the
user must explicitly approve** any major bump before you proceed. Show
the user the proposed bumps and use `AskUserQuestion` to confirm.

**DECISION POINT 2:** If `check-update` proposes bumping any hold-back
package past its current major, ask the user before running `update.sh`.
The pragmatic flow: run `update.sh`, then revert the hold-back bumps
after, rather than trying to filter ncu's output.

### 4.3 Run the actual sweep

```bash
bash scripts/update.sh
```

**Expect these install errors during the sweep** — they are not
failures, they are pnpm's safety prompts:

- `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]` — pnpm wants TTY
  confirmation to wipe node_modules. The script's per-directory
  `pnpm install` calls hit this and that's fine; do one final install
  at root with `CI=true` after the sweep:
  ```bash
  CI=true pnpm install --no-frozen-lockfile
  ```

- `[ERR_PNPM_LOCKFILE_CONFIG_MISMATCH]` — overrides changed since the
  lockfile was generated. Add `--no-frozen-lockfile`.

### 4.4 Revert the hold-back bumps

After the sweep, `ncu` will have happily bumped `eslint`, `typescript`,
`class-validator`, `react`, etc. to their latest. Revert those edits in
each affected `package.json`:

```
# Reverts to do in each package.json the sweep touched:
eslint:          ^10.x.x   →   ^9.39.2
@eslint/js:      ^10.x.x   →   ^9.39.2
typescript:      ^6.x.x    →   ^5.9.3
class-validator: ^0.15.x   →   ^0.14.3
react:           19.2.6    →   19.2.4
react-dom:       19.2.6    →   19.2.4
```

Also revert `packageManager` if it was bumped to a major you're not
ready for (see §6 if upgrading to pnpm 11; otherwise revert).

### 4.5 Reinstall

```bash
CI=true pnpm install --no-frozen-lockfile
```

Verify with:

```bash
ls node_modules/.pnpm | grep -E "^@nestjs\+(common|core)@" | sort -u
ls node_modules/.pnpm | grep -E "^react@" | sort -u
ls node_modules/.pnpm | grep -E "^class-validator@" | sort -u
readlink apps/web/node_modules/react
readlink packages/nextjs-jsonapi/node_modules/react
readlink apps/api/node_modules/@nestjs/common
readlink packages/nestjs-neo4jsonapi/node_modules/@nestjs/common
```

For each pair of `readlink`s above, **the two paths MUST be identical**.
If they're not, an override isn't taking effect — go to §5.6 / §7.

---

## 5. Reconcile peerDependencies in submodules

After the apps bump, the submodule libraries may have peer-dep ranges
that no longer match the apps' new versions. Check each:

```bash
# Open the submodule package.json
cat packages/nestjs-neo4jsonapi/package.json | jq .peerDependencies
cat packages/nextjs-jsonapi/package.json | jq .peerDependencies
```

For each peer:
- If apps stayed in the declared range: no change.
- If apps moved to a new major (e.g. `@fastify/multipart ^9 → ^10`):
  bump the library's peer range to match.

**Edit the submodule's `package.json` in-place** (you're inside a git
submodule worktree, so the change shows as dirty inside the submodule
repo). The user will commit + push these inside the submodule later
(§9).

**Run `pnpm peers check` after every install** to spot anything else.
Most warnings come from third-party packages with stale ranges and are
non-blocking; flag any that mention `@nestjs/*` or the libraries.

---

## 6. pnpm 11 migration (do this only if user wants pnpm 11)

This is a separate sub-procedure. Only run it if the user explicitly
asks for pnpm 11; the rest of the upgrade works fine on pnpm 10.

### 6.1 What changed in pnpm 11

1. `pnpm install` no longer treats ignored build scripts as a warning —
   it errors. Without an `allowBuilds` config, every `pnpm <script>` in
   the repo fails because turbo's deps-status precheck runs
   `pnpm install` first.
2. **pnpm 11 stopped reading `pnpm.*` fields from `package.json`.** All
   config must move to `pnpm-workspace.yaml`. The fields that need
   moving: `overrides`, `ignoredBuiltDependencies`,
   `peerDependencyRules`, `patchedDependencies`.
3. **`onlyBuiltDependencies` (list of strings) was replaced by
   `allowBuilds` (map of `pkg: true|false`)** in
   `pnpm-workspace.yaml`. On the first install, pnpm 11 will write a
   stub `allowBuilds:` block with placeholder strings like
   `"set this to true or false"` — those placeholders must be replaced
   with actual booleans before re-running install.

### 6.2 Migration steps

1. Bump `packageManager` in root `package.json` and any other workspace
   that declares it (e.g. `apps/web`) from `pnpm@10.x.x` to
   `pnpm@11.1.1` (or the latest 11.x).

2. **Move all `pnpm.*` keys from `package.json` to
   `pnpm-workspace.yaml`.** Example:

   Before (`package.json`):
   ```json
   "pnpm": {
     "overrides": {
       "react": "19.2.4",
       "class-validator": "^0.14.3"
     },
     "onlyBuiltDependencies": ["sharp", "bcrypt", "esbuild", "..."],
     "ignoredBuiltDependencies": ["@tensorflow/tfjs-node", "canvas"],
     "peerDependencyRules": {
       "allowAny": ["@nestjs/*"]
     }
   }
   ```

   After (`pnpm-workspace.yaml`):
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'

   overrides:
     react: 19.2.4
     class-validator: ^0.14.3

   allowBuilds:
     sharp: true
     bcrypt: true
     esbuild: true
     # …
     # set false for any package whose install script fails on this
     # machine (e.g. node-crc which needs rustc ≥1.88)
     node-crc: false

   ignoredBuiltDependencies:
     - '@tensorflow/tfjs-node'
     - canvas

   peerDependencyRules:
     allowAny:
       - '@nestjs/*'
   ```

   And the entire `pnpm` block in root `package.json` should be
   **removed**.

3. Reinstall:
   ```bash
   CI=true pnpm install --no-frozen-lockfile
   ```

4. If pnpm 11 wrote a stub `allowBuilds:` block with placeholder
   strings (it will, on first install), edit it to set each package to
   `true` (approved to run install scripts) or `false` (ignored).
   Reinstall again.

5. **Verify overrides take effect** with the readlink commands from
   §4.5. This is essential — if overrides silently no-op'd because you
   missed migrating them, dual-instance bugs will appear later.

### 6.3 Don't forget the `engines.pnpm` constraint

If `package.json` has `engines.pnpm: ">=10.0.0"`, bump it to
`">=11.0.0"`.

---

## 7. The dual-instance peer-fingerprint failure (most likely landmine)

Worth its own section because this is the #1 hidden hazard.

### 7.1 Symptoms

- Backend: `UnknownDependenciesException` at startup for a service
  whose module is `@Global()` and whose dependency comes from another
  `@Global()` module (e.g. `ConfigService`). Tests pass.
- Frontend: Build fails with a `UseFormReturn`,
  `UseFormSetValue`, or similar form/JSX type mismatch in a file that
  uses both an app-defined hook and a library-exported component. Lint
  and dev compilation may pass; production type check fails.
- Both: `pnpm peers check` may show no errors. The bug is silent in pnpm.

### 7.2 Detection

```bash
# Run after every install. Each command should print a SINGLE line
# (one resolution per package). Multiple lines = duplicate.
ls node_modules/.pnpm | grep -E "^@nestjs\+common@" | sort -u
ls node_modules/.pnpm | grep -E "^@nestjs\+core@"   | sort -u
ls node_modules/.pnpm | grep -E "^react@"           | sort -u
ls node_modules/.pnpm | grep -E "^react-dom@"       | sort -u
ls node_modules/.pnpm | grep -E "^class-validator@" | sort -u
ls node_modules/.pnpm | grep -E "^class-transformer@" | sort -u
```

If a package appears twice (e.g. `react@19.2.4` AND `react@19.2.6`),
inspect what each consumer links to:

```bash
readlink apps/web/node_modules/react
readlink packages/nextjs-jsonapi/node_modules/react
readlink packages/nestjs-neo4jsonapi/node_modules/@nestjs/common
readlink apps/api/node_modules/@nestjs/common
```

The two paths in each pair MUST point to the same `.pnpm/`
subdirectory. If they don't, you have a real duplicate that will break
at runtime.

### 7.3 Fix

Add an exact-version override in `pnpm-workspace.yaml` (pnpm 11) or
`package.json` `pnpm.overrides` (pnpm 10) forcing the package to the
version the library expects. Reinstall.

After fix, the stale variant may linger in `.pnpm/` as an orphan
(harmless — nothing symlinks to it). If you want to fully clean:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**DECISION POINT 3:** Removing `pnpm-lock.yaml` regenerates resolutions
from scratch. Minor transitive versions may drift. Always rename to
`.bak` first (`mv pnpm-lock.yaml pnpm-lock.yaml.bak`) and ask the user
before deleting, so they can diff or restore. The sandbox will often
deny `rm -rf` of `node_modules` — give the user the exact command to
paste into their shell.

---

## 8. The full verification chain (do not skip)

After install completes cleanly, run these in order. **Do not mark the
upgrade complete until all four pass.**

### 8.1 Lint

```bash
pnpm lint
```

Pre-existing warnings (unused-vars, etc.) are fine. Any ERROR is a stop.

### 8.2 Build

```bash
pnpm build
```

Build is where type-mismatch issues from peer duplication surface most
visibly (see §7).

### 8.3 Test

```bash
pnpm test
```

Tests are necessary but not sufficient. They mock DI and won't catch
the dual-instance NestJS bug. Their passing is a baseline, not a green
light.

### 8.4 Dev smoke test — CRITICAL

**Tell the user**: "Please run `pnpm dev` and smoke-test the app
end-to-end. Click through login, the main flows, anything that
exercises real NestJS DI. Discord interactions, recording, or any
queue-driven flow are especially worth exercising. Report any console
errors."

**Wait for explicit user confirmation** before continuing. Possible
follow-up errors and their resolutions:

- `UnknownDependenciesException` → §7 (peer fingerprint duplicate).
- Next.js error: "Cross-origin access to Next.js dev resources is
  blocked by default" → add the dev host to `allowedDevOrigins` in
  `apps/web/next.config.js`. Example: `allowedDevOrigins: ["{{name}}.test"]`.
  (This is project-specific; ask the user for their dev host.)
- Any module DI error at startup → §7.

**DECISION POINT 4:** If dev smoke test fails, isolate to one of the
known failure modes (§5/§7) and present options to the user. Do not
guess.

---

## 9. Commit and tag

### 9.1 Sequence (important — submodules first)

```bash
# Submodule 1
cd packages/nestjs-neo4jsonapi
git add package.json    # peer dep bumps only — never touch dist/
git commit -m "chore(deps): bump <pkg> peer to <new range>"
cd ../..

# Submodule 2 (only if it has changes)
cd packages/nextjs-jsonapi
git add package.json
git commit -m "chore(deps): <message>"
cd ../..

# Superproject
git add package.json apps/api/package.json apps/web/package.json \
        apps/web/next.config.js packages/shared/package.json \
        packages/nestjs-neo4jsonapi packages/nextjs-jsonapi \
        pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "chore(deps): <month> <year> update sweep"
```

**Never include `pnpm-lock.yaml.bak`** in any commit. Add to `.gitignore`
if the user uses backups regularly.

### 9.2 Commit message body

For the superproject, include a body with:
- Major bumps held back (and why)
- Any peer fingerprint pins added (class-validator, react, etc.)
- The rollback tag name

Example template:
```
chore(deps): May 2026 update sweep

Bulk-updated dependencies. Three majors held back:
- pnpm: kept at ^10.28.2 (turn-everything-into-errors regression)
- eslint: kept at ^9.39.2 (@typescript-eslint v8 not ESLint-10-ready)
- typescript: on ^6.0.3 (TS 6 migration complete — see §3.2)

class-validator pinned to ^0.14.3 to keep @nestjs/common single-resolution.

Rollback point: tag pre-deps-update-2026-05-13 (all three repos).
```

### 9.3 DO NOT push without user approval

Pushes (especially of submodules) are a separate user decision. When
the user is ready, the correct order is:

1. `git push origin <branch> && git push origin <tag>` in each
   submodule (the superproject points at a SHA — that SHA MUST exist
   on the submodule's remote first).
2. Then `git push origin <branch> && git push origin <tag>` in the
   superproject.

If you push the superproject first, anyone fetching it will see a
submodule pointer they can't resolve.

---

## 10. Document deferred work

After the sweep, update `scripts/update.sh` with a `DEFERRED MAJOR
BUMPS` comment header at the top, listing every pin in §3 with:
- The package + the kept version
- Why it's pinned (the failure mode in one sentence)
- The condition that would let you unblock it

Template:

```bash
#!/bin/bash
# Update all dependencies in the monorepo
#
# DEFERRED MAJOR BUMPS — last reviewed: YYYY-MM-DD
#
# - eslint  ^9.39.2  (root + apps/api + apps/web)
#     Why: @typescript-eslint v8 transitively loads utils@8.49.0 which
#          crashes on ESLint 10 (FlatESLint removed/relocated).
#     Unblock: wait for typescript-eslint to ship a release whose
#          runtime (not just peer ranges) supports ESLint 10.
#
# - typescript 7 (typescript is on ^6.0.3; 6 is done, see §3.2)
#     Why: typescript@7 removed the JS compiler API, so @typescript-eslint
#          and tsup's --dts cannot load it.
#     Unblock: TypeScript 7.1 (stable programmatic API).
#
# Sanity-check current latest before retry:
#   pnpm view eslint version
#   pnpm view typescript version
#   pnpm view @typescript-eslint/parser peerDependencies

ncu -u
pnpm install
# … rest of script …
```

---

## 11. Quick reference — file templates

### 11.1 `pnpm-workspace.yaml` (pnpm 11)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

overrides:
  # peer-fingerprint pins (NEVER remove without re-running §7 checks)
  react: 19.2.4
  react-dom: 19.2.4
  '@types/react': 19.2.7
  '@types/react-dom': 19.2.3
  class-validator: ^0.14.3
  typescript: ^5.9.3
  '@nestjs/common': ^11.1.13
  '@nestjs/config': ^4.0.3
  '@nestjs/core': ^11.1.13
  '@nestjs/platform-fastify': ^11.1.13
  '@nestjs/platform-socket.io': ^11.1.13
  '@nestjs/websockets': ^11.1.13
  # project-specific:
  yjs: ^13.6.27
  validator: '>=13.15.20'
  sharp: ^0.33.5
  jotai: ^2.17.1

allowBuilds:
  '@nestjs/core': true
  '@parcel/watcher': true
  '@scarf/scarf': true
  '@swc/core': true
  bcrypt: true
  cpu-features: true
  esbuild: true
  msgpackr-extract: true
  msw: true
  necord: true
  protobufjs: true
  sharp: true
  ssh2: true
  tesseract.js: true
  unrs-resolver: true
  # set to false for packages whose native build fails on this machine:
  node-crc: false   # needs rustc ≥1.88 (system at 1.86)

ignoredBuiltDependencies:
  - '@tensorflow/tfjs-node'
  - canvas
  - core-js

peerDependencyRules:
  allowAny:
    - '@nestjs/*'
    - reflect-metadata
    - discord-api-types
```

### 11.2 `pnpm-workspace.yaml` (pnpm 10 — legacy)

If staying on pnpm 10, the same data lives in `package.json` under
`"pnpm": { ... }` instead. Mirror the same fields, with
`onlyBuiltDependencies` as a list (not the `allowBuilds` map).

---

## 12. Gotchas cheat sheet

| Symptom | Likely cause | Section |
|---|---|---|
| `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]` | No TTY for confirmation | Use `CI=true` |
| `[ERR_PNPM_LOCKFILE_CONFIG_MISMATCH]` | Lockfile predates overrides change | Add `--no-frozen-lockfile` |
| `[ERR_PNPM_IGNORED_BUILDS]` (pnpm 11) | `allowBuilds` not configured | §6.2 |
| Lint dies with `FlatESLint` undefined | Tried ESLint 10 | Revert to ^9, §3.1 |
| Build dies with TS5101 / TS5107 | Tried TS 6 with deprecated tsconfig opts | §3.2, §7 |
| `UnknownDependenciesException` at startup | Two `@nestjs/common` instances | §3.3, §7 |
| Build: `UseFormReturn` type mismatch | Two `react` instances | §3.5, §7 |
| Build seems to use a version you reverted | Stale lockfile transitive | Full clean install, §7.3 |
| Override declared but not applied | pnpm 11 reading wrong config location | §6.1 |
| Submodule shows dirty after install | pnpm install rewrote submodule's lockfile or package.json | Inspect diff; usually you edited it; commit inside submodule |
| Next.js dev: "Cross-origin access … blocked" | Need to allow dev host | §8.4 |
| `pnpm-workspace.yaml` has weird `allowBuilds:` placeholder strings | pnpm 11 wrote a stub on first install | §6.2 step 4 |
| Native build fails (e.g. rustc too old) | Underlying toolchain issue | Set the package to `false` in `allowBuilds`, move to `ignoredBuiltDependencies` |

---

## 13. What this guide deliberately does NOT cover

- **The TypeScript 7 migration.** TS 6 is already done (§3.2). TS 7 is
  blocked on `@typescript-eslint` and `tsup`, not on this codebase, and
  will be a dedicated effort rather than a step inside a dep sweep.
- **Replacing the libraries.** This guide assumes you're staying on
  `@carlonicora/nestjs-neo4jsonapi` and `@carlonicora/nextjs-jsonapi`.
  If you're migrating off, the peer-fingerprint pins become moot.
- **Upgrading the database driver, Node.js, or pnpm to a major beyond
  11.** Out of scope here.

---

## 14. Final checklist for the agent

Before reporting the upgrade complete, confirm all of these:

- [ ] Safety tag created in all three repos (root + both submodules)
- [ ] Hold-back packages (§3) verified at intended versions
- [ ] `node_modules/.pnpm/` has single resolution per critical peer
      (§7.2 checks)
- [ ] `readlink` checks confirm app and library see same `react` and
      same `@nestjs/common`
- [ ] `pnpm lint` exits 0 (warnings OK)
- [ ] `pnpm build` exits 0
- [ ] `pnpm test` exits 0
- [ ] **User confirmed `pnpm dev` smoke test passed**
- [ ] Submodule peer-dep changes committed inside the submodule (not
      lost)
- [ ] Superproject pointer to submodule SHA(s) is updated and committed
- [ ] `scripts/update.sh` DEFERRED block updated with current date and
      remaining holds
- [ ] No `pnpm-lock.yaml.bak` or other temp files staged
- [ ] User has the exact `git push` sequence for submodules-first (§9.3)

When all are checked, summarize:
1. What was bumped (top-level).
2. What was held back and why (one-liner each, link §3).
3. The rollback tag name.
4. Any unpushed commits and the recommended push order.

---

*End of playbook. If anything in this guide turns out to be wrong in
practice, update it before closing out the session — future agents
will rely on it.*
