#!/usr/bin/env bash
#
# Full-stack e2e runner (see apps/web/tests/README.md).
#   1. recreate the test database, empty
#   2. boot worker + api + web against it on dedicated ports (4080-4082)
#   3. wait for migrations, then for every process to answer
#   4. run Playwright (which seeds and logs in via its `setup` project)
#
# Logs stream prefixed [api] [worker] [web]. The stack is torn down on exit.
#
# Everything below can be overridden from `.env.e2e` (see env.e2e.example).
# The dev stack is never touched: different ports, a different database, a
# different Redis queue prefix and a different Next.js build directory.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# Optional local overrides. `set -a` exports everything the file declares so the
# child processes below inherit it without being listed one by one.
if [ -f "${ROOT}/.env.e2e" ]; then
  echo "==> [e2e] loading .env.e2e"
  set -a
  # shellcheck disable=SC1091
  . "${ROOT}/.env.e2e"
  set +a
fi

# Defaults are assigned to their own variables first: a literal "{{name}}" holds
# a brace pair, and nesting one inside a ${VAR:-default} expansion is asking a
# shell parser for trouble. Two lines, no ambiguity.
DEFAULT_API_PORT=4080
DEFAULT_WEB_PORT=4081
DEFAULT_WORKER_HEALTH_PORT=4082
DEFAULT_TEST_DB="{{name}}test"
DEFAULT_QUEUE_PREFIX="{{name}}e2e"
DEFAULT_PUBLIC_HOSTNAME="{{name}}.test"

API_PORT="${E2E_API_PORT:-$DEFAULT_API_PORT}"
WEB_PORT="${E2E_WEB_PORT:-$DEFAULT_WEB_PORT}"
WORKER_HEALTH_PORT="${E2E_WORKER_HEALTH_PORT:-$DEFAULT_WORKER_HEALTH_PORT}"
TEST_DB="${E2E_NEO4J_DATABASE:-$DEFAULT_TEST_DB}"

# BullMQ key prefixes MUST differ from the dev stack's (root .env: REDIS_QUEUE).
# Redis is a single shared instance, also used by other projects on this
# machine. Without this, the e2e worker and the DEV worker consume the SAME
# queues: a job enqueued by one stack is executed by the other, against the
# OTHER stack's database. The failure is intermittent and looks like a bug in
# the code under test — an endpoint that only ENQUEUES returns 2xx immediately
# while the wrong worker applies the effect to the wrong database.
QUEUE_PREFIX="${E2E_REDIS_QUEUE:-$DEFAULT_QUEUE_PREFIX}"

# Hosts come from PUBLIC_HOSTNAME (root .env), so a project that renames its
# dev host does not have to edit this script. Both names must resolve to
# 127.0.0.1 in /etc/hosts.
WEB_HOST="${PUBLIC_HOSTNAME:-$DEFAULT_PUBLIC_HOSTNAME}"
API_HOST="api.${WEB_HOST}"

HELPER="apps/web/tests/scripts/e2e-db.mjs"

# ── teardown ────────────────────────────────────────────────────────────────
# NEVER kill a process by matching its NAME or command line. Several projects
# run on this machine at once and their command lines are identical, so a
# name-pattern kill destroys unrelated work. Everything below kills a PID this
# script captured, or a PID that is listening on one of THIS stack's ports —
# and `grep -c` over this file for the name-matching killers must stay at 0.
killtree() {
  local pid="$1"
  for child in $(pgrep -P "${pid}" 2>/dev/null); do killtree "${child}"; done
  kill -9 "${pid}" 2>/dev/null || true
}

# Frees ONLY the e2e ports, and only processes LISTENING on them.
#
# -sTCP:LISTEN is load-bearing. Without it, `lsof -i tcp:<port>` also matches
# sockets whose FOREIGN port is that number — a browser tab still open on the
# web port, a curl holding a keep-alive — and this function runs before the
# stack boots as well as on teardown. Killing those is killing someone else's
# work. For the same reason it never escalates to the parent process: several
# unrelated projects run on this machine, and killtree() already covers every
# descendant of the PIDs this script actually started.
#
# NEVER replace this with a name-pattern process kill. Every project on this
# machine runs `node`, and a name pattern cannot tell them apart.
free_ports() {
  for port in "$@"; do
    for pid in $(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null); do
      kill -9 "${pid}" 2>/dev/null || true
    done
  done
}

