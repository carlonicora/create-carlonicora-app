# Template Comparison Report

**Generated:** 2026-01-28T16:46:16.011Z
**Template:** /Users/carlo/Development/create-carlonicora-app/template
**Target:** /Users/carlo/Development/only35
**Project Name:** only35

---

## Summary

| Category | Count |
|----------|-------|
| Identical | 38 |
| Config Drift | 31 |
| Version Drift | 0 |
| Additions | 229 |
| Custom Code | 22 |

**Total:** 93 template files, 320 target files compared

---

## Config Drift

Configuration files that have been modified beyond version changes.

### `.github/workflows/dev.yml`

<details>
<summary>View changes</summary>

```diff
+           node scripts/apply-production-versions.js
+       - name: Run Tests
+         run: pnpm test
```

</details>

### `.github/workflows/pull-request.yml`

<details>
<summary>View changes</summary>

```diff
+           node scripts/apply-production-versions.js
+       - name: Run Tests
+         run: pnpm test
```

</details>

### `.husky/pre-commit`

<details>
<summary>View changes</summary>

```diff
- pnpm lint
+ # Colors
+ RED='\033[0;31m'
+ GREEN='\033[0;32m'
+ CYAN='\033[0;36m'
+ BOLD='\033[1m'
+ NC='\033[0m' # No Color
+ # ============================================
+ # Lint
+ # ============================================
+ echo ""
... and 10 more added lines
```

</details>

### `.husky/pre-push`

<details>
<summary>View changes</summary>

```diff
+ pnpm test
```

</details>

### `CHANGELOG.md`

<details>
<summary>View changes</summary>

```diff
+ ## [1.39.0](https://github.com/carlonicora/only35/compare/v1.38.0...v1.39.0) (2026-01-28)
+ ### 🚀 Features
+ * add audit and cache invalidator decorators ([d13be78](https://github.com/carlonicora/only35/commit/d13be78d3204e2b004376eb1393bf7a9586a9568))
+ * add audit and cache invalidator decorators ([74e4abb](https://github.com/carlonicora/only35/commit/74e4abb933c8aa4332f1bc05fe576ab65ac1eb1a))
+ ### 🐛 Bug Fixes
+ * correct elements in sidebar ([7906ba4](https://github.com/carlonicora/only35/commit/7906ba4d1908bc943508768db70fc06a0d783782))
+ * reorder @Audit decorator for findById method ([ca22c9d](https://github.com/carlonicora/only35/commit/ca22c9d39a996f9aef53cb4be94e5194e2bf861e))
+ ### 📚 Documentation
+ * add updated architecture documentation ([c1e499c](https://github.com/carlonicora/only35/commit/c1e499c7d861da15eff16e0c949ae922447fe568))
+ * add updated architecture documentation ([ea65b31](https://github.com/carlonicora/only35/commit/ea65b31b1c8f49dcaf387a26d86c4fddde3d31dc))
... and 2182 more added lines
```

</details>

### `CLAUDE.md`

<details>
<summary>View changes</summary>

```diff
+ <!-- OPENSPEC:START -->
+ # OpenSpec Instructions
+ These instructions are for AI assistants working in this project.
+ Always open `@/openspec/AGENTS.md` when the request:
+ - Mentions planning or proposals (words like proposal, spec, change, plan)
+ - Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
+ - Sounds ambiguous and you need the authoritative spec before coding
+ Use `@/openspec/AGENTS.md` to learn:
+ - How to create and apply change proposals
+ - Spec format and conventions
... and 67 more added lines
```

</details>

### `DOCKER.md`

<details>
<summary>View changes</summary>

```diff
+ ### Standalone Service Deployment (Coolify, PaaS, etc.)
+ **Setup:** Each service deployed as an independent resource on separate servers or platforms.
+ This approach uses dedicated compose files for each service, ideal for:
+ - **Coolify** deployments where each service is a separate resource
+ - **PaaS platforms** that deploy single-service configurations
+ - **Multi-server setups** where each server runs one service type
+ - **Independent scaling** of individual services
+ **Compose Files:**
+ - `docker-compose.api.yml` - API service only
+ - `docker-compose.worker.yml` - Worker service only
... and 66 more added lines
```

</details>

### `Dockerfile`

<details>
<summary>View changes</summary>

```diff
- COPY packages/nestjs-neo4jsonapi ./packages/nestjs-neo4jsonapi/
- COPY packages/nextjs-jsonapi ./packages/nextjs-jsonapi/
- # Install all dependencies once (including dev deps for build targets)
- RUN pnpm install --frozen-lockfile
- # SHARED PACKAGE BUILD (DEVELOPMENT) - Built ONCE and reused by dev services
- FROM workspace-deps AS shared-builder
- # Build nestjs-neo4jsonapi package
- WORKDIR /app/packages/nestjs-neo4jsonapi
- # Build nextjs-jsonapi package
- WORKDIR /app/packages/nextjs-jsonapi
... and 64 more removed lines
+ # Set Transformers.js cache directory (models will be downloaded on first startup in dev)
+ # Copy model configuration (single source of truth for all ML models)
+ COPY --from=api-builder /app/apps/api/config/models.config.yaml /app/config/models.config.yaml
+ # Model cache directory for unified ModelManagerService
+ # Models are downloaded on first startup from: https://huggingface.co/carlonicora/only35-models
+ ENV MODELS_CACHE_DIR=/app/.cache/models
+ # Path to model configuration (single source of truth)
+ ENV MODEL_CONFIG_PATH=/app/config/models.config.yaml
```

</details>

### `README.md`

<details>
<summary>View changes</summary>

```diff
- # only35
+ # Only 35
+ **Photography Digital Asset Management**
+ Only 35 is a comprehensive digital asset management platform designed for professional photographers. It combines powerful organization tools with AI-driven intelligence to help you manage, discover, and share your photography work efficiently.
+ ---
+ ## What is Only 35?
+ Only 35 transforms how photographers manage their image libraries. Built for professionals who need more than basic file storage, it provides intelligent organization, semantic search capabilities, and seamless client collaboration tools.
+ Whether you're a portrait photographer managing thousands of client sessions, a studio handling multiple projects, or an agency coordinating large-scale productions, Only 35 gives you the tools to stay organized and deliver exceptional work to your clients.
+ **The name "Only 35" pays homage to 35mm film photography** - the format that defined professional photography for generations. Like a well-organized film archive, Only 35 helps you manage your digital captures with the same care and precision.
+ ---
+ ## Key Features
... and 212 more added lines
```

