---
title: Secrets
section: 07-operations
---

Every secret {{display}} uses arrives as an environment variable. There is no
secret store, no vault client and no encrypted file in this repository. Where
those variables come from — a local env file, a Docker build argument, or the
hosting platform — decides who can read them and what a rotation costs.

## Inventory

`.env.example` is the complete list of variables the template declares. This is
the subset that carries a secret, grouped by subsystem, with the file that reads
it and what holding it grants.

### Authentication

| Variable | Set in | Grants |
|---|---|---|
| `JWT_SECRET` | env file / platform | Signs and verifies **every** access token. Holding it means minting a valid session for any user. Read by `JwtModule.registerAsync` in `packages/nestjs-neo4jsonapi/src/core/core.module.ts`. |
| `JWT_EXPIRES_IN` | env file / platform | Not a secret, but it sets how long a leaked token stays usable. `.env.example` ships `1d`. |

`.env.example` seeds `JWT_SECRET` with the literal `{{name}}_SECRET`. That value
is in every scaffolded app and is therefore public knowledge. Replacing it is the
first thing a deployment does.

### Data stores

| Variable | Set in | Grants |
|---|---|---|
| `NEO4J_USER`, `NEO4J_PASSWORD` | env file / platform | Full read and write on the database named by `NEO4J_DATABASE` — the system of record. |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | env file / platform | Read and write on the queue, cache and presence key spaces. Enough to inject jobs a worker will execute. |

### Object storage

| Variable | Set in | Grants |
|---|---|---|
| `S3_ACCESS_KEY_ID` | env file / platform | With the secret below, read and write on the bucket. Under `S3_TYPE=azure` this variable holds the **Azure connection string**, which itself contains the account key — a much larger grant than an access key id. |
| `S3_SECRET_ACCESS_KEY` | env file / platform | The other half of the S3-family credential. |

### Web push

| Variable | Set in | Grants |
|---|---|---|
| `VAPID_PRIVATE_KEY` | env file / platform | Signs push messages. Holding it lets someone send notifications to every subscribed browser as this application. |
| `VAPID_PUBLIC_KEY`, `VAPID_EMAIL` | env file / platform | Public by design. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **build ARG** | The same public key, baked into the browser bundle. |

### Email

| Variable | Set in | Grants |
|---|---|---|
| `EMAIL_API_KEY` | env file / platform | Sends mail as this application through the configured provider. `baseConfig` types the provider as `sendgrid`, `smtp` or `brevo`. |
| `EMAIL_PASSWORD` | platform | The SMTP password, paired with `EMAIL_USERNAME`. Read by `baseConfig.email` but **not listed in `.env.example`** — see Gaps. |

### Billing

| Variable | Set in | Grants |
|---|---|---|
| `STRIPE_SECRET_KEY` | env file / platform | Full API access to the Stripe account: charges, refunds, customer data. |
| `STRIPE_WEBHOOK_SECRET` | env file / platform | Verifies webhook signatures. Holding it lets someone forge a webhook the api will treat as genuine — a synthetic "payment succeeded". |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | env file, and public by name | Not a secret. Stripe's publishable key. |

### OAuth

| Variable | Set in | Grants |
|---|---|---|
| `DISCORD_CLIENT_SECRET` | env file / platform | Completes the Discord authorisation-code exchange as this application. |
| `GOOGLE_CLIENT_SECRET` | env file / platform | The same for Google. |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | env file | Public by design; they also gate whether the login button renders. |

`baseConfig.discord` additionally reads `DISCORD_TOKEN` — a bot token — which
`.env.example` does not list.

### Encryption keys

| Variable | Set in | Grants |
|---|---|---|
| `ENCRYPTION_KEY` | env file / platform | Symmetric key for the AI-connection secrets stored in the database. `AiConnectionEncryptionService` throws without it, and `AiConnectionService.create` rejects every save with "ENCRYPTION_KEY is not configured". Holding it decrypts every provider key an administrator saved through the UI. |
| `TOTP_ENCRYPTION_KEY` | env file / platform | AES-256-GCM key for stored TOTP seeds. 64 hex characters; `.env.example` documents `openssl rand -hex 32`. Holding it lets someone generate the second factor for every enrolled user. |

These two are deliberately distinct. Neither falls back to the other.

