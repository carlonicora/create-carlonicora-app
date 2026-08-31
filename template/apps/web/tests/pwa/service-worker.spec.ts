import { expect, test } from "@playwright/test";
import { gotoWithRetry } from "../support/actions";

/**
 * The `chromium-pwa` project: baseURL is http://localhost:<port> and the
 * storageState is the localhost-domain administrator session, because
 * `navigator.serviceWorker` exists only in a secure context and the custom
 * host over plain HTTP is not one. Same server either way.
 *
 * src/app/sw.ts declares `/offline` as the document fallback; Serwist
 * precaches it on install, so the wait below is for that precache, not for
 * the registration alone.
 */
test.describe("service worker — offline fallback", () => {
  test("serves /offline for a failed navigation and recovers on retry", async ({ page, context }) => {
    await gotoWithRetry(page, "/", (p) => p.getByTestId("admin-index-companies"));

    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(
        () => page.evaluate(async () => !!(await caches.match("/offline", { ignoreSearch: true }))),
        { timeout: 30000 },
      )
      .toBe(true);

    try {
      await context.setOffline(true);
      await page.goto("/administration", { waitUntil: "domcontentloaded" }).catch(() => undefined);
      // offline/page.tsx: <h1>{t("offline.title")}</h1> = "You're Offline".
      await expect(page.getByRole("heading", { name: /you.re offline/i })).toBeVisible({ timeout: 15000 });
      // The worker answered the /administration navigation with the fallback
      // body — the address bar stays on the requested URL.
      expect(page.url()).toContain("/administration");
    } finally {
      await context.setOffline(false);
    }

    // "Try Again" reloads the SAME URL, which now succeeds for real.
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("admin-index-companies")).toBeVisible({ timeout: 15000 });
  });
});