</details>

### `apps/api/nest-cli.json`

<details>
<summary>View changes</summary>

```diff
+       },
+         "include": "assets/**/*",
```

</details>

### `apps/api/package.json`

<details>
<summary>View changes</summary>

```diff
-     "@aws-sdk/client-s3": "^3.948.0",
-     "@aws-sdk/s3-request-presigner": "^3.948.0",
-     "@azure/msal-node": "^3.8.4",
-     "@azure/storage-blob": "^12.29.1",
-     "@fastify/multipart": "^9.3.0",
-     "@langchain/aws": "^1.1.0",
-     "@langchain/community": "^1.0.7",
-     "@langchain/core": "^1.1.4",
-     "@langchain/langgraph": "^1.0.4",
-     "@langchain/ollama": "^1.0.3",
... and 46 more removed lines
+     "@aws-sdk/client-s3": "^3.975.0",
+     "@aws-sdk/s3-request-presigner": "^3.975.0",
+     "@azure/msal-node": "^5.0.2",
+     "@azure/storage-blob": "^12.30.0",
+     "@fastify/multipart": "^9.4.0",
+     "@huggingface/transformers": "^3.8.1",
+     "@langchain/aws": "^1.2.1",
+     "@langchain/community": "^1.1.7",
+     "@langchain/core": "^1.1.17",
... (truncated)
```

</details>

### `apps/api/tsconfig.json`

<details>
<summary>View changes</summary>

```diff
+     "types": ["vitest/globals", "node"],
```

</details>

### `apps/api/vitest.config.ts`

<details>
<summary>View changes</summary>

```diff
+     setupFiles: ["./vitest.setup.ts"],
+     silent: true,
+     reporters: ["default"],
+     onConsoleLog: () => false,
```

</details>

### `apps/web/components.json`

<details>
<summary>View changes</summary>

```diff
-     "css": "src/app/globals.css",
+     "css": "app/globals.css",
```

</details>

### `apps/web/eslint.config.mjs`

<details>
<summary>View changes</summary>

```diff
+ import i18next from "eslint-plugin-i18next";
+     plugins: {
+       i18next: i18next,
+       // Detect hardcoded strings in JSX (set to "warn" to find all, "off" for production)
+       "i18next/no-literal-string": ["warn", {
+         mode: "jsx-text-only",
+       }],
+     // Disable i18n literal string checks in test files
+     files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"],
+       "i18next/no-literal-string": "off",
```

</details>

### `apps/web/messages/en.json`

<details>
<summary>View changes</summary>

```diff
-   "foundations": {
-     "auth": {
-       "accept_invitation": "Accept Invitation",
-       "account_activated": "Account Activated",
-       "account_activated_description": "Your account is ready. Log in to access Phlow",
-       "activation_description": "Your account has been successfully activated. You will be redirected to the login page shortly.",
-       "activation_wait": "Please wait while your account is being activated...",
-       "add_email_to_reset": "Please add your email to reset your password.",
-         "forgot_password": "Forgot Password?",
-         "login": "Login",
... and 97 more removed lines
+   "ui": {
+       "actions": "Actions",
+       "add": "Add",
+       "close": "Close",
+       "clear": "Clear",
+       "done": "Done",
+       "download": "Download",
+       "downloading": "Downloading...",
+       "edit": "Edit",
... (truncated)
```

</details>

### `apps/web/next-env.d.ts`

<details>
<summary>View changes</summary>

```diff
- import "./.next/types/routes.d.ts";
+ import "./.next/dev/types/routes.d.ts";
```

</details>

### `apps/web/next.config.js`

<details>
<summary>View changes</summary>

```diff
-   pageExtensions: ["ts", "tsx"],
-       // Scripts: self, Stripe, Google Maps, and unsafe-inline/eval for Next.js
-       "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
-       // Connect: self, API (http + ws for socket.io), Stripe, Google, and storage (for uploads)
-       "connect-src 'self' https://api.stripe.com https://maps.googleapis.com " +
-         (process.env.NEXT_PUBLIC_API_URL
-           ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
-           : "") +
-       // Frames: only Stripe for payment elements
-       "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
... and 1 more removed lines
+ const createMDX = require("@next/mdx");
+ const withMDX = createMDX({
+   extension: /\.mdx?$/,
+ });
+   pageExtensions: ["ts", "tsx", "mdx"],
+       // Scripts: self, Stripe, Google Maps, Turnstile, and unsafe-inline/eval for Next.js
+       "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://challenges.cloudflare.com",
+       // Connect: self, API (http + ws for socket.io), Stripe, Google, Turnstile, and storage (for uploads)
+       "connect-src 'self' https://api.stripe.com https://maps.googleapis.com https://challenges.cloudflare.com " +
... (truncated)
```

</details>

### `apps/web/package.json`

<details>
<summary>View changes</summary>

```diff
-   "packageManager": "pnpm@10.27.0",
-     "@aws-sdk/lib-storage": "^3.964.0",
-     "@aws-sdk/s3-request-presigner": "^3.964.0",
-     "@aws-sdk/xhr-http-handler": "^3.957.0",
-     "@base-ui/react": "^1.0.0",
-     "@next/third-parties": "16.1.1",
-     "@stripe/stripe-js": "^8.6.1",
-     "framer-motion": "^12.24.10",
-     "i18next": "^25.7.3",
-     "jotai": "^2.16.1",
... and 18 more removed lines
+   "packageManager": "pnpm@10.28.1",
+     "@aws-sdk/lib-storage": "^3.975.0",
+     "@aws-sdk/s3-request-presigner": "^3.975.0",
+     "@aws-sdk/xhr-http-handler": "^3.972.0",
+     "@base-ui/react": "^1.1.0",
+     "@mdx-js/loader": "^3.1.1",
+     "@mdx-js/react": "^3.1.1",
+     "@next/mdx": "^16.1.4",
+     "@next/third-parties": "16.1.4",
... (truncated)
```

</details>

### `apps/web/public/sw.js`

