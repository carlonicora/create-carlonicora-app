---
title: Foundations
section: 02-framework
---

A **foundation** is a complete feature module that ships inside
`@carlonicora/nestjs-neo4jsonapi` rather than inside your app: its own entity
descriptor, repository, service, DTOs and — usually — controller, registered
into the running application by the package's own module. `{{display}}` has 43
of them on day zero, and 37 are mounted before a single line of app code runs.

They are not examples. They are the running identity system, the running
tenancy model, the running billing integration. An app's first decision about a
foundation is which ones to switch off, not which ones to copy.

The per-domain detail — graph model, endpoints, flows, permissions — lives in
`05-foundations/`. This page is the framework view: how they are registered,
what the complete list is, and how an app changes one.

## `FoundationsModule.forRoot()`

Declared in
`packages/nestjs-neo4jsonapi/src/foundations/foundations.modules.ts`. Its config
has exactly four keys:

```typescript
export interface FoundationsModuleConfig {
  /** Optional extension for Content module to add additional relationships */
  contentExtension?: ContentExtensionConfig;
  /** Optional configuration for the referral feature module */
  referral?: ReferralModuleConfig;
  /** Optional configuration for the user-activity feature module */
  userActivity?: UserActivityModuleConfig;
  /**
   * Foundation module classes to exclude from registration.
   * Default [] keeps all modules registered.
   */
  exclude?: Type<any>[];
}
```

`forRoot()` filters `STATIC_FOUNDATION_MODULES` by `exclude`, then builds the
three dynamic modules whose class references also survived the filter, and
returns them all as both `imports` and `exports`.

## How an app reaches it

An app never calls `FoundationsModule.forRoot()` itself. It passes options to
`bootstrap()`, and
`packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts` forwards them:

```typescript
...(options.foundations?.disabled
  ? []
  : [
      FoundationsModule.forRoot({
        contentExtension: options.contentExtension,
        referral: options.referral,
        userActivity: options.userActivity,
        exclude: options.foundations?.exclude ?? [],
      }),
    ]),
```

So `BootstrapOptions.foundations` has two keys:

| Key | Effect |
|---|---|
| `exclude: Type<any>[]` | drops the named module classes from the registration list; everything else still mounts |
| `disabled: true` | skips `FoundationsModule` entirely — the app supplies all of its own foundations |

`disabled` exists for the case where an app replaces so many foundations that
transitive controller collisions become the problem: several package modules
import `CompanyModule` for its service, and importing a module also mounts its
controller.

**The template app excludes nothing.** `apps/api/src/main.ts` passes
`appModules`, `i18n`, `config`, `contentExtension` and `openApi`, and no
`foundations` key at all. All 37 registered foundations are live in a freshly
scaffolded `{{display}}`.

## The complete inventory

43 directories under
`packages/nestjs-neo4jsonapi/src/foundations`. "Endpoint" is the base path the
controller's routes are built from — read from the entity meta, so nested and
suffixed routes hang off the same base. "—" means the module has no controller
and is reachable only from other server code.

### Identity and tenancy

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `user` | the person record, plus the `owner`/`assignee`/`author` aliases of the same node | `User` | `users`, `owners`, `assignees`, `authors` |
| `company` | the tenant every scoped node hangs off | `Company` | `companies` |
| `membership` | the user-to-company edge; backend-internal by design | `Membership` | — |
| `role` | role definitions and the user-to-role assignment routes | `Role` | `roles`, and role routes under `users` |
| `auth` | login, refresh, password reset, the pending-auth handshake | `Auth`, `AuthCode`, `PendingAuth` | `auth`, `authcodes`, `two-factor-challenge` |
| `google-user` | the Google identity linked to a user | — | — |
| `discord-user` | the Discord identity linked to a user | — | — |

### Access control

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `module` | the `(Module)` nodes the RBAC matrix is keyed by | `Module` | — |
| `feature` | feature flags read by both the API and the client | `Feature` | `features` |
| `rbac` | the permission engine, the matrix DSL, the reconciler, the dev-only matrix controller | `PermissionMapping`, `ModulePaths` | `rbac/permission-mappings`, `rbac/module-paths`, `_dev/rbac` |
| `two-factor` | TOTP, passkeys and backup codes | `TwoFactorConfig`, `TotpAuthenticator`, `Passkey`, `BackupCode`, `PendingTwoFactor`, plus the request/response shapes | `auth`, `auth/totp` |
| `oauth` | the OAuth authorisation-server side: clients, PKCE, discovery | `OAuthClient` | `oauth`, `oauth/clients`, `.well-known` |

