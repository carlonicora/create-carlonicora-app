---
title: Evaluation and cost
section: 06-ai
---

Two questions about an AI feature only have answers if something measures them:
does retrieval actually find the right material, and what does a run cost. The
package ships machinery for both — a retrieval evaluation harness and a token
ledger with a credits conversion. {{display}} wires neither of them on day zero.
This page describes what exists, how it is priced, and exactly what an app has
to add before either number is real.

## The retrieval evaluation harness

Everything lives under
`packages/nestjs-neo4jsonapi/src/eval/retrieval/`. It answers one question per
question in a set: did the answer assert what a correct answer must assert, and
was it grounded in the material it had to be grounded in.

| Service | File | What it does |
|---|---|---|
| `QuestionSetLoader` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/question-set.loader.ts` | Reads a YAML question set, validates it against the Zod schema, and throws a message naming every offending path. A malformed ground truth that loaded anyway would silently weaken every later comparison |
| `EvidenceMatcher` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/evidence.matcher.ts` | Decides whether a ground-truth snippet is present in retrieved text. Forgiving on whitespace and case, deliberately not fuzzy on wording — a snippet is chosen to be distinctive, so a near-miss is a miss. Chunk ids and positions cannot anchor this: ids are regenerated on every ingest and positions shift when the chunker changes |
| `RetrievalSweepService` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/retrieval-sweep.service.ts` | The fast inner loop. Asks the retrieval layer what it *would* read and stops there — the only provider call is embedding the question. Reports evidence found, missing snippets, chunk count and elapsed milliseconds |
| `EndToEndSweepService` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/end-to-end-sweep.service.ts` | The metric of record. Runs a full responder turn per question with the app's own prompts and temperature, then measures evidence retrieved, evidence that survived the trim into the answer model, evidence cited, the rubric verdict, tokens and elapsed time |
| `RubricJudgeService` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/rubric-judge.service.ts` | Grades one answer against its rubric with an LLM call at temperature 0 and an explicit reasoning effort, returning `passed`, one of four failure modes, and a one-sentence explanation. A judge failure records the question as failed rather than skipping it |
| `TokenAccountingChecker` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/token-accounting.check.ts` | Cross-checks the turn's reported token total against the sum of the calls actually observed, within a two-token tolerance. `reset()` exists for the question that never completed a turn, so its observations are not attributed to the next one |
| `renderSweepReport` | `packages/nestjs-neo4jsonapi/src/eval/retrieval/sweep-report.ts` | Renders a summary to markdown, leading with the number that decides whether a change ships |

Both sweeps run **sequentially**, on purpose: `retrievalMs` and `answerMs` are
reported metrics and concurrency would make them meaningless.

The four rubric failure modes are a closed set, declared once so the schema the
judge is constrained to and the runtime guard cannot drift apart:
`evidence-not-retrieved`, `retrieved-but-unused`, `contradicted-source` and
`hedged-without-answering`. A failing answer gets exactly one.

A token-accounting mismatch is rendered as a banner, not a column: a sweep whose
own arithmetic does not close cannot be used as a baseline, and that must not be
discoverable only by reading a table. A question whose turn never completed is
reported as a failure, not as a mismatch — it was never compared.

### The module, and why an app must reach for it by path

`RetrievalEvalModule` (`packages/nestjs-neo4jsonapi/src/eval/retrieval/retrieval-eval.module.ts`)
imports exactly three modules, one per injected dependency: the LLM module for
the judge, the chunk module for the retrieval sweep, and the responder module
for the end-to-end sweep. It is **not** imported by `AgentsModule` and not
mounted by `bootstrap()` — a product that never runs a sweep should not pay for
this dependency graph.

It is also not exported from the package's root barrel
(`packages/nestjs-neo4jsonapi/src/index.ts`), and the package's `exports` map has
no `eval` subpath beside the ones it declares for core, foundations, agents,
bootstrap and MCP. So an app cannot import it the way it imports everything
else: it reaches the module by path, from a sweep entry point it writes itself,
and pins the package version it does that against.

### Scope comes from CLS, not from a parameter

Both sweep services say so in their own docblocks, and it is the one thing an
entry point must get right. `RetrievalSweepService.run` deliberately takes no
company id, because accepting one would imply it is honoured, and it is not.
Company scope reaches the chunk repository through CLS; the run's scope root
reaches it through the agent-scope CLS key, which fails closed. An entry point
that does not establish that context retrieves nothing — or, worse, retrieves
unscoped. `EndToEndSweepService.run` still takes a company id and a user id
because the responder genuinely needs them, but they do not scope retrieval
either.

### The question set

