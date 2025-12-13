# =============================================================================
# Unified Dockerfile for {{name}} Monorepo
# =============================================================================
# This Dockerfile builds all services (API, Worker, Web) from a single file,
# eliminating duplicate builds of the shared package by reusing build stages.
#
# Build targets:
#   - api-development:  API with hot-reload for development (uses local submodules)
#   - api-production:   Optimized API production build (uses npm packages)
#   - web-development:  Web with hot-reload for development (uses local submodules)
#   - web-production:   Optimized Web production build (uses npm packages)
#
# Usage:
#   docker build --target api-production -t api:prod .
#   docker build --target web-production -t web:prod .
#   docker build --target api-development -t api:dev .
#   docker build --target web-development -t web:dev .
#
# Benefits:
#   - Shared package (@{{name}}/shared) built ONCE and reused
#   - Faster builds when building multiple services
#   - Better layer caching across services
#   - Consistent base dependencies
#   - Production uses pinned npm versions (versions.production.json)
#   - Development uses local submodules for live editing
# =============================================================================

# =============================================================================
# BASE STAGE - Common foundation for all services
# =============================================================================
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

# Install build dependencies for native modules (required for sharp + webp)
RUN apk add --no-cache python3 py3-pip make g++ cairo-dev jpeg-dev pango-dev giflib-dev libwebp-dev \
    tesseract-ocr tesseract-ocr-data-ita graphicsmagick ghostscript

WORKDIR /app

# =============================================================================
# WORKSPACE DEPENDENCIES (DEVELOPMENT) - Uses local submodules
# =============================================================================
FROM base AS workspace-deps

# Copy workspace manifests (minimal set for faster caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared/
COPY packages/nestjs-neo4jsonapi ./packages/nestjs-neo4jsonapi/
COPY packages/nextjs-jsonapi ./packages/nextjs-jsonapi/
COPY apps/api ./apps/api/
COPY apps/web ./apps/web/

# Install all dependencies once (including dev deps for build targets)
RUN pnpm install --frozen-lockfile

# =============================================================================
# SHARED PACKAGE BUILD (DEVELOPMENT) - Built ONCE and reused by dev services
# =============================================================================
FROM workspace-deps AS shared-builder

WORKDIR /app/packages/shared
RUN pnpm build

# Build nestjs-neo4jsonapi package
WORKDIR /app/packages/nestjs-neo4jsonapi
RUN pnpm build

# Build nextjs-jsonapi package
WORKDIR /app/packages/nextjs-jsonapi
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# Return to workspace root for subsequent stages
WORKDIR /app

# =============================================================================
# API DEVELOPMENT TARGET
# =============================================================================
FROM shared-builder AS api-development

# Expose port (set via build arg; defaults to 3400 for local compose)
ARG API_PORT=3400
EXPOSE ${API_PORT}

# Development command (hot reload) - stay in /app to access tsconfig.json
CMD ["pnpm", "--filter", "{{name}}-api", "run", "dev"]

# =============================================================================
# WEB DEVELOPMENT TARGET
# =============================================================================
FROM shared-builder AS web-development

# Expose port (set via build arg; defaults to 3401 for local compose)
ARG PORT=3401
EXPOSE ${PORT}

# Development command (hot reload with Turbopack) - stay in /app to access node_modules
CMD ["pnpm", "--filter", "{{name}}-web", "run", "dev"]

# =============================================================================
# WORKSPACE DEPENDENCIES (PRODUCTION) - Uses npm packages, not submodules
# =============================================================================
FROM base AS workspace-deps-prod

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY versions.production.json ./
COPY scripts/apply-production-versions.js ./scripts/

# Copy only the shared package (still local)
COPY packages/shared ./packages/shared/

# Copy app source
COPY apps/api ./apps/api/
COPY apps/web ./apps/web/

# Apply production versions (replaces workspace:* with npm versions)
RUN node scripts/apply-production-versions.js

# Remove submodule entries from pnpm-workspace.yaml for production
RUN sed -i '/nestjs-neo4jsonapi/d; /nextjs-jsonapi/d' pnpm-workspace.yaml

# Install dependencies (fetches libraries from npm)
RUN pnpm install --no-frozen-lockfile

# =============================================================================
# SHARED PACKAGE BUILD (PRODUCTION) - Only builds shared, not submodule packages
# =============================================================================
FROM workspace-deps-prod AS shared-builder-prod

WORKDIR /app/packages/shared
RUN pnpm build

WORKDIR /app

# =============================================================================
# API BUILDER (production) - Uses npm packages
# =============================================================================
FROM shared-builder-prod AS api-builder

WORKDIR /app
RUN pnpm --filter {{name}}-api build

# =============================================================================
# API PRODUCTION TARGET
# =============================================================================
FROM node:22-alpine AS api-production

# Install runtime dependencies only (no build tools + OCR)
RUN apk add --no-cache cairo jpeg pango giflib libwebp \
    tesseract-ocr graphicsmagick ghostscript

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app
ENV NODE_ENV=production

# Copy built files from api-builder
COPY --from=api-builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=api-builder /app/packages/shared ./packages/shared
COPY --from=api-builder /app/apps/api ./apps/api

# Install only production dependencies
RUN pnpm install --no-frozen-lockfile --prod --ignore-scripts

WORKDIR /app/apps/api

# Expose port (set via build arg; defaults to 3400 for local compose)
ARG API_PORT=3400
EXPOSE ${API_PORT}

# Production command (can be overridden for worker mode)
CMD ["node", "dist/main", "--mode=api"]

# =============================================================================
# WEB BUILDER (production) - Uses npm packages
# =============================================================================
FROM shared-builder-prod AS web-builder

WORKDIR /app

# Accept build arguments for Next.js public env vars
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADDRESS
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Set them as environment variables for the build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ADDRESS=${NEXT_PUBLIC_ADDRESS}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

RUN pnpm --filter {{name}}-web build

# =============================================================================
# WEB PRODUCTION TARGET
# =============================================================================
FROM node:22-alpine AS web-production

# Install runtime dependencies for Next.js image optimization (sharp)
RUN apk add --no-cache cairo jpeg pango giflib libwebp

# Install pnpm for runtime scripts
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app
ENV NODE_ENV=production

# Copy built files from web-builder
COPY --from=web-builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=web-builder /app/packages/shared ./packages/shared
COPY --from=web-builder /app/apps/web ./apps/web

# Install only production dependencies
RUN pnpm install --no-frozen-lockfile --prod --ignore-scripts

WORKDIR /app/apps/web

# Expose port (set via build arg; defaults to 3401 for local compose)
ARG PORT=3401
EXPOSE ${PORT}

# Production command
CMD ["pnpm", "--filter", "{{name}}-web", "run", "start"]
