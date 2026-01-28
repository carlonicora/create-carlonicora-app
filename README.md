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
