---
title: The LLM layer
section: 06-ai
---

{{display}} has no AI code of its own. There is no apps/api/src/ai directory, no
model client, no prompt file, no embedding call anywhere under `apps/api/src`.
Every provider call the application can make is made by
`packages/nestjs-neo4jsonapi/src/core/llm/`, which the package registers as a
`@Global()` module (`packages/nestjs-neo4jsonapi/src/core/llm/llm.module.ts`) so
any service in the app can inject `LLMService` without importing anything.

The layer is configured entirely through environment variables read in
`packages/nestjs-neo4jsonapi/src/config/base.config.ts`, plus an optional set of
database-backed connections. An app that sets no `AI_*` variables still boots;
the first call then fails at model construction, not at startup.

## The five entry points

All five live on `LLMService`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/llm.service.ts`). They differ
in what they guarantee, not in how they are configured — every one resolves its
model through `ModelService`, opens a dump session, bills through the token
recorder, and runs under the same timeout/watchdog/deadline envelope.

| Method | Returns | Guarantees |
|---|---|---|
| `call<T>(params)` | `T & { tokenUsage, modelWeight }` | Zod-validated structured output, tool loop, salvage ladder, transient retry with connection failover |
| `streamCall<T>(params)` | `{ partialObjectStream, result }` | Same structured contract, delivered progressively; `result` resolves only after the stream is drained |
| `streamText(params)` | `{ fullStream, result }` | Free-form prose plus a separate reasoning trace; no schema, no JSON mode |
| `extractViaTool<T>(params)` | `T` | Structured extraction through a single forced tool call, for models that reject `response_format` |
| `callStep(params)` | `{ message, tokenUsage }` | Exactly one model step with tools bound and `tool_calls` untouched; executes nothing |

### `call`

The general-purpose entry point. It builds a chat prompt from `systemPrompts`,
optional `history` (trimmed to `maxHistoryMessages`) and either explicit
`instructions` with `{placeholder}` substitution or instructions auto-generated
from `inputParams` and `inputSchema` field descriptions. It binds `tools` when
given and runs the tool loop up to `maxToolIterations`, then makes one final
structured invocation against `outputSchema`.

Three short-circuits run before any provider contact, in this order: `MOCK_AI`
returns a synthetic object derived from the schema
(`packages/nestjs-neo4jsonapi/src/core/llm/utils/mock-from-zod.ts`) with zero
token usage; a `cacheable: true` call looks the response up in Redis and returns
a hit without spending anything; only then is the candidate chain resolved and
the provider called.

### `streamCall`

Built on the Vercel AI SDK's `streamObject` rather than LangChain, because
LangChain's structured streaming yields parsed partials only and never the raw
JSON fragments an incremental UI consumer needs. Exactly one stream view is
exposed — `partialObjectStream` — because `textStream`, `partialObjectStream`
and `fullStream` all consume the same source and reading a second one throws.
Provider support is OpenAI-compatible endpoints only; a native Vertex or Azure
configuration without a `url` is refused.

### `streamText`

For output that is prose, or for models that cannot produce JSON at all. Its
`fullStream` yields `{ type: "text", delta }` and `{ type: "reasoning", delta }`
parts; a non-reasoning model simply never emits the second kind. `result`
resolves to the concatenated `text`, the full `reasoning` string (empty when
none was emitted) and the token usage.

### `extractViaTool`

Forces one named tool with `tool_choice` and validates its arguments against the
tool's Zod schema. It exists for models served over OpenAI-compatible endpoints
that ignore `response_format`. The implementation tolerates three known
malformations: arguments delivered as a raw JSON string, arguments nested under
a single wrapper key, and a tool call emitted as plain text — including the
pseudo-quoted `<|"|>` format some locally-served models leak, which is
reassembled by `parseGemmaToolCallText`.

### `callStep`

One model invocation, returned verbatim. No tool is executed, no loop runs, no
schema is applied. It is the primitive a durably-checkpointed agent needs: the
caller checkpoints the returned `AIMessage`, executes the tool calls itself, and
comes back for the next step. "One step" is still bounded and still re-issued on
a transient network failure — what it never does is re-run the caller's agent.

