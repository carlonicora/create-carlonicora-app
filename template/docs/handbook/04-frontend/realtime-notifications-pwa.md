---
title: Realtime, notifications and the PWA
section: 04-frontend
---

Three mechanisms deliver events to a signed-in browser: a socket for live in-app
notifications, Web Push for notifications while the tab is closed, and a service worker
that also makes the app installable and gives it an offline fallback. All three are wired
by the session shell the two authenticated layouts render; none of them runs for a
signed-out visitor.

## The socket

`SocketProvider` is mounted by
`apps/web/src/features/common/components/session/AppShell.tsx` — the shell both
`apps/web/src/app/[locale]/(admin)/layout.tsx` and `apps/web/src/app/[locale]/(main)/layout.tsx`
render — and by `apps/web/src/app/[locale]/(public-help)/help/layout.tsx`. Each passes the
session promise from `ServerSession.read()`, not a token: the layouts never await.

The provider is a thin wrapper. It resolves the token from the session in an effect, so it
never suspends and its children render at once, then calls `useSocket({ token })`
unconditionally. `useSocket` returns early while the token is empty, and the provider
spreads a default context underneath whose `socket` is `null` and whose `sendMessage` is a
no-op — so every consumer works unconditionally, including a signed-out help reader.

`useSocket` connects `socket.io-client` to `ENV.API_URL` with `auth: { token }`,
`transports: ["websocket"]` and a 20-second timeout. It keeps the connection on `window`
under a key derived from the API URL, reuses a live one, and calls `removeAllListeners()`
before re-attaching — React Strict Mode double-mounts would otherwise stack duplicate
handlers on the same socket.

Four events are subscribed:

| Event | Handler |
|---|---|
| `connect` / `disconnect` | Flip `isConnected` |
| `message` | Appended to a `messages` array |
| `notification` | Rehydrated and appended to `socketNotifications` |

The `notification` payload arrives as a JSON:API document `{ data, included }` while
`rehydrate` expects `{ jsonApi, included }`, so the handler maps it, and warns and returns
on an unexpected shape rather than letting a malformed payload throw inside the socket
callback.

Two more events are subscribed elsewhere, by the package's `CurrentUserProvider`:
`company:credits_updated` and `company:subscription_updated`. The first writes a transient
credit override that a real user refresh clears; the second refreshes the subscription
state. The assistant feature subscribes to `assistant:status`.

`useSocketContext()` is the consumer hook and throws outside a provider.

## Notifications

`useNotificationSync` is the bridge between the socket and the notification list:

```ts
const { socketNotifications, clearSocketNotifications } = useSocketContext();
const { addSocketNotifications } = useNotificationContext();
// on change: add, then clear
```

It is called once, from `apps/web/src/features/common/components/details/LayoutDetails.tsx`,
alongside `usePageTracker`. Nothing else should call it — two callers would race to drain
the same array.

`NotificationContextProvider` owns the list. It exposes `notifications`,
`setNotifications`, `addNotification`, `addSocketNotifications`, `loadNotifications`,
`markNotificationsAsRead`, `generateNotification`, `generateToastNotification`,
`isLoading`, `error`, `lastLoaded` and `shouldRefresh` (a five-minute staleness flag). A
ref holds the in-flight `loadNotifications` promise so concurrent callers share one
request.

`LayoutDetails` calls `loadNotifications()` on mount **only for non-administrators** —
administrators have no company and therefore no notification feed.

The list UI is `NotificationsListContainer` (mounted at `/notifications`),
`NotificationsList`, `Notification` (which supplies both the menu-item and the toast
rendering) and `NotificationErrorBoundary`. **There is no component named
`NotificationBell`**: the bell in the sidebar footer is `NotificationModal`, mounted by
`apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx` and hidden
from administrators.

## Web push

`PushNotificationProvider` wraps `usePushNotifications()`, which runs once per user and
does this, in order:

1. **Capability check** — `"serviceWorker" in navigator && "PushManager" in window`.
   Anything else is a silent no-op.
2. **Per-user session dedup** — a `sessionStorage` key `push_registered_<userId>` holds a
   hash of the last registered subscription. The API call is skipped when the hash has not
   changed.
3. **Worker registration.** In production it registers the app's public worker URL; in
   development it registers `apps/web/public/sw-dev.js` directly. The dev worker is
   push-only precisely so it cannot cache a stale Turbopack chunk. Both live at scope `/`,
   so the subscription is identical either way.
4. **Permission.** Reads `Notification.permission` and calls `requestPermission()` only
   when it is `"default"`. A denial returns quietly — it is a user decision, not an error.
5. **VAPID key.** `ENV.VAPID_PUBLIC_KEY` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), trimmed,
   converted from URL-safe base64 to a `Uint8Array`. An empty key aborts.