<details>
<summary>View changes</summary>

```diff
- self.addEventListener("push", function (event) {
-   var title = data.title || "Notification";
-     body: data.message || "You have a new notification",
-     icon: "/logo.webp",
- self.addEventListener("notificationclick", function (event) {
-         type: "window",
-         if (windowClient.url === event.notification.data && "focus" in windowClient) {
+ // =============================================================================
+ // Only35 Service Worker
+ // Version: 1.0.0
+ // =============================================================================
+ const CACHE_VERSION = 'v1';
+ const CACHE_NAMES = {
+   static: `only35-static-${CACHE_VERSION}`,
+   dynamic: `only35-dynamic-${CACHE_VERSION}`,
+   images: `only35-images-${CACHE_VERSION}`,
+   api: `only35-api-${CACHE_VERSION}`,
... and 230 more added lines
```

</details>

### `apps/web/tsconfig.json`

<details>
<summary>View changes</summary>

```diff
-   "include": [
-     "next-env.d.ts",
-     "**/*.ts",
-     "**/*.tsx",
-     "**/*.mdx",
-     "**/*.test.ts",
-     ".next/types/**/*.ts"
-   ],
+   "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "**/*.mdx", "**/*.test.ts", ".next/types/**/*.ts"],
```

</details>

### `apps/web/vitest.config.ts`

<details>
<summary>View changes</summary>

```diff
-       exclude: [
-         "src/**/*.{test,spec}.{ts,tsx}",
-         "src/**/*.d.ts",
-         "src/**/index.ts",
-       ],
+   css: {
+     // Disable PostCSS processing in tests to avoid plugin resolution issues
+     postcss: {},
+     silent: true,
+     reporters: ["default"],
+     onConsoleLog: () => false,
+       exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.d.ts", "src/**/index.ts"],
+     server: {
+       deps: {
+         // Inline workspace packages so CI doesn't use pre-bundled npm versions
... and 2 more added lines
```

</details>

### `apps/web/vitest.setup.ts`

<details>
<summary>View changes</summary>

```diff
- // Re-export testing utilities from nextjs-jsonapi for convenience
- // These are available in tests via direct import from @carlonicora/nextjs-jsonapi/testing
- export {
-   MockJsonApiProvider,
-   renderWithProviders,
-   createMockApiData,
-   createMockResponse,
-   createMockService,
- } from "@carlonicora/nextjs-jsonapi/testing";
+ // Mock shepherd.js CSS import to avoid PostCSS processing issues
+ // This is needed because @carlonicora/nextjs-jsonapi/components re-exports
+ // OnboardingContext which imports shepherd.js/dist/css/shepherd.css
+ vi.mock("shepherd.js/dist/css/shepherd.css", () => ({}));
+ // Note: Testing utilities from @carlonicora/nextjs-jsonapi/testing should be
+ // imported directly in test files, not re-exported here to avoid loading
+ // the package before mocks are applied.
+ // Mock next-intl/navigation (required for components using i18n routing)
+ vi.mock("next-intl/navigation", () => ({
+   createNavigation: () => ({
... and 11 more added lines
```

</details>

### `docker-compose.yml`

<details>
<summary>View changes</summary>

```diff
+   # vision ai
+   VISION_PROVIDER: ${VISION_PROVIDER:-}
+   VISION_API_KEY: ${VISION_API_KEY:-}
+   VISION_MODEL: ${VISION_MODEL:-}
+   VISION_URL: ${VISION_URL:-}
+   VISION_REGION: ${VISION_REGION:-}
+   VISION_SECRET: ${VISION_SECRET:-}
+   VISION_INSTANCE: ${VISION_INSTANCE:-}
+   VISION_API_VERSION: ${VISION_API_VERSION:-}
+   VISION_INPUT_COST_PER_1M_TOKENS: ${VISION_INPUT_COST_PER_1M_TOKENS:-}
... and 2 more added lines
```

</details>

### `.env.example`

<details>
<summary>View changes</summary>

```diff
+ # ENVIRONMENT VARIABLE REFERENCE
+ #
+ # SERVICE REQUIREMENTS FOR STANDALONE DEPLOYMENT:
+ # -----------------------------------------------
+ # When deploying services independently (docker-compose.api.yml, etc.),
+ # each service requires different environment variables:
+ #
+ # API SERVICE (docker-compose.api.yml):
+ #   Required: NEO4J_*, REDIS_*, S3_*, JWT_SECRET, API_URL, API_PORT
+ #   Optional: AI_*, EMBEDDER_*, TRANSCRIBER_*, CORS_*, RATE_LIMIT_*, CACHE_*
... and 48 more added lines
```

</details>

### `.gitignore`

<details>
<summary>View changes</summary>

```diff
+ # Auto Claude data directory
+ .worktrees/
+ # Auto Claude data directory
+ .auto-claude/
+ # ONNX Models (downloaded at runtime)
+ apps/api/models
```

</details>

### `.npmrc`

<details>
<summary>View changes</summary>

```diff
+ public-hoist-pattern[]=@tensorflow/*
+ public-hoist-pattern[]=@vladmandic/face-api
```

</details>

### `package.json`

<details>
<summary>View changes</summary>

```diff
-   "version": "0.1.0",
-   "packageManager": "pnpm@10.27.0",
-     "test": "turbo run test",
-     "zod": "^4.3.5"
-     "@types/node": "^25.0.3",
-     "@typescript-eslint/eslint-plugin": "^8.52.0",
-     "@typescript-eslint/parser": "^8.52.0",
-     "eslint-plugin-prettier": "^5.5.4",
-     "prettier": "^3.7.4",
-     "turbo": "^2.7.3",
... and 9 more removed lines
+   "version": "1.39.0",
+   "packageManager": "pnpm@10.28.1",
+     "test": "turbo run test --concurrency=1",
+     "test:verbose": "turbo run test",
+     "zod": "^4.3.6"
+     "@types/node": "^25.0.10",
+     "@typescript-eslint/eslint-plugin": "^8.53.1",
+     "@typescript-eslint/parser": "^8.53.1",
+     "eslint-plugin-prettier": "^5.5.5",
... (truncated)
```

</details>

### `packages/shared/package.json`

<details>
<summary>View changes</summary>

