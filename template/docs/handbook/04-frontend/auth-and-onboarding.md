---
title: Authentication and onboarding
section: 04-frontend
---

Every authentication surface the app ships is a thin route that composes a package
component. The app owns three things and no more: the cookie writer, the login
configuration, and the token refresh. Everything else — the forms, the two-factor flows,
the OAuth consent screen — lives in `@carlonicora/nextjs-jsonapi`.

## The `(auth)` routes

`apps/web/src/app/[locale]/(auth)/layout.tsx` wraps everything in `CurrentUserProvider`
and a centred `h-svh` box, inside a `Suspense` with `SessionFallback`: the provider reads
the pathname, which suspends on the `[code]` routes while they prerender. There is no
gate: these pages must be reachable while signed out, and `apps/web/src/proxy.ts` lists
all eight prefixes in `PUBLIC_PATHS`.

| Route | Renders |
|---|---|
| `/login` | `AuthContainer` with `AuthComponent.Login` |
| `/register` | `AuthComponent.Register` |
| `/activation/[code]` | `AuthComponent.ActivateAccount`, code forwarded through `params` |
| `/invitation/[code]` | `AuthComponent.AcceptInvitation` |
| `/reset/[code]` | `AuthComponent.ResetPassword` |
| `/logout` | `Logout` |
| `/auth` | `Cookies`, fed the result of `AuthService.findToken({ tokenCode })` |
| `/auth/consent` | A local GDPR consent form, the only hand-written `(auth)` page besides the OAuth trio |
| `/oauth/authorize` | Server-side login check, then `OAuthAuthorizeClient` |
| `/oauth/success` | The manual authorisation-code copy card |
| `/oauth/error` | Error-code to translated copy |

`AuthComponent` is an enum in the package with eight members: `Login`, `ForgotPassword`,
`ResetPassword`, `ActivateAccount`, `AcceptInvitation`, `Register`, `Landing` and
`TwoFactorChallenge`. `AuthContainer` switches on it; `AuthContext` can change it at
runtime, which is how login escalates into the two-factor challenge without a navigation.

`Landing` is not under `(auth)`. `apps/web/src/app/[locale]/(marketing)/home/page.tsx`
renders it as a static page, and the proxy rewrites `/` to it for a visitor without a
session, so the URL stays `/`.

## The cookie inventory

`apps/web/src/server-actions/auth-cookies.ts` is a `"use server"` module exporting two
actions, `updateToken` and `removeToken`. `apps/web/src/config/instrumentation-env.ts` hands both
to the package through `configureAuth`, and the package calls them whenever a session is
established or refreshed. Every cookie is written with `path: "/"` and
`secure: process.env.NODE_ENV === "production"`.

| Cookie | `httpOnly` | Lifetime | Value |
|---|---|---|---|
| `token` | `false` | 24 hours | The JWT. Readable by client code, which is why it is not `httpOnly` |
| `refreshToken` | `true` | 365 days | The refresh token the proxy exchanges |
| `userId` | `true` | 365 days | Plain UUID |
| `companyId` | `true` | 365 days | Plain UUID |
| `roles` | `true` | 365 days | `JSON.stringify(string[])` |
| `features` | `true` | 365 days | `JSON.stringify(string[])` |
| `modules` | `true` | 365 days | gzip, then base64, then `JSON.stringify` of that string |

`removeToken` deletes all seven.

Two cookies are written elsewhere and are not part of this inventory: `sidebar_state`,
read by `ServerSession.read()` into the session that seeds `SidebarProvider` (the sidebar
opens unless it is `"false"`), and `reloadData`, set by the proxy after a successful
token refresh.

### The `modules` encoding, and why it must stay in lockstep

The per-module permission matrix is too large for a cookie uncompressed, so
`updateToken` does:

```ts
const compressedValue = Buffer.from(gzip(JSON.stringify(params.modules))).toString("base64");
// …value: JSON.stringify(compressedValue)
```