One YAML file, validated by `evalQuestionSetSchema`: a `version` of `1`, a
`product` name, and one or more questions. Each question carries:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable, unique within the set |
| `corpus` | yes | Which body of content the question is asked against |
| `question` | yes | Exactly as a user would ask it |
| `mustRetrieve` | yes | Distinctive snippets a correct answer must be grounded in |
| `rubric` | yes | What a correct answer must assert, in one or two sentences |
| `scopeId` | no | The scope root when the turn is scope-confined |
| `scopeType` | no | Its JSON:API type |
| `scopeLabel` | no | Its Neo4j label — required whenever `scopeId` is set, because the scope guard needs the label and deriving it would drag the graph catalogue into the runner |

## What a call costs

Cost is computed in `TokenUsageService.computeCost`
(`packages/nestjs-neo4jsonapi/src/foundations/tokenusage/services/tokenusage.service.ts`),
which is the single source of truth for both the persisted record and any
ephemeral telemetry.

For a text call, the tier that priced it is the tier that served it — `ai`,
`aiLite` or `aiLarge`, or the vision block when the caller asks for vision
costs. Then:

```
cached          = min(tokens.cached, tokens.input)
uncachedInput   = tokens.input − cached
cost (currency) = (uncachedInput × inputRate
                 + cached       × cachedRate
                 + tokens.output × outputRate) / 1_000_000
```

`inputRate` and `outputRate` come from `AI_INPUT_COST_PER_1M_TOKENS` and
`AI_OUTPUT_COST_PER_1M_TOKENS` for that tier. `cachedRate` comes from
`AI_CACHED_INPUT_COST_PER_1M_TOKENS`, and **falls back to the full input rate**
when unset — no discount rather than a free lunch. When a database-backed AI
connection served the call it supplies its own rates, and each one falls back to
the config block individually — except the cached rate, which then falls back to
that connection's *effective* input rate, because mixing one connection's input
price with another's cache discount could price cached tokens above uncached
ones.

Three paths do not price by token, and each passes a `costOverride` instead:

| Path | Priced by | Variable |
|---|---|---|
| OCR | pages the provider actually processed, reported by `DocumentAiService.extract` | `DOCUMENT_AI_COST_PER_PAGE` |
| Audio | the provider's own reported cost if there is one, else tokens at the audio rates, else duration | `AUDIO_COST_PER_MINUTE` |
| Embeddings | locally counted tokens at the embedder rate; a rate of 0 records nothing at all | `EMBEDDER_INPUT_COST_PER_1M_TOKENS` |

The audio ordering is strict and never combined: a measured provider invoice
beats estimated tokens, which beat a per-minute estimate. Which clock priced the
row is logged, because three clocks can produce three different numbers for the
same audio and nothing on the record says which one ran. All three override
paths must also name their `model` and `provider` explicitly — the recorder
cannot infer a tier it did not price with, and a record naming the base model
for a call that model never made is worse than an unnamed one.

### Credits

`recordTokenUsage` converts the cost into billing credits:

```
credits = max(minCreditsPerRecord, round4(cost / creditCost))
```

`creditCost` is `CREDIT_COST` and `minCreditsPerRecord` is `CREDIT_MINIMUM`,
which defaults to 0.1. `CREDIT_COST` unset or zero disables credits entirely:
records store `0` and no balance is deducted, so an app with no credit model is
unaffected.

Rounding is to four decimals rather than two, because sub-cent operations — a
short transcription, an embedding call — rounded to zero at this step even
before the floor applied, so cheap high-volume calls billed nothing. The floor
itself is skipped (`applyMinimum: false`) for the three `costOverride` paths and
for a successful call that reported no tokens at all: the floor exists to stop
sub-cent *real* usage rounding away, not to invent a charge.

### Where the record lands

One `TokenUsage` node per call, written by `TokenUsageRepository.create` with
`inputTokens`, `outputTokens`, `cachedInputTokens`, `cost`, `credits`,
`tokenUsageType`, `model` and `provider`, and three edges: `BELONGS_TO` the
company, `TRIGGERED_BY` the user, and `USED_FOR` the attributed entity. The last
one is polymorphic — any label — which is why the descriptor declares no
relationships and why both `relationshipId` and `relationshipType` are required
before anything is written at all.

The service then emits a `tokenusage.recorded` event, which the company
foundation consumes to decrement the running credit balance. The decoupling is
deliberate: the token-usage module never imports the company module, and the
handler is best-effort so a balance failure cannot break the LLM call that
triggered it. `tokenUsageType` stays a free-form string, because the set of
billable operations is the application's, not the package's.

There is no token-usage controller in the package. Records are written only
through `recordTokenUsage`; an app that wants to expose them mounts its own
controller over the inherited CRUD, and `findByCompany` exists for the
date-range and type filtering such an endpoint needs.

## What this app must add to measure anything

None of the following exists in {{display}} today. Stating it plainly is the
point of this section.