```diff
-     "tslib": "^2.6.0"
+     "tslib": "^2.6.0",
+     "zod": "^4.3.6"
```

</details>

### `scripts/apply-production-versions.js`

<details>
<summary>View changes</summary>

```diff
-       console.log(`${file}: ${dep} → ${version}`);
- console.log('Production versions applied.');
```

</details>

### `versions.production.json`

<details>
<summary>View changes</summary>

```diff
-   "@carlonicora/nestjs-neo4jsonapi": "1.2.0",
-   "@carlonicora/nextjs-jsonapi": "1.1.0"
+   "@carlonicora/nestjs-neo4jsonapi": "1.43.0",
+   "@carlonicora/nextjs-jsonapi": "1.41.1"
```

</details>

---

## Additions

Files in target that don't exist in template (project-specific code).

### Documentation

- `AGENTS.md`
- `AI-ARCHITECTURE-GUIDE.md`
- `CONTRIBUTING.md`
- `EXTEND-USER.md`
- `apps/api/scripts/README.md`

### Other

<details>
<summary>other/ (108 files)</summary>

- `.husky/_/.gitignore`
- `.husky/_/applypatch-msg`
- `.husky/_/commit-msg`
- `.husky/_/h`
- `.husky/_/husky.sh`
- `.husky/_/post-applypatch`
- `.husky/_/post-checkout`
- `.husky/_/post-commit`
- `.husky/_/post-merge`
- `.husky/_/post-rewrite`
- `.husky/_/pre-applypatch`
- `.husky/_/pre-auto-gc`
- `.husky/_/pre-commit`
- `.husky/_/pre-merge-commit`
- `.husky/_/pre-push`
- `.husky/_/pre-rebase`
- `.husky/_/prepare-commit-msg`
- `.ruff_cache/.gitignore`
- `.ruff_cache/0.12.5/16256018957079928054`
- `.ruff_cache/CACHEDIR.TAG`
- `apps/.DS_Store`
- `apps/api/.DS_Store`
- `apps/api/.cache/models/onnx/age-gender/age-gender-classifier.onnx`
- `apps/api/.cache/models/onnx/age-gender/age-gender-classifier.onnx.metadata`
- `apps/api/.cache/models/onnx/arcface/arcface.onnx`
- `apps/api/.cache/models/onnx/arcface/arcface.onnx.metadata`
- `apps/api/.cache/models/onnx/emotion/emotion-ferplus-8.onnx`
- `apps/api/.cache/models/onnx/emotion/emotion-ferplus-8.onnx.metadata`
- `apps/api/.cache/models/onnx/mediapipe/MediaPipeFaceLandmarkDetector.onnx`
- `apps/api/.cache/models/onnx/mediapipe/MediaPipeFaceLandmarkDetector.onnx.metadata`
- `apps/api/.cache/models/onnx/nsfw-5class/nsfw-5class.onnx`
- `apps/api/.cache/models/onnx/nsfw-5class/nsfw-5class.onnx.data`
- `apps/api/.cache/models/onnx/nsfw-5class/nsfw-5class.onnx.data.metadata`
- `apps/api/.cache/models/onnx/nsfw-5class/nsfw-5class.onnx.metadata`
- `apps/api/.cache/models/onnx/nsfw-binary/nsfw-classifier.onnx`
- `apps/api/.cache/models/onnx/nsfw-binary/nsfw-classifier.onnx.data`
- `apps/api/.cache/models/onnx/nsfw-binary/nsfw-classifier.onnx.data.metadata`
- `apps/api/.cache/models/onnx/nsfw-binary/nsfw-classifier.onnx.metadata`
- `apps/api/.cache/models/onnx/nudenet/nudenet-detector.onnx`
- `apps/api/.cache/models/onnx/nudenet/nudenet-detector.onnx.metadata`
- `apps/api/.cache/models/onnx/scrfd/det_2.5g.onnx`
- `apps/api/.cache/models/onnx/scrfd/det_2.5g.onnx.metadata`
- `apps/api/.cache/models/onnx/yolo-pose/yolo11l-pose.onnx`
- `apps/api/.cache/models/onnx/yolo-pose/yolo11l-pose.onnx.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/config.json`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/config.json.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/onnx/model.onnx`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/onnx/model.onnx.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/onnx/vision_model.onnx`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/onnx/vision_model.onnx.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/preprocessor_config.json`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/preprocessor_config.json.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/tokenizer.json`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/tokenizer.json.metadata`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/tokenizer_config.json`
- `apps/api/.cache/models/transformers/clip-vit-base-patch32/tokenizer_config.json.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/config.json`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/config.json.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/onnx/text_model.onnx`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/onnx/text_model.onnx.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/onnx/vision_model.onnx`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/onnx/vision_model.onnx.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/preprocessor_config.json`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/preprocessor_config.json.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/tokenizer.json`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/tokenizer.json.metadata`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/tokenizer_config.json`
- `apps/api/.cache/models/transformers/marqo-fashionSigLIP/tokenizer_config.json.metadata`
- `apps/api/config/models.config.yaml`
- `apps/api/scripts/compute-all-model-hashes.ts`
- `apps/api/scripts/download-transformers-models.ts`
- `apps/api/scripts/validate-image-analysis.js`
- `apps/api/scripts/validate-image-analysis.ts`
- `apps/api/templates/email/en/activationEmail.hbs`
- `apps/api/templates/email/en/contactFormNotification.hbs`
- `apps/api/templates/email/en/contactSheetCompleted.hbs`
- `apps/api/templates/email/en/contactSheetInvite.hbs`
- `apps/api/templates/email/en/moodboardCompleted.hbs`
- `apps/api/templates/email/en/preferenceProfileReady.hbs`
- `apps/api/templates/email/en/registrationAdminNotification.hbs`
- `apps/api/templates/email/en/waitlistAdminNotification.hbs`
- `apps/api/templates/email/en/waitlistConfirmation.hbs`
- `apps/api/templates/email/en/waitlistInvitation.hbs`
- `apps/api/templates/email/footer.hbs`
- `apps/api/templates/email/header.hbs`
- `apps/api/vitest.setup.ts`
- `apps/web/.DS_Store`
- `apps/web/mdx-components.tsx`
- `apps/web/messages/it.json`
- `apps/web/public/favicon.ico`
- `apps/web/public/icons/apple-touch-icon.png`
- `apps/web/public/icons/favicon-96x96.png`
- `apps/web/public/icons/web-app-manifest-128x128.png`
- `apps/web/public/icons/web-app-manifest-144x144.png`
- `apps/web/public/icons/web-app-manifest-152x152.png`
- `apps/web/public/icons/web-app-manifest-192x192-maskable.png`
- `apps/web/public/icons/web-app-manifest-192x192.png`
- `apps/web/public/icons/web-app-manifest-384x384.png`
- `apps/web/public/icons/web-app-manifest-512x512-maskable.png`
- `apps/web/public/icons/web-app-manifest-512x512.png`
- `apps/web/public/icons/web-app-manifest-72x72.png`
- `apps/web/public/logo.webp`
- `apps/web/public/manifest.json`
- `apps/web/public/splash/apple-splash-1125x2436.png`
- `apps/web/public/splash/apple-splash-1242x2208.png`
- `apps/web/public/splash/apple-splash-1284x2778.png`
- `apps/web/public/splash/apple-splash-640x1136.png`
- `apps/web/public/splash/apple-splash-750x1334.png`

