---
title: Architecture rulebook
section: 02-framework
---

The twenty files beside this one are **verbatim copies** of the `nja` plugin's
`nja-architecture` skill references. They are reproduced here so the handbook is
complete offline — a reader with the repository but without the plugin installed
still has the full architecture rulebook — and so a future reader can see which
rules the app was built against.

Three rules govern them:

1. **They are never edited in place.** Each copy opens with a front-matter block
   and an HTML comment naming the plugin, the skill, the version and the date it
   was taken from. An edit made here is lost on the next sync.
2. **They are re-copied when the plugin updates.** The copies in this repository
   were taken from `nja` version 1.20.0.
3. **The handbook path checker skips them.** Their inline path citations point at
   the plugin's own tree, not at this repository, so validating them here would
   fail on every line.

Fix a rule in the plugin, then re-copy. The plugin is the source of truth; this
directory is a snapshot.

### What the copies cite, and the one redaction

**A path named inside a copy may not exist here.** The copies were written
against the plugin's own tree and the applications it was written for, not
against this repository. [Typography Roles](frontend/05-typography.md) cites
apps/web/docs/UI.md three times — in its `source_files` front matter, in the
body, and in its closing table — and no such file is created by this template.
That is why `scripts/check-handbook.mjs` exempts them: its `isRulebookCopy()`
test returns a copy's front-matter and placeholder problems and stops there,
before the cited-path and relative-link checks every authored page goes through.
Read a citation inside a copy as a rule about where something belongs, not as a
promise that the file is there.

**One line is redacted, and only one.** The reference-values line of
[Typography Roles](frontend/05-typography.md) named another product's stylesheet
and the same missing docs/UI.md; the citation was cut back to this repository's
own `apps/web/src/app/globals.css`. The HTML comment at the top of that file
records the change. Every other copy is byte-identical to the plugin's
reference, so a diff against the plugin should report that one line and nothing
else.

## Routing table

Match the file you are about to edit, then read the listed references **in the
listed order, before writing code**.

### Backend — `apps/api`

| File pattern | Read, in order |
|---|---|
| `apps/api/src/features/*/entities/*` | [Core principles](core-principles.md) → [Backend: Entity Basics](backend/01-entity-basics.md) → [Date and DateTime Handling](date-handling.md) if any field is a date or datetime |
| `apps/api/src/features/**/*.dto.ts`, or anything under `*/dtos/*` | [Backend: DTOs](backend/02-dtos.md) → [Date and DateTime Handling](date-handling.md) if any attribute is a date or datetime |
| `apps/api/src/features/**/*.repository.ts`, or anything under `*/repositories/*` | [Backend: Repositories](backend/03-repositories.md) → [Anti-Patterns Detection Guide](anti-patterns.md) → [Date and DateTime Handling](date-handling.md) if custom Cypher writes a date or datetime |
| `apps/api/src/features/**/*.service.ts`, or anything under `*/services/*` | [Backend: Services](backend/04-services.md) |
| `apps/api/src/features/**/*.controller.ts`, or anything under `*/controllers/*` | [Backend: Controllers](backend/05-controllers.md) → [Backend: DTOs](backend/02-dtos.md) |
| `apps/api/src/features/*/agent/**` — agent nodes, prompts, schemas, anything that calls an LLM | [Backend: LLM Calls](backend/06-llm-calls.md) → [Backend: Services](backend/04-services.md) |
| A **new** backend entity, full chain | [Core principles](core-principles.md) → [Entity Basics](backend/01-entity-basics.md) → [DTOs](backend/02-dtos.md) → [Repositories](backend/03-repositories.md) → [Services](backend/04-services.md) → [Controllers](backend/05-controllers.md) → [Backend: New Entity Template](backend/template.md) → [Date and DateTime Handling](date-handling.md) if any field is a date or datetime |

### Frontend — `apps/web`

| File pattern | Read, in order |
|---|---|
| `apps/web/src/features/*/data/*Interface.ts` | [Frontend: Interfaces](frontend/02-interfaces.md) → [Date and DateTime Handling](date-handling.md) if any getter is a `Date` |
| `apps/web/src/features/*/data/*Service.ts` | [Frontend: Services](frontend/03-services.md) → [Anti-Patterns Detection Guide](anti-patterns.md) |
| `apps/web/src/features/*/data/*.ts` — anything else in `data/` | [Frontend: Models](frontend/01-models.md) → [Date and DateTime Handling](date-handling.md) if `rehydrate()` or `createJsonApi()` touches a date or datetime |
| `apps/web/src/features/*/components/**`, or any `.tsx` under a feature | [UI Components (Base UI)](frontend/04-components.md) → [Typography Roles](frontend/05-typography.md) if the edit styles text → [BlockNote rich-text fields](frontend/06-blocknote.md) if the file touches a rich-text field |
| A **new** frontend entity, full chain | [Core principles](core-principles.md) → [Interfaces](frontend/02-interfaces.md) → [Models](frontend/01-models.md) → [Services](frontend/03-services.md) → [Components](frontend/04-components.md) → [Typography](frontend/05-typography.md) → [Frontend: New Entity Template](frontend/template.md) → [Date and DateTime Handling](date-handling.md) if any field is a date or datetime → [BlockNote](frontend/06-blocknote.md) if any field is rich text |