### LLM providers

| Variable | Set in | Grants |
|---|---|---|
| `AI_API_KEY` | env file / platform | Spend on the chat provider's account. |
| `AI_SECRET` | env file / platform | The provider's paired secret where one applies. |
| `AI_GOOGLE_CREDENTIALS_BASE64` | env file / platform | A **base64-encoded GCP service-account JSON**, for `AI_PROVIDER=vertex`. This is a private key in transport encoding, not an API key — decoding it yields the full service-account credential. |
| `VISION_API_KEY`, `VISION_SECRET`, `VISION_GOOGLE_CREDENTIALS_BASE64` | env file / platform | The vision modality. Each falls back to its `AI_*` equivalent when unset. |
| `EMBEDDER_API_KEY`, `EMBEDDER_GOOGLE_CREDENTIALS_BASE64` | env file / platform | The embedding provider. |
| `TRANSCRIBER_API_KEY` | env file / platform | The transcription provider. |

The base64 credentials deserve separate handling: they are long, they look like
noise in a log, and a truncated copy fails in a way that reads like a network
error rather than a credential error.

### Bot protection

| Variable | Set in | Grants |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | env file | Server-side verification of a Cloudflare Turnstile token. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | env file | Public by design. |

`.env.example` documents both, including Cloudflare's always-pass test pair. No
code in the template or in either framework package reads either variable — see
Gaps.

### Observability

| Variable | Set in | Grants |
|---|---|---|
| `LOKI_USERNAME`, `LOKI_PASSWORD` | env file / platform | Basic-auth credentials for the Loki endpoint. Commented out in `.env.example`. |

### Test fixtures

| Value | Lives in | Grants |
|---|---|---|
| The seeded administrator's bcrypt hash | `apps/api/src/neo4j.migrations/20250901_004.ts`, committed | Nothing directly — it is a hash. |
| Its plaintext | `.env.e2e.example`, committed, as `E2E_ADMIN_PASSWORD` | Login as a **platform administrator** on any environment whose database still carries the seeded account with an unchanged password. |

This pair is fine for an e2e stack that is dropped every run. It is a critical
finding on any long-lived environment. Changing the administrator's password is
part of first setup, not of hardening.

## Which are public

**Baked into the browser bundle at build time, therefore public.** Next.js
inlines every `NEXT_PUBLIC_*` value during `next build`. `web-builder` in the
`Dockerfile` declares four of them as ARGs and promotes them to ENV:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ADDRESS`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

`.env.example` declares more `NEXT_PUBLIC_*` variables than the `Dockerfile`
passes: `NEXT_PUBLIC_REGISTRATION_MODE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_DISCORD_CLIENT_ID`,
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`. The prefix is the contract regardless of the
transport: anything carrying it reaches the browser, and nothing secret may.

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the one worth naming explicitly. It *is* a
key, it *is* billable, and it *is* in the bundle. It is protected by referrer
restrictions configured in the Google console, not by secrecy. Setting one is
part of deploying it.

**Server-only.** Everything else in the inventory above. None of it is readable
from the browser: the api runs in its own process, and the web app's server-side
code is the only part of Next.js that sees a non-`NEXT_PUBLIC_` variable.

**A build argument is not a secret store.** Values passed with `--build-arg`
appear in the image's build history. The four baked variables are public anyway,
so this costs nothing here — but it is the reason no secret may be added to that
list.

## Files that must never be committed

`.gitignore` ignores the environment files as a group and calls out two paths by
name, with the reason attached to each.

The first is the e2e environment file, **.env.e2e**, described in `.gitignore`
as a copy of `.env.e2e.example` that "carries database credentials and the
seeded administrator's password — never commit it."

