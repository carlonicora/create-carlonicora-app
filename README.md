# create-carlonicora-app

CLI tool to scaffold a new NestJS + Next.js monorepo project with Neo4j and JSON:API.

## Usage

### With npx (recommended)

```bash
npx create-carlonicora-app my-project
```

### With global installation

```bash
npm install -g create-carlonicora-app
create-carlonicora-app my-project
```

### Options

```bash
create-carlonicora-app [project-name] [options]

Options:
  --skip-git       Skip git initialization and submodules
  --skip-install   Skip dependency installation
  -V, --version    Output version number
  -h, --help       Display help
```

## What's Included

The generated project includes:

- **apps/api** - NestJS 11 backend with:
  - Fastify HTTP server
  - Neo4j graph database integration
  - BullMQ job processing
  - JWT authentication
  - JSON:API standard compliance
  - OpenTelemetry observability
  - LangChain AI integration

- **apps/web** - Next.js 16 frontend with:
  - React 19
  - Tailwind CSS 4
  - shadcn/ui components
  - next-intl internationalization
  - JSON:API client

- **packages/shared** - Shared types and constants

- **Git submodules**:
  - `@carlonicora/nestjs-neo4jsonapi`
  - `@carlonicora/nextjs-jsonapi`

## Prerequisites

- Node.js 18+
- pnpm 10+
- Git

## After Scaffolding

```bash
cd my-project
cp .env.example .env
# Edit .env with your configuration
pnpm dev
```

## Development

### Building the CLI

```bash
pnpm install
pnpm build
```

### Maintaining the template

Two projects already run this stack — `wyrdli` and `neural-erp`. They keep improving
and the template goes stale. This is how you catch up.

#### You do not read the report

```
Skill(template-sync)
```

That is the whole workflow. The skill runs the comparison, reads the 400-row report,
throws away everything that structurally cannot matter, and comes back with a short
ranked proposal:

```
Reviewed 400 rows (77 after triage). Proposing:

ADOPT (9)
  apps/web/src/app/.../administration/users/page.tsx   from wyrdli  — admin route the index links to
  apps/api/templates/email/*.hbs (12 files)            from wyrdli  — whitespace only
KEEP TEMPLATE (5)
  .github/workflows/dev.yml   — wyrdli deleted its test step; a scaffolder keeps one
NEEDS YOUR CALL (2)
  apps/web/messages/it.json   — ship a second locale as an example, or stay en-only?

Nothing adopted yet. Say which groups to apply.
```

You answer, it applies, it runs the gates. `template-drift-report.md` is evidence for
the agent — you should not have to open it.

The rest of this section is what the tool does underneath, for when something looks
wrong.

#### What the comparison actually does

**It reads other repositories on your machine.** Not this one — sibling checkouts
listed in `template.sources.json`, resolved relative to this repo's root:

```jsonc
{ "name": "wyrdli",     "path": "../wyrdli"     }   // → /Users/you/Development/wyrdli
{ "name": "neural-erp", "path": "../neural-erp" }   // → /Users/you/Development/neural-erp
```

**Strictly read-only against them** — never writes, never runs their scripts, never
touches their git state. A missing path stops the run rather than silently comparing
against nothing.

For each file: does the template have it, does each project, and are they identical
once the project's own name is generalized back to `{{name}}`? Plus one `git log` pass
per project for *when* each file last changed and in *what kind of commit*.

```bash
pnpm compare:template     # writes template-drift-report.{md,json}, both gitignored
```

#### What the numbers mean

```
DIVERGED 56 · TARGET_AHEAD 57 · TARGET_ONLY 90 · TEMPLATE_ONLY 100 · NEVER_ADOPT 27 · ALIGNED 70
```

**This is a difference report, not a defect report.** Around half of any run needs no
action, and much of the rest *should* differ permanently — `CLAUDE.md`, `README.md`,
`Dockerfile`, `tsconfig.json` and the CI workflows differ from both projects by design.

**A high `TEMPLATE_ONLY` is healthy.** It counts what the template provides that no
product happens to use — the PWA and onboarding features, the e2e harness, the bundled
skills. It rises every time the template gains something.