### Shared packages

| File pattern | Read |
|---|---|
| `packages/nestjs-neo4jsonapi/src/*` | `packages/nestjs-neo4jsonapi/CLAUDE.md` and `apps/api/CLAUDE.md` |
| `packages/nextjs-jsonapi/src/*` | `packages/nextjs-jsonapi/CLAUDE.md` and `apps/web/CLAUDE.md` |
| `packages/shared/src/*` | `packages/shared/CLAUDE.md` |

### Cross-cutting

Reviewing code or debugging: read [Anti-Patterns Detection Guide](anti-patterns.md)
first, then the layer-specific reference for the file under review.

[Working discipline](discipline.md) applies to any file, by situation: §1 *Prove
it works* before reporting anything as done, fixed or passing; §2 *Fix root
causes* while debugging; §3 *Type system discipline* when designing a type, an
entity descriptor or a signature; §4 *Encode lessons in structure* when writing
the same correction a second time; §5 *Separate before serialising shared state*
when working in a worktree or alongside another session.

If no row matches, read [Core principles](core-principles.md) and ask.

## Page index

### Cross-cutting

| Page | Covers |
|---|---|
| [Core Principles](core-principles.md) | JSON:API compliance, type safety, security defaults |
| [Anti-Patterns Detection Guide](anti-patterns.md) | the common mistakes and how to avoid them |
| [Working discipline](discipline.md) | prove it works, fix root causes, type discipline, encode lessons in structure, separate shared state |
| [Date and DateTime Handling](date-handling.md) | the native-storage contract end to end: descriptor → DTO → repository → model |
| [Architecture Decision Records](decisions.md) | why the patterns exist |
| [Feature Handbook Template](feature-template.md) | the shape of a feature handbook page |

### Backend

| Page | Covers |
|---|---|
| [Backend: Entity Basics](backend/01-entity-basics.md) | entity metadata and entity descriptors |
| [Backend: DTOs](backend/02-dtos.md) | POST and PUT request validation |
| [Backend: Repositories](backend/03-repositories.md) | `AbstractRepository`, Cypher, company filtering, pagination |
| [Backend: Services](backend/04-services.md) | `AbstractService`, business logic, JSON:API response building |
| [Backend: Controllers](backend/05-controllers.md) | HTTP handlers, auth guards, cache invalidation |
| [Backend: LLM Calls](backend/06-llm-calls.md) | input schemas and `.describe()`, output shape rules, prompt safety, attribution, tools |
| [Backend: New Entity Template](backend/template.md) | the copy-paste template |

### Frontend

| Page | Covers |
|---|---|
| [Frontend: Models](frontend/01-models.md) | `AbstractApiData`, `rehydrate()`, `createJsonApi()` |
| [Frontend: Interfaces](frontend/02-interfaces.md) | the TypeScript interface behind each model |
| [Frontend: Services](frontend/03-services.md) | `AbstractService`, `callApi()`, `EndpointCreator` |
| [UI Components (Base UI)](frontend/04-components.md) | Base UI patterns, the `render` prop, trigger composition |
| [Typography Roles](frontend/05-typography.md) | one Tailwind recipe per text role, colour tokens, header markup |
| [BlockNote rich-text fields](frontend/06-blocknote.md) | model conversion, display, editing, emptiness — and the converters never to write |
| [Frontend: New Entity Template](frontend/template.md) | the copy-paste template |

## The non-negotiable rules

Condensed. The canonical copy is the root `CLAUDE.md`; where the two disagree,
`CLAUDE.md` wins.

**Protocol.** All API traffic is JSON:API. Never build a JSON:API payload by
hand — the model builds it. No model, no request.

**Backend.** Extend `AbstractRepository` and `AbstractService`, never bypass the
framework. Query through `buildDefaultMatch()`, which injects company filtering —
hand-rolled filtering is a security defect. Return typed objects from
`readOne()` / `readMany()`, never raw `result.records`. Paginate with the
`{CURSOR}` placeholder, never manual `SKIP`/`LIMIT`. Pass `serialiser` to
`initQuery()` or type mapping fails. Use `createCrudHandlers()` /
`createRelationshipHandlers()` for standard CRUD. Take endpoint paths from meta
constants. Validate requests with DTOs. Parameterise every Cypher query.
Controllers call services, never repositories.

**Frontend.** Fetch through `callApi()`, never `fetch()`. Implement `rehydrate()`
and `createJsonApi()` on every model. Build URLs with `EndpointCreator`. Pass
`type: Modules.X` on every `callApi()` call, or rehydration fails. Never reach
for `overridesJsonApiCreation` without a dedicated model method. Never construct
a JSON:API payload by hand. This is **Base UI, not Radix**: no `asChild`, never
wrap a `<Button>` inside a trigger — compose with the `render` prop.