`gzip` comes from `pako`. The app owns this encode. The **package** owns the decode, in
`ServerSession.hasPermissionToModule`:

```ts
JSON.parse(ungzip(Buffer.from(rawModules, "base64"), { toText: true }));
```

Nothing links the two beyond convention: they are in different repositories, there is no
shared helper, and no test covers the round trip. Change the compression, the encoding or
the cookie name on either side and every server-side permission check silently returns
`false` — `hasPermissionToModule` throws nothing, it just cannot find the module.

Note the asymmetry: the app wraps the base64 string in `JSON.stringify`, so the stored
value carries surrounding double quotes, while the package feeds the raw cookie value
straight to `Buffer.from(..., "base64")`. It works because a base64 decoder discards
characters outside its alphabet. It is not a designed behaviour, and the e2e suite's
`apps/web/tests/support/auth.ts` reproduces the quoting deliberately so its planted
cookies match.

## The flows

**Password login.** `AuthService.login` posts to the auth endpoint. If the response
carries a `pendingToken` field, two-factor is required (below); otherwise the package
calls `updateToken` with the token, the refresh token, the user and company ids, the role
ids, the company feature ids and the module permission list, and sets the client user.

**Registration.** `AuthService.register` takes an `AuthInput`. `configureLogin` in
`apps/web/src/config/instrumentation-env.ts` passes `registrationMode` from
`NEXT_PUBLIC_REGISTRATION_MODE`, and the package's `Register` form branches on all three
values:

| Mode | Behaviour |
|---|---|
| `open` | The form registers anyone. The template's default, set in `env.example` |
| `closed` | Registration is refused |
| `waitlist` | The form demands an invite code in the query string, validates it before showing the fields, and otherwise shows the waitlist join surface |

`apps/web/src/config/waitlist.config.ts` supplies the waitlist copy — hero title,
subtitle, description, four benefits, and a two-question questionnaire — through
`configureWaitlist`.

**Activation.** `/activation/[code]` calls `AuthService.activate({ activationCode })`.
Registration mails the code; there is no in-app path to it.

**Password reset.** `ForgotPassword` calls `initialiseForgotPassword({ email })`;
`/reset/[code]` calls `validateCode` and then `resetPassword({ code, password })`.

**Invitations.** `/invitation/[code]` calls `acceptInvitation({ code, password })` — the
invited user sets a password and the membership is activated in one step.

**OAuth.** Three routes, each with a distinct job:

- `/oauth/authorize` runs on the server. Signed out, it rebuilds the query string
  (`client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`,
  `code_challenge_method`) and redirects to `/login?callbackUrl=…`. Signed in, it renders
  `OAuthAuthorizeClient` with those parameters as props.
- `/oauth/success` shows the authorisation code with a copy button, for redirect URIs
  that cannot be followed automatically. Its copy handler falls back to a hidden textarea
  and `document.execCommand` outside a secure context.
- `/oauth/error` maps ten known codes — `access_denied`, `invalid_request`,
  `unauthorized_client`, `unsupported_response_type`, `invalid_scope`, `server_error`,
  `temporarily_unavailable`, `waitlist_required`, `registration_closed`,
  `registration_disabled` — onto `oauth.errors.<code>` messages, with a `default` branch.

**The `/auth` token landing.** A single-use code arrives as `?code=`. The page resolves it
server-side with `AuthService.findToken` and renders `Cookies` with the dehydrated auth
resource and `page="/"`. `Cookies` is a client component whose only effect calls
`AuthService.saveToken` — which rehydrates and calls `updateToken` — sets the current
user, and then navigates. It is guarded by a `hasSaved` state flag so the effect runs
once.

**GDPR consent.** `/auth/consent` is reached with `?pending=<id>` when an OAuth sign-up
has no consent on file. It renders the package's `GdprConsentSection` inside a
react-hook-form, requires `termsAccepted` to be literally `true` through a zod
`z.literal`, and posts `AuthService.completeOAuthRegistration({ pendingId,
termsAcceptedAt, marketingConsent, marketingConsentAt })`. The response carries a code,
and the page forwards to `/auth?code=…` — joining the token-landing flow above.

