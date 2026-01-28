#!/bin/bash
# Update all dependencies in the monorepo

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

cd ../../
