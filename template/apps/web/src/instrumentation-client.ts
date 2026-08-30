// Runs before any other client code (Next.js client instrumentation hook).
// Imports env.ts for its side effects: setBootstrapper(bootstrap), bootstrap(),
// configureJsonApi, configureAuth, configureI18n, configureRoles, configureLogin.
// This guarantees the Modules registry is populated before any chunk that
// touches Modules.X at module-eval time can evaluate.
import "@/config/env";
import { ENV } from "@/config/middleware-env";

// Dev-only service-worker teardown. The PWA worker is a production concern, but
// a worker installed by a local `next build && next start` (or by scripts/e2e.sh)
// on this same origin may still control it and serve stale Turbopack chunks via
// its CacheFirst rule (src/app/sw.ts) — throwing "module factory is not
// available" during MODULE evaluation, i.e. before React renders. That crash is
// why no React-level effect can clean this up, so it happens here, at the
// earliest client entrypoint, outside React.
if (!ENV.IS_PRODUCTION && typeof window !== "undefined" && "serviceWorker" in navigator) {
  // One-shot guard: the post-teardown reload lands uncontrolled, so this never
  // loops, but the flag makes that invariant explicit and loop-proof.
  const RELOADED_KEY = "sw-dev-teardown-reloaded";
  const wasControlled = !!navigator.serviceWorker.controller;
  void (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    // Keep the push-only dev worker (public/sw-dev.js): it has no fetch handler,
    // so it cannot serve stale chunks, and tearing it down on every load would
    // drop the push subscription and churn new ones in the database. Any OTHER
    // worker — a caching prod-style sw.js left over from a local production
    // build — still goes.
    await Promise.all(
      registrations
        .filter((registration) => {
          const scriptURL =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            "";
          return !scriptURL.endsWith("/sw-dev.js");
        })
        .map((registration) => registration.unregister()),
    );
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    // If a worker was controlling THIS load, its stale chunks are already in the
    // page (and may have crashed it). Reload once onto a clean, worker-free load.
    if (wasControlled && !sessionStorage.getItem(RELOADED_KEY)) {
      sessionStorage.setItem(RELOADED_KEY, "1");
      window.location.reload();
    } else if (!wasControlled) {
      sessionStorage.removeItem(RELOADED_KEY);
    }
  })();
}
