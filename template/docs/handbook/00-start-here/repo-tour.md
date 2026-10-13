---
title: Repository tour
section: 00-start-here
---

Every directory and every file at the root of {{display}}, one line each. Nothing
here explains how a subsystem works; it tells you which door to open.

## Top-level directories

| Path | What it holds |
|---|---|
| `apps/` | The two deployable applications, `apps/api` and `apps/web`. |
| `packages/` | Three libraries: one local, two git submodules. |
| `scripts/` | Thirteen repository-level scripts plus the e2e dashboard's HTML page. |
| `docs/` | This handbook. |
| `.github/` | Three GitHub Actions workflows. |
| `.husky/` | Two git hooks. |
| `.claude/` | Agent settings and the `playwright-cli` skill. |
| `.vscode/` | Editor settings, committed on purpose. |

An empty `.playwright` directory also exists in the working tree. Git does not
track empty directories, so a fresh clone will not have it.

### `apps/`

| Path | Role |
|---|---|
| `apps/api` | The NestJS application. One binary; `--mode=api` serves HTTP, `--mode=worker` runs queues, crons and the migrator. Twenty-four files under `apps/api/src`. |
| `apps/web` | The Next.js App Router application. |

`apps/api/src/main.ts` is twenty-nine lines: it imports `apps/api/src/load-env.ts`
first, then calls `bootstrap()` from `@carlonicora/nestjs-neo4jsonapi` with the
app's feature modules, i18n path, config, the public help routes
(`howTo: { publicRoutes: true }`, which the web app's help pages need) and
OpenAPI options. The rest of
`apps/api/src` is configuration, four Neo4j migrations, the RBAC maps, the email
notification strings and one feature — `apps/api/src/features/essentials/search`.
Handlebars email templates live in `apps/api/templates`, and the two
app-owned tooling scripts in `apps/api/scripts`.

`apps/web` carries its own Next.js, Playwright, Vitest, ESLint, PostCSS and
Tailwind configuration, the single message catalogue at
`apps/web/messages/en.json`, the App Router tree under `apps/web/src/app`, the
features under `apps/web/src/features`, and the Playwright suite under
`apps/web/tests`.

### `packages/`

| Path | Kind | Role |
|---|---|---|
| `packages/shared` | Local workspace package | Identifiers both apps must agree on: `packages/shared/src/const/module.id.ts`, `packages/shared/src/const/roles.id.ts`, `packages/shared/src/const/system.roles.id.ts`. Built with `tsup`. |
| `packages/nestjs-neo4jsonapi` | Git submodule | The backend framework. |
| `packages/nextjs-jsonapi` | Git submodule | The frontend framework. |

Both submodules are declared in `.gitmodules` and, because the repository was
created with `git submodule add -b master`, each tracks the `master` branch
rather than a tag. `git submodule update --remote` therefore moves them to the
latest commit. `versions.production.json` separately pins the npm versions the
production Docker build substitutes. In the template, before
`git submodule update --init`, each directory contains only a placeholder file.

### `scripts/`

Thirteen scripts, plus `scripts/e2e-dashboard.html`, which is the dashboard's
page rather than a script.

| Script | Invoked by |
|---|---|
| `scripts/dev.sh` | `pnpm dev` |
| `scripts/dev-reset.sh` | `pnpm dev:reset` |
| `scripts/e2e.sh` | `pnpm test:e2e`, and by the dashboard |
| `scripts/e2e-dashboard.mjs` | `pnpm e2e:dash` |
| `scripts/e2e-dashboard.test.mjs` | `pnpm e2e:dash:test` |
| `scripts/check-dep-drift.js` | `pnpm lint` and `pnpm check:drift` |
| `scripts/sync-production-versions.js` | `pnpm sync:versions` |
| `scripts/check-handbook.mjs` | `pnpm check:handbook` |
| `scripts/check-handbook.test.mjs` | Run directly with `node --test` |
| `scripts/apply-production-versions.js` | `Dockerfile`, in the production dependency stage — no `package.json` script |
| `scripts/update.sh` | Nothing. Run by hand during a dependency sweep |
| `scripts/check-update.sh` | Nothing. The dry-run half of the sweep |
| `scripts/validate-translations.js` | Nothing. `apps/web` runs its own copy instead |
| `scripts/find-duplicate-translations.js` | Nothing. Run by hand |
| `scripts/remove-worktree.sh` | Nothing. Run by hand |

Five of them — `scripts/update.sh`, `scripts/check-update.sh`,
`scripts/validate-translations.js`, `scripts/find-duplicate-translations.js` and
`scripts/remove-worktree.sh` — are reachable only by typing their path. They are
not dead: `DEPENDENCY_UPGRADE_GUIDE.md` drives the first two by hand.

### `.github/workflows/`

| Workflow | Trigger |
|---|---|
| `.github/workflows/dev.yml` | Push to `dev`: install, build, test, then semantic-release. |
| `.github/workflows/pull-request.yml` | Pull request opened or updated: install, build, test. |
| `.github/workflows/check-library-updates.yml` | Daily at 08:00 UTC and on manual dispatch: checks whether the two framework packages have newer releases. |

### `.husky/`

| Hook | Runs |
|---|---|
| `.husky/pre-commit` | `pnpm lint` |
| `.husky/pre-push` | `pnpm build` then `pnpm test` |

`pre-push` runs a full build. Do not push while a dev server is using the
worktree.

### `.claude/`

`.claude/settings.json` holds the agent permission lists and one
`WorktreeCreate` hook that creates a worktree under a nested directory, copies
the environment file into it, initialises the submodules, installs and builds
both packages. `.claude/skills/playwright-cli/SKILL.md` and its six reference
files under `.claude/skills/playwright-cli/references` document driving a
browser from the command line.

### `.vscode/`

`.vscode/settings.json` is the one editor file `.gitignore` allows through. It
configures the i18n-ally extension against the four message directories, makes
Prettier the only formatter, and turns off ESLint-on-save.

### `docs/`

`docs/handbook` is this handbook. `docs/handbook/README.md` is its index.

## Root files

| File | What it is |
|---|---|
| `README.md` | The front door: stack, getting started, commands, documentation index. |
| `CLAUDE.md` | The architecture guardrails and the component routing table. |
| `AGENTS.md` | Three lines pointing at `CLAUDE.md`. |
| `CHANGELOG.md` | Empty until the first release; semantic-release writes it. |
| `CORE-UPDATE.md` | How to propose a configuration improvement back to the scaffold, and how to apply one. |
| `DEPENDENCY_UPGRADE_GUIDE.md` | The dependency sweep procedure, including the two update scripts. |
| `DOCKER.md` | Docker images, compose files, deployment strategies, scaling. |
| `EXTEND-USER.md` | How to add fields and relationships to the user entity. |
| `Dockerfile` | Eleven stages: shared bases, development images, production builders, and the API and web runtime images. |
| `docker-compose.yml` | Runs `api`, `worker` and `web` together. Provides no database, queue or object store. |
| `docker-compose.api.yml` | The API alone. |
| `docker-compose.worker.yml` | The worker alone. |
| `docker-compose.web.yml` | The web app alone. |
| `package.json` | Workspace root: version, engines, `packageManager`, and every command. |
| `pnpm-workspace.yaml` | Workspace globs, the version catalog, the resolution overrides, the peer rules and the build allowlist — each with its reasoning inline. |
| `turbo.json` | Turborepo task graph, cache settings, global dependencies and the per-task environment allowlists. |
| `tsconfig.json` | Solution file: no sources, three project references. |
| `tsconfig.base.json` | The compiler options every project extends, plus the `@{{name}}/shared` path mapping. |
| `versions.production.json` | The npm versions of the two framework packages that the production image installs. |
| `.env.example` | Every environment variable, grouped by subsystem, with the service each belongs to. |
| `.env.e2e.example` | Every variable `scripts/e2e.sh` reads, and the ones it sets itself. |
| `.gitignore` | What never enters the repository. |
| `.gitmodules` | The two submodule declarations. |
| `.gitattributes` | One merge-driver attribute. |
| `.npmrc` | One line: `link-workspace-packages=true`. |
| `.pnpmfile.cjs` | A `readPackage` hook that strips the optional `supports-color` peer so the NestJS packages resolve to a single copy. |
| `.prettierrc` | Formatting rules and the Tailwind class-sorting plugin. |
| `.prettierignore` | One line. |
| `.releaserc` | semantic-release: release branch, tag format, commit analysis rules and changelog sections. |

## The dotfiles, and what each one actually decides

| File | Decides |
|---|---|
| `.npmrc` | Workspace packages are symlinked rather than fetched, so `apps/api` and `apps/web` compile against the submodules' own build output. |
| `.pnpmfile.cjs` | Removes one optional peer dependency. Without it a fresh install can materialise two `@nestjs/core` copies and NestJS fails to boot with an unresolved-dependency error that names the wrong module. |
| `.prettierrc` | 120-column lines, double quotes, trailing commas, and `prettier-plugin-tailwindcss` for class ordering. Prettier is the only formatter; ESLint never formats. |
| `.gitattributes` | Declares a custom merge driver for one JSONL path. Nothing in the repository produces that file, so the attribute is inert until a tool that uses it is installed. |
| `.releaserc` | Releases only from `dev`, tags `v${version}`, and treats every conventional-commit type as at least a patch. A `wip:` commit and a subject containing a skip-release marker release nothing. |
| `.env.example` | The contract between the repository and its environment. It is documentation, not configuration: nothing reads it. |
| `.gitignore` | Listed below. |

In this repository's own tree these files are stored without their leading dot —
`gitignore`, `npmrc`, `prettierrc`, `env.example` and so on — and the dot is
restored when an application is generated. Cite them by the dotted name; that is
the name they have in {{display}}.

## Directories that appear only once you work

`.gitignore` keeps these out of the repository. All of them are generated, and
several of them hold live credentials.

| Path | Why it is ignored |
|---|---|
| **node_modules/** | Dependencies. Reproduced from the lockfile. |
| **dist/** | Compiled output for the API and the packages. |
| **dist-worker/** | The worker's own compiled output. `apps/api/tsconfig.worker.json` sets a separate `outDir` so an API build and a worker build cannot overwrite each other. |
| **.next/** | The web app's development and production build. Shared by `next dev` and `next build`, which is why a build taken while a dev server runs makes every route 404. |
| **.next-e2e/** | The end-to-end stack's build. `createNextConfig`, which `apps/web/next.config.js` calls, switches to it when `E2E_BUILD` is set, so an e2e run never clobbers the dev server's build. |
| **.turbo/** | Turborepo's task cache. |
| **coverage/**, **\*.lcov** | Coverage reports. |
| **playwright-report/**, **test-results/** | Playwright's report and per-test artefacts. |
| **playwright/.auth/** | Playwright storage-state files. These hold live session tokens for the seeded personas — never commit one, never attach one to a bug report. |
| **.worktrees/**, **.claude/worktrees/** | Git worktrees, including the ones the agent hook creates. Ignored so a worktree nested inside the checkout is not committed into it. |
| **apps/api/.llm-dumps/** | Raw LLM request and response dumps, written only when the dump variable is set. They contain whole prompts. |
| **.env**, **.env.e2e**, **\*.local** | The real environment files. The e2e one carries database credentials and the seeded administrator's password. |
| **.core-update-manifest.json** | Bookkeeping for the core-update workflow. |
| **logs**, **\*.log** | Log files written when file logging is enabled. |
| **.playwright-cli/**, **.superpowers/** | Scratch directories for the browser-driving skill and for brainstorming notes. |
| **package-lock.json**, **yarn.lock** | Only the pnpm lockfile is allowed. A second lockfile means someone ran the wrong package manager. |

`.vscode/*` is ignored with four explicit exceptions, of which only
`.vscode/settings.json` exists here.

## Where to look

| File | Why |
|---|---|
| `package.json` | The command surface of the whole repository |
| `pnpm-workspace.yaml` | Why each shared version is pinned where it is |
| `turbo.json` | Which tasks depend on which, and what busts the cache |
| `.gitignore` | The complete ignore list this page summarises |
| `apps/api/src/main.ts` | The entire API entry point |
| `apps/web/next.config.js` | The web app's own build options, passed to the package's `createNextConfig` |
| `Dockerfile` | The eleven stages, named |
| `scripts/dev.sh` | What `pnpm dev` actually starts, and the lock file it keeps |
| `.claude/settings.json` | The agent permissions and the worktree hook |
| `docs/handbook/README.md` | The rest of the handbook |

## Gaps and drift

- `.gitattributes` exists twice in this repository's own tree, once with the dot
  and once without, with identical contents. Only one of them survives into a
  generated application.
- The merge driver `.gitattributes` declares applies to a path no tool in this
  repository writes.
- `scripts/validate-translations.js` is shadowed by the web app's own
  `apps/web/scripts/validate-translations.mjs`, which is the one `pnpm lint`
  runs. The root copy is never executed.
- `versions.production.json` pins `4.17.3` and `4.0.4`, the latest published
  releases, while `.gitmodules` tracks `master`. Once `master` moves past a
  release, a development checkout and a production image run different framework
  versions.
- This page does not describe the contents of `apps/api/src`, `apps/web/src` or
  either submodule beyond naming their top-level shape. The backend, frontend
  and framework sections of the handbook cover those.
- File counts here were taken against the repository as scaffolded. They drift
  the moment the first feature lands, and nothing checks them.