## Bounding a call

Every provider request is wrapped by `runBounded`, which installs two
independent mechanisms:

- a **watchdog** that logs every `AI_REQUEST_WATCHDOG_MS` while the call is
  still pending, so a stall is visible as it happens rather than after it
  resolves;
- an absolute **deadline** of `AI_REQUEST_TIMEOUT_MS × AI_REQUEST_DEADLINE_ATTEMPTS`
  plus a fifteen-second slack, which aborts the signal and rejects with
  `LLMTimeoutError`.

`LLMTimeoutError` carries the call `label` and the `deadlineMs` it burned. It is
a distinct class so a caller can tell a stall from a refusal; both are
retryable. Reaching the deadline means the transport ignored its own per-attempt
timeout — in normal operation the attempt timeout fires first.

Around that sits `runWithTransientRetry`. It retries only failures classified as
transient by the exported `isTransientNetworkError` — DNS and socket error
codes, HTTP 429, HTTP 5xx, and the prose those arrive as — with long jittered
waits of roughly 5s and 15s. The waits are deliberately long: LangChain's own
`AsyncCaller` has already retried fast underneath, so by the time a failure
surfaces here the quick retries are spent. Each attempt gets a fresh
`AbortController`, because an aborted controller stays aborted forever. Each
attempt also receives its index, which is what turns the retry into a failover:
attempt *n* uses candidate *n* of the tier's connection chain, and the candidate
that failed is put into cooldown before the next attempt resolves.

A timeout, a 402/403 refusal, a malformed request and a parse failure are all
deliberately **not** transient.

## Structured output with Zod

`call` decides how to ask for structured output from the schema, never from a
model name. `packages/nestjs-neo4jsonapi/src/core/llm/utils/schema.utils.ts`
holds the analysis:

| Condition | Path |
|---|---|
| Provider is `requesty` and the model is Gemini | `sanitizeSchemaForGemini` strips `$schema`, `$defs` and friends, then `withStructuredOutput` on the sanitised JSON Schema |
| `ModelService.supportsStrictStructuredOutput()` is false (provider `vertex`) | The Zod schema is passed through untouched; strict mode is ignored there, so rewriting would cost a null per optional field and buy nothing |
| `isStrictStructuredOutputCompatible(convertZodToDraftJsonSchema(schema))` | The Zod schema goes straight to `withStructuredOutput` |
| The schema can be rewritten into a strict-compatible one | `makeSchemaStrictCompatible` rewrites it, the call runs with `strict: true`, and `stripSyntheticNulls` undoes the rewrite on the way back |
| Nothing else works (an open `z.record`, a `$ref`) | `method: "functionCalling"` — no schema rules imposed, still validated by Zod |

Strict mode is preferred because it is the only mode that guarantees the payload
matches the schema. A schema-authoring trap comes with it: a field that chains a
Zod `default` wrapper and *then* a description makes LangChain's zod interop
emit a `$ref` carrying sibling keywords, which strict mode rejects outright.
Describe the inner type first and wrap it afterwards, and the conversion stays
inline and valid.

When the declared schema does not come back cleanly, a salvage ladder runs:
parsed tool calls, then lenient tool-call parsing that filters invalid array
entries, then the raw message content parsed by hand, and finally truncation
repair. Each rung that fires is recorded on the dump session as a
`parseFallback`, and the call is logged as `fallback:*` rather than `clean`.

### The three repair paths