**Logout.** `/logout` renders the package's `Logout`, which clears the localStorage keys
first (`CURRENT_USER_STORAGE_KEY`, plus any the caller lists), then calls
`AuthService.logout()` — which invokes `removeToken` — then hard-navigates to `/`. The
order matters: `CurrentUserProvider` persists the user in localStorage, so clearing the
cookies alone leaves the server rendering anonymous while every client consumer still
reads the old user.

## Two-factor authentication

Enrolment lives in the package's `SecurityContainer` / `TwoFactorSettings` components,
reachable from the settings rail. `TwoFactorService` covers the whole surface:

| Area | Methods |
|---|---|
| Status | `getStatus`, `enable({ preferredMethod })`, `disable({ code })` |
| TOTP | `setupTotp`, `verifyTotpSetup`, `listTotpAuthenticators`, `deleteTotpAuthenticator` |
| Passkeys | `getPasskeyRegistrationOptions`, `verifyPasskeyRegistration`, `listPasskeys`, `renamePasskey`, `deletePasskey` |
| Backup codes | `generateBackupCodes`, `getBackupCodesCount` |
| Challenge | `getChallenge`, `verifyTotp`, `getPasskeyAuthOptions`, `verifyPasskey`, `verifyBackupCode` |

Each of those resources has its own registry entry in `apps/web/src/config/Bootstrapper.ts` —
fourteen of the fifty-five keys are two-factor modules, because every verification step is
its own JSON:API resource.

### The pending-token handoff

`POST /auth/login` does not return a session when two-factor is enabled. It returns a
challenge carrying a `pendingToken`. The package's `Login` form detects it with a
property test — `if ("pendingToken" in response)` — stores the challenge in `AuthContext`
via `setPendingTwoFactor`, and flips `componentType` to `AuthComponent.TwoFactorChallenge`.
No navigation happens; `AuthContainer` simply renders a different component.

`TwoFactorChallenge` then offers three tabs — an authenticator code, a passkey and a
backup code — each calling the matching verify method with the same `pendingToken`. On
success it clears the pending challenge, sets the user, and replaces the history entry
with `?callbackUrl` if one was carried through login, or `/` otherwise. The pending token
never reaches a cookie: it lives in React state for the length of the challenge.

## Keeping the session fresh

**Token refresh is entirely app-owned and happens in exactly one place**:
`apps/web/src/proxy.ts`. On every matched request it reads the `refreshToken` cookie and,
when the `token` cookie is missing or its JWT `exp` is under 300 seconds away, POSTs to
the refresh endpoint and rewrites the `token` cookie plus a `reloadData=true` marker.

The package never refreshes. It has no timer, no interceptor and no retry-on-401 that
mints a new token; `ServerSession` only reads cookies, and `AbstractService` only sends
whatever token is present. If the proxy's matcher excludes a path, nothing refreshes on
it.

`RefreshUser`, mounted by the session shell
(`apps/web/src/features/common/components/session/AppShell.tsx`) that both authenticated
layouts render, is a different thing: it refreshes
the *user document* (roles, features, module permissions) by calling
`UserService.findFullUser` and writing the result back through `updateToken`. It does not
touch the JWT.

## Onboarding

`apps/web/src/features/onboarding/` is the app's tour layer over the package's Shepherd
integration. Five files:

| File | Role |
|---|---|
| `apps/web/src/features/onboarding/config/tours.config.ts` | The per-app definition point |
| `apps/web/src/features/onboarding/components/OnboardingProviderWrapper.tsx` | Mounts `OnboardingProvider` with translated labels and the route-change handler |
| `apps/web/src/features/onboarding/components/OnboardingTrigger.tsx` | The sidebar entry that starts a tour |
| `apps/web/src/features/onboarding/hooks/useOnboardingLabels.ts` | Maps the six `tour.*` message keys onto the package's `OnboardingLabels` |
| `apps/web/src/features/onboarding/hooks/useOnboardingRouteChange.ts` | Cancels an active tour when the pathname changes |