</details>

### Root Files

- `.gitattributes`
- `Dockerfile.backup`
- `docker-compose.api.yml`
- `docker-compose.web.yml`
- `docker-compose.worker.yml`

### Scripts

- `scripts/find-duplicate-translations.js`
- `scripts/update.sh`
- `scripts/validate-translations.js`

### Shared Package

<details>
<summary>packages/shared/ (27 files)</summary>

- `packages/shared/src/contact-link/contact-link.constants.ts`
- `packages/shared/src/contact-sheet/index.ts`
- `packages/shared/src/critique/critique.schema.ts`
- `packages/shared/src/critique/index.ts`
- `packages/shared/src/metadata/cardinality.ts`
- `packages/shared/src/metadata/categories.ts`
- `packages/shared/src/metadata/exif-categories.ts`
- `packages/shared/src/metadata/index.ts`
- `packages/shared/src/metadata/types.ts`
- `packages/shared/src/metadata/values/age-group.ts`
- `packages/shared/src/metadata/values/body-part.ts`
- `packages/shared/src/metadata/values/body-position.ts`
- `packages/shared/src/metadata/values/body-type.ts`
- `packages/shared/src/metadata/values/camera-angle.ts`
- `packages/shared/src/metadata/values/color-mode.ts`
- `packages/shared/src/metadata/values/facial-expression.ts`
- `packages/shared/src/metadata/values/framing.ts`
- `packages/shared/src/metadata/values/gender.ts`
- `packages/shared/src/metadata/values/genre.ts`
- `packages/shared/src/metadata/values/index.ts`
- `packages/shared/src/metadata/values/lighting-style.ts`
- `packages/shared/src/metadata/values/nudity-level.ts`
- `packages/shared/src/metadata/values/people-count.ts`
- `packages/shared/src/metadata/values/photo-feature.ts`
- `packages/shared/src/metadata/values/setting.ts`
- `packages/shared/src/moodboard/discovery-config.ts`
- `packages/shared/src/moodboard/index.ts`

</details>

### Tests

<details>
<summary>tests/ (9 files)</summary>

- `apps/web/__tests__/sample-component.test.tsx`
- `apps/web/__tests__/sample-service.test.ts`
- `apps/web/src/components/dialogs/__tests__/AddReviewerDialog.spec.tsx`
- `apps/web/src/components/dialogs/__tests__/ExpirationDialog.spec.tsx`
- `apps/web/src/components/dialogs/__tests__/ExpireNowDialog.spec.tsx`
- `apps/web/src/components/dialogs/__tests__/PersonReviewDialog.spec.tsx`
- `apps/web/src/components/dialogs/__tests__/ReviewerShareDialog.spec.tsx`
- `apps/web/src/components/forms/__tests__/GenericMultiSelector.spec.tsx`
- `apps/web/src/components/forms/__tests__/GenericSelector.spec.tsx`

</details>

### Web Source

<details>
<summary>apps/web/ (72 files)</summary>

- `apps/web/src/app/[locale]/(admin)/administration/waitlist/page.tsx`
- `apps/web/src/app/[locale]/(auth)/auth/consent/page.tsx`
- `apps/web/src/app/[locale]/(auth)/oauth/authorize/OAuthAuthorizeClient.tsx`
- `apps/web/src/app/[locale]/(blocked)/layout.tsx`
- `apps/web/src/app/[locale]/(blocked)/trial-expired/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/account/[section]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/account/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/categories/[category]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/categories/[category]/subcategories/[subcategory]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/categories/[category]/subcategories/[subcategory]/photographs/[photographId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/categories/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/collections/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/collections/[id]/photographs/[photographId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/collections/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/contactsheets/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/contactsheets/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/culls/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/culls/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/discovery/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/galleries/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/galleries/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/libraries/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/moodboards/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/moodboards/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/persons/[id]/[[...section]]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/persons/[id]/photographs/[photographId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/persons/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/persons/unassigned/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/photographs/processing/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/photographs/search/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/pose-catalog/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/pose-catalog/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/rolls/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/rolls/[id]/photographs/[photographId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/rolls/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/[module]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/layout.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/oauth/[clientId]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/oauth/new/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/oauth/page.tsx`
- `apps/web/src/app/[locale]/(main)/(features)/settings/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/about/page.mdx`
- `apps/web/src/app/[locale]/(marketing)/contact/page.mdx`
- `apps/web/src/app/[locale]/(marketing)/help/lightroom/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/layout.tsx`
- `apps/web/src/app/[locale]/(marketing)/pricing/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/privacy/page.mdx`
- `apps/web/src/app/[locale]/(marketing)/terms/page.mdx`
- `apps/web/src/app/[locale]/(marketing)/waitlist/confirm/[code]/page.tsx`
- `apps/web/src/app/[locale]/(marketing)/waitlist/page.tsx`
- `apps/web/src/app/[locale]/(persons)/layout.tsx`
- `apps/web/src/app/[locale]/(persons)/welcome/[personId]/contact-sheets/[id]/page.tsx`
- `apps/web/src/app/[locale]/(persons)/welcome/[personId]/galleries/[id]/page.tsx`
- `apps/web/src/app/[locale]/(persons)/welcome/[personId]/moodboards/[id]/page.tsx`
- `apps/web/src/app/[locale]/offline/page.tsx`
- `apps/web/src/app/api/contact/route.ts`
- `apps/web/src/app/api/optimiseImage/route.ts`
- `apps/web/src/app/api/persons/[personId]/photographs/[photographId]/image/route.ts`
- `apps/web/src/components/dialogs/AddReviewerDialog.tsx`
- `apps/web/src/components/dialogs/ExpirationDialog.tsx`
- `apps/web/src/components/dialogs/ExpireNowDialog.tsx`
- `apps/web/src/components/dialogs/PersonReviewDialog.tsx`
- `apps/web/src/components/dialogs/ReviewerShareDialog.tsx`
- `apps/web/src/components/forms/GenericMultiSelector.tsx`
- `apps/web/src/components/forms/GenericSelector.tsx`
- `apps/web/src/config/waitlist.config.ts`
- `apps/web/src/hooks/usePWA.ts`
- `apps/web/src/types/file-system-access.d.ts`
- `apps/web/src/utils/clipboard.ts`
- `apps/web/src/utils/cn.ts`
- `apps/web/src/utils/dateFormatters.ts`
- `apps/web/src/utils/getPersonEmails.ts`

