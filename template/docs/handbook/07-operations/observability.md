---
title: Observability
section: 07-operations
---

{{display}} emits three signals: structured logs through pino, optional
OpenTelemetry traces, and three HTTP health endpoints. All three are configured
entirely from environment variables, and all three live in the framework package
rather than in `apps/api`.

## Logging

### The logger

`AppLoggingService` in
`packages/nestjs-neo4jsonapi/src/core/logging/services/logging.service.ts`
constructs a pino logger in its own constructor and implements both NestJS's
`LoggerService` and the package's `LoggingServiceInterface`. `LoggingModule` is
`@Global()`, and `bootstrap()` installs the service with `app.useLogger()` in
both api and worker mode — so framework logs, Nest's own logs and application
logs all leave through one pipe.

It picks one of two transport configurations at construction time:

| Condition | Transport |
|---|---|
| `LOKI_ENABLED=true` **and** `LOKI_HOST` set | `pino-loki`, plus a `pino-pretty` console target when `CONSOLE_ENABLED=true` |
| anything else, including a Loki transport that throws | `pino-pretty` over `pino.multistream`, at level `silent` when `CONSOLE_ENABLED` is false |

The Loki path is wrapped in `try`/`catch`: a transport that fails to initialise
logs the reason to `console.error` and falls back to the file logger rather than
taking the process down.

Both paths use the same formatting: `colorize`, no time translation,
`ignore: "pid,hostname"`, `messageFormat: "{msg}"` and `hideObject: true`.
`LOG_LEVEL` sets the level, and the default deliberately differs between them —
`info` for Loki, `trace` for the console path — because the default belongs at
the call site rather than in `baseConfig`, which leaves the variable raw.

Every log call is enriched: `getEnrichedContext()` merges the caller's `context`
string and metadata with the current request context, which
`setRequestContext()` stores in CLS under `logContext`. `createChildLogger()`
caches a pino child per context-plus-metadata key.

### `LoggingInterceptor`

`bootstrap()` installs it globally, third in the chain after tracing and cache.
On the way in it:

- writes `requestStartTime` onto the raw Fastify request, for the `onSend` hook
  to read;
- builds a `LogContext` of `requestId` (the `x-request-id` header or Fastify's
  own id), `ip`, `userAgent`, `method`, `url`, and `userId`/`companyId` when the
  JWT guard has attached a user, and stores it in CLS;
- stores the full request URL in CLS as `requestUrl`, for pagination links. When
  a request was proxied from another service, the caller forwards its own public
  base URL as `x-forwarded-base-url` and that wins, so generated links point at
  the URL the browser actually used rather than at an internal address.

On the way out it does nothing for a success — the `onSend` hook owns that path,
because it has accurate timing. On an error it branches:

| Status | What is logged |
|---|---|
| 5xx | `logHttpError` (the access line at error level, with the stack) plus `errorWithContext("Request failed", …, "HTTP_ERROR")` carrying `responseTime`, `statusCode`, `errorCode` and `errorType`. |
| 4xx | One `warn` line, `"<method> <url> - <status> (<ms>ms)"`, with no stack. Client errors are not server faults, and a stack on a spec-compliant 405 is noise. |
| validation errors | Nothing here — `HttpExceptionFilter` logs those with their details. |

Then it clears the request context.

### The Fastify `onSend` hook

`setupFastifyLoggingHook` in
`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` registers an `onSend`
hook on the Fastify instance. It runs after the response body exists, which is
the only place the two facts below can both be known. For every request that has
a `requestStartTime` it records:

- **the access line**, via `logHttpRequest(method, url, statusCode, responseTime,
  ip)` — which logs at info level under context `HTTP` with `httpMethod`,
  `httpUrl`, `httpStatusCode`, `responseTimeMs` and `clientIp`;
- **a completion line**, `"Request completed successfully"` under context
  `HTTP_SUCCESS`, carrying `responseTime`, `statusCode`, `resultSize` and
  `loggedFromOnSend: true`. `resultSize` is the payload's length — its string
  length, or the length of its JSON serialisation, or 0 if that throws.

Then it clears the request context. Every successful request therefore produces
two lines, and the interceptor produces none.

### Console output and the debug file logger

`CONSOLE_ENABLED` is the switch. `.env.example` sets it to `true` for local
development; `docker-compose.yml` defaults it to `false` in the shared env
anchor, so a containerised deployment ships to Loki and stays quiet on stdout.
With it false and Loki disabled, the stream level is `silent` and nothing is
written anywhere.

Separately, `DebugLoggerService` in
`packages/nestjs-neo4jsonapi/src/core/debug/services/debug.logger.service.ts` is
a file-based structured logger for multi-step LLM work — rounds, turns, stages
and the LLM calls inside them. `DebugModule` is `@Global()`, so it is always
available, but every method returns immediately unless `DEBUG_LOGGING_ENABLED`
is `true`. Files are written under `DEBUG_LOG_PATH`, default `./logs`, which
`.gitignore` ignores.