PIDS=()
cleanup() {
  echo ""
  echo "==> [e2e] tearing down stack"
  for pid in "${PIDS[@]:-}"; do [ -n "${pid:-}" ] && killtree "${pid}"; done
  free_ports "${API_PORT}" "${WEB_PORT}" "${WORKER_HEALTH_PORT}"
}
trap cleanup EXIT INT TERM

echo "==> [e2e] freeing test ports ${API_PORT} ${WEB_PORT} ${WORKER_HEALTH_PORT}"
free_ports "${API_PORT}" "${WEB_PORT}" "${WORKER_HEALTH_PORT}"

# The api runs from src through ts-node and the web build imports the same
# workspace packages, so their dist output must exist before either boots.
# `...^<app>` is turbo's "everything <app> depends on, but not <app> itself", so
# this adapts to whatever packages the project actually has instead of naming
# them here and rotting. Turbo caches it, so it is a no-op after the first run.
# The two apps are deliberately NOT built here: the api runs from src, and the
# web build below needs the e2e env exported into it, which turbo's strict env
# mode would filter out.
echo "==> [e2e] building workspace packages"
pnpm turbo run build \
  --filter=...^{{name}}-api \
  --filter=...^{{name}}-web > >(sed 's/^/[packages] /') 2>&1 \
  || { echo "[e2e] workspace package build failed"; exit 1; }

echo "==> [e2e] recreating test database ${TEST_DB}"
E2E_NEO4J_DATABASE="${TEST_DB}" node "${HELPER}" recreate || { echo "[e2e] recreate failed"; exit 1; }

# BOOT ORDER MATTERS. The WORKER owns the migrator (a worker-only provider) AND,
# like the API, its repositories create fulltext indexes/constraints in
# onModuleInit via a check-then-create (TOCTOU) pattern. If API and WORKER
# bootstrap concurrently against a freshly-recreated database, both see no index
# and both CREATE it -> "An equivalent index already exists" crashes one
# process, intermittently. So: start the WORKER ALONE, wait for migrations, THEN
# start API and WEB, whose onModuleInit checks then find the existing schema and
# create nothing.
echo "==> [e2e] starting WORKER (db=${TEST_DB}) — migrator + schema owner"
(
  exec env NEO4J_DATABASE="${TEST_DB}" \
    REDIS_QUEUE="${QUEUE_PREFIX}" \
    API_WORKER_HEALTH_PORT="${WORKER_HEALTH_PORT}" \
    pnpm --filter {{name}}-api dev:worker
) > >(grep --line-buffered -vE "injecting env|injected env|nodemon\]" | sed 's/^/[worker] /') 2>&1 &
PIDS+=("$!")

echo "==> [e2e] waiting for migrations in ${TEST_DB} (the worker applies them)"
migrated=0
for _ in $(seq 1 45); do
  if E2E_NEO4J_DATABASE="${TEST_DB}" node "${HELPER}" check; then migrated=1; break; fi
  sleep 2
done
[ "${migrated}" = "1" ] || { echo "[e2e] FAILED: migrations not applied (see the [worker] logs above)"; exit 1; }
echo "==> [e2e] migrations applied — starting API + WEB"

# RATE_LIMIT_ENABLED=false: the login route hard-codes a per-IP @Throttle that
# the env-configured global throttlers cannot raise, and a suite that logs in
# repeatedly from 127.0.0.1 otherwise starts collecting 429s. Off = no rate-limit
# flakiness in e2e. No spec asserts throttling, and production defaults are
# untouched — this is set for these processes only.
#
# CORS_ORIGINS carries localhost as well as the custom host: navigator.serviceWorker
# only exists in a secure context, and a custom /etc/hosts name over plain HTTP is
# not one — so any PWA/service-worker test has to load the same server through
# http://localhost, and its client-side API calls need that origin allowed.
echo "==> [e2e] starting API (db=${TEST_DB}) on :${API_PORT}"
(
  exec env NEO4J_DATABASE="${TEST_DB}" \
    REDIS_QUEUE="${QUEUE_PREFIX}" \
    API_PORT="${API_PORT}" PORT="${API_PORT}" \
    API_URL="http://${API_HOST}:${API_PORT}/" \
    APP_URL="http://${WEB_HOST}:${WEB_PORT}/" \
    CORS_ORIGINS="http://${WEB_HOST}:${WEB_PORT},http://localhost:${WEB_PORT}" \
    RATE_LIMIT_ENABLED="false" \
    pnpm --filter {{name}}-api dev
) > >(grep --line-buffered -vE "Mapped \{|injecting env|injected env|nodemon\]" | sed 's/^/[api] /') 2>&1 &
PIDS+=("$!")