</details>

---

## Custom Code Changes

Application code that differs from template baseline.

### `apps/web/src/app/[locale]/(admin)/administration/companies/[id]/page.tsx`

<details>
<summary>View changes</summary>

```diff
-     ? `[${t(`types.companies`, { count: 1 })}] ${company.name}`
-     : `${t(`types.companies`, { count: 1 })}`;
+     ? `[${t(`entities.companies`, { count: 1 })}] ${company.name}`
+     : `${t(`entities.companies`, { count: 1 })}`;
```

</details>

### `apps/web/src/app/[locale]/(admin)/administration/companies/page.tsx`

<details>
<summary>View changes</summary>

```diff
-     title: t(`types.companies`, { count: 2 }),
-       <PageContainer>
+     title: t(`entities.companies`, { count: 2 }),
+       <PageContainer className="pr-4">
```

</details>

### `apps/web/src/app/[locale]/(admin)/layout.tsx`

<details>
<summary>View changes</summary>

```diff
-         <CurrentUserProvider>
-           <PushNotificationProvider>
-             <NotificationContextProvider>
-               <SidebarProvider defaultOpen={defaultOpen}>
-                 <RefreshUser />
-                 <LayoutDetails>{children}</LayoutDetails>
-               </SidebarProvider>
-             </NotificationContextProvider>
-           </PushNotificationProvider>
-         </CurrentUserProvider>
+ import { PhotographUploadManager } from "@/features/features/photograph/components/managers/PhotographUploadManager";
+ import { UploadProgressToast } from "@/features/features/photograph/components/toasts/UploadProgressToast";
+ import { OnboardingProviderWrapper } from "@/features/onboarding";
+         <OnboardingProviderWrapper>
+           <CurrentUserProvider>
+             <PhotographUploadManager />
+             <UploadProgressToast />
+             <PushNotificationProvider>
+               <NotificationContextProvider>
+                 <SidebarProvider defaultOpen={defaultOpen}>
... (truncated)
```

</details>

### `apps/web/src/app/[locale]/(auth)/oauth/authorize/page.tsx`

<details>
<summary>View changes</summary>

```diff
- "use client";
- import { useSearchParams } from "next/navigation";
- import { useMemo } from "react";
- import { OAuthConsentScreen } from "@carlonicora/nextjs-jsonapi/components";
-  * Expects the following query parameters:
- export default function OAuthAuthorizePage() {
-   const searchParams = useSearchParams();
-   const params = useMemo(
-     () => ({
-       clientId: searchParams.get("client_id") || "",
... and 12 more removed lines
+ import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
+ import { redirect } from "next/navigation";
+ import { OAuthAuthorizeClient } from "./OAuthAuthorizeClient";
+  * If the user is not logged in, redirects to login page with callback URL.
+  * Expected query parameters:
+ export default async function OAuthAuthorizePage(props: {
+   params: Promise<{ locale: string }>;
+   searchParams: Promise<Record<string, string | undefined>>;
+ }) {
... (truncated)
```

</details>

### `apps/web/src/app/[locale]/(auth)/oauth/error/page.tsx`

<details>
<summary>View changes</summary>

```diff
- import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
-  * Error code to user-friendly message mapping
- const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
-   access_denied: {
-     title: "Access Denied",
-     description: "You denied the authorization request.",
-   },
-   invalid_request: {
-     title: "Invalid Request",
-     description: "The authorization request is missing required parameters or is otherwise malformed.",
... and 36 more removed lines
+ import { AlertTriangle, ArrowLeft, Home, UserPlus } from "lucide-react";
+ import { useTranslations } from "next-intl";
+  * OAuth error codes that have specific translations
+ const KNOWN_ERROR_CODES = [
+   "access_denied",
+   "invalid_request",
+   "unauthorized_client",
+   "unsupported_response_type",
+   "invalid_scope",
... (truncated)
```

</details>

### `apps/web/src/app/[locale]/(auth)/oauth/success/page.tsx`

<details>
<summary>View changes</summary>

```diff
-       await navigator.clipboard.writeText(code);
-           <CardTitle className="text-2xl">Authorization Successful</CardTitle>
-             Copy the authorization code below and paste it into your application.
-             <Label htmlFor="code">Authorization Code</Label>
-             <p className="font-medium mb-2">Instructions:</p>
-               <li>Copy the authorization code above</li>
-               <li>Return to your application</li>
-               <li>Paste the code when prompted</li>
-             This code expires in 10 minutes and can only be used once.
+ import { useTranslations } from "next-intl";
+   const t = useTranslations();
+       // Try modern clipboard API first (requires secure context)
+       if (navigator.clipboard && window.isSecureContext) {
+         await navigator.clipboard.writeText(code);
+       } else {
+         // Fallback for non-secure contexts (http://*.test, etc.)
+         const textArea = document.createElement("textarea");
+         textArea.value = code;
+         textArea.style.position = "fixed";
... and 14 more added lines
```

</details>

