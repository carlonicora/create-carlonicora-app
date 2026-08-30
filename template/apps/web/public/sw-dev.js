// Development-only, push-ONLY service worker.
//
// WHY THIS EXISTS: the real worker (src/app/sw.ts) CacheFirst-caches
// /_next/static/*.js. In dev Turbopack rebuilds the chunk graph on every HMR
// pass, so that worker serves a stale sibling chunk ("module factory is not
// available") and wedges the app — which is why the full worker is banned from
// dev (instrumentation-client.ts tears it down; usePWA never registers it in
// development). But Web Push REQUIRES an active service-worker registration, so
// dev would otherwise have no way to receive notifications at all.
//
// This worker deliberately has NO `fetch` handler and NO clientsClaim: it never
// intercepts a navigation, never caches a chunk, and never takes control of the
// page. The stale-chunk failure mode is therefore impossible by construction,
// and navigator.serviceWorker.controller stays null (so the dev teardown's
// reload path is never armed). It handles ONLY push. It is served statically
// from public/ at scope "/", the same scope the prod worker uses, so a
// subscription created here is registered against the same origin+scope.
//
// Keep the push/notificationclick/pushsubscriptionchange handlers below in sync
// with src/app/sw.ts.

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

// FCM rotates/expires subscriptions periodically. When it does, re-subscribe
// with the old application server key and hand the new subscription to any open
// client, which re-registers it against the API with the user's auth. If no
// client is open, the next page load re-registers instead.
self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    (async function () {
      const applicationServerKey = event.oldSubscription && event.oldSubscription.options.applicationServerKey;
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