6. **Subscribe.** `registration.pushManager.getSubscription()`, then `subscribe({
   userVisibleOnly: true, applicationServerKey })` if there is none.
7. **Register with the API.** `PushService.register({ data: { endpoint, keys } })`, then
   store the hash.

The whole hook is gated on `currentUser && !hasRole(Administrator)` — administrators are
never subscribed.

## The service worker

### `apps/web/src/app/sw.ts`

Built by Serwist through `apps/web/src/app/serwist/[path]/route.ts`, which also precaches
`/offline` with the **root** `package.json` version as its revision (`apps/web/package.json`
is pinned at 1.0.0 forever, so using it would freeze the cached HTML across deploys).

Construction options: `skipWaiting: false` (the user decides when to reload, via the
update toast), `clientsClaim: true`, `navigationPreload: true`.

The runtime cache is a **default-deny allowlist**, deliberately not Serwist's
`defaultCache` — which NetworkFirst-caches same-origin JSON behind a same-origin
catch-all, making "no auth-scoped bytes on disk" unprovable. Five rules, in order:

| Matcher | Handler |
|---|---|
| `request.mode === "navigate"`, or an `RSC: 1` header, or a `/api/` path, or any cross-origin URL | `NetworkOnly` |
| `/_next/static/….(js\|css)` | `CacheFirst`, cache `next-static-assets`, 64 entries, 30 days from last use |
| `/_next/static/….(eot\|otf\|ttc\|ttf\|woff\|woff2)` | `CacheFirst`, cache `static-font-assets`, 16 entries, 365 days |
| Same-origin images under `/icons/` or `/_next/static/`, or in the explicit allowlist | `CacheFirst`, cache `static-image-assets`, 64 entries, 30 days |
| Everything else | `NetworkOnly` |

The image rule's pathname allowlist is the load-bearing part. Matching on extension alone
would cache any same-origin URL ending in `.png` — safe only by accident, and unsafe the
moment a route is added that serves a user document as an image. `IMAGE_ALLOWLIST` is a
`Set` of three files in `apps/web/public`; brand assets go there, not into a looser
matcher. `apps/web/public/splash` is deliberately **absent**: iOS reads the launch images
from the startup-image tags at install time and keeps its own copy.

`fallbacks.entries` declares `/offline` as the document fallback, which is what turns a
failed navigation into the offline page rather than a browser error.

The worker also carries the push handlers: `push` (shows a notification with the 192px
icon and the payload URL as `data`), `notificationclick` (focuses a matching window or
opens one), and `pushsubscriptionchange` (re-subscribes with the old application server
key and posts `PUSH_RESUBSCRIBED` to any open client — without it, rotated endpoints die
silently and the API just collects 410s). There is no `SKIP_WAITING` listener, because
`skipWaiting: false` makes Serwist register an identical one itself.

### `apps/web/public/sw-dev.js`

A development-only, **push-only** worker, 73 lines, served statically from the app's
public directory. It
has no `fetch` handler and no `clientsClaim`, so it never intercepts a navigation, never
caches a chunk, and never becomes `navigator.serviceWorker.controller`.

It exists because the two requirements conflict: Web Push needs an active registration,
but the real worker CacheFirst-caches `/_next/static/*.js`, and Turbopack rebuilds that
graph on every hot-reload pass — so the worker serves a stale sibling chunk and Turbopack
throws "module factory is not available" during module evaluation, before React renders.
A worker with no fetch handler cannot do that. Its three push handlers must be kept in
sync with `apps/web/src/app/sw.ts`.

### The route and the rewrites

`apps/web/next.config.js` passes `beforeFiles` rewrites to `createNextConfig` — before the
filesystem, so the dev destination resolves to the static file rather than 404ing:

| Environment | Rewrite |
|---|---|
| Development | the public worker URL → the dev worker in `public/` |
| Production | the public worker URL and its source map → the Serwist route |

The public URL never changes, which is what lets existing push subscriptions (keyed to
the `/` scope) survive the switch. `serwist: true` makes the package's `createNextConfig`
add `serverExternalPackages: ["esbuild", "esbuild-wasm"]` itself rather than requiring
`@serwist/turbopack`'s wrapper: that package is a devDependency, `apps/web/next.config.js`
is loaded at runtime by `next start`, and the production image installs with `--prod`.

### The development teardown

`apps/web/src/instrumentation-client.ts` runs before any other client code. Outside
production it enumerates every service-worker registration, unregisters everything whose
script URL does not end in the dev worker's filename, deletes every cache, and — if a
worker was controlling *this* load — reloads once onto a clean, worker-free load, guarded
by a `sessionStorage` flag so it cannot loop.

