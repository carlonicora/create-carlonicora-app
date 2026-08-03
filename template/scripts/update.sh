#!/bin/bash
# Update all dependencies in the monorepo
#
# DEFERRED MAJOR BUMPS — last reviewed: 2026-05-13 (second sweep, {{name}})
#
# - eslint  ^9.39.2  (root + apps/api + apps/web + both submodules)
#     Why: @typescript-eslint v8 transitively loads utils@8.49.0 which
#          crashes on ESLint 10 (FlatESLint removed/relocated).
#     Unblock: wait for typescript-eslint to ship a release whose
#          runtime (not just peer ranges) supports ESLint 10, then
#          bump both in lockstep.
#
# - typescript  ^5.9.3  (pnpm-workspace.yaml overrides.typescript)
#     Why: tsup's dts build errors on TS 6 because shared tsconfigs use
#          deprecated `baseUrl` and `moduleResolution=node10`. The
#          frontend (web, nextjs-jsonapi) can migrate cleanly to
#          `moduleResolution: bundler` without baseUrl, but the backend
#          (apps/api, packages/shared via tsconfig.base) needs
#          `module: commonjs` for ts-node/NestJS, which forbids
#          `moduleResolution: bundler`. The "proper" migration there is
#          `module: node16` + `.js` extensions in every relative import
#          — hundreds of source files. Realistic short-term path is
#          `"ignoreDeprecations": "6.0"` in tsconfig.base.json.
#     Unblock: either add ignoreDeprecations to silence and accept the
#          deferred refactor, or do the node16/.js-extension pass.
#
# - class-validator  ^0.14.3  (pnpm-workspace.yaml overrides + apps/api +
#                              packages/nestjs-neo4jsonapi)
#     Why: peer-fingerprint pin for @nestjs/common. Mixing
#          class-validator versions between the app and the submodule
#          spawns parallel @nestjs/common resolutions, breaking
#          NestJS DI at runtime with UnknownDependenciesException.
#     Unblock: bump class-validator everywhere (submodule
#          packages/nestjs-neo4jsonapi/package.json dependencies block
#          included) in the same change set.
#
# - react / react-dom  19.2.4  (overrides + apps/web + packages/nextjs-jsonapi)
#     Why: same dual-resolution hazard as class-validator, on the
#          frontend side. Forms hooks (react-hook-form) and JSX types
#          go incoherent when app and library see different React
#          versions.
#     Unblock: bump in lockstep with the nextjs-jsonapi submodule.
#
# - stripe  ^20.3.1  (packages/nestjs-neo4jsonapi/dependencies.stripe)
#     Why: stripe v22 removed the `StripeConstructor.X` namespace
#          types (PaymentMethod, PaymentIntent, Product, etc.) — the
#          stripe foundation services + fixtures use that pattern in
#          ~40 places. Build fails with TS2694.
#     Unblock: migrate those services to use `Stripe.X` namespace
#          imports (or the new resource type imports) in a dedicated
#          change set.
#
# - react-day-picker  ^9.13.0  (apps/web + packages/nextjs-jsonapi)
#     Why: v10 removed the `table` key from `ClassNames` (and likely
#          others); shadcnui/ui/calendar.tsx fails to type-check.
#     Unblock: migrate the calendar component to v10's ClassNames shape.
#
# - @vitejs/plugin-react  ^5.1.x  (apps/web + packages/nextjs-jsonapi)
#     Why: v6 requires vite ^8; the repo (next + transitives) resolves
#          vite to 7.3.1. Vitest fails at module resolution
#          (ERR_PACKAGE_PATH_NOT_EXPORTED for './internal').
#     Unblock: when vite goes to ^8 across the stack, bump
#          @vitejs/plugin-react to ^6 in lockstep.
#
# Sanity-check current latest before retry:
#   pnpm view eslint version
#   pnpm view typescript version
#   pnpm view @typescript-eslint/parser peerDependencies
#   pnpm view stripe version
#   pnpm view react-day-picker version
#   pnpm view @vitejs/plugin-react peerDependencies

ncu -u
pnpm install

cd apps/api
ncu -u
pnpm install

cd ../web
ncu -u
pnpm install

cd ../../packages/shared
ncu -u
pnpm install

cd ../nestjs-neo4jsonapi
ncu -u
pnpm install

cd ../nextjs-jsonapi
ncu -u
pnpm install

cd ../../
