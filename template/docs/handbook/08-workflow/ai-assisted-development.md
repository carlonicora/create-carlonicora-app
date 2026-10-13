---
title: AI-assisted development
section: 08-workflow
---

This repository is written to be worked on with a coding agent in the loop, and
it carries the instructions, permissions, tooling and generators that assume
one. Everything on this page ships in the template; none of it is optional
decoration.

## The instruction hierarchy

Five files, read in this order by an agent starting work:

| File | Scope | Contents |
|---|---|---|
| `AGENTS.md` | repository | Three lines. Points at `CLAUDE.md` and nothing else. |
| `CLAUDE.md` | repository | What the monorepo is, the component table (each row pointing at a handbook page), the pointer to the handbook's rulebook, and the non-negotiable guardrails for both tiers. |
| `apps/api/CLAUDE.md` | backend | Six core rules, the feature file layout, the RBAC workflow, and a common-mistakes table. |
| `apps/web/CLAUDE.md` | frontend | Six core rules, the feature file layout, the testing utilities import, and a longer common-mistakes table. |
| `packages/shared/CLAUDE.md` | shared package | A few lines: read the architecture skill, then the root file and the shared-package handbook page. |

`AGENTS.md` exists so that tools which look for that filename land on the same
document. It contains no rules of its own — every rule lives in `CLAUDE.md` or a
workspace file below it.

The root guardrails are stated as absolutes and mean it: extend
`AbstractRepository` and `AbstractService`; use `buildDefaultMatch()`;
`readOne()` / `readMany()` rather than raw records; the `{CURSOR}` placeholder
rather than `SKIP`/`LIMIT`; meta constants rather than endpoint literals;
parameterised Cypher; controllers call services, never repositories. On the
frontend: `callApi()` rather than `fetch()`; `rehydrate()` and `createJsonApi()`
on every model; `EndpointCreator` for URLs; `type: Modules.X` on every call; no
hand-built {json:api} payloads; Base UI's `render`, never `asChild`.

The per-workspace files add what only that tier needs. `apps/api/CLAUDE.md`
carries the RBAC instructions — the declarative matrix at
`apps/api/src/rbac/permissions.ts` is the source of truth, the worker reconciler
applies drift to Neo4j on bootstrap, the api process does not reconcile, and
`pnpm --filter {{name}}-api rbac:dump` is the only sanctioned way to regenerate
the matrix from live database state.

## The architecture rulebook

`CLAUDE.md` routes architecture questions to the handbook's rulebook,
`docs/handbook/02-framework/rulebook/README.md`, and says to read the reference
for the layer *before* editing any TypeScript file under
`apps/api/src/features`, `apps/web/src/features` or `packages/*/src`. The three
workspace files still name the **`nja` plugin's `nja-architecture` skill**,
invoked as `nja:nja-architecture`; the skill's own SKILL.md carries a routing
table from file pattern to reference document, and its bundled references tree
holds the per-layer rules.

That plugin is installed globally, outside this repository — so the handbook
ships a **verbatim copy of the same rulebook** at
`docs/handbook/02-framework/rulebook/`, twenty-one files reproduced byte for byte:

| Group | Pages |
|---|---|
| Cross-cutting | `docs/handbook/02-framework/rulebook/core-principles.md`, `docs/handbook/02-framework/rulebook/anti-patterns.md`, `docs/handbook/02-framework/rulebook/discipline.md`, `docs/handbook/02-framework/rulebook/date-handling.md`, `docs/handbook/02-framework/rulebook/decisions.md`, `docs/handbook/02-framework/rulebook/feature-template.md` |
| Backend | entity basics, DTOs, repositories, services, controllers, LLM calls, and a feature template |
| Frontend | models, interfaces, services, components, typography, BlockNote, routes and Cache Components, and a feature template |

Each copy carries an HTML comment recording the plugin, skill and version it
came from, and the instruction not to edit it in place: re-copy it when the
plugin updates. Their internal citations point at the plugin's tree, which is
why the handbook path checker skips them.

Use the copy when the plugin is unavailable or when you want the rules under
version control alongside the code. Use the skill when it is available — it
routes, the copy does not.

## `.claude/settings.json`

Two blocks: permissions and one hook.

### Permissions

`allow` lists the tools an agent may use without a prompt — `Read`, `Edit`,
`Write`, `Glob`, `Grep`, `Bash(*)`, `WebSearch`, two `WebFetch` domains
(`ui.shadcn.com` and `github.com`), the `playwright-cli` skill, thirteen `nja:*`
skills, and four `superpowers:*` skills.

`deny` is the list that matters. None of these ever run:

```
rm -rf *        rmdir *
git reset --hard*   git clean*
git push --force*   git push -f*
gh pr edit*         gh pr merge*
```

`ask` prompts before `rm *`, `git commit*` and `git push*`. The shape of the
policy is deliberate: broad read and write inside the working tree, no
destructive git, no unattended commits or pushes, and no pull-request mutation.

### The `WorktreeCreate` hook

One hook, one command, run when an isolated worktree is requested. It:

1. Reads the requested name from the hook's JSON payload.
2. Resolves the repository root and creates .claude/worktrees/<name> under it.
3. Runs `git worktree add` for that path on a new branch `worktree-<name>`, cut
   from `dev`.
4. Copies the repository-root environment file into the worktree if one exists.
5. Runs `git submodule update --init --recursive` — without this the two
   `@carlonicora/*` directories are empty and nothing installs.
