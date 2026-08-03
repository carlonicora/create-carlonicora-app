#!/usr/bin/env bash
#
# Safe dev reset — the targeted replacement for the old nuclear
#   rm -rf apps/web/.next .turbo apps/*/.turbo packages/*/.turbo node_modules/.cache ...
#
# That nuke wiped turbo + every package cache, forcing a full cold rebuild that
# routinely looked "stuck" (cold Turbopack compile + cold ts-node API boot at
# once). The random 404 only ever needed apps/web/.next cleared — so that's all
# this does, plus a couple of safe wedge-clearers, then it starts dev.
#
# Orphan-kill is scoped to node processes whose working directory is THIS
# checkout, so it will not kill a dev server you are running from another
# checkout (e.g. the main repo or another worktree). Worktrees live nested
# under .claude/worktrees/, so when this runs from the main repo we explicitly
# skip those subdirs — otherwise a main-repo reset would kill worktree dev
# servers (their cwd is a child of the main-repo ROOT).

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ stopping turbo daemon (clears any wedged daemon state)…"
npx turbo daemon stop >/dev/null 2>&1 || true

echo "→ killing stale node processes rooted in this checkout…"
for pid in $(pgrep -f node 2>/dev/null); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  case "$cwd" in
    "$ROOT"/.claude/worktrees/*) ;;  # belongs to a nested worktree, not us — skip
    "$ROOT"*) echo "   kill $pid ($cwd)"; kill "$pid" 2>/dev/null || true ;;
  esac
done

echo "→ removing apps/web/.next + dev lock…"
rm -rf "$ROOT/apps/web/.next" "$ROOT/apps/web/.next-dev.lock"

echo "→ starting dev…"
exec pnpm dev