The package's `OnboardingProvider` drives **Shepherd**, building a
`Shepherd.Tour` with a modal overlay and smooth scroll, and rendering each step's body as
a React root mounted into Shepherd's DOM node. It listens for Shepherd's `show`, `cancel`
and `complete` events to keep `isTourActive` in sync and to unmount those roots.

That configuration file is deliberately empty in the template and holds three exported
structures the app fills in:

- `TOURS` — the tour-id constants.
- `TOUR_PATHS` — a route-to-tour map. Keys may carry `:id` segments; `getTourForPath`
  strips the locale prefix, prefers an exact match, and otherwise picks the dynamic
  pattern with the most static segments.
- `TOUR_STEPS` — the steps per tour, read by `getTourSteps`.

It also exports `clickElement`, a helper that dispatches a full `mousedown` / `mouseup` /
`click` triple with real coordinates, for steps that must open a tab before pointing at
something inside it.

**The trigger.** `OnboardingTrigger` renders a sidebar menu item labelled
`common.page_tour`, with `data-testid="sidebar-tour-trigger"`. It renders **nothing** when
`getTourForPath(pathname)` returns null or a tour is already running — so in a fresh app,
with `TOUR_PATHS` empty, the entry never appears. It is mounted by
`apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx`, between the
how-to command and the notification bell.

**The route-change hook.** `useOnboardingRouteChange` keeps the previous pathname in a
ref and calls `closeTour()` when it changes while a tour is active. Shepherd anchors
steps to DOM selectors, and a navigation invalidates all of them at once.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/server-actions/auth-cookies.ts` | The seven cookies, their flags and the `modules` encode |
| `apps/web/src/proxy.ts` | The only token refresh in the app |
| `apps/web/src/config/instrumentation-env.ts` | `configureAuth`, `configureLogin`, `configureRoles` |
| `apps/web/src/config/waitlist.config.ts` | The waitlist copy and questionnaire |
| `apps/web/src/app/[locale]/(auth)/layout.tsx` | The ungated shell |
| `apps/web/src/app/[locale]/(auth)/auth/page.tsx` | The token-landing exchange |
| `apps/web/src/app/[locale]/(auth)/auth/consent/page.tsx` | The GDPR form and the consent-to-code handoff |
| `apps/web/src/app/[locale]/(auth)/oauth/authorize/page.tsx` | The callback-URL round trip |
| `apps/web/src/features/onboarding/config/tours.config.ts` | Where an app defines its tours |
| `apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx` | Where the tour trigger is mounted |

## Gaps and drift

- The `modules` cookie encode lives in the app and the decode in the package, with no
  shared constant and no round-trip test. The `JSON.stringify` wrapper on the base64
  string survives only because base64 decoding ignores the quotes.
- `configureLogin` is called with `useInternalAuth: true` hard-coded and no
  `allowRegistration`, so that flag falls back to `true` regardless of
  `NEXT_PUBLIC_REGISTRATION_MODE`.
- `apps/web/src/app/[locale]/(auth)/oauth/error/page.tsx` links to `/waitlist` for the
  `waitlist_required` code, and `apps/web/src/config/waitlist.config.ts` configures a
  waitlist surface, but the template ships no public `/waitlist` route.
- `ForgotPassword` has no route of its own; it is only reachable through `AuthContainer`
  switching `componentType`.
- `apps/web/src/features/onboarding/config/tours.config.ts` ships with `TOURS`,
  `TOUR_PATHS` and `TOUR_STEPS` all empty, so the
  onboarding trigger is invisible until an app fills them in. Its `clickElement` comment
  still refers to Radix, in a Base UI codebase.
- I did not examine the package's `AuthContainer`, `Register`, `SecurityContainer` or the
  passkey WebAuthn plumbing beyond their service surface, nor the API side of any of these
  flows.
