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

# Install LibreOffice headless for DOCX -> PDF conversion (used by libreoffice-convert)
# Mirrors the install in the api-production stage so dev parity is preserved.
RUN apk add --no-cache libreoffice ttf-liberation ttf-dejavu

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
ENV NODE_OPTIONS="--max-old-space-size=6144"
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
# NOTE: glibc (Debian) base, NOT Alpine. The nestjs-neo4jsonapi onnx-runtime /
# model-manager infra uses onnxruntime-node, which ships prebuilt binaries
# linked against glibc and has no musl/Alpine build — on Alpine the native load
# fails with "ld-linux-x86-64.so.2: No such file" and the worker crashes on
# boot. Any project enabling the ONNX/model-manager features (e.g. Silero VAD)
# MUST run on a glibc-based runtime, so this template ships glibc by default.
FROM node:22-bookworm-slim AS api-production

# Install runtime dependencies only (no build tools).
# OCR (tesseract/graphicsmagick/ghostscript), image libs (cairo/jpeg/pango/etc),
# and LibreOffice headless (DOCX -> PDF via libreoffice-convert) — Debian names.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libjpeg62-turbo libpango-1.0-0 libgif7 libwebp7 \
    tesseract-ocr graphicsmagick ghostscript \
    libreoffice fonts-liberation fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app
ENV NODE_ENV=production

# Copy built files from api-builder
COPY --from=api-builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=api-builder /app/packages/shared ./packages/shared
COPY --from=api-builder /app/apps/api ./apps/api

# ML model configuration (single source of truth for the model-manager).
# Ships empty by default — add entries under registry.onnx / registry.transformers
# in apps/api/config/models.config.yaml to enable models.
COPY --from=api-builder /app/apps/api/config/models.config.yaml /app/config/models.config.yaml

# Install only production dependencies
RUN pnpm install --no-frozen-lockfile --prod --ignore-scripts

WORKDIR /app/apps/api

# ONNX / model-manager runtime config. Models (if any are configured) are
# downloaded on first worker start into MODELS_CACHE_DIR; MODEL_CONFIG_PATH
# points at the config copied above.
ENV MODELS_CACHE_DIR=/app/.cache/models
ENV MODEL_CONFIG_PATH=/app/config/models.config.yaml

# Expose port (set via build arg; defaults to 3400 for local compose)
ARG API_PORT=3400
EXPOSE ${API_PORT}

# Production command (can be overridden for worker mode)
CMD ["node", "dist/main", "--mode=api"]

# =============================================================================
# WEB BUILDER (production) - Uses npm packages
# =============================================================================
FROM api-builder AS web-builder

WORKDIR /app

# -----------------------------------------------------------------------------
# Build-time Arguments
# -----------------------------------------------------------------------------
# IMPORTANT: These ARGs must be provided during docker build to be available
# during the Next.js build process. Coolify automatically injects these as ARGs
# when variables are marked with is_buildtime: true.
#
# Client-side variables (NEXT_PUBLIC_*):
#   - Embedded into the JavaScript bundle at build time
#   - Accessible in browser via process.env.NEXT_PUBLIC_*
#
# Server-side variables:
#   - API_URL: Used by server-side code (SSR, API routes) to call backend API
#   - API_INTERNAL_URL: Used when API and Web run on same machine (docker-compose)
#   - Available only to server-side code via process.env.*
# -----------------------------------------------------------------------------

# Server-side API URL (used during SSR/server components)
ARG API_URL

# Internal API URL for same-machine deployments (docker-compose)
ARG API_INTERNAL_URL

# Client-side public variables (embedded in browser bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADDRESS
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Image sources for CSP headers (needed at build time for next.config.js headers())
ARG IMAGE_SOURCES

# Optional: Node.js memory settings for build process
ARG WEB_NODE_OPTIONS

# Optional: Port configuration
ARG PORT

# -----------------------------------------------------------------------------
# Set Environment Variables for Build Process
# -----------------------------------------------------------------------------
# These ENV declarations make the ARGs available to the Next.js build process
# via process.env.* when running `pnpm build`

# Server-side variables
ENV API_URL=${API_URL}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

# Client-side variables (will be embedded in bundle)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ADDRESS=${NEXT_PUBLIC_ADDRESS}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

# Image sources for CSP headers
ENV IMAGE_SOURCES=${IMAGE_SOURCES}

# Optional: Set Node options if provided (useful for memory-intensive builds)
ENV NODE_OPTIONS=${WEB_NODE_OPTIONS}

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