| File | Repairs |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/llm/utils/repair-truncated-json.ts` | A payload the provider cut off mid-value (`finish_reason: "length"`). Trims back to the last element the input proves complete, drops the partial tail, closes the open containers. Pure and total — it never throws, and returns `null` when nothing is recoverable. Turns a total loss into an N−1 result. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/unsupported-param-fetch.ts` | A 400 naming a parameter the deployment rejects. It removes the named parameter, retries (up to six repairs, since the API reports one rejection per response), and remembers the verdict per model for the rest of the process. `unsupported_parameter` is remembered at parameter scope; `unsupported_value` only at the (parameter, value) pair, so one bad value never strips a parameter from every later request. `PARAM_SUCCESSORS` renames rather than drops where the ecosystem renamed a parameter (`max_tokens` → `max_completion_tokens`). Dotted paths are handled, because the Responses API reports `reasoning.effort`. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/tool-error-feedback.ts` | A tool call whose arguments fail schema validation, which LangChain rejects with a generic message before the tool's code runs. It replaces that dead end with an imperative message naming the missing arguments, and gives the loop a key-order-independent `toolCallSignature` so an identical failing call repeated `REPEATED_TOOL_FAILURE_LIMIT` (3) times abandons the loop instead of burning the whole iteration budget. |

## Provider and transport adapters

`ModelService.buildChatModel`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/model.service.ts`) is the
only place a client is constructed. Every branch validates its URL through
`validateAiUrl` first.

| Branch | What it builds | What it works around |
|---|---|---|
| `llamacpp` / `local` | `ChatOpenAI` against the configured URL | The model name is irrelevant to a single-model server |
| `openrouter` | `ChatOpenAI` plus `openRouterEscalatingFetch` | OpenRouter routes to any provider unless the body carries a `provider` block. The fetch injects `order: [region]`; attempt 1 honours the configured `allow_fallbacks`, every retry allows fallbacks so a 429/502 can reroute. Such a tier is never cached, because the closure is per-call by design |
| `requesty` | `ChatOpenAI` against the configured URL | — |
| `ollama` | `ChatOpenAI` with a placeholder key | Ollama ignores the API key but the OpenAI client demands one |
| `vertex` | `ChatVertexAI` | Credentials are materialised to a 0600 temp file with a UUID name, cleaned up on process exit, and `GOOGLE_APPLICATION_CREDENTIALS` is left set because Google's auth library resolves the project lazily. `vertexLocationParams` builds the endpoint, because LangChain only knows regional and global hostnames and silently produces a non-existent host for a multi-region (`eu`, `us`) |
| `azure` | `ChatOpenAIResponses` on the GA v1 surface | Reasoning models reject function tools combined with `reasoning_effort` on chat-completions, so this branch speaks the Responses API. `apiVersion` is deliberately unused (v1 is implicitly versioned), the base URL is built from the instance (a missing `AI_INSTANCE` throws rather than producing an unresolvable host), and the effort is lifted out of `modelKwargs` into `reasoning.effort` because the Responses body would otherwise carry an unknown key |
| anything else | `ChatOpenAI` against `AI_URL` | Any OpenAI-compatible gateway works without a code change; a provider with no URL throws a named error |

Two fetch middlewares wrap the generic client, outermost first:
`reasoningContentFetch` then `unsupportedParamFetch`. The first repairs a
response whose serving stack classified the entire answer as reasoning and
returned `content: null` — it promotes `reasoning` into `content` only when
`content` is blank **and** the reasoning text is itself a JSON document, so
prose deliberation can never leak into an answer.
`packages/nestjs-neo4jsonapi/src/core/llm/utils/message.content.ts` exists for
the same family of problem on the way out: `AIMessage.content` is sometimes an
array of parts, and `String(content)` on it yields `"[object Object]"`, which is
indistinguishable from a real answer once persisted.

## The modality services

| Service | File | Notes |
|---|---|---|
| `VisionLLMService` | `packages/nestjs-neo4jsonapi/src/core/llm/services/vision.llm.service.ts` | Structured image analysis. Five retries with backoff, a 120s call timeout, Gemini schema sanitisation, a raw-JSON fallback when the parsed value is null, and `ContentModerationError` for a safety block. The model is rebuilt inside the retry so a rate-limited attempt reaches the next connection |
| `ImageLLMService` | `packages/nestjs-neo4jsonapi/src/core/llm/services/image.llm.service.ts` | Image *generation* over an OpenRouter-style chat completion with `modalities: ["image"]`. Returns the full data URL, the MIME type, token usage, the provider-reported `cost` when there is one, and the serving connection's rates as fallback pricing |
| `AudioLLMService` | `packages/nestjs-neo4jsonapi/src/core/llm/services/audio.llm.service.ts` | One facade, two backends chosen by `AUDIO_DIRECT_URL`: a chat model receiving an `input_audio` part, or a multipart POST to any OpenAI-style transcription endpoint. Both are preceded by a universal ffmpeg transcode to 16 kHz mono (`packages/nestjs-neo4jsonapi/src/core/llm/services/audio/ffmpeg-transcode.ts`). No retry layer — the queue's job retry covers it |
| `DocumentAiService` | `packages/nestjs-neo4jsonapi/src/core/llm/services/document-ai.service.ts` | OCR with structured annotation, posted directly rather than through a vendor SDK because the SDK hardcodes a cloud route. Returns the extracted fields, the OCR text and the **page count**, which is the only usable cost signal for a per-page product |
| `EmbedderService` | `packages/nestjs-neo4jsonapi/src/core/llm/services/embedder.service.ts` | Single and batch vectorisation. Inputs are sliced at 8000 tokens (below the 8192 provider cap) on whitespace boundaries, and one failover retry runs on a transient failure — only when the chain has somewhere to go |