### Loki

| Variable | Default | Effect |
|---|---|---|
| `LOKI_ENABLED` | false | Selects the Loki transport. |
| `LOKI_HOST` | `http://localhost:3100` | The push endpoint. Empty means fall back to the console path. |
| `LOKI_BATCHING` | true | Batch pushes. |
| `LOKI_INTERVAL` | 30 | Seconds between batches. `.env.example` does not set it; the transport call passes 5 when the config omits it. |
| `LOKI_APP_LABEL` | the app name | Becomes the `application` label. |
| `ENV` | `development` | Becomes the `environment` label. |
| `LOKI_USERNAME`, `LOKI_PASSWORD` | empty | Parsed into config, **not passed to the transport**. |

`.env.example` ships `LOKI_ENABLED=true` with a host on the api's own domain at
port 3100. Nothing in this repository runs Loki.

## Tracing

### Initialisation

`tracingSetup.initialize()` is the **first statement in `bootstrap()`**, before
`EventEmitter.defaultMaxListeners`, before the mode is read and before the Nest
application is created. OpenTelemetry instruments modules by patching them as
they load, so anything initialised after the application would miss the
libraries the application already required.

`TracingSetup` is a singleton with an `isInitialized` guard, so a second call is
a no-op. It returns immediately when `TEMPO_ENABLED` is not `true`, which means
the default is no tracing and no exporter.

When enabled it builds:

- an `OTLPTraceExporter` from `@opentelemetry/exporter-trace-otlp-http`, pointed
  at `TEMPO_ENDPOINT`;
- a `NodeSDK` whose resource carries `service.name` from `TEMPO_SERVICE_NAME` and
  `service.version` from `TEMPO_SERVICE_VERSION`;
- two instrumentations — `HttpInstrumentation`, with a `requestHook` that copies
  `user-agent` and `x-forwarded-for` onto every HTTP span, and
  `NestInstrumentation` for controller and provider spans.

`sdk.start()` is called synchronously, and `SIGTERM`/`SIGINT` handlers call
`shutdown()` so buffered spans flush.

