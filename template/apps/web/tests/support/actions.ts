import { Locator, Page } from "@playwright/test";

/**
 * Navigate and wait until `ready` resolves at least one element, retrying the
 * navigation a few times. The first hit on a route after a cold boot can pay
 * for the api's lazy schema work; a bare `goto` + assertion races that.
 */
export async function gotoWithRetry(page: Page, url: string, ready: (page: Page) => Locator): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await page.goto(url);
    // best-effort: some pages never reach networkidle (e.g. a retried image 404)
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    if ((await ready(page).count()) > 0) return;
    await page.waitForTimeout(1000);
  }
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
