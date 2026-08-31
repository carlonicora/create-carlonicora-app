# {{name}}

A full-stack monorepo application built with NestJS, Next.js, Neo4j, and JSON:API.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | NestJS 11, Fastify, Neo4j |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **API Standard** | JSON:API |
| **Job Processing** | BullMQ, Redis |
| **Authentication** | JWT, Passport |
| **Observability** | OpenTelemetry, Pino |
| **AI Integration** | LangChain |

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **Docker** (for Neo4j, Redis, MinIO)
- **Git**

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd {{name}}
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration. Key variables:

| Variable | Description |
|----------|-------------|
| `NEO4J_URI` | Neo4j connection string |
| `NEO4J_USERNAME` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `REDIS_HOST` | Redis host for BullMQ |
| `JWT_SECRET` | Secret for JWT signing |

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- Neo4j (graph database)
- Redis (job queue and caching)
- MinIO (S3-compatible object storage)

### 4. Run Development Server

```bash
pnpm dev
```

This starts:
- **API**: http://localhost:3000
- **Web**: http://localhost:3001
- **Worker**: Background job processor

## Project Structure

```
{{name}}/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── config/         # Configuration modules
│   │   │   ├── modules/        # Feature modules
│   │   │   ├── core/           # Core functionality
│   │   │   └── main.ts         # Application entry
│   │   └── test/               # E2E tests
│   │
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # App router pages
│       │   ├── components/     # React components
│       │   ├── contexts/       # React contexts
│       │   └── lib/            # Utilities
│       └── public/             # Static assets
│
├── packages/
│   ├── shared/                 # Shared types and constants
│   ├── nestjs-neo4jsonapi/     # Backend JSON:API framework
│   └── nextjs-jsonapi/         # Frontend JSON:API client
│
├── scripts/                    # Utility scripts
├── docs/                       # Documentation
│   └── architecture/           # Architecture documentation
│
├── docker-compose.yml          # Local development infrastructure
├── Dockerfile                  # Production build
├── turbo.json                  # Turborepo configuration
└── pnpm-workspace.yaml         # pnpm workspace config
```

## Development Commands

### Running the Application

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services (API + Web + Worker) |
| `pnpm dev:api` | Start API only |
| `pnpm dev:web` | Start Web only |
| `pnpm dev:worker` | Start Worker only |

### Building

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm build:api` | Build API only |
| `pnpm build:web` | Build Web only |

### Testing

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests |
| `pnpm test:verbose` | Run tests with full output |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:e2e` | Run the full-stack end-to-end suite headless (`scripts/e2e.sh`) |
| `pnpm e2e:dash` | Interactive e2e dashboard on http://127.0.0.1:4084 — live per-test status, Run/Stop, HTML report |
| `pnpm test:cov` | Run tests with coverage |

### Code Quality

| Command | Description |
|---------|-------------|
| `pnpm lint` | Run ESLint on all packages |
| `pnpm format` | Format code with Prettier |

### Utilities

| Command | Description |
|---------|-------------|
| `pnpm clean` | Remove build artifacts and node_modules |
| `pnpm clean:all` | Deep clean including .next and .turbo |
| `pnpm structure` | Import/export project structure |

### Code Generation

| Command | Description |
|---------|-------------|
| `pnpm generate-module` | Generate a new API module |
| `pnpm generate-web-module` | Generate a new Web module |
| `pnpm neo4jsonapi-migrate` | Run entity migrations |

## Documentation

| Document | Description |
|----------|-------------|
| [DOCKER.md](DOCKER.md) | Docker setup and deployment |
| [EXTEND-USER.md](EXTEND-USER.md) | Extending the User model |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [CORE-UPDATE.md](CORE-UPDATE.md) | Core update workflow |
| [docs/architecture/](docs/architecture/) | Architecture documentation |

## Docker Deployment

For production deployment, see [DOCKER.md](DOCKER.md).

Quick start:

```bash
# Build production image
docker build -t {{name}} .

# Run with docker-compose
docker compose -f docker-compose.api.yml up -d
docker compose -f docker-compose.web.yml up -d
docker compose -f docker-compose.worker.yml up -d
```

## Core Update Workflow

This project supports sharing improvements with the bootstrapper template. See [CORE-UPDATE.md](CORE-UPDATE.md) for:

- Proposing configuration improvements
- Generating portable patches
- Applying updates from the bootstrapper

## API Documentation

When running in development, API documentation is available at:

- **Swagger UI**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc

## Environment Files

| File | Purpose |
|------|---------|
| `.env` | Local development (gitignored) |
| `.env.example` | Template with all variables |
| `.env.test` | Test environment |
| `.env.production` | Production settings |

## License

[Add your license here]