The embedder that `ModelService.getEmbedder()` hands back is normally not the
raw provider client. When `MOCK_AI` is on it is a zero-vector stub sized to
`EMBEDDER_DIMENSIONS`. Otherwise, when the `embedder.rateLimit` block is present
— and `createBaseConfig` always builds it — the provider embedder is wrapped in
`RateLimitedEmbedder`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/rate-limited-embedder.ts`)
and memoised per connection id, so an admin edit takes effect on the next call
rather than the next restart.

`RateLimitedEmbedder` splits a batch into sub-batches of at most
`EMBEDDER_MAX_BATCH_TOKENS`, holds a local semaphore of
`EMBEDDER_MAX_CONCURRENT_REQUESTS`, and asks a distributed token bucket for
permission before each sub-batch. The bucket
(`packages/nestjs-neo4jsonapi/src/core/llm/services/embedder-token-bucket.service.ts`)
is a Redis Lua script shared by every worker: capacity is
`EMBEDDER_TPM_LIMIT − EMBEDDER_TPM_SAFETY`, refilled over a minute, keyed under
the queue prefix. A request that cannot be granted within `EMBEDDER_MAX_WAIT_MS`
fails with `EmbedderBucketStarvedError`; a failed call refunds its reservation.

## Database-backed AI connections

`AiConnectionResolverService`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/ai-connection-resolver.service.ts`)
turns `AiConnection` nodes into an ordered fallback chain per connection type.
The nine types are `ai`, `aiLite`, `aiLarge`, `vision`, `audio`, `image`,
`embedder`, `transcriber` and `documentAi`
(`packages/nestjs-neo4jsonapi/src/core/llm/interfaces/ai-candidate.interface.ts`).

It holds a decrypted in-memory snapshot because `getLLM()` is synchronous and
sits on the hot path. The snapshot is rebuilt at boot, every 60 seconds, and
immediately on an admin write in the same process; other processes catch up at
the next scheduled refresh. A read failure keeps the previous snapshot, and a
connection whose stored secret cannot be decrypted is skipped rather than taking
the chain down.

`resolve(type)` returns the requesting company's chain when it has one,
otherwise the global chain, and **always appends the environment block as the last
link**. Candidates inside their cooldown window are dropped — unless that would
empty the list, in which case the full chain is returned anyway. Every
degradation in this service points the same way: toward the environment block,
never toward no AI.

`markFailure(connectionId)` parks a connection for
`AI_CONNECTION_COOLDOWN_MINUTES`. The environment candidate is tracked under
`env:<type>` like any other, so a dead fallback cannot block recovery.

With no resolver wired at all — a bare test harness, or an app that excluded the
AI-connection foundation — every chain is exactly one environment candidate and the
retry behaves as it did before failover existed.

## `ModelService` and the `MOCK_AI` gate

`ModelService` owns model construction, the resolved configuration per tier, the
embedder, and the transcriber client. `getLLM()` caches constructed clients in a
map keyed on connection id, provider, instance-or-URL, model, temperature, max
output tokens, frequency penalty, resolved reasoning effort and timeout — every
value baked into the instance. Without the cache, a worker builds thousands of
short-lived SDK clients. Two constructions are never cached: the `MOCK_AI` fake
model, which is stateful, and an OpenRouter tier with a pinned region, whose
escalating fetch is per-call by design. The cache clears itself with a warning
past 100 entries, which means a caller is varying a cached parameter per call.