### `apps/web/src/app/[locale]/(main)/(foundations)/users/[id]/error.tsx`

<details>
<summary>View changes</summary>

```diff
- export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
-   const customError = JSON.parse(error.message);
-         <ErrorDetails code={customError.code ?? 500} message={customError.message ?? error} />
+ import { useMessages } from "next-intl";
+ function parseErrorMessage(message: string): { code: number; message: string | null } {
+   try {
+     return JSON.parse(message);
+   } catch {
+     return { code: 500, message: null };
+   }
+ export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
+   const messages = useMessages() as any;
+   const customError = parseErrorMessage(error.message);
... and 9 more added lines
```

</details>

### `apps/web/src/app/[locale]/(main)/(foundations)/users/[id]/page.tsx`

<details>
<summary>View changes</summary>

```diff
-   let title = `${t(`types.users`, { count: 1 })}`;
-     title = `[${t(`types.users`, { count: 1 })}] ${user.name}`;
+   let title = `${t(`entities.users`, { count: 1 })}`;
+     title = `[${t(`entities.users`, { count: 1 })}] ${user.name}`;
```

</details>

### `apps/web/src/app/[locale]/(main)/error.tsx`

<details>
<summary>View changes</summary>

```diff
- import { useMessages } from "next-intl";
-   const [status, message] = error.message.split(`:`) as any[];
-   if ((error.status ?? +status) === 401) {
-   if ((error.status ?? +status) === 404) {
-     return <ErrorPage code={404} reset={reset} messages={messages} />;
-   if ((error.status ?? +status) === 500 || (error.status ?? +status) === 503) {
-     return <ErrorPage code={error.status ?? status} reset={reset} messages={messages} />;
-         code={error.status ?? +status}
-         title={`Something went wrong!`}
-         message={message ?? error.message ?? "An unexpected error occurred."}
... and 3 more removed lines
+ import { useMessages, useTranslations } from "next-intl";
+ import { useRouter } from "next/navigation";
+ /**
+  * Extract status code and message from an error object.
+  * Handles both error.status property and "status:message" format in error.message.
+  */
+ function parseError(error: Error & { status?: number }): { statusCode: number; errorMessage: string } {
+   let statusCode: number | undefined = error.status;
+   let errorMessage: string = error.message ?? "An unexpected error occurred.";
... (truncated)
```

</details>

### `apps/web/src/app/[locale]/(main)/layout.tsx`

<details>
<summary>View changes</summary>

```diff
- import { AuthContainer, PushNotificationProvider, RefreshUser, SidebarProvider } from "@carlonicora/nextjs-jsonapi/components";
- import { AuthComponent } from "@carlonicora/nextjs-jsonapi/core";
-       <div className="flex min-h-screen w-full flex-col items-center justify-center">
-         <AuthContainer componentType={AuthComponent.Landing} />
-   // if (await ServerSession.isLicenseActive())
-         <PushNotificationProvider>
-           <NotificationContextProvider>
-             <SidebarProvider defaultOpen={defaultOpen}>
-               <RefreshUser />
-               <LayoutDetails>{children}</LayoutDetails>
... and 4 more removed lines
+ import "@carlonicora/nextjs-jsonapi/contexts/styles.css";
+ import { TrialBlockingWrapper } from "@/features/common/components/wrappers/TrialBlockingWrapper";
+ import { PhotographUploadManager } from "@/features/features/photograph/components/managers/PhotographUploadManager";
+ import { GlobalFolderDropZone } from "@/features/features/photograph/components/overlays/GlobalFolderDropZone";
+ import { UploadProgressToast } from "@/features/features/photograph/components/toasts/UploadProgressToast";
+ import { MarketingHeader } from "@/features/marketing/components/layout/MarketingHeader";
+ import { MarketingFooter } from "@/features/marketing/components/layout/MarketingFooter";
+ import {
+   PushNotificationProvider,
... (truncated)
```

</details>

### `apps/web/src/app/[locale]/(main)/page.tsx`

<details>
<summary>View changes</summary>

```diff
- import IndexContainer from "@/features/common/components/containers/IndexContainer";
- import { AuthContainer, CompaniesList, PageContainer } from "@carlonicora/nextjs-jsonapi/components";
- import { AuthComponent } from "@carlonicora/nextjs-jsonapi/core";
-   return await generateSpecificMetadata({ title: t(`generic.home`) });
-   if (!(await ServerSession.isLogged())) return <AuthContainer componentType={AuthComponent.Landing} />;
-             <CompaniesList />
-       <PageContainer testId="page-homepage-container">
-         <IndexContainer />
+ import DashboardContainer from "@/features/features/dashboard/components/containers/DashboardContainer";
+ import { AISection } from "@/features/marketing/components/sections/AISection";
+ import { CollaborationSection } from "@/features/marketing/components/sections/CollaborationSection";
+ import { CTASection } from "@/features/marketing/components/sections/CTASection";
+ import { FreedomSection } from "@/features/marketing/components/sections/FreedomSection";
+ import { HeroSection } from "@/features/marketing/components/sections/HeroSection";
+ import { OrganizationSection } from "@/features/marketing/components/sections/OrganizationSection";
+ import { PricingSection } from "@/features/marketing/components/sections/PricingSection";
+ import { SocialProofSection } from "@/features/marketing/components/sections/SocialProofSection";
+ import { PageContainer } from "@carlonicora/nextjs-jsonapi/components";
... and 38 more added lines
```

</details>

### `apps/web/src/app/[locale]/layout.tsx`

<details>
<summary>View changes</summary>

```diff
- import { TooltipProvider } from "@carlonicora/nextjs-jsonapi/components";
- import { Toaster } from "sonner";
-                   <Toaster closeButton richColors />
-                   {children}
+ import { PWAProvider } from "@/features/pwa/components";
+ import { Toaster, TooltipProvider } from "@carlonicora/nextjs-jsonapi/components";
+ import type { Viewport, Metadata } from "next";
+ export const viewport: Viewport = {
+   themeColor: [
+     { media: "(prefers-color-scheme: light)", color: "#ffffff" },
+     { media: "(prefers-color-scheme: dark)", color: "#000000" },
+   ],
+   width: "device-width",
+   initialScale: 1,
... and 43 more added lines
```

</details>