| Classification | Means |
|---|---|
| `ALIGNED` | identical everywhere |
| `TARGET_AHEAD` | exactly one project differs |
| `DIVERGED` | the projects disagree with each other and with the template |
| `TARGET_ONLY` | a project has it, the template doesn't |
| `TEMPLATE_ONLY` | only the template has it |
| `NEVER_ADOPT` | protected by config |

Each row names a `winner` — the project whose version is *probably* worth considering.
**A hint, not a verdict.** A commit touching more than 25 files is flagged `(bulk)` and
ranked below smaller recent edits: a rename sweep touches a file without advancing it.
In one measured case the "newer" commit on a CI workflow had *deleted* its test step.

#### Applying by hand

```bash
pnpm template:apply --target wyrdli --paths "path/one.ts,path/two.tsx" [--dry-run]
```

Copies exactly those paths, rewriting the project's name back to `{{name}}` /
`{{display}}`. **Never copy a file by hand** — this is the only thing that
re-generalizes, and a hand copy leaks the donor's product name and branding into every
app scaffolded afterwards.

#### Adding another project

```jsonc
{ "name": "my-project", "path": "../my-project", "appName": "my-project",
  "ignore": ["apps/web/src/features/features", "apps/web/public"] }
```

`ignore` is that project's *business* code. Get it wrong and the report fills with
noise; the fix is almost always another `ignore` entry, not a decision.

### Checking the template is sound

```bash
pnpm check:template          # nine checks
pnpm check:template --strict # also fail if any check had to skip
```

| Check | Catches |
|---|---|
| `junk` | `.DS_Store` and friends shipped into generated apps |
| `manifests` | `package.json` scripts pointing at files that don't exist; a nested `packageManager` contradicting the root |
| `placeholder-urls` | `new URL("{{name}}.com")` — schemeless, throws `Invalid URL` at runtime |
| `production-versions` | `versions.production.json` drifting from the libraries on disk |
| `bootstrapper-modules` | a `Modules.X` the library dereferences but the app never registers — **typechecks clean, `undefined` at runtime** |
| `env-required` | required env keys missing, retired ones lingering |
| `email-templates` | an auth flow that mails with no template behind it |
| `admin-gate` | the `(admin)` subtree losing its Administrator role check |
| `orphan-modules` | dead modules under `features/common` |

Two checks need the library checked out; `integrity.config.json` says where.
Without it they `SKIP`, and `--strict` turns a skip into a failure so CI cannot
pass on a check that never ran.

### Verifying a generated app

Static checks do not prove a scaffolded app runs. Scaffold one and boot it:

```bash
node bin/cli.js my-test-app     # with git, so submodules clone and build
cd my-test-app && cp .env.example .env   # then set ports, Neo4j, Redis
pnpm dev:worker                 # FIRST — see below
pnpm dev:api
pnpm dev:web
```

- **`dev:worker` before `dev:api`.** The migrator is worker-mode-gated, so
  `dev:api` never applies migrations. Without the worker there is no schema and
  no seeded administrator.
- **A `200` on `/` is the gate, not "Ready".** Next reports ready before
  `instrumentation.ts` has bootstrapped the module registry.
- **Never kill by name pattern** (`pkill -f node`). Kill the PID you captured,
  or `lsof -ti :<port> -sTCP:LISTEN | xargs -r kill`.

Then run the end-to-end suite, which does all of the above for you:

```bash
bash scripts/e2e.sh                          # everything
bash scripts/e2e.sh --project=chromium-smoke # scoped
```

It recreates an empty test database, boots the stack on dedicated ports
(3980-3982), waits for migrations, runs Playwright and tears down. Arguments
pass through to `playwright test`.

### Running from local folder

```bash
# Clone and build
git clone https://github.com/carlonicora/create-carlonicora-app.git
cd create-carlonicora-app
pnpm install
pnpm build

# Go to the parent directory and run the CLI from there
cd ..
node create-carlonicora-app/bin/cli.js my-project

# Or link globally for convenience
cd create-carlonicora-app
npm link
cd ..
create-carlonicora-app my-project
```

> **Note:** The project is created in your current working directory. Run the CLI from the directory where you want the project to be created.

#### Options

```bash
node create-carlonicora-app/bin/cli.js [project-name] [options]

Options:
  --skip-git       Skip git initialization and submodules
  --skip-install   Skip dependency installation
```

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