`onModuleInit` is a fail-closed safety gate: if `MOCK_AI=true` while `ENV` is
`production`, the process refuses to start. It reads the module-level
`baseConfig` rather than the injected `ConfigService` on purpose — a safety gate
must not depend on DI being wired correctly. `MOCK_AI` returns synthetic
structured output, a "mock summary" chat response and zero vectors; letting that
reach a production graph would write fake data into it permanently.

## The three model tiers

`ModelWeight` (`packages/nestjs-neo4jsonapi/src/core/llm/enums/model.weight.ts`)
has three values, and every call that omits one gets `Normal`.

| Weight | Env prefix | Config block |
|---|---|---|
| `ModelWeight.Lite` | `AI_*_LITE` | `ai.aiLite` |
| `ModelWeight.Normal` | `AI_*` | `ai.ai` |
| `ModelWeight.Large` | `AI_*_LARGE` | `ai.aiLarge` |

Each tier resolves a complete configuration — provider, key, URL, model, region,
costs, max output tokens, reasoning effort — so the three can live on three
different providers.

### The inheritance rules

`buildAiTier(suffix)` in
`packages/nestjs-neo4jsonapi/src/config/base.config.ts` resolves them:

1. A tier that declares **no** `AI_PROVIDER<suffix>`, or declares the **same**
   provider as the base tier, inherits field by field from the unsuffixed `AI_*`
   variables. Setting `AI_MODEL_LITE` alone therefore overrides only the model
   and keeps the base key, URL, instance and costs.
2. A tier that declares a **different** provider is standalone: nothing
   inherits. Every field resolves from its own suffixed variable, because the
   base values point at another service entirely — inheriting a base Ollama URL
   into a hosted tier produces a request to the wrong endpoint with the wrong
   credentials.
3. **`AI_REGION` and `AI_ALLOW_FALLBACKS` never inherit, under any of the
   above.** They describe per-model routing — the OpenRouter provider pin — not
   provider-wide credentials. A tier that overrides only `AI_MODEL_LITE` and
   inherited the base pin would send its different model to a provider that may
   not serve it, which answers 404, or rejects the routing constraint, which
   answers 422. A tier that wants a pin sets `AI_REGION_LITE` or
   `AI_REGION_LARGE` explicitly.

`AI_ALLOW_FALLBACKS` defaults to true, matching OpenRouter's own default; only
the literal string `false` turns `AI_REGION` into a hard pin.

`getResolvedConfig(weight)` layers the first healthy candidate over the tier's
environment block, copying only fields the candidate actually defines, so a field the
candidate shape does not carry (`secret`) survives.

## Reasoning effort

`ReasoningEffort`
(`packages/nestjs-neo4jsonapi/src/core/llm/enums/reasoning.effort.ts`) is
`"none" | "minimal" | "low" | "medium" | "high"`, sent as the OpenAI-compatible
`reasoning_effort` parameter. Precedence in `getLLM`: an explicit per-call
`reasoningEffort` wins; then the per-call `disableThinking: true`, which is the
older boolean spelling of `"none"` and is retained as a working alias; then the
tier's configured `AI_REASONING_EFFORT`. A per-call signal is never overridden
by configuration.

A configured value is narrowed by `normaliseConfiguredReasoningEffort`, which
warns and ignores anything outside the set — a typo would otherwise reach the
wire, cost a round-trip, and be remembered as a rejected value for the rest of
the process. Per-call values are typed and skip that check.

Two providers need translation. Azure carries the effort as `reasoning.effort`
on the Responses body. Gemini 3 and later understand `thinkingLevel`, so a
configured effort is mapped onto it — and only then: sending it to an earlier
Gemini is an error, not a no-op, so `supportsGeminiThinkingLevel` gates the
whole mapping and `none` maps to `MINIMAL`, Gemini's nearest honest equivalent.

## The cache and the dumper

