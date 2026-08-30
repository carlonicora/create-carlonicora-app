/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The individual files in public/ that the image runtime-caching rule below is
 * allowed to cache. Everything else in public/ is served but never stored.
 * Add your own brand assets here when you replace the placeholders.
 */
const IMAGE_ALLOWLIST = new Set(["/logo.webp", "/{{name}}.png", "/favicon.ico"]);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Controlled by the SKIP_WAITING message instead, so the user decides when to
  // reload rather than losing form state mid-edit.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  // This is a DEFAULT-DENY allowlist ending in NetworkOnly, and deliberately NOT
  // Serwist's `defaultCache`. `defaultCache` NetworkFirst-caches same-origin JSON
  // and carries a same-origin catch-all, which makes "no auth-scoped bytes on
  // disk" unprovable — the wrong default for an application that will hold its
  // users' data on phones that get shared and lost.
  //
  // If any entry below is ever relaxed, a caches.delete() sweep on logout (and on
  // company switch) becomes mandatory.
  runtimeCaching: [
    // Navigations, RSC payloads, API calls, anything cross-origin: network only.
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" ||
        request.headers.get("RSC") === "1" ||
        url.pathname.startsWith("/api/") ||
        url.origin !== self.location.origin,
      handler: new NetworkOnly(),
    },
    // Hashed build assets — immutable by construction, identical for everyone.
    {
      matcher: /\/_next\/static\/.+\.(?:js|css)$/i,
      handler: new CacheFirst({
        cacheName: "next-static-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60, maxAgeFrom: "last-used" })],
      }),
    },
    // Self-hosted fonts — next/font emits these under /_next/static, which is
    // build output only, so the path prefix is the guard. A RegExp matcher is
    // tested against the whole URL, hence no ^ anchor.
    {
      matcher: /\/_next\/static\/.+\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
      handler: new CacheFirst({
        cacheName: "static-font-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60, maxAgeFrom: "last-used" })],
      }),
    },
    // Same-origin images — brand and build assets only. User and API images are
    // cross-origin and already NetworkOnly above.
    //
    // WHY THE PATHNAME ALLOWLIST: matching on the extension alone would cache ANY
    // same-origin URL ending in .png/.jpg. That is safe only by accident — adding
    // an app/documents/[id]/thumbnail.png/route.ts later would silently write
    // user-confidential bytes to disk with no change here. Do NOT "simplify" this
    // back to a bare extension test; add new static assets to the list instead.
    //
    // /splash/ IS DELIBERATELY ABSENT. iOS reads the launch images from the
    // apple-touch-startup-image tags at install time and keeps its own copy, so
    // caching them would only spend the 64-entry budget and evict assets that ARE
    // re-fetched. Adding files under public/splash needs no change here.
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin &&
        /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i.test(url.pathname) &&
        (url.pathname.startsWith("/icons/") ||
          url.pathname.startsWith("/_next/static/") ||
          IMAGE_ALLOWLIST.has(url.pathname)),
      handler: new CacheFirst({
        cacheName: "static-image-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60, maxAgeFrom: "last-used" })],
      }),
    },
    // DEFAULT DENY: everything not explicitly allowed above stays off disk.
    { matcher: /.*/i, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// --- Web Push -------------------------------------------------------------
// Moved verbatim from the former public/sw.js. The public URL of this worker
// stays /sw.js (via the rewrite in next.config.js) precisely so that existing
// push subscriptions survive. Keep these handlers in sync with public/sw-dev.js.

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Notification";
  const options = {
    body: data.message || "You have a new notification",
    icon: "/icons/web-app-manifest-192x192.png",
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    (async function () {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const windowClient of clientList) {
        if (windowClient.url === event.notification.data && "focus" in windowClient) {
          return windowClient.focus();
        }
      }
      if (self.clients.openWindow && event.notification.data) {
        return self.clients.openWindow(event.notification.data);
      }
    })(),
  );
});

// Push services rotate and expire subscriptions periodically. Without handling
// this event the old endpoint silently dies (the API then collects 410s) and
// nothing ever re-subscribes. Re-subscribe with the old application server key
// and hand the new subscription to any open client, which re-registers it with
// the API under the user's auth. If no client is open, the next page load
// re-registers instead.
// PushSubscriptionChangeEvent is not in the standard webworker lib typings.
interface PushSubscriptionChangeEvent extends ExtendableEvent {
  readonly oldSubscription: PushSubscription | null;
}
self.addEventListener("pushsubscriptionchange", (event) => {
  const changeEvent = event as PushSubscriptionChangeEvent;
  changeEvent.waitUntil(
    (async function () {
      const applicationServerKey = changeEvent.oldSubscription?.options.applicationServerKey;
      if (!applicationServerKey) return;

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const plainSubscription = { endpoint: subscription.endpoint, keys: subscription.toJSON().keys };
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const windowClient of clientList) {
        windowClient.postMessage({ type: "PUSH_RESUBSCRIBED", subscription: plainSubscription });
      }
    })(),
  );
});

// No SKIP_WAITING listener here on purpose: with `skipWaiting: false` the
// Serwist constructor registers an identical message listener itself, so
// usePWA().refreshApp()'s postMessage({ type: "SKIP_WAITING" }) still activates
// the waiting worker.