6. Runs `pnpm install`.
7. Builds `@carlonicora/nestjs-neo4jsonapi`, then `@carlonicora/nextjs-jsonapi`.
8. Prints the worktree path, which is the hook's return value.

Steps 5 to 7 are what makes the worktree usable: both apps consume the packages
as `workspace:*` and import their build output, so an unbuilt submodule fails at
import, not at install.

`scripts/remove-worktree.sh` is the companion. Called with no argument it lists
what is under .claude/worktrees; called with a name it removes that directory,
runs `git worktree prune` and deletes the `worktree-<name>` branch.
It removes the directory with `rm -rf` rather than `git worktree remove`,
because the latter refuses to operate on a worktree containing submodules.

A worktree is a full second checkout with its own install tree and its own Next.js
output directory. It does **not** get its own ports — two stacks started at
once collide on 4050 and 4051. Start one at a time, or override the ports.

## The `playwright-cli` skill

`.claude/skills/playwright-cli/SKILL.md` documents a browser-automation CLI for
driving the running application: open, goto, click, type, fill, select, upload,
snapshot, eval, screenshot, close. Its `allowed-tools` is scoped to
`Bash(playwright-cli:*)` and nothing else, and `.claude/settings.json` allows
the skill by name.

Seven reference documents ship with it:
`.claude/skills/playwright-cli/references/session-management.md`,
`.claude/skills/playwright-cli/references/storage-state.md`,
`.claude/skills/playwright-cli/references/request-mocking.md`,
`.claude/skills/playwright-cli/references/test-generation.md`,
`.claude/skills/playwright-cli/references/tracing.md`,
`.claude/skills/playwright-cli/references/video-recording.md` and
`.claude/skills/playwright-cli/references/running-code.md`.

This is the tool for proving a change works in the real application rather than
in a test double. It is separate from the Playwright *suite* under
`apps/web/tests/`, which runs against its own stack on its own ports.

## The two generators

Both are compiled CLIs that ship inside the framework packages and are invoked
from the repository root. Both take a JSON schema file describing one entity and
both support `--dry-run`, `--force` and `--no-register`.

### `pnpm generate-module` — backend

Runs the compiled generate-module entry inside `packages/nestjs-neo4jsonapi`.
From one JSON definition it emits the full feature: the meta file, the entity class
with its `EntityDescriptor`, a base DTO plus POST, PUT and relationship DTOs,
the repository, the service, the controller, the NestJS module — and a spec
alongside the controller, the DTO, the repository and the service. It registers
the new module in the parent module unless `--no-register` is passed, and takes
`--shared-scope` to override the auto-detected shared-package scope that exports
`ModuleId`.

### `pnpm generate-web-module` — frontend

Runs the compiled generate-web-module entry inside `packages/nextjs-jsonapi`.
From the same shape of definition it emits the frontend quartet and more: in the
data directory the model, the interface, the service, the field selectors and
the aliases; the `ModuleFactory` call; a context; a table hook; the components —
container, content, list, list container, editor, deleter, selector and
multi-selector; and the two pages, list and detail. `--no-register` skips the
`apps/web/src/config/Bootstrapper.ts` and i18n updates it otherwise performs.

Generated code is a starting point, not an answer. Both emit the layout the
conventions page describes, which is the point: the generator and the rulebook
agree, so a reviewer only has to read the diff.

A third tool, `pnpm neo4jsonapi-migrate`, runs the package's entity-migration
CLI; `pnpm --filter {{name}}-api generate:rbac-paths` regenerates
`apps/api/src/features/rbac/module-relationships.map.ts` from the compiled
feature tree.

## Where to look

| File | What it settles |
|---|---|
| `CLAUDE.md` | The guardrails, and the pointer to the rulebook |
| `AGENTS.md` | The redirect for tools that look for this filename |
| `apps/api/CLAUDE.md` | Backend rules, feature layout, RBAC workflow |
| `apps/web/CLAUDE.md` | Frontend rules, feature layout, common mistakes |
| `packages/shared/CLAUDE.md` | The shared package's pointer to both of the above |
| `.claude/settings.json` | Tool permissions and the worktree hook |
| `scripts/remove-worktree.sh` | Tearing a worktree down, submodules included |
| `.claude/skills/playwright-cli/SKILL.md` | Driving the running app from the command line |
| `docs/handbook/02-framework/rulebook/` | The in-repo copy of the architecture rulebook |
| `package.json` | `generate-module`, `generate-web-module`, `neo4jsonapi-migrate` |

## Gaps and drift

- The rulebook copies are a snapshot. Nothing in the repository detects that the
  `nja` plugin has moved on, so the copies go stale silently. Re-copy them when
  the plugin updates, and record the version in the HTML comment each file
  carries.
- The workspace `CLAUDE.md` files point at the skill, whose references live in
  the plugin and not in the application. The handbook copy, which the root
  `CLAUDE.md` now names, is the only in-repo address for those rules.
- `.claude/settings.json` allows several `nja:*` skills that no shipped document
  explains — `nja-blast-radius`, `nja-interrogate`, `nja-reflect`,
  `nja-automate-me`, `nja-create-verifier`, `nja-maintain-verifier`. The
  permission list is broader than the documentation.
- Both generators read their entry point from the packages' build output, so neither
  runs until `pnpm build` has produced it. In a fresh clone that means
  `git submodule update --init` first.
- Not examined: the JSON schema format either generator consumes, the contents
  of the seven `playwright-cli` reference documents, and the behaviour of the
  `superpowers:*` skills the settings file permits.