`LLMCacheService`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/llm-cache.service.ts`) is a
Redis cache used only by calls that pass `cacheable: true` on `call` or
`extractViaTool`. `buildCacheKey` hashes `CACHE_VERSION`, the model weight, the
temperature, the system prompts and the prompt — generic LLM parameters only,
never an application concept, so the cache stays domain-agnostic and a
deployment can invalidate every entry by bumping `CACHE_VERSION`. Writes carry a
24-hour TTL. Any Redis error on read is a miss and any error on write is
swallowed: a cache outage degrades to no cache, never to a failed call. A hit
returns before the provider is contacted and therefore records no token usage,
which is the correct accounting.

`LLMCallDumper`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/llm-call-dumper.service.ts`)
writes one JSON file per call: every message sent per iteration with its byte
size and approximate token count, the response, every tool result, the token
totals, the computed cost, the warnings and the parse fallbacks. It is off
unless `ASSISTANT_DUMP_LLM_CALLS` is exactly `1` — any other value, including
`true`, leaves a no-op session that does no I/O at all. Files land in
`ASSISTANT_DUMP_LLM_CALLS_DIR`, defaulting to a .llm-dumps folder under the process's
working directory. Redaction is opt-in through `ASSISTANT_DUMP_LLM_REDACT`, so
local development keeps full prompts; when on, it blanks every `userMessage` and
`content` key, every system prompt matching the policy regex and every scalar
nested under a `metadata` object, minus the dot-paths listed in
`ASSISTANT_DUMP_LLM_KEEP_FIELDS`. When a WebSocket service and a user id are
available, each closed session is also pushed to that user as an `llm:dump`
event.

## Token accounting

Every provider call in this layer records through the optional
`TOKEN_USAGE_RECORDER` token
(`packages/nestjs-neo4jsonapi/src/common/tokens.ts`), falling back to the
package's own `TokenUsageService` when no application recorder is bound.
`LLMService`, `EmbedderService` and `AudioLLMService` are the three callers, and
any new package code that bills must use the same token — injecting the service
class directly re-opens the bypass the token exists to close.

Attribution is opt-in: without **both** `relationshipId` and
`relationshipType`, nothing is written and the package stays domain-agnostic. A
successful call that reported no tokens is still recorded, with the per-record
credit floor disabled; a failed call that consumed nothing is not recorded at
all, because there was no call to make visible. Persistence never throws — a
failure logs a warning and the LLM call continues.

The record itself, the cost formula and the credits conversion are covered by
[token usage and credits](../03-backend/token-usage-and-credits.md) and
[cost](eval-and-cost.md).

## Environment inventory

All defaults below are the ones `packages/nestjs-neo4jsonapi/src/config/base.config.ts`
applies. `.env.example` in a fresh app sets only a subset — see "Gaps and drift".

### Runtime and safety

| Variable | Default | Effect |
|---|---|---|
| `MOCK_AI` | off | `true` returns synthetic output everywhere. Boot fails if `ENV` is `production` |
| `AI_REQUEST_TIMEOUT_MS` | `120000` | Per-attempt provider budget |
| `AI_REQUEST_DEADLINE_ATTEMPTS` | `3` | Attempts the hard deadline budgets for |
| `AI_REQUEST_WATCHDOG_MS` | `30000` | Interval at which a pending call is logged |
| `AI_CONNECTION_COOLDOWN_MINUTES` | `5` | How long a failed connection is skipped |
| `AI_URL_ALLOWLIST` | unset | Comma-separated host suffixes, enforced by `validateAiUrl` |
| `CACHE_VERSION` | `v1` | Mixed into every LLM cache key |

### Per tier — suffix `` (Normal), `_LITE`, `_LARGE`