### Content, storage and the knowledge graph

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `content` | the polymorphic view over anything a user publishes | `Content` | `contents` |
| `s3` | uploads, signed URLs and the storage abstraction over S3/Azure | `S3` | `s3` |
| `chunker` | turning a file into text and splitting it — loaders for pdf, docx, xlsx, pptx, email, markdown, csv, json | — | — |
| `chunk` | the persisted chunk, its embedding, and the queue processors that build both | `Chunk` | `chunks` |
| `atomicfact` | the extracted facts a chunk yields | `AtomicFact` | — |
| `keyconcept` | the extracted entities, their relationships and their embeddings | `KeyConcept` | `keyconcepts` |
| `community` | Louvain communities over the key-concept graph and their summaries | `Community` | — |
| `relevancy` | the "related to this" query used across entity types | — | — |

### Assistant

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `assistant` | the conversation | `Assistant` | `assistants` |
| `assistant-message` | one turn in a conversation | `AssistantMessage` | `assistant-messages` |
| `assistant-action` | a proposed action attached to a turn, and its approval | `AssistantAction` | `assistant-actions` |
| `ai-connection` | per-tenant provider credentials and the ordered fallback chain, encrypted at rest | `AiConnection` | `ai-connections` |

### Billing and usage

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `stripe` | the billing service and the customer-facing billing routes | — | `billing` |
| `stripe-customer` | the Stripe customer and its payment methods | `StripeCustomer`, `StripePaymentMethod` | `stripe-customers`, `stripe-payment-methods` |
| `stripe-product` | the product catalogue mirror | `StripeProduct` | `stripe-products` |
| `stripe-price` | the price catalogue mirror | `StripePrice` | `stripe-prices` |
| `stripe-subscription` | the subscription record | `StripeSubscription` | `stripe-subscriptions` |
| `stripe-invoice` | the invoice record | `StripeInvoice` | `stripe-invoices` |
| `stripe-promotion-code` | discount codes | `StripePromotionCode` | `stripe-promotion-codes` |
| `stripe-usage` | metered-usage records pushed to Stripe | `StripeUsageRecord` | `stripe-usage-records` |
| `stripe-trial` | the trial lifecycle and its queue processor | — | — |
| `stripe-webhook` | signature verification and webhook dispatch | `StripeWebhookEvent` | `stripe-webhooks` |
| `tokenusage` | per-call LLM token accounting, with report and admin views | `TokenUsage` plus six read-model labels | `tokenusages`, `tokenusages/reports/*`, `tokenusages/administration/*` |

### Communication

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `notification` | the in-app notification and its read/archive state | `Notification` | `notifications` |
| `push` | web-push subscriptions and delivery | `Push` | `push` |
| `discord` | the Discord bot, mounted only in worker mode when a token is configured | — | — |

### Audit, growth and help

| Directory | Owns | Neo4j labels | Endpoint |
|---|---|---|---|
| `audit` | the audit log written by `AbstractService` write paths | `AuditLog` | `audit-logs` |
| `user-activity` | an append-only trail of user actions, with an optional global interceptor | `UserActivity` | — |
| `waitlist` | pre-launch signups | `Waitlist` | `waitlists` |
| `referral` | referral codes, referrals and their reward hooks | `ReferralCode`, `Referral`, `ReferralStats` | `referral-codes`, `referrals`, `referral-stats` |
| `how-to` | in-app help articles, with a public and an authenticated controller | `HowTo` | `howtos` |

## What is registered, and what is not

`STATIC_FOUNDATION_MODULES` lists **34** module classes. Three more are
**dynamic**, assembled inside `forRoot()` because each takes configuration:

| Dynamic module | Configured by |
|---|---|
| `ContentModule.forRoot(contentExtension)` | `BootstrapOptions.contentExtension` |
| `UserActivityModule.forRoot(userActivity)` | `BootstrapOptions.userActivity` |
| `ReferralModule.forRoot(referral)` | `BootstrapOptions.referral` |

Dynamic modules are excluded by the same class reference as static ones —
`exclude: [ContentModule, UserActivityModule]` — because `forRoot()` keeps each
class next to its factory and only runs the factory for entries that survive
the filter.

That accounts for 37. The remaining **six** are never named by
`FoundationsModule`, and each arrives a different way:

| Directory | How it is actually mounted |
|---|---|
| `assistant-message` | imported by `AssistantModule` |
| `assistant-action` | imported by `AssistantModule` behind a `forwardRef` — its controller needs `AssistantService`, and `AssistantModule` needs the action module |
| `google-user` | imported by `AuthModule` |
| `community` | imported by `CommunityDetectorModule`, `CommunitySummariserModule` and `DriftModule` — the GraphRAG side, not the foundation side |
| `discord` | imported by `packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts`, and only in worker mode with a configured bot token |
| `rbac` | a dynamic module requiring app-level configuration (`RbacModule.register({ moduleUserPaths, … })`), so the app registers it; `RbacPermissionModule` is the separate, config-free half that other package modules import |

## The bug class this list creates

Registration is a hand-maintained array, so a module can be written, exported
and tested and still never mount. The package carries an inline record of
exactly that happening, in
`packages/nestjs-neo4jsonapi/src/foundations/foundations.modules.ts`, next to
`StripeCustomerModule`:

> Every other stripe-\* foundation was registered here; this one was omitted, so
> its controller (GET/POST/PUT/DELETE /stripe-customers plus all
> payment-methods routes) was never mounted and its two models were never added
> to modelRegistry.

Both halves of that failure matter. The routes 404, and — because the module's
`onModuleInit` never ran — its descriptors were never added to `modelRegistry`,
so any `include:` naming those types fails at serialisation time in a request
that has nothing to do with billing. Worse, a consuming app can *mask* it: an
app that imports the module from one of its own modules for an unrelated reason
mounts the controller as a side effect and sees nothing wrong, while an app
without that import gets a 404 on its first billing request.

When you add a foundation, or extend one with a new module, the registration
list is the thing to check first. A green test suite does not cover it.

## Extending a foundation: the narrowed-extend pattern

The package's foundations are deliberately minimal. Four of them — `user`,
`auth`, `company` and `tokenusage` — are extended this way by consuming apps,
and `notification` documents the pattern in
`packages/nestjs-neo4jsonapi/src/foundations/notification/entities/notification.ts`:

> Consuming apps that need more attributes, more subjects or a polymorphic
> actor register an EXTENDED descriptor (`modelRegistry`, last write wins) and
> subclass `NotificationRepository` — the narrowed-extend pattern used for
> user/auth/company/tokenusage.

The three moves are always the same:

1. **Spread the package descriptor** into your own `defineEntity()` call, adding
   fields and relationships. Per-field `description`s come along with the spread,
   so the LLM-facing copy is inherited rather than rewritten.
2. **Register the extended descriptor** in `modelRegistry`. It is keyed by
   `nodeName`, and the last write wins — which is exactly why your app's
   registration must happen after the foundation's, and why a new descriptor
   must never reuse a foundation's `nodeName`.
3. **Subclass the repository** so the extra fields are read and written, and
   provide it in your module.

What you do **not** do is fork the foundation. The narrowing is the point: the
package keeps the default behaviour for every other consumer, and your app
carries only the delta.

## `contentExtension.additionalRelationships`

`ContentModule` is the one foundation that is configured rather than
subclassed, because its whole job is to be a view over entity types it does not
know about. The extension shape, from
`packages/nestjs-neo4jsonapi/src/foundations/content/interfaces/content.extension.interface.ts`:

```typescript
export interface ContentRelationshipExtension {
  /** Meta information for the related model */
  model: DataMeta;
  /** Neo4j relationship type (e.g., "HAS_KNOWLEDGE") */
  relationship: string;
  /** Direction of the relationship relative to Content node */
  direction: "in" | "out";
  /** Whether this is a one-to-one or one-to-many relationship */
  cardinality: "one" | "many";
  /** Optional JSON:API key override */
  dtoKey?: string;
}
```