The second is the Playwright storage-state directory, **playwright/.auth/**,
which `.gitignore` introduces with: "storageState files: these hold LIVE session
tokens for the seeded personas. Never commit them, never publish them, never
attach one to a bug report." The rule covers **apps/web/playwright/.auth/** as
well.

Also ignored, and for the same reason: **.env**, **.env.local**, every
`.env*.local`, `*.pem`, and the `.env-backup/` directory.

Two operational consequences of the storage-state rule:

- A Playwright trace or an HTML report can embed request headers, including a
  bearer token. **playwright-report/** and **test-results/** are ignored for
  that reason as well as for size.
- A session token attached to an issue is a live credential until it expires —
  `JWT_EXPIRES_IN` days by default.

## Rotation

Rotate on a schedule, and after any exposure. For each secret below: what breaks
while the rotation is in flight, and the order that keeps the window shortest.

### `JWT_SECRET`

**Breaks:** every issued token at once. There is no key-id rotation and no
grace period in this framework — the secret is a single value handed to
`JwtModule`. Changing it logs out every user, and every in-flight request
carrying an old token fails with a 401.

**Order:** pick a maintenance window. Set the new value on the api **and** the
worker together — they must agree, which is why the compose anchor carries it —
then restart both. Users log in again. Do not stagger the restart: a fleet with
two secrets rejects half its own traffic.

### `NEO4J_PASSWORD`

**Breaks:** every query, in both processes, the moment the server-side password
changes.

**Order:** change it on the Neo4j server, then update the api and the worker and
restart both. The api's readiness probe fails during the gap, so a load balancer
drains it — which is the desired behaviour. Rehearse this one: `Neo4jService`
constructs its driver once, in its constructor, so there is no re-authentication
path short of a restart.

### `REDIS_PASSWORD`

**Breaks:** queues, cache and websocket presence. An api process that cannot
reach Redis fails `/health/ready`; a worker that cannot reach it stops consuming.
Jobs already in Redis are not lost — they are simply not picked up until a worker
reconnects.

**Order:** change it on the server, update both processes, restart. Expect a
backlog to drain afterwards.

### `S3_SECRET_ACCESS_KEY` / the Azure connection string

**Breaks:** uploads and the generation of new presigned URLs. Already-issued
URLs keep working until they expire — one hour for the S3 family.

**Order:** most providers allow two active keys. Create the second key, deploy
it, verify an upload, then delete the first. That makes this the one rotation
with no downtime. If the provider does not allow two, treat it like the Neo4j
password. Under `azure`, remember that rotating the account key invalidates the
whole connection string, not just one field.

### `VAPID_PRIVATE_KEY`

**Breaks:** every existing push subscription. Browsers bind a subscription to
the public key it was created with, so a new key pair makes every stored
subscription undeliverable.

**Order:** this is not a rotation, it is a migration. Rotate only when the key is
actually compromised. Generate the pair, set `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, **rebuild the web image**
— the public key is baked in — then deploy both. Pruning is automatic:
`PushService` in
`packages/nestjs-neo4jsonapi/src/foundations/push/services/push.service.ts`
deletes a subscription by endpoint when a send returns 404 or 410. Users must
re-grant permission.

### `EMAIL_API_KEY`

**Breaks:** outbound mail, including password resets and invitations. Queued
email jobs fail and retry.

**Order:** issue the new key at the provider, deploy it to the api and the
worker, verify one send, revoke the old key.

### `STRIPE_SECRET_KEY`

**Breaks:** every call to Stripe. Checkout sessions, portal links, subscription
reads.

**Order:** create the new key at the provider, deploy it, verify one call, then
revoke the old one. Never revoke first — the gap between revocation and deploy
is an outage.

### `STRIPE_WEBHOOK_SECRET`

**Breaks:** signature verification, which means genuine webhooks start being
rejected. That is worse than it sounds: Stripe retries, but events can be
dropped after enough failures.

**Order:** a webhook secret belongs to a specific endpoint. Register a second
endpoint with its own secret, deploy the new value, confirm events verify, then
delete the old endpoint. Do not rotate the secret on the endpoint that is
currently live.

### `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`

**Breaks:** new OAuth logins, at the code-exchange step. Existing sessions are
unaffected — they are already JWTs.

**Order:** if the provider allows a second active secret, add it, deploy, verify
a login, then remove the old one. If it does not, the rotation is a short window
in which new logins fail; schedule it.

### `ENCRYPTION_KEY`

**Breaks:** every AI-connection secret already stored in the database becomes
undecryptable. This is **data loss**, not an outage. The administration page
starts failing on read, not only on save.

**Order:** do not rotate in place. Decrypt every stored connection secret with
the old key first, deploy the new key, re-encrypt and re-save each one, and only
then discard the old key. The template ships no tool for this — write the
migration before you rotate.

### `TOTP_ENCRYPTION_KEY`

**Breaks:** every enrolled user's second factor. The stored seeds cannot be
decrypted, so no code verifies and every 2FA user is locked out.

**Order:** same shape as `ENCRYPTION_KEY`, and same warning. Either re-encrypt
the seeds under the new key while the old one is still available, or accept that
every user must re-enrol — in which case plan the recovery path before you
rotate, not after.

### The LLM provider keys

**Breaks:** the modality whose key changed, and any modality that falls back to
it. `VISION_*`, `EMBEDDER_*` and the audio path all fall back to their `AI_*`
equivalents, so rotating `AI_API_KEY` alone can break more than the chat path.

**Order:** issue the new key, deploy to the api and the worker, verify one call
per affected modality, revoke the old one. For the base64 GCP credentials:
generate the new service-account key, base64-encode it, confirm the encoding
round-trips before deploying, then delete the old key in GCP.

### `TURNSTILE_SECRET_KEY`, `LOKI_PASSWORD`

Rotate freely. Nothing in the template reads the Turnstile secret, and a Loki
credential change costs at most a gap in shipped logs.

### The seeded administrator password

**Breaks:** the e2e suite, if it is changed without updating `E2E_ADMIN_PASSWORD`
in the e2e environment file.

**Order:** change it through the application on every long-lived environment as
part of first setup. Leave the seeded value alone in the e2e stack, whose
database is dropped and recreated on every run.

## Where to look

| File | What it gives you |
|---|---|
| `.env.example` | The declared inventory, grouped, with per-service requirements in its header. |
| `packages/nestjs-neo4jsonapi/src/config/base.config.ts` | Every `process.env` read and every default. The authority when `.env.example` and the code disagree. |
| `Dockerfile` | Which values become build ARGs and are therefore baked into the bundle. |
| `docker-compose.yml` | The api/worker shared env anchor — the secrets both processes must agree on. |
| `.gitignore` | The never-commit list, with the reason attached to each entry. |
| `.env.e2e.example` | The seeded administrator credentials and why they are safe there. |
| `apps/api/src/neo4j.migrations/20250901_004.ts` | The committed bcrypt hash of that account. |
| `packages/nestjs-neo4jsonapi/src/foundations/ai-connection/services/ai-connection-encryption.service.ts` | What `ENCRYPTION_KEY` protects and how it fails without it. |
| `packages/nestjs-neo4jsonapi/src/foundations/two-factor/services/totp-encryption.service.ts` | The TOTP seed encryption. |
| `packages/nestjs-neo4jsonapi/src/core/core.module.ts` | Where `JWT_SECRET` reaches `JwtModule`. |

## Gaps and drift

- **`TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are read by
  nothing.** The only `turnstile` in the code is a CSP service name in
  `packages/nextjs-jsonapi/src/next-config/csp.ts`, which
  `apps/web/next.config.js` deliberately leaves out of its `services` list.
  `.env.example` documents both variables in detail, including test keys. They
  are configuration for a feature that is not wired.
- **`LOKI_USERNAME` and `LOKI_PASSWORD` are parsed but not used.**
  `baseConfig.logging.loki` reads both, and `initializeLokiLogger` in
  `AppLoggingService` passes only `host`, `batching`, `interval` and `labels` to
  the `pino-loki` transport. A Loki endpoint behind basic auth will reject the
  writes.
- **`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USERNAME` and
  `EMAIL_PASSWORD` are read by `baseConfig` and passed by the compose anchor,
  but are absent from `.env.example`.** An SMTP deployment has to discover them
  from the config file.
- **`DISCORD_TOKEN` and `DISCORD_DEV_GUILD_ID` are read by `baseConfig` and
  absent from `.env.example`.** A bot token is a high-value secret with no
  documented home.
- `.env.example` ships `JWT_SECRET="{{name}}_SECRET"` — a value identical in
  every scaffolded app.
- The framework has no key-rotation mechanism for `ENCRYPTION_KEY` or
  `TOTP_ENCRYPTION_KEY`: no dual-key read path, no re-encryption command. Both
  rotations above are therefore procedures an app must write.
- Not examined: how any given hosting platform stores and injects these values,
  and whether it records them in build logs.