| Variable | Inherits from base tier | Notes |
|---|---|---|
| `AI_PROVIDER` | n/a | Declaring a different one makes the tier standalone |
| `AI_API_KEY` | yes | |
| `AI_MODEL` | yes | |
| `AI_URL` | yes | Required by the generic branch |
| `AI_SECRET` | yes | |
| `AI_INSTANCE` | yes | Required by the Azure branch |
| `AI_API_VERSION` | yes | Unused by the Azure chat branch |
| `AI_INPUT_COST_PER_1M_TOKENS` | yes | Parsed as a float, default `0` |
| `AI_OUTPUT_COST_PER_1M_TOKENS` | yes | Parsed as a float, default `0` |
| `AI_CACHED_INPUT_COST_PER_1M_TOKENS` | yes | Omitted entirely when unset, so it stays `undefined` rather than `NaN` |
| `AI_MAX_OUTPUT_TOKENS` | yes | Omitted when unset |
| `AI_REASONING_EFFORT` | yes | Narrowed to the five allowed values |
| `AI_GOOGLE_CREDENTIALS_BASE64` | yes | Vertex service-account JSON |
| `AI_REGION` | **no** | Per-model routing |
| `AI_ALLOW_FALLBACKS` | **no** | Default true; only `false` hard-pins |

### Vision, audio, image, transcriber, document AI

| Group | Variables | Fallback |
|---|---|---|
| Vision | `VISION_PROVIDER`, `_API_KEY`, `_MODEL`, `_URL`, `_REGION`, `_SECRET`, `_INSTANCE`, `_API_VERSION`, `_INPUT_COST_PER_1M_TOKENS`, `_OUTPUT_COST_PER_1M_TOKENS`, `_GOOGLE_CREDENTIALS_BASE64`, `_REASONING_EFFORT` | Falls back field by field to the matching `AI_*` |
| Audio | `AUDIO_*` (same set, minus reasoning effort) plus `AUDIO_COST_PER_MINUTE`, `AUDIO_DIRECT_URL`, `AUDIO_DIRECT_FORMAT`, `AUDIO_DIRECT_PROVIDER`, `AUDIO_LANGUAGE` | Falls back to `AI_*`; the direct-* keys have none |
| Image | `IMAGE_PROVIDER`, `_API_KEY`, `_MODEL`, `_URL`, `_REGION`, `_INSTANCE`, `_API_VERSION`, `_GOOGLE_CREDENTIALS_BASE64`, `_INPUT_COST_PER_1M_TOKENS`, `_OUTPUT_COST_PER_1M_TOKENS` | **None, deliberately** — image generation is its own modality with its own endpoint and pricing |
| Transcriber | `TRANSCRIBER_PROVIDER`, `_API_KEY`, `_MODEL`, `_URL`, `_API_VERSION` | None |
| Document AI | `DOCUMENT_AI_ENABLED`, `_PROVIDER` (default `azure`), `_API_KEY`, `_MODEL`, `_URL`, `_API_VERSION`, `_COST_PER_PAGE` | None |

### Embedder

| Variable | Default |
|---|---|
| `EMBEDDER_PROVIDER`, `_API_KEY`, `_URL`, `_MODEL`, `_INSTANCE`, `_API_VERSION`, `_REGION`, `_GOOGLE_CREDENTIALS_BASE64` | empty |
| `EMBEDDER_DIMENSIONS` | `0` |
| `EMBEDDER_INPUT_COST_PER_1M_TOKENS` | `0` — unset means embeddings are not billed |
| `EMBEDDER_TPM_LIMIT` | `1000000` |
| `EMBEDDER_TPM_SAFETY` | `200000` |
| `EMBEDDER_MAX_BATCH_TOKENS` | `100000` |
| `EMBEDDER_MAX_CONCURRENT_REQUESTS` | `10` |
| `EMBEDDER_MAX_WAIT_MS` | `90000` |
| `EMBEDDER_MAX_ATTEMPTS` | `3` |
| `EMBEDDER_CHARS_PER_TOKEN` | `4` |

### Dumping

| Variable | Default |
|---|---|
| `ASSISTANT_DUMP_LLM_CALLS` | off; only the literal `1` enables it |
| `ASSISTANT_DUMP_LLM_CALLS_DIR` | a .llm-dumps folder under the working directory |
| `ASSISTANT_DUMP_LLM_REDACT` | off |
| `ASSISTANT_DUMP_LLM_KEEP_FIELDS` | empty; comma-separated dot-paths |

## `AI_URL_ALLOWLIST`