- **No eval harness is wired.** Nothing under `apps/api/src` imports
  `RetrievalEvalModule`, and there is no sweep entry point.
- **No question set exists.** There is no YAML file anywhere in the app for
  `QuestionSetLoader` to read.
- **No cost test exists.** No script, no spec and no `package.json` command
  runs a sweep or asserts a cost.
- **No spec exercises any AI path.** Neither app ships a single unit spec under
  `src`, and every Vitest config sets `passWithNoTests: true`, so all three
  suites pass on an empty run.

### The shape of what to add

1. **A question set**, versioned with the app rather than with the content it
   asks about. Ten to thirty questions is enough to move a number; each needs a
   rubric written as an assertion ("states that X applies to Y"), not as a
   topic, and `mustRetrieve` snippets copied verbatim from the source. Where the
   app is scope-confined, every question carries all three of `scopeId`,
   `scopeType` and `scopeLabel`.

2. **A sweep entry point** under `apps/api/src`, run as a standalone Nest
   context rather than through the HTTP server. Its whole job is the thing the
   services refuse to do for it: establish CLS — company id, user id and the
   agent scope — then load the set, run one of the two sweeps, render the
   report, and write it somewhere a diff can see it. Wrap the run in
   `cls.run()`; without it the repositories read no tenant and the sweep either
   retrieves nothing or retrieves across every tenant.

3. **A `package.json` script** so the sweep is invoked the same way twice.
   Retrieval-only is cheap enough to run on every retrieval change; end-to-end
   costs a full turn per question and belongs on a deliberate cadence.

4. **A committed baseline**: the rendered report for a known model and a known
   question set, replaced only when the number is understood. A sweep is only
   evidence against something.

5. **A cost assertion**, if cost is a requirement rather than an observation.
   The ledger already records tokens, cost and credits per call with a
   `tokenUsageType` the app chooses; a test that runs one representative flow
   and asserts the number of records, the types and a ceiling on credits catches
   a regression that no unit test can see — an extra model call added to a loop
   costs money without failing anything.

Two rules carry over from the harness's own design. Sequential, because a
reported duration under concurrency is not a duration. And a sweep whose token
accounting does not close is not a baseline, whatever its pass rate says.

## Where to look

| File | What it holds |
|---|---|
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/retrieval-eval.module.ts` | The wiring, and why it is not mounted by default. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/retrieval-eval.types.ts` | The question schema, the result shapes and the closed failure-mode set. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/end-to-end-sweep.service.ts` | The metric of record, and the CLS contract an entry point must honour. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/retrieval-sweep.service.ts` | The fast loop, and why it takes no company id. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/rubric-judge.service.ts` | The grading prompt, the output schema and the deliberate call parameters. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/token-accounting.check.ts` | The self-check that makes a reducer bug loud. |
| `packages/nestjs-neo4jsonapi/src/eval/retrieval/sweep-report.ts` | The report format and the mismatch banner. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/services/tokenusage.service.ts` | `computeCost`, `recordTokenUsage` and the credits formula. |
| `packages/nestjs-neo4jsonapi/src/foundations/tokenusage/repositories/tokenusage.repository.ts` | The three edges and the polymorphic `USED_FOR` target. |
| `.env.example` | Where `CREDIT_COST` and `CREDIT_MINIMUM` are set — both empty in a fresh app. |

## Gaps and drift

- The sweep services' docblocks point at an `apps/api` eval entry point as the
  place CLS is established. No such file exists in the template; the reference
  describes the application the package was first written for.
- The package exposes no `eval` subpath in its `exports` map and no export from
  the root barrel, so importing `RetrievalEvalModule` means reaching past the
  published entry points. Any app that adds a sweep should expect that import to
  be the fragile part.
- `.env.example` describes `CREDIT_MINIMUM` as the smallest purchasable top-up.
  In the code it is `minCreditsPerRecord`, the per-record credits floor applied
  by `recordTokenUsage`. Nothing in the package reads it as a purchase minimum.
- `.env.example` sets neither `CREDIT_COST` nor `CREDIT_MINIMUM`, so a fresh app
  records zero credits on every call and deducts nothing, however much it spends.
  Cost is still recorded.
- `.env.example` also omits `DOCUMENT_AI_COST_PER_PAGE`, `AUDIO_COST_PER_MINUTE`
  and `EMBEDDER_INPUT_COST_PER_1M_TOKENS`, each of which defaults to zero — so
  OCR, transcription and embeddings are priced at nothing until they are set.
- The rubric judge pins a reasoning effort chosen for the model one baseline was
  measured against. An app grading on a different model should state its own,
  and should re-baseline when it changes.
- Not examined here: the chunk repository's retrieval Cypher, which is what the
  retrieval sweep actually measures; the responder trace fields the end-to-end
  sweep reads; the Stripe foundations that sit above credits; the package's own
  specs for these services.
