#!/bin/bash
# Update all dependencies in the monorepo

# ncu -u
ncu
# pnpm install

cd apps/api
# ncu -u
ncu
# pnpm install

cd ../web
# ncu -u
ncu
# pnpm install

cd ../../packages/shared
# ncu -u
ncu
# pnpm install

cd ../nestjs-neo4jsonapi
# ncu -u
ncu
# pnpm install

cd ../nextjs-jsonapi
# ncu -u
ncu
# pnpm install

cd ../../