`validateAiUrl` refuses an empty URL, a malformed URL, and plaintext HTTP to any
host other than `localhost`, `127.0.0.1`, `::1` or a .local name — sending an
API key over cleartext leaks it on the wire. On top of that it optionally
enforces an allowlist of host suffixes: a URL passes when its hostname equals a
listed host or ends with `.` plus that host.

Unset and empty are **not** the same thing, and `buildAiUrlAllowlist` keeps them
apart:

- **Unset or an empty string** produces `undefined`, and the allowlist check is
  skipped entirely. Every well-formed HTTPS URL is accepted.
- **A value that parses to no usable hosts** — `AI_URL_ALLOWLIST=","` is the
  worked example — produces an empty array, which matches no host and therefore
  rejects *every* URL.

Collapsing the two would turn a misconfiguration into a silently disabled
security check, which is the one direction this must never fail.

## Where to look

| File | What it holds |
|---|---|
| `packages/nestjs-neo4jsonapi/src/core/llm/services/llm.service.ts` | The five entry points, the bounding envelope, the salvage ladder, usage persistence. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/model.service.ts` | Tier resolution, the provider branches, the client cache, the `MOCK_AI` gate, the embedder. |
| `packages/nestjs-neo4jsonapi/src/config/base.config.ts` | Every variable above, and the tier inheritance rules in `buildAiTier`. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/ai-connection-resolver.service.ts` | The snapshot, the chain order and the cooldown. |
| `packages/nestjs-neo4jsonapi/src/core/llm/utils/schema.utils.ts` | Strict-mode analysis, the rewrite, the Gemini sanitiser. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/unsupported-param-fetch.ts` | Provider-truth parameter repair and its two memo scopes. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/llm-call-dumper.service.ts` | Dump sessions, redaction and the socket event. |
| `packages/nestjs-neo4jsonapi/src/core/llm/services/rate-limited-embedder.ts` | Sub-batching, the concurrency gate and the bucket retry. |
| `packages/nestjs-neo4jsonapi/src/core/llm/llm.module.ts` | The eleven providers this layer exports globally. |
| `apps/api/src/config/config.ts` | Where the app would extend the AI configuration it inherits. |

## Gaps and drift

- `.env.example` covers `AI_*`, `VISION_*`, `EMBEDDER_*` and `TRANSCRIBER_*`
  only. `MOCK_AI`, the three `AI_REQUEST_*` bounds,
  `AI_CONNECTION_COOLDOWN_MINUTES`, `AI_URL_ALLOWLIST`, every `_LITE` and
  `_LARGE` suffix, `AUDIO_*`, `IMAGE_*`, `DOCUMENT_AI_*`, every
  `EMBEDDER_*` rate-limit key and all four `ASSISTANT_DUMP_LLM_*` keys are read
  by the package but absent from the template's example file. They all have
  defaults, so nothing fails to boot; they are simply undiscoverable from
  `.env.example` alone.
- `.env.example` also omits `AI_CACHED_INPUT_COST_PER_1M_TOKENS` and
  `AI_MAX_OUTPUT_TOKENS`, so a fresh app prices prompt-cache hits at the full
  input rate and leaves the output cap to the provider.
- The comment above `AI_PROVIDER` in `.env.example` lists three supported
  providers. `ModelService` has named branches for six and treats any other
  name with a URL as an OpenAI-compatible endpoint.
- `EMBEDDER_DIMENSIONS` defaults to `0` in `packages/nestjs-neo4jsonapi/src/config/base.config.ts` while
  `.env.example` ships `3072`. Under `MOCK_AI` with no value set, the stub
  embedder returns zero-length vectors.
- The package's default MCP server name and several docblock examples name the
  application the package was first written for. They are defaults and comments,
  not behaviour, but an app should not adopt them.
- Not examined here: the internals of the tool loop inside `call` beyond the
  fallback ladder; `ChunkNodeService` and the other retrieval consumers of the
  embedder; the `AiConnection` entity's HTTP surface and encryption service
  (covered by the assistant-and-actions foundation chapter); `TokenUsageService`
  beyond `computeCost` and `recordTokenUsage`; `pdf` and `document` core modules
  that also consume OCR.