| Variable | Default | Effect |
|---|---|---|
| `TEMPO_ENABLED` | false | Master switch. |
| `TEMPO_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP/HTTP receiver. |
| `TEMPO_SERVICE_NAME` | the app name | `service.name` on every span. |
| `TEMPO_SERVICE_VERSION` | `1.0.0` | `service.version`. |

`.env.example` ships `TEMPO_ENABLED=true` pointing at `localhost:4318`. Nothing
in this repository runs a collector.

### `TracingInterceptor`

Installed globally and **first** in the interceptor chain, ahead of cache and
logging, so a cached response is still traced.

It returns `next.handle()` untouched when tracing is disabled, and again if
`startHttpSpan` returns nothing. Otherwise it opens a server span named
`<method> <url>` and attaches the OpenTelemetry HTTP semantic attributes —
`http.method`, `http.url`, `http.route`, `http.target`, `http.scheme`,
`http.user_agent`, `http.client_ip`, `http.host` — plus `operation.name`,
`component: "nestjs-http"` and `span.kind: "server"`. `x-forwarded-for`,
`x-real-ip` and the request id are added when present.

On success it records `http.status_code`, `http.response_time_ms`,
`response.success: true` and, when the result serialises,
`http.response_size_bytes`; marks the span successful; adds a
`request.completed` event; and ends the span. On error it records the status
from `error.status` or `error.statusCode` or 500, sets the span's error status,
adds a `request.error` event with the error name and message, ends the span, and
rethrows.

### The CLS span

`TracingService` stores the active span in CLS under `currentSpan` and reads it
back from there. That is what lets a service deep in a call stack add an
attribute or an event to the request's span without the span being threaded
through every signature — the same mechanism the logger uses for `logContext`
and the repositories use for `companyId`.

## Health endpoints

`HealthController` in
`packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts`
is `@SkipThrottle()` and requires no authentication.

| Endpoint | Checks | Meaning |
|---|---|---|
| `GET /health` | Neo4j, Redis, storage, disk | Full dependency status. 200 when all pass, 503 otherwise. |
| `GET /health/live` | none | The process answered, so it is alive. A failure means restart the container. |
| `GET /health/ready` | Neo4j, Redis | Ready for traffic. A failure means route elsewhere — do **not** restart. |

The four indicators:

| Indicator | Check | Timeout |
|---|---|---|
| `Neo4jHealthIndicator` | `RETURN 1` through `Neo4jService` | 3s |
| `RedisHealthIndicator` | client status, then `PING`, requiring `PONG` | 3s |
| `S3HealthIndicator` | `HeadBucketCommand`, or the Azure container equivalent | 5s |
| `DiskHealthIndicator` | free space ≥ 1 GB or 10% of the volume, whichever is smaller | — |

Two behaviours worth knowing before you rely on a probe:

- **Storage failure does not affect readiness.** The S3 indicator backs
  `/health` only. And with `S3_BUCKET` empty it returns *healthy* with the
  message "S3 not configured - skipping check", so a deployment that forgot the
  bucket passes every probe.
- **The worker has no HTTP health endpoint.** `bootstrapWorker` starts a
  one-route server only when `options.worker.healthCheckPort` is passed, and
  `apps/api/src/main.ts` does not pass it. `docker-compose.yml` therefore checks
  the worker with `pgrep` instead, and `scripts/e2e.sh` uses the migration count
  as the worker's readiness signal.

`docker-compose.yml` polls `/health/ready` for the api service, with a 40-second
start period.

## The version surface

Two independent readings of the same number, which is why they can disagree.

**The api.** `VersionModule.forRoot()` is registered globally in
`packages/nestjs-neo4jsonapi/src/core/core.module.ts` and exposes
`GET /version`, returning `{ version }`. `VersionService` reads
`baseConfig.api.version`, which is `process.env.npm_package_version` with a
fallback of `"1.0.0"`. npm and pnpm set that variable when a process is started
through a package script; a container whose `CMD` is a bare `node dist/main`
does not get it. `/version` is also in the default `CACHE_SKIP_PATTERNS`, so it
is never served from cache.

**The web app.** `apps/web/src/features/common/components/navigations/VersionDisplay.tsx`
imports the **root `package.json`** directly and renders `packageInfo.version`
in the sidebar footer, through `apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx`. The value is therefore
bundled at build time and is the monorepo's version — the same number
`semantic-release` writes on a release, as the release page in this section
describes.

## Where to look

| File | What it gives you |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/logging/services/logging.service.ts` | The two transport paths, the CLS enrichment, `logHttpRequest`/`logHttpError`. |
| `packages/nestjs-neo4jsonapi/src/core/logging/interceptors/logging.interceptor.ts` | What is captured per request and how errors are split by status class. |
| `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` | `tracingSetup.initialize()` first, the `onSend` hook, the interceptor order. |
| `packages/nestjs-neo4jsonapi/src/core/tracing/tracing.setup.ts` | The NodeSDK, exporter and instrumentations. |
| `packages/nestjs-neo4jsonapi/src/core/tracing/interceptors/tracing.interceptor.ts` | Every span attribute and event. |
| `packages/nestjs-neo4jsonapi/src/core/tracing/services/tracing.service.ts` | The CLS-held `currentSpan`. |
| `packages/nestjs-neo4jsonapi/src/core/health/controllers/health.controller.ts` | The three endpoints. |
| `packages/nestjs-neo4jsonapi/src/core/debug/services/debug.logger.service.ts` | The opt-in file logger. |
| `packages/nestjs-neo4jsonapi/src/core/version/services/version.service.ts` | Where `/version`'s number comes from. |
| `apps/web/src/features/common/components/navigations/VersionDisplay.tsx` | Where the UI's number comes from. |

## Gaps and drift

- **`nestjs-pino` is a declared dependency of the framework package and is
  imported nowhere.** `AppLoggingService` builds its pino logger by hand.
  Nothing is broken; the dependency is dead weight and misleads a reader looking
  for the usual `LoggerModule.forRoot()`.
- **`@opentelemetry/instrumentation-fastify` is a declared dependency of
  `apps/api` and is registered nowhere.** `tracingSetup` registers
  `HttpInstrumentation` and `NestInstrumentation` only. Fastify-level spans —
  route matching, hooks — are therefore absent.
- **`pino-roll` is a declared dependency of `apps/api` and is imported
  nowhere.** There is no rotating file transport; the "file logger" path in
  `AppLoggingService` is in fact a pretty-printed stdout stream.
- **`LOKI_USERNAME` and `LOKI_PASSWORD` are read into config and never passed to
  the transport.** A Loki endpoint behind basic auth rejects the writes.
- **`LOKI_INTERVAL` disagrees with itself.** `baseConfig` defaults it to 30
  seconds; the transport options fall back to 5 when the config value is absent.
- `.env.example` ships `LOKI_ENABLED=true` and `TEMPO_ENABLED=true` pointing at
  endpoints nothing in this repository runs. A fresh clone therefore starts with
  logging routed at a host that is not there — the `try`/`catch` fallback is
  what keeps that from being fatal.
- `/version` reads `npm_package_version`, which a container started with a bare
  `node dist/main` does not set. The api can report `1.0.0` while the sidebar
  reports the real version.
- Not examined: any metrics signal. There is no Prometheus endpoint, no
  `@opentelemetry/sdk-metrics` usage, and no counter or histogram anywhere in
  the framework package.