**Testing.** The runner is Vitest. Anything Jest — a `jest.*` call, a
`jest.config.js`, a `ts-jest` or `@types/jest` dependency — is a defect to fix,
not a style to match. A `vi.mock` factory cannot reference a module-scope binding
(Vitest hoists it); use `vi.hoisted()`. A factory using `vi.importActual()` must
be `async`. With `globals: true`, `vi` is still not a global — import it. An API
`vitest.config.ts` using `unplugin-swc` must set `oxc: false`, or decorator
metadata is not guaranteed and every reflection-resolved DI token is at risk. The
`include` pattern must cover every directory holding specs; `src/**` alone
silently drops specs under `scripts/**` and still reports green. Vitest is strict
about mocked exports where Jest was lenient, and it *constructs* a
`mockImplementation` called with `new`, so use a `function` expression for
anything reached that way.

**Dates.** A calendar date is `type: "date"` in the descriptor; a point in time
is `type: "datetime"`. Never `"string"`. Custom Cypher writes must cast —
`date(left($v, 10))` and `datetime($v)` — because only the standard
create/put/patch path auto-casts. DTOs validate with `@IsDateString()`. Frontend
interfaces type these getters as `Date`, `rehydrate()` parses with `new Date(…)`,
and `createJsonApi()` uses `formatLocalDate(d)` for dates and `d.toISOString()`
for datetimes.

**Reuse before you write.** Grep `apps/web/src`, then `packages/nextjs-jsonapi/src`,
before creating any component, helper or utility. A near-match adapted through
props beats a new file every time. A named reference is a specification, not an
example: copy it verbatim and adapt only the data. Deviations are proposed, never
assumed. And existing usage is not proof of correctness — a helper an earlier
session committed can itself be the duplication.

## Relationship to `CLAUDE.md` and to the plugin

Three layers, and they are not interchangeable.

| Layer | What it is | Authority |
|---|---|---|
| Root [`CLAUDE.md`](../../../../CLAUDE.md) | the guardrails, always in context | canonical — wins every conflict |
| The `nja-architecture` skill | the routing table plus the twenty references, loaded on demand | the working detail behind the guardrails |
| This directory | a point-in-time copy of those references | a snapshot; never edit |

The plugin also ships a **PreToolUse hook**. It fires on `Edit`, `Write` and
`MultiEdit`, matches the path being written against the same patterns as the
routing table above, and reminds the agent to invoke the skill and read the
relevant reference. The hook's patterns and the routing table are mirrors of each
other — the skill says so explicitly — so a change to one without the other
leaves the reminder pointing at the wrong page.

Because the hook lives in the plugin rather than in the repository, an
environment without the plugin gets no reminder. That environment still has this
directory, which is the point of reproducing it.

## The sync obligation

When the `nja` plugin updates:

1. Re-copy all twenty files from the plugin's `nja-architecture` skill
   `references/` tree, byte for byte.
2. Restore each file's two-key front matter and the HTML comment recording the
   plugin name, skill, version and date.
3. Update the routing table and the page index on this page if the plugin's own
   table or reference index changed.
4. Re-read the root `CLAUDE.md` guardrails against the plugin's condensed list;
   if they have diverged, fix `CLAUDE.md` — it is canonical, so a divergence is
   a decision to make, not a copy to accept.

Never the reverse. A correction discovered while reading a copy here goes into
the plugin first.

## Where to look

| File | Why |
|---|---|
| `docs/handbook/02-framework/rulebook/core-principles.md` | the entry point when no routing row matches |
| `docs/handbook/02-framework/rulebook/anti-patterns.md` | first read for any review or debugging session |
| `docs/handbook/02-framework/rulebook/discipline.md` | the five cross-cutting working rules |
| `docs/handbook/02-framework/rulebook/date-handling.md` | the one contract that spans all four backend layers and the frontend model |
| `docs/handbook/02-framework/rulebook/backend/template.md` | the copy-paste start for a new backend entity |
| `docs/handbook/02-framework/rulebook/frontend/template.md` | the copy-paste start for a new frontend entity |
| `CLAUDE.md` | the canonical guardrails |
| `apps/api/CLAUDE.md` | the API-specific instructions the routing table points at |
| `apps/web/CLAUDE.md` | the web-specific instructions the routing table points at |
| `packages/shared/CLAUDE.md` | the shared-package instructions |

## Gaps and drift

- The copies are a snapshot of plugin version 1.20.0. Nothing in this repository
  detects that the plugin has moved on; the sync is manual and unenforced.
- The copies' own inline path citations point at the plugin's tree rather than at
  this repository, which is why the handbook checker skips them. A path named
  inside a copy is therefore not guaranteed to exist here.
- The plugin's condensed rule list and the root `CLAUDE.md` guardrails are
  maintained separately and can diverge silently. The skill states that
  `CLAUDE.md` wins, but nothing compares them.
- The routing table's `apps/api/src/features/*/agent/**` row has no counterpart
  in a freshly scaffolded app: the template ships no agent directory under
  `apps/api/src/features`.
- Not examined: the contents of the twenty copies themselves — this page
  describes their provenance and routing, not their rules. The plugin's hook
  script and its pattern list were read only to describe what the hook does.