This lives outside React on purpose: the failure it cleans up is a crash during **module**
evaluation, so no React-level effect would ever run to fix it. The dev worker itself is
kept, because tearing it down on every load would drop the push subscription and churn new
rows in the database.

## Install, update and offline UI

`apps/web/src/hooks/usePWA.ts` owns the browser-facing PWA state: `isInstalled`,
`isStandalone`, `isOnline`, `isIOS`, `canInstall`, `showInstallPrompt`, `updateAvailable`,
plus `install()`, `dismissInstallPrompt()` and `refreshApp()`.

- It registers the worker with a **relative** URL, because registration is same-origin
  only and an absolute URL silently fails on every other origin (a preview domain, an IP,
  localhost).
- `isOnline` starts `true` and changes only on the `online`/`offline` events.
  `navigator.onLine` can report `false` on a working dev connection.
- `refreshApp()` adds a one-shot `controllerchange` listener **before** posting
  `SKIP_WAITING`, so the reload happens after activation. Reloading immediately can beat
  activation and serve the old assets again, and the update toast comes straight back.
- The install prompt is suppressed once dismissed, via a `localStorage` key.

`apps/web/src/features/pwa/components/PWAProvider.tsx` renders `OfflineIndicator`,
`InstallPrompt` and `UpdateNotification` around the app, and is mounted by the root
layout.

## Manifest, icons and splash images

`apps/web/public/manifest.json` declares `{{name}}` as both name and short name,
`start_url: "/"`, `display: "standalone"`, a white background, a black theme colour, the
`productivity` category, and ten icons — eight `any` plus two `maskable` (192 and 512).
The root layout links it through `metadata.manifest` and adds the Apple touch icon and
five `apple-splash-*` startup images with device-specific media queries.

`apps/web/scripts/generate-icons.py` regenerates the whole set from one source PNG
(`apps/web/public` holds the placeholder). It needs Pillow, detects a primary colour from
the source by ignoring near-white and transparent pixels, produces a white-on-brand
variant for the splash screens, and writes the icons, the favicon and the splash images.
Replacing the brand means replacing the source image and re-running it — and adding the
new filenames to `IMAGE_ALLOWLIST` in `apps/web/src/app/sw.ts` if they are to be cached.

## The offline route

`apps/web/src/app/[locale]/offline/page.tsx` is a client page with a heading, a
description and a retry button that calls `window.location.reload()`. It reads the
`offline` message namespace.

It sits directly under `[locale]`, outside every route group, and
`apps/web/src/proxy.ts` lists `/offline` in `PUBLIC_PATHS`. The exemption is not
cosmetic: the proxy's matcher skips any path containing a dot, `/offline` has none, and an
auth-gated `/offline` would precache a redirect to `/login` — so the fallback would never
render for the signed-out or expired session that needs it most.

## Where to look

| File | Why |
|---|---|
| `apps/web/src/app/sw.ts` | The default-deny cache, the image allowlist, the fallback, the push handlers |
| `apps/web/public/sw-dev.js` | Why development gets a push-only worker |
| `apps/web/src/app/serwist/[path]/route.ts` | The build, and the precache revision choice |
| `apps/web/next.config.js` | The two rewrites, and `serwist: true` |
| `apps/web/src/instrumentation-client.ts` | The development worker teardown |
| `apps/web/src/hooks/usePWA.ts` | Registration, update detection and the install prompt |
| `apps/web/src/features/pwa/components/PWAProvider.tsx` | Where the three PWA surfaces mount |
| `apps/web/public/manifest.json` | The installable-app declaration |
| `apps/web/scripts/generate-icons.py` | Regenerating every icon and splash image |
| `apps/web/src/features/common/components/details/LayoutDetails.tsx` | The single call site of `useNotificationSync` |

## Gaps and drift

- `apps/web/src/hooks/usePWA.ts` and the package's `usePushNotifications` both register a
  worker, at the same scope, on every authenticated page. They pick their script URL by
  different rules — the app hook always registers the rewritten public URL and lets the
  rewrite choose, the package hook branches on `ENV.IS_PRODUCTION` itself.
- The push handlers are duplicated verbatim between `apps/web/src/app/sw.ts` and
  `apps/web/public/sw-dev.js`, with a comment asking that they be kept in sync. Nothing
  enforces it.
- The socket's default context is published whenever no token is present, so
  `useSocketContext()` never throws in a signed-out tree and a missing socket is
  indistinguishable from a disconnected one.
- `apps/web/src/app/sw.ts` notes that relaxing any cache rule makes a `caches.delete()`
  sweep on logout mandatory. No such sweep exists today, because nothing auth-scoped is
  cached.
- I did not examine the package's `NotificationModal`, `NotificationsList` or
  `PushService` internals, the API side of push delivery, or the behaviour of the worker
  under an actual deploy.
