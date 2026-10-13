---
title: Token usage and credits
section: 03-backend
---

Every large-language-model (LLM) call the platform makes is accounted for: how
many tokens it consumed, what it cost in euros, and how many billing credits
that converts to. This page covers where the record is written, the two
injection tokens an application must bind to make accounting and gating actually
apply, the credits formula and its inputs, and the two dashboards the template
mounts. The Stripe half is summarised and cross-referenced rather than repeated.

## Where usage is recorded

`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/`. One entity, three
services, three repositories, two controllers, seven descriptors.

### `TokenUsageService`

`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/services/tokenusage.service.ts`
extends `AbstractService`, and two of its design decisions matter to anyone
subclassing it:

- The descriptor is an initialised class field, resolved by subclass
  polymorphism, never by a registry lookup — Nest constructs providers before
  `onModuleInit`, where models are registered.
- Every member is `protected` rather than `private`, because TypeScript forbids
  a subclass from redeclaring a name the base holds privately (TS2415).

Its inherited generic CRUD is unused by any route in the package — there is no
`tokenusages` controller, records are only ever written by `recordTokenUsage()`
— but it is there for an app that mounts its own.

`recordTokenUsage(params)` is the write path. It computes the cost (or takes the
caller's `costOverride`), resolves the model and provider, converts cost to
credits, persists through `TokenUsageRepository.create`, and then emits
`tokenusage.recorded` on the event bus with `{ input, output, cost, credits }`.
The emit is wrapped in a `try`/`catch` that logs a warning: a listener failure
must never break the LLM call that triggered it. The event exists so the module
can stay ignorant of billing — `CompanyService` listens and deducts the
balance, and `TokenUsageModule` never imports `CompanyModule`.

### The entity

`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/entities/tokenusage.ts`
is `isCompanyScoped: true` with fields `inputTokens`, `outputTokens`,
`cachedInputTokens`, `cost`, `credits`, `tokenUsageType`, `model`, `provider`,
plus the company relationship.

Three real graph edges are written by
`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/repositories/tokenusage.repository.ts`
and **none of them is declared in the descriptor's `relationships`**:

| Edge | Target | Written when |
|---|---|---|
| `BELONGS_TO` | `(:Company)` | a company id is in CLS |
| `TRIGGERED_BY` | `(:User)` | a user id is in CLS |
| `USED_FOR` | any entity label | always, from `relationshipId` + `relationshipType` |

`USED_FOR` is polymorphic — its target can carry any label — which the
descriptor's fixed-target relationship shape cannot express, so `create()` is
hand-written Cypher. `tokenUsageType` is typed `string` rather than an enum
because the set of operations that record usage is application-specific; the
package's own values are listed in
`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/enums/tokenusage.type.ts`.

### The two projections

Neither controller serves the entity. Both serve read-only aggregate shapes,
each with its own descriptor and serialiser.

| Surface | Controller | Guard | Endpoints |
|---|---|---|---|
| Administrative (cross-tenant) | `tokenusage.admin.controller.ts` | `JwtAuthGuard` + `@Roles(Administrator)` on every route | `GET tokenusages/administration/summary`, `…/timeline`, `…/breakdown` |
| Self-service (own company) | `tokenusage.report.controller.ts` | `JwtAuthGuard`, **no `@Roles`** | `GET tokenusages/reports/summary`, `…/timeline`, `…/breakdown` |

The two differ in more than their guard:

- The admin surface accepts a `companyId` filter, can stack a timeline by
  `scope`, `type` or `company`, and can break down by `company`, `user`,
  `operation` or `target`. The report surface accepts no `companyId` at all —
  scoping is the repository's job through the CLS company — pins `stackBy` to
  `"type"`, and allows only `operation` and `target` as dimensions. Company and
  user are absent by design: inside one tenant the company dimension is a single
  row and the user dimension would expose colleagues' individual spend.
- The report surface's `metric` allowlist is `credits` and `tokens`. **`cost` is
  deliberately absent**: customers are billed in credits, and exposing the
  platform's monetary cost would leak margin. Enforcing that only in the UI
  would leave it one query string away, so the boundary refuses it.

Both controllers validate enum-valued query params against closed allowlists
declared as module constants, not through DTOs. The reason is stated in both
files: granularity, dimension and stacking **select a Cypher clause** — they are
interpolated, not bound — so an unvalidated string would be an injection vector.
DTOs are body validation for `POST`/`PUT`/`PATCH`; `GET` filters arrive as bare
`@Query()` params and need this treatment.

Both mount under `tokenusages/` with distinct sub-prefixes so importing
`TokenUsageModule` can never duplicate a Fastify route against an app's own
`tokenusages` routes.

`dimension=target` needs one more thing: the `TOKEN_USAGE_TARGET_LABELS` token
(`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/common/tokenusage.target-labels.ts`),
an app-supplied allowlist of the Neo4j labels the `USED_FOR` breakdown may group
by. Supplied from a `@Global()` module and injected with `@Optional()`; absent
means an empty list, which means `dimension=target` is rejected. That is the
correct default for an app that has not opted in — and the template opts in to
nothing, so the "by target" panel is skipped in the UI.

### The entity set

`TokenUsageModule` registers seven models in one `onModuleInit`:

| Descriptor | Type | Endpoint |
|---|---|---|
| `TokenUsageDescriptor` | `tokenusages` | `tokenusages` |
| `TokenUsageAdminSummaryDescriptor` | `tokenusage-admin-summaries` | `tokenusages/administration/summary` |
| `TokenUsageAdminTimelineDescriptor` | `tokenusage-admin-timelines` | `tokenusages/administration/timeline` |
| `TokenUsageAdminBreakdownDescriptor` | `tokenusage-admin-breakdowns` | `tokenusages/administration/breakdown` |
| `TokenUsageReportSummaryDescriptor` | `tokenusage-report-summaries` | `tokenusages/reports/summary` |
| `TokenUsageReportTimelineDescriptor` | `tokenusage-report-timelines` | `tokenusages/reports/timeline` |
| `TokenUsageReportBreakdownDescriptor` | `tokenusage-report-breakdowns` | `tokenusages/reports/breakdown` |

All seven serialisers are in `providers`. The module has no `imports`.

## `TOKEN_USAGE_RECORDER`

Declared in `packages/nestjs-neo4jsonapi/src/common/tokens.ts`.

**What it is.** An optional application-provided sink for token-usage records
produced *inside* the package. Its contract is `TokenUsageRecorderInterface`,
deliberately minimal — the write path only. Cost and telemetry helpers such as
`computeCost` stay on the package `TokenUsageService`, which every consumer
keeps resolving as before.

**Why package-internal callers resolve it optionally with a fallback.**
`LLMModule` imports the package `TokenUsageModule`, so `LLMService` resolves the
package `TokenUsageService` from **its own** module context. An application that
subclasses the service and aliases the class token in **its** module —
`{ provide: TokenUsageService, useExisting: ExtendedTokenUsageService }` — does
not change what `LLMService` gets, because Nest resolves per injector context.
The result was package-side LLM calls silently bypassing the app's billing
logic.

So every package caller injects:

```ts
@Optional() @Inject(TOKEN_USAGE_RECORDER) private readonly tokenUsageRecorder?: TokenUsageRecorderInterface,
```

and writes through `this.tokenUsageRecorder ?? this.tokenUsageService`. Bound,
the app's implementation receives the record; unbound, behaviour is exactly
what it was for a consumer that never opted in. Current package callers:
`LLMService`, `EmbedderService` and `AudioLLMService`
(`packages/nestjs-neo4jsonapi/src/core/llm/services/`). Any new package code
that persists usage must use the same token — injecting `TokenUsageService`
directly re-opens the bypass.

**Why an app must bind it in a `@Global()` module.** Aliasing the class is not
enough, for the reason above. A library module can never import an application
feature module, so the binding has to be visible application-wide:

```ts
{ provide: TOKEN_USAGE_RECORDER, useExisting: ExtendedTokenUsageService }
```

in a `@Global()` module. The template binds nothing, so package LLM calls are
recorded by the package service.

## `CREDIT_VALIDATOR`

The mirror seam, also in `packages/nestjs-neo4jsonapi/src/common/tokens.ts`.
`CreditValidatorInterface` has one required method and one optional one:

- `validateCredits({ companyId })` must **throw**
  `HttpException("NO_CREDITS", HttpStatus.PAYMENT_REQUIRED)` when the company has
  no available credits, and must be a no-op when credits are disabled
  (`creditCost <= 0`).
- `isAiEnabled?({ companyId })` answers a different question — not "is there
  balance?" but "does this plan carry AI at all?". A company can have AI and no
  balance (defer the work) or no AI at all (drop it).

HTTP controllers want the 402 to propagate. Job processors must **defer** rather
than fail, so they need a boolean, which is what
`packages/nestjs-neo4jsonapi/src/common/helpers/credit-gate.ts` adapts:

`hasAvailableCreditsVia(validator, { companyId })`:

| Situation | Result |
|---|---|
| No provider bound | `true` — work proceeds **ungated** |
| Validator throws 402 `NO_CREDITS` | `false` — job defers |
| Validator throws anything else | rethrown — a Neo4j outage is never read as an empty balance |
| Credits disabled (`creditCost <= 0`) | `true` — the validator is a documented no-op |

`isAiEnabledVia(validator, { companyId })`:

| Situation | Result |
|---|---|
| No provider bound | `true` — AI treated as enabled |
| `isAiEnabled` not implemented | `true` |
| `isAiEnabled` throws | `true` |
| `isAiEnabled` resolves | its answer |

### Both tokens fail open

The first row of each table is the dangerous one. **An application that intends
to enforce credits but forgets to bind `CREDIT_VALIDATOR` runs entirely
ungated, silently** — no error, no warning, no log line. The same holds for
`TOKEN_USAGE_RECORDER`: an unbound token means the app's billing subclass never
sees a package-side call, and nothing says so.

Failing open is deliberate. It preserves behaviour for every consumer that never
opted in, and wrongly reporting "no AI" would drop work for a paying customer,
which is unrecoverable. But it means **the binding, not the package, is what
enforces billing**. If your app charges for AI, bind both tokens from a
`@Global()` module and write a boot-time assertion that they are bound.

The template binds neither. On a fresh app, AI work is unmetered against a
balance and no credit gate applies.

## The credits formula

From `packages/nestjs-neo4jsonapi/src/config/interfaces/config.credits.interface.ts`
and `TokenUsageService.recordTokenUsage`:

```
credits = max(minCreditsPerRecord, round4(cost / creditCost))
```

`cost` is in **euros** — as is every `*_COST_PER_1M_TOKENS` value in the
configuration.

Two variables drive it, both in `baseConfig.credits`
(`packages/nestjs-neo4jsonapi/src/config/base.config.ts`):

| Variable | Env | Default | Effect |
|---|---|---|---|
| `creditCost` | `CREDIT_COST` | `0` | Euros per credit. **`0` or an absent block disables credits entirely** — records store `credits: 0` and no balance is deducted, so a consumer that never sets it keeps its pre-credits behaviour. |
| `minCreditsPerRecord` | `CREDIT_MINIMUM` | `0.1` | Floor applied to every record, so sub-cent calls are still billed. Skipped when the caller passes `applyMinimum: false`. |

Rounding is to four decimals, not two, and that is deliberate: a ~144-token
transcription utterance or an embedding call rounded to `0.00` at this step even
before the floor was applied, so cheap high-volume work billed nothing. Four
decimal places keep it measurable. Embedding callers pass `applyMinimum: false`
so sub-cent calls are not floored up.

`env.example` ships `CREDIT_COST=""` and `CREDIT_MINIMUM=""`, so credits are off
until you set them.

## How a call is priced

`computeCost` reads a rate card, not a single price:

```ts
const cached = Math.min(tokens.cached ?? 0, tokens.input);
const uncachedInput = tokens.input - cached;
const cost = (uncachedInput * inputRate + cached * cachedRate + tokens.output * outputRate) / 1_000_000;
```

Rates are per million tokens. Which card applies is resolved by `configForCall`:

| Call | Config block | Notes |
|---|---|---|
| Text, normal tier | `ai` | The default. |
| Text, lite tier (`ModelWeight.Lite`) | `aiLite` | Falls back field by field to `ai` unless it declares a different provider. |
| Text, large tier (`ModelWeight.Large`) | `aiLarge` | Same fallback rule. |
| Image analysis (`useVisionCosts: true`) | `vision` | Selected before the weight, so vision wins over `modelWeight`. |
| Audio transcription | `audio` | Also carries `costPerMinute` (`AUDIO_COST_PER_MINUTE`). |
| Document AI / OCR | `documentAi` | `costPerPage` (`DOCUMENT_AI_COST_PER_PAGE`); no token counts at all. |

Three refinements:

- **Cached input.** `cached` is clamped to at most `input`. The cached rate
  (`AI_CACHED_INPUT_COST_PER_1M_TOKENS`) falls back to the **effective input
  rate**, not to the config's cached rate, when a connection supplies its own
  rates — mixing one connection's input price with another's cache discount
  would price cached tokens above uncached ones. The `vision` and `audio` blocks
  have no cached rate, so cached tokens there bill at the full input rate.
- **Per-connection rates.** A call may be served by any link of a database-backed
  `AiConnection` fallback chain, and each link carries its own prices. Such a
  candidate passes `rates: TokenUsageRatesInterface`, which overrides the config
  block field by field. An `.env`-sourced candidate passes nothing.
- **`costOverride`.** Where a provider returns no token counts, the caller
  computes the price itself and passes it: embeddings as estimated tokens times
  the embedder rate, audio through up to three pricing clocks ending in
  `costPerMinute`, OCR as `pages * costPerPage`. **Every `costOverride` caller
  must also pass `model` and `provider` explicitly** — their tier is not
  derivable from `useVisionCosts` or `modelWeight`, and without them the record
  would name the config-block model for a call that model never made. The same
  rule applies to any caller served by a database-backed connection.

A `documentAi.costPerPage` of `0` or unset means OCR pages are free and no usage
record is written for them. An `audio.costPerMinute` left unset means an engine
that reports no usage bills nothing — `AudioLLMService` warns loudly in that
case.

## The Stripe side

Ten of the package's foundations are the billing stack: `stripe` plus
`stripe-customer`, `stripe-invoice`, `stripe-price`, `stripe-product`,
`stripe-promotion-code`, `stripe-subscription`, `stripe-trial`, `stripe-usage`
and `stripe-webhook`. In outline:

- Products, prices, promotion codes and subscriptions mirror the Stripe objects
  into Neo4j so the app can query entitlements without a network call.
- `stripe-usage` is where metered usage is reported back to Stripe; it is the
  natural consumer of the `tokenusage.recorded` event in an app that bills on
  consumption.
- `stripe-webhook` is the reason `RAW_BODY_ROUTES` in
  `packages/nestjs-neo4jsonapi/src/bootstrap/raw-body.config.ts` contains
  `/stripe-webhooks`: signature verification needs the unparsed body, and the
  `preParsing` hook captures it only for that prefix.

The full picture — the entity graph, the webhook flow, the trial and promotion
mechanics — belongs to
[Billing and token usage](../05-foundations/billing-and-token-usage.md), and the
package ships its own reference set under
`packages/nestjs-neo4jsonapi/src/foundations/stripe/docs/`. Read those rather
than a summary here.

The connection between the two halves is one event and two tokens: usage is
recorded by `TokenUsageService`, announced as `tokenusage.recorded`, converted
to credits by the formula above, and deducted or reported by whatever the app
binds to `CREDIT_VALIDATOR` and `TOKEN_USAGE_RECORDER`.

## The web side

The dashboards are not app code. They live in the frontend package's
`tokenusage` feature and are exported from
`packages/nextjs-jsonapi/src/features/tokenusage/index.ts`, consumed as
`@carlonicora/nextjs-jsonapi/tokenusage`.

That barrel is deliberately **not** re-exported from the package's main entry
point: keeping it off the main barrel is what keeps its charting dependency out
of the main client bundle.

The template mounts two routes, each of which does nothing but compose the
package's container:

| Route | File | Composes |
|---|---|---|
| `/tokenusage` | `apps/web/src/app/[locale]/(main)/(foundations)/tokenusage/page.tsx` | `TokenUsageReportProvider` + `TokenUsageReportContainer` |
| `/administration/token-usage` | `apps/web/src/app/[locale]/(admin)/administration/token-usage/page.tsx` | `AdministrationProvider` + `TokenUsageAdminProvider` + `TokenUsageAdminContainer` |

Four things the two files record and you will need:

- **Import from the client subpath.** The package ships no server entry for this
  feature on purpose. `tsup` stamps `"use client"` only on the entries in its
  `clientEntries`, and with `splitting: true` a package-side server page puts the
  provider and container into a directive-less shared chunk — Next then treats
  them as Server Components and every `createContext` in the transitive graph
  fails to compile.
- **No `targetLabel` is passed** on the report page. The "by target" panel groups
  by an application-specific Neo4j label and the API refuses any label the app's
  target-labels module did not declare. This app declares none, so the panel is
  skipped and no request is issued for it. Pass `targetLabel` together with
  `targetPanelTitleKey` once your app attributes usage to one of its entities.
- **The remaining-credits tiles need a bridge.** `TokenUsageReportContainer`
  takes an optional `balances` prop, and those values come from
  `useCurrentUserContext()` — a client hook a server route cannot call. Wrap the
  container in a small `"use client"` component of your own to supply them.
- **The admin route's only gate is `requireAdministrator`.** The `(admin)` layout
  reads no session; the page awaits `requireAdministrator(locale)`
  (`apps/web/src/features/common/components/session/requireAdministrator.ts`),
  which sends anyone without the Administrator role to a 404.
  `TokenUsageAdminContainer` brings its own page container and reads its title
  from shared context, which `AdministrationProvider` supplies.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/src/common/tokens.ts` | Both seams, their contracts, and the fail-open tables. |
| `packages/nestjs-neo4jsonapi/src/common/helpers/credit-gate.ts` | The throwing-to-boolean adapters processors use. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/services/tokenusage.service.ts` | `computeCost`, `recordTokenUsage`, the credits conversion. |
| `packages/nestjs-neo4jsonapi/src/config/interfaces/config.credits.interface.ts` | The formula and what `creditCost: 0` means. |
| `packages/nestjs-neo4jsonapi/src/config/interfaces/config.ai.interface.ts` | Every tier's rate fields, plus `documentAi` and `audio` pricing. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/controllers/tokenusage.report.controller.ts` | Why `cost` is absent and why allowlists are not DTOs. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/controllers/tokenusage.admin.controller.ts` | The cross-tenant surface and its role guard. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/common/tokenusage.target-labels.ts` | The app-supplied label allowlist for `dimension=target`. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/events/tokenusage.events.ts` | The event that decouples usage from balance deduction. |
| `packages/nextjs-jsonapi/src/features/tokenusage/index.ts` | Everything the two template routes import. |

## Gaps and drift

- The template binds neither `TOKEN_USAGE_RECORDER` nor `CREDIT_VALIDATOR`, so
  on a fresh app every AI operation is ungated and package-side usage is
  recorded by the package service. Nothing warns about it.
- `env.example` describes `CREDIT_MINIMUM` as "the smallest purchasable
  top-up". It is not: `ConfigCreditsInterface` and `recordTokenUsage` use it as
  the per-record credits floor. The code is authoritative.
- `CREDIT_COST` and `CREDIT_MINIMUM` ship as empty strings in `env.example`.
  `parseFloat("")` is `NaN`, so an uncommented-but-unfilled `CREDIT_COST` gives
  `creditCost: NaN`, which fails the `> 0` test and leaves credits disabled —
  the same outcome as the `"0"` default, by a different route.
- `TokenUsageDescriptor` declares no relationships, while
  `TokenUsageRepository.create` writes three edges. `USED_FOR` is polymorphic
  and cannot be expressed in the descriptor's fixed-target shape; the other two
  are simply absent from the {json:api} surface.
- The template's own `tokenUsageType` set is empty — the values in
  `tokenusage.type.ts` are the package's operations, not the app's.
- Not examined: the three repositories' aggregation Cypher; the six projection
  descriptors' field sets; `TokenUsageAdminService` and
  `TokenUsageReportService` beyond their route surface; the Stripe foundations
  in any detail; the chart components in the frontend package. The billing
  chapter and `06-ai/eval-and-cost.md` carry those.
