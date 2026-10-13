---
title: Contributing
section: 08-workflow
---

How a change gets from a working tree into `dev`: the branch it starts on, the
commit message that decides the next version number, the two git hooks that run
before it leaves the machine, and the two GitHub workflows that run after.

## Tooling floors

`package.json` declares them and `preinstall` enforces the package manager:

| Requirement | Value | Declared in |
|---|---|---|
| Node | `>=22.0.0` | `package.json` `engines` |
| pnpm | `>=11.0.0` | `package.json` `engines` |
| Pinned package manager | `pnpm@11.24.0` | `package.json` `packageManager` |
| npm/yarn refused | `npx only-allow pnpm` | `package.json` `preinstall` |

`apps/api/package.json` and `apps/web/package.json` each pin `engines.node` to
`22` exactly. Both `@carlonicora/*` directories are git submodules declared in
`.gitmodules`; `pnpm install` fails fast without them, because
`scripts/check-dep-drift.js` exits 1 when either `package.json` is missing.

## Branching

`.releaserc` declares exactly one release branch:

```json
"branches": [{ "name": "dev" }]
```

`dev` is the trunk. Branch off it, open the pull request back into it. Nothing
else releases, and no other branch is configured anywhere in the repository —
the `check-library-updates` workflow also targets `base: dev`.

## Commits

Conventional commits, classified by `@semantic-release/commit-analyzer` with the
`conventionalcommits` preset. `.releaserc` overrides the preset with an explicit
`releaseRules` list, and that list is the real contract:

| Commit | Release |
|---|---|
| Any commit with a breaking-change marker | major |
| `feat:` | minor |
| `fix:` `docs:` `style:` `refactor:` `test:` `build:` `ci:` `chore:` `perf:` | patch |
| `wip:` | none |
| Any type, with `[skip release]` in the subject | none |

The consequence is worth stating plainly: **every type this repository uses
except `wip` ships a release.** A `chore:` or a `docs:` commit merged to `dev`
bumps the patch version, writes `CHANGELOG.md`, tags `v<version>` and pushes.
Use `wip:` for work that must land without a version, or put `[skip release]` in
the subject line.

The release notes group the same types under headed sections
(`🚀 Features`, `🐛 Bug Fixes`, `📚 Documentation`, `💎 Styles`,
`📦 Code Refactoring`, `🚨 Tests`, `🛠 Build System`,
`⚙️ Continuous Integration`, `♻️ Chores`, `⚡ Performance Improvements`), all
listed in the `release-notes-generator` block of `.releaserc`.

A type the `releaseRules` list does not name falls through to the preset's own
defaults rather than to "no release". Stick to the ten types above.

## The local gates

Two hooks, installed by `husky` through the root `prepare` script.

| Hook | File | Runs |
|---|---|---|
| pre-commit | `.husky/pre-commit` | `pnpm lint` |
| pre-push | `.husky/pre-push` | `pnpm build`, then `pnpm test` |

### `pnpm lint`

```
turbo run lint && node scripts/check-dep-drift.js
```

`turbo run lint` fans out to every workspace that declares a `lint` script:

| Workspace | `lint` |
|---|---|
| `apps/api` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` |
| `apps/web` | `eslint .` then `pnpm validate-translations` |
| `packages/nestjs-neo4jsonapi` | its own eslint run |
| `packages/nextjs-jsonapi` | its own eslint run, plus an RTL class check |
| `packages/shared` | no `lint` script — silently skipped |

Two details that surprise people:

- `apps/web`'s `lint` does more than lint. `pnpm validate-translations` runs
  `apps/web/scripts/validate-translations.mjs`, which scans `apps/web/src` and
  both package trees for `useTranslations()`, `getTranslations()` and `t()`
  calls and fails when a key is missing from `apps/web/messages/en.json`. A
  missing translation key is a lint failure, not a runtime warning.
- `apps/api`'s `lint` carries `--fix`, so the pre-commit hook can rewrite files
  after you staged them. Re-check `git diff` after a hook run that reformatted
  something.

`scripts/check-dep-drift.js` then enforces five workspace invariants: apps
provide every non-optional peer of the workspace library they consume; a
dependency declared by both an app and a library uses an identical range; a
devDependency declared in two or more manifests uses an identical range;
`pnpm-workspace.yaml` overrides never undercut a declared floor; and
`versions.production.json` matches the workspace packages' versions. Any
violation exits 1 and takes `pnpm lint` down with it.

### `pnpm build` and `pnpm test`

Both are `turbo run` fan-outs (`turbo.json`). `build` depends on `^build`, so
the two framework packages and `packages/shared` compile before the apps.

`pnpm build` on the pre-push hook is the single most common way to break a
running dev server: `next build` and `next dev` share one output directory under
`apps/web`.
`scripts/dev.sh` detects the damage and repairs it on the next `pnpm dev`, but
the running server 404s until you restart it. See the known-traps page.

## Pull requests

`.github/workflows/pull-request.yml` runs on `opened` and `synchronize`:

1. Checkout with `fetch-depth: 0`, pnpm, Node 22, pnpm cache.
2. **Strip the submodules from the workspace** —
   `sed -i '/nestjs-neo4jsonapi/d; /nextjs-jsonapi/d' pnpm-workspace.yaml` —
   then `node scripts/apply-production-versions.js` and
   `pnpm install --no-frozen-lockfile`.
3. Write a throwaway .env file with three `NEXT_PUBLIC_*` values.
4. Build `@{{name}}/shared`, then `{{name}}-api`, then `{{name}}-web`, each with
   `NODE_OPTIONS: --max-old-space-size=4096`.
5. `pnpm test`.

Step 2 matters more than it looks: **CI does not build against the submodules.**
It builds against the published npm releases named in
`versions.production.json`. A change that works locally against a newer
submodule can fail CI against the pinned release, and the reverse. `Dockerfile`
does the same substitution, so production matches CI, not your working tree.

CI does not run `pnpm lint`, and it does not run the Playwright suite. Both are
local gates only.

## Release

`.github/workflows/dev.yml` runs on every push to `dev`. Same install and build
steps, `NODE_OPTIONS: --max-old-space-size=6144`, then `pnpm test`, then
`pnpm dlx semantic-release` with `HUSKY: "0"` so the release commit does not
re-trigger the hooks.

`.releaserc` then, in order: analyses commits, generates notes, writes
`CHANGELOG.md`, skips the npm publish (`npmPublish: false`, the root package is
`private`), and commits `CHANGELOG.md` plus `package.json` with the message
`chore(release): ${nextRelease.version} [skip ci]`. Tags are `v${version}`.

A third workflow, `.github/workflows/check-library-updates.yml`, runs daily at
08:00 UTC and on manual dispatch. It compares `versions.production.json` against
the latest `@carlonicora/nestjs-neo4jsonapi` and `@carlonicora/nextjs-jsonapi`
on npm and, when either has moved, opens a pull request on the branch
deps/library-updates against `dev`.

## Formatting

`.prettierrc` is the whole style policy: 120 columns, two-space indent, double
quotes, semicolons, trailing commas everywhere, always-parenthesised arrow
parameters, and the `prettier-plugin-tailwindcss` class sorter.
`.prettierignore` excludes only the install directory. `pnpm format` runs
`turbo run format`, which is `prettier --write` in each workspace that declares
it. `apps/api` carries a second Prettier config of its own next to its manifest.

ESLint composes with Prettier through `eslint-config-prettier` and
`eslint-plugin-prettier`, both pinned in the `pnpm-workspace.yaml` catalog.

## Pulling template updates

`CORE-UPDATE.md` documents the seam back to the scaffolder: propose a change
from this application, generate a portable patch file, submit it to the
template, and apply template updates back into the app. `scripts/update.sh` and
`scripts/check-update.sh` implement the app-side half. Neither is wired to a
`package.json` script — invoke them directly, as `CORE-UPDATE.md` shows.

## Dependency work

`DEPENDENCY_UPGRADE_GUIDE.md` at the repository root is the playbook for any
dependency sweep: what to tag before starting, which packages never take a major
bump without a decision, how the `catalog:` block in `pnpm-workspace.yaml` is
the single source of shared versions, and why `scripts/check-dep-drift.js` must
be satisfied rather than weakened. `pnpm check:drift` runs the check on its own;
`pnpm sync:versions` refreshes `versions.production.json` from the workspace.

## Where to look

| File | What it settles |
|---|---|
| `.releaserc` | Release branch, commit classification, changelog sections, tag format |
| `.husky/pre-commit` | The lint gate before a commit |
| `.husky/pre-push` | The build and test gate before a push |
| `package.json` | Engines, package manager, every root script |
| `turbo.json` | Task graph, caching, which env vars each task sees |
| `scripts/check-dep-drift.js` | The five dependency invariants `pnpm lint` enforces |
| `apps/web/scripts/validate-translations.mjs` | The translation-key check inside `apps/web`'s lint |
| `.github/workflows/pull-request.yml` | What a pull request must pass |
| `.github/workflows/dev.yml` | The release pipeline |
| `.prettierrc` | Formatting, including the Tailwind class sorter |

## Gaps and drift

- This page absorbs the template's former root CONTRIBUTING.md, deleted by the
  handbook work on 2026-09-11. That file stated a pnpm floor of `>= 10.0.0`;
  `package.json` `engines` says `>=11.0.0` and `packageManager` pins
  `pnpm@11.24.0`. The manifest wins.
- That same file also said "The CI pipeline automatically runs `pnpm test`" and
  stopped there. It did not mention that CI first removes the submodules from
  `pnpm-workspace.yaml` and installs the pinned npm releases instead, which is
  the single largest difference between a local run and a CI run.
- `pnpm lint` is a pre-commit hook and nothing more: no workflow in
  `.github/workflows/` runs it, so a commit pushed with `--no-verify` reaches
  `dev` unlinted.
- The handbook path checker is not part of `pnpm lint` either. Run
  `pnpm check:handbook` by hand after editing these pages.
- Not examined: the contents of `DOCKER.md`, the Coolify deployment path, and
  the review conventions a team layers on top of the pull-request workflow —
  none of which the template encodes.
