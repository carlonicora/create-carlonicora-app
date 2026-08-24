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

The template is **not** synced from one source project. It is compared against
several, and merged by judgement. Whichever project most recently advanced a
given file is a *hint*; the decision is always a human's.

#### The loop

```bash
pnpm compare:template     # 1. gather evidence
```

Reads `template.sources.json`, compares `template/` against every configured
target, and writes `template-drift-report.md` (grouped for reading) and
`template-drift-report.json` (for programmatic triage). Every row is classified:

| Classification | Meaning | What to do |
|---|---|---|
| `ALIGNED` | template matches every target | nothing |
| `TARGET_AHEAD` | exactly one target differs | consider adopting |
| `DIVERGED` | targets disagree with each other | judgement required |
| `TARGET_ONLY` | a target has it, the template doesn't | candidate addition |
| `TEMPLATE_ONLY` | only the template has it | confirm it's intentional |
| `NEVER_ADOPT` | protected by config | skip without reading |

```
2. Read the report — judgement-needed groups come first, ALIGNED last.
3. Invoke the template-sync skill for the rules behind each decision.
4. Adopt what you decided:
```

```bash
pnpm template:apply --target wyrdli --paths "path/one.ts,path/two.tsx" [--dry-run]
```

```bash
pnpm check:template --strict   # 5. nine integrity checks must pass
pnpm test                      # 6. the tooling's own suite
```

Then verify a real scaffolded app still works — see *Verifying a generated app*.

#### Rules that are not obvious

- **Never hand-copy a file from a target.** `template:apply` re-generalizes the
  donor's project name into `{{name}}` / `{{display}}` as it copies. Copying by
  hand skips that and leaks the donor's brand into every scaffolded app.
- **`{{name}}` and `{{display}}` are different values** — kebab-case (`my-app`)
  and human-readable (`My App`). Mixing them inside one rendered artifact is
  visible to the end user.
- **Recency is a hint, not a decision.** A rename sweep or a dependency chore
  touches hundreds of files without advancing any of them. The report flags
  those commits `(bulk)` and ranks them below smaller, more recent edits.
- **A check that fires on correct code is a broken check.** Fix the check, never
  the code. Editing working code to silence a linter is how correct code gets
  degraded.

#### Adding a source project

Add an entry to `template.sources.json`:

```jsonc
{
  "name": "my-project",
  "path": "../my-project",
  "appName": "my-project",
  "ignore": ["apps/web/src/features/features", "apps/web/public", "..."]
}
```

`ignore` is that project's *business* code — everything the template should
never learn about. Repo-level `neverAdopt` and `templateOnly` apply to all
targets; the reasoning behind each entry is in
`.claude/skills/template-sync/references/never-adopt.md`.

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