# WEB runs a PRODUCTION build (next build -> next start), NOT `next dev`. Under
# dev every route cold-compiles on first hit (15-110s each), so the suite takes
# 45+ minutes and flakes on compile timeouts. A production build compiles once,
# then serves in <1s — and instrumentation bootstraps before render, so the
# dev-only SSR registry race cannot occur.
#  - E2E_BUILD=true -> next.config.js uses distDir ".next-e2e", so this build
#    never touches the dev server's `.next`. Sharing it makes a running
#    `next dev` 404 every route. It must be set for the BUILD and for `start`.
#  - NEXT_PUBLIC_* are inlined at BUILD time, so they are exported BEFORE the
#    build. The web scripts' `dotenv -e ../../.env` does not override env that is
#    already set, so these e2e values win over the root .env dev values.
#  - E2E_INSECURE_COOKIES=true is exported for apps whose auth cookies read it.
#    HONEST NOTE: the library currently derives a cookie's `secure` flag from
#    NODE_ENV alone, with no override, so under `next start` over plain http the
#    browser would drop any cookie the APP writes. The suite therefore never
#    relies on that: tests/support/auth.ts mints the session through the API and
#    plants the cookies directly into Playwright's cookie jar, which is not
#    subject to the Secure rule. Keep this export so an app that adds the lever
#    (and a UI-login test) works without editing this script.
WEB_ENV=(
  E2E_BUILD="true"
  E2E_INSECURE_COOKIES="true"
  PORT="${WEB_PORT}"
  APP_URL="http://${WEB_HOST}:${WEB_PORT}/"
  API_URL="http://${API_HOST}:${API_PORT}/"
  API_INTERNAL_URL="http://${API_HOST}:${API_PORT}/"
  NEXT_PUBLIC_API_URL="http://${API_HOST}:${API_PORT}/"
  NEXT_PUBLIC_ADDRESS="http://${WEB_HOST}:${WEB_PORT}"
)

echo "==> [e2e] building WEB (production, distDir .next-e2e) — one-time compile"
if ! env "${WEB_ENV[@]}" pnpm --filter {{name}}-web build > >(sed 's/^/[web-build] /') 2>&1; then
  echo "[e2e] web build failed"
  exit 1
fi

echo "==> [e2e] starting WEB (next start) on :${WEB_PORT}"
(
  exec env "${WEB_ENV[@]}" pnpm --filter {{name}}-web start
) > >(grep --line-buffered -vE "injecting env|injected env" | sed 's/^/[web] /') 2>&1 &
PIDS+=("$!")

for url in "http://${API_HOST}:${API_PORT}/" "http://${WEB_HOST}:${WEB_PORT}/"; do
  echo "==> [e2e] waiting for ${url}"
  curl -s -o /dev/null --retry 120 --retry-delay 2 --retry-connrefused --max-time 260 "${url}" \
    || { echo "[e2e] ${url} never came up"; exit 1; }
done

# The worker exposes an HTTP health endpoint only when the app opts in with
# `bootstrap({ worker: { healthCheckPort: Number(process.env.API_WORKER_HEALTH_PORT) } })`.
# The template does not, so ${WORKER_HEALTH_PORT} is reserved and freed but not
# polled — the migration check above is the worker's real readiness signal.

# Any argument to this script is forwarded verbatim to `playwright test`, so a
# run can be scoped instead of executing everything:
#   ./scripts/e2e.sh                                  # everything
#   ./scripts/e2e.sh --project=chromium-smoke         # one project
#   ./scripts/e2e.sh tests/smoke/app.smoke.spec.ts    # one spec
#   ./scripts/e2e.sh --grep administration            # by title
# The `setup` project is a declared dependency of every other project, so a
# scoped run still seeds the database and logs in.
if [ "$#" -gt 0 ]; then
  echo "==> [e2e] stack is up. running Playwright (scoped): $*"
else
  echo "==> [e2e] stack is up. running Playwright (full suite)"
fi

E2E_API_PORT="${API_PORT}" E2E_WEB_PORT="${WEB_PORT}" \
  E2E_PUBLIC_HOSTNAME="${WEB_HOST}" E2E_NEO4J_DATABASE="${TEST_DB}" \
  pnpm --filter {{name}}-web exec playwright test "$@"
code=$?
echo "==> [e2e] Playwright exited with code ${code}"
exit "${code}"