Each entry produces an `OPTIONAL MATCH` in the Content Cypher, an entry in the
entity mapping, and a relationship on the {json:api} wire. `dtoKey` renames the
wire key without renaming the Cypher relationship — convenient, and a trap: two
relationships whose effective keys collide resolve silently to the last one.

`ContentExtensionConfig` carries four further optional keys, each defaulting to
the package's historical behaviour so that passing only
`additionalRelationships` changes nothing else:

| Key | Default | Effect |
|---|---|---|
| `ownerMatchPattern` | the directed `(content)<-[:PUBLISHED]-(owner:User)` match | accepts several relationship types, optionally undirected |
| `requireTldr` | off | returns only records carrying a non-empty `tldr`, in both the list match and `findByIds` |
| `metaFields` | none | appends an `OPTIONAL MATCH` and projects one extra computed meta key |
| `serialiseAuthor` | on | drops the `author` relationship from the Cypher and the wire |

`apps/api/src/main.ts` passes `additionalRelationships: []` and nothing else, so
`{{display}}` starts with the package defaults on all four.

## The other two configured foundations

`ReferralModuleConfig` (`enabled`, `rewardTokens`, `inviteCooldownSeconds`)
defaults to `enabled: false`, so every referral endpoint returns 404 and the
registration hook is a no-op until an app turns it on.

`UserActivityModuleConfig` (`queueId`, `jobName`, `interceptorEnabled`) defaults
to inert: no global interceptor, and nothing recorded unless the app calls
`UserActivityService.record()`. One asymmetry is worth knowing — the producer
reads `queueId` from config, but the processor binds its queue through the
`@Processor()` decorator, which BullMQ evaluates at class-decoration time and
cannot read config. Overriding `queueId` therefore moves the producer only, and
the app must run its own worker for the new queue. Every package processor has
the same constraint.

## Where to look

| File | Why |
|---|---|
| `packages/nestjs-neo4jsonapi/src/foundations/foundations.modules.ts` | the registration list, the three dynamic modules, and the omission comment |
| `packages/nestjs-neo4jsonapi/src/foundations/index.ts` | which foundations are re-exported by name |
| `packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.options.ts` | `foundations.exclude`, `foundations.disabled` and the three configs |
| `packages/nestjs-neo4jsonapi/src/bootstrap/app.module.factory.ts` | where the options are forwarded and the Discord gate lives |
| `packages/nestjs-neo4jsonapi/src/foundations/content/interfaces/content.extension.interface.ts` | the full content extension contract |
| `packages/nestjs-neo4jsonapi/src/foundations/referral/interfaces/referral.config.interface.ts` | the referral defaults |
| `packages/nestjs-neo4jsonapi/src/foundations/user-activity/interfaces/user-activity.config.interface.ts` | the activity defaults and the processor constraint |
| `packages/nestjs-neo4jsonapi/src/foundations/notification/entities/notification.ts` | the narrowed-extend pattern, stated in the source |
| `packages/nestjs-neo4jsonapi/src/foundations/user/entities/user.meta.ts` | a meta file with aliases, the shape every endpoint column above comes from |
| `apps/api/src/main.ts` | what this app actually configures — and what it leaves alone |

## Gaps and drift

- The endpoint column is read from each foundation's entity meta and the
  `@Controller()` argument. It is the route base, not a route list; nested and
  action routes are built from the same base and are not enumerated here.
- The Neo4j label column lists the labels declared in each foundation's `*.meta.ts`
  files. Labels created only inside Cypher — join nodes, transient markers —
  are not covered. `01-architecture/graph-model.md` is the place for those.
- `chunker`, `relevancy`, `stripe-trial`, `stripe`, `discord`, `google-user` and
  `discord-user` declare no entity meta, so they have no label of their own.
- `packages/nestjs-neo4jsonapi/src/foundations/community` is registered by three
  agent modules but by no foundation module, which means an app that sets
  `bootstrap({ agents: false })` loses the community foundation as well.
- Per-foundation flows, permissions and background jobs are out of scope here.
  `05-foundations/` covers all 43 in ten chapters.
