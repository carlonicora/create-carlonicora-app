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

### Syncing template from source

```bash
pnpm sync-template
```

### Testing locally

```bash
# Build first
pnpm build

# Test with node directly
node bin/cli.js test-project

# Or link globally
npm link
create-carlonicora-app test-project
```

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.
