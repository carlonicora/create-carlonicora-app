#!/usr/bin/env bash
#
# Guarded dev launcher.
#
# Why this exists: `next dev` (Turbopack) writes route manifests under
# apps/web/.next. If the previous dev session is killed uncleanly (terminal
# hard-closed, SIGKILL, crash) while a manifest is mid-write, .next is left
# inconsistent and Next serves random 404s for pages that exist on disk.
#
# This wrapper drops a lock file on start and removes it on a clean exit
# (Ctrl-C / SIGTERM / normal exit, via the trap). If the lock is still present
# on the next start, the previous run did NOT exit cleanly, so we clear .next
# proactively — turning the random 404 into a one-time automatic reset.
#
# It ALSO clears .next when it holds a *production* build. `pnpm build` (next
# build) overwrites the shared apps/web/.next with production output, and a
# `next dev` running over that serves 404s on every route. A production build
# leaves required-server-files.json (the standalone-server manifest) which
# `next dev` never writes — so its presence means a build clobbered .next since
# the last dev session. The unclean-kill lock does NOT catch this case (a build
# leaves no lock), which is why a plain `pnpm dev` could still 404.
#
# It does NOT touch .turbo or node_modules caches, so it never triggers the
# slow cold-rebuild that the old `rm -rf` nuke caused.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NEXT_DIR="$ROOT/apps/web/.next"
LOCK="$ROOT/apps/web/.next-dev.lock"

if [ -f "$LOCK" ]; then
  echo "⚠  previous dev run did not exit cleanly — clearing apps/web/.next"
  rm -rf "$NEXT_DIR"
elif [ -f "$NEXT_DIR/required-server-files.json" ]; then
  echo "⚠  apps/web/.next holds a production build (next build) — clearing before dev"
  rm -rf "$NEXT_DIR"
fi

: > "$LOCK"
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM

turbo run dev dev:worker