### `apps/web/src/app/globals.css`

<details>
<summary>View changes</summary>

```diff
-     @apply border-border;
+ @plugin "@tailwindcss/typography";
+   .grid-cols-subgrid {
+     grid-template-columns: subgrid;
+ /* =============================================================================
+    PWA Safe Area Support for Notched Devices
+    ============================================================================= */
+ /* Ensure viewport fit cover is respected */
+ @supports (padding: env(safe-area-inset-top)) {
+   /* Safe area padding for notched devices */
+   .safe-area-inset {
... and 33 more added lines
```

</details>

### `apps/web/src/config/Bootstrapper.ts`

<details>
<summary>View changes</summary>

```diff
+   BackupCodeVerifyModule,
+   PasskeyModule,
+   PasskeyRegistrationOptionsModule,
+   PasskeyRegistrationVerifyModule,
+   PasskeyRenameModule,
+   PasskeyVerifyLoginModule,
+   PasskeyAuthenticationOptionsModule,
+   StripePromotionCodeModule,
+   TotpAuthenticatorModule,
+   TotpSetupModule,
... and 70 more added lines
```

</details>

### `apps/web/src/config/env.ts`

<details>
<summary>View changes</summary>

```diff
+ import "./waitlist.config";
+   registrationMode: ENV.REGISTRATION_MODE,
```

</details>

### `apps/web/src/config/middleware-env.ts`

<details>
<summary>View changes</summary>

```diff
+   REGISTRATION_MODE: (process.env.NEXT_PUBLIC_REGISTRATION_MODE as "open" | "closed" | "waitlist") || "open",
```

</details>

### `apps/web/src/enums/feature.ids.ts`

<details>
<summary>View changes</summary>

```diff
+   Standard = "88b20287-d4a1-4ca7-97a1-76b93e205ba3",
+   ArtificialIntelligence = "2b8a56c5-8dee-46a1-95f4-3ba7daf34aa2",
+   CustomerManagement = "9e582ddf-a1be-44ce-9537-14dadc747253",
+   Culling = "00121527-52b8-4cb2-a1e5-19fb1855de9d",
```

</details>

### `apps/web/src/i18n/useDateFnsLocale.ts`

<details>
<summary>View changes</summary>

```diff
- import { enUS, it } from "date-fns/locale";
-   en: enUS,
-   return dateFnsLocales[locale] ?? enUS;
+ import { enGB, it } from "date-fns/locale";
+   en: enGB,
+   return dateFnsLocales[locale] ?? enGB;
```

</details>

### `apps/web/src/proxy.ts`

<details>
<summary>View changes</summary>

```diff
-     const uri = `${process.env.NEXT_PUBLIC_API_URL}auth/refreshtoken/${refreshToken}`;
+     const uri = `${process.env.NEXT_PUBLIC_API_URL}authOverride/refreshtoken/${refreshToken}`;
```

</details>

### `apps/web/src/server-actions/auth-cookies.ts`

<details>
<summary>View changes</summary>

```diff
-   licenseExpirationDate?: Date;
-   if (params.licenseExpirationDate)
-       name: "licenseExpirationDate",
-       value: params.licenseExpirationDate.toISOString(),
-     name: "licenseExpirationDate",
```

</details>

### `apps/web/src/utils/metadata.ts`

<details>
<summary>View changes</summary>

```diff
-   const url = (await headers()).get("x-full-url") ?? ENV.APP_URL ?? "only35.com";
-   const title: string = params.title ? `${params.title} | ${t(`generic.title`)}` : t(`generic.title`);
-   const description = params.description ? params.description : t(`generic.description`);
-     publisher: "Phlow",
-       siteName: "Phlow",
-     metadataBase: new URL(ENV.APP_URL ?? "only35.com"),
+   const url = (await headers()).get("x-full-url") ?? ENV.APP_URL ?? "https://only35.app";
+   const title: string = params.title ? `${params.title} | ${t(`common.title`)}` : t(`common.title`);
+   const description = params.description ? params.description : t(`common.description`);
+     publisher: "Only35",
+       siteName: "Only35",
+     metadataBase: new URL(ENV.APP_URL ?? "https://only35.app"),
```

</details>

### `packages/shared/src/index.ts`

<details>
<summary>View changes</summary>

```diff
+ export * from "./contact-link/contact-link.constants";
+ export * from "./moodboard";
+ export * from "./metadata";
+ export * from "./critique";
```

</details>

---

## Identical Files (38)

<details>
<summary>Click to expand</summary>

- `.gitmodules`
- `.prettierignore`
- `.prettierrc`
- `.releaserc`
- `apps/api/.prettierrc`
- `apps/api/eslint.config.mjs`
- `apps/api/tsconfig.build.json`
- `apps/web/.swcrc`
- `apps/web/global.d.ts`
- `apps/web/playwright.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/[locale]/(auth)/activation/[code]/page.tsx`
- `apps/web/src/app/[locale]/(auth)/auth/page.tsx`
- `apps/web/src/app/[locale]/(auth)/invitation/[code]/page.tsx`
- `apps/web/src/app/[locale]/(auth)/layout.tsx`
- `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- `apps/web/src/app/[locale]/(auth)/logout/page.tsx`
- `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- `apps/web/src/app/[locale]/(auth)/reset/[code]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(foundations)/notifications/page.tsx`
- `apps/web/src/app/[locale]/(main)/(foundations)/roles/[id]/page.tsx`
- `apps/web/src/app/[locale]/(main)/(foundations)/roles/page.tsx`
- `apps/web/src/app/[locale]/(main)/(foundations)/users/[id]/loading.tsx`
- `apps/web/src/app/[locale]/(main)/(foundations)/users/page.tsx`
- `apps/web/src/config/BootstrapProvider.tsx`
- `apps/web/src/i18n/request.ts`
- `apps/web/src/i18n/routing.ts`
- `apps/web/src/instrumentation.ts`
- `apps/web/src/types/modules.d.ts`
- `apps/web/src/utils/revalidation.ts`
- `packages/shared/src/const/roles.id.ts`
- `packages/shared/src/const/system.roles.id.ts`
- `packages/shared/tsconfig.json`
- `packages/shared/tsup.config.ts`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `tsconfig.json`
- `turbo.json`

</details>
