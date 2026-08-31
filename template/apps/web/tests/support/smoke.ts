import { expect, Locator, Page, test } from "@playwright/test";
import { E2E } from "../e2e.env";

export type SmokeRoute = {
  path: string;
  /** Something that only renders once the page's data has actually arrived. */
  ready: (page: Page) => Locator;
  allowConsole?: RegExp[];
  /** Same-stack request URLs whose 4xx/5xx responses are EXPECTED on this route. */
  allowRequest?: RegExp[];
};

/**
 * Console errors that are noise in the isolated e2e stack, not regressions.
 * Extend ONLY with a comment naming the route and the run that produced the
 * message — an allowlist that grows silently stops catching anything.
 */
export const GLOBAL_CONSOLE_ALLOWLIST: RegExp[] = [
  /WebSocket/i, // socket reconnection noise: the stack has no realtime server
  /favicon/i,
];

const SAME_STACK = [E2E.apiBase, E2E.webBase, E2E.webBaseLocalhost];

/**
 * A route smoke: the page renders its `ready` element, no same-stack request
 * failed, and nothing unexpected reached console.error. Three cheap assertions
 * that catch a route 500ing, an api call the page cannot make, and a runtime
 * exception in a client component.
 */
export function smokeTest(route: SmokeRoute): void {
  test(`smoke ${route.path}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const allow = [...GLOBAL_CONSOLE_ALLOWLIST, ...(route.allowConsole ?? [])];

    page.on("console", (msg) => {
      if (msg.type() === "error" && !allow.some((re) => re.test(msg.text()))) consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      const sameStack = SAME_STACK.some((base) => res.url().startsWith(base));
      const expected = (route.allowRequest ?? []).some((re) => re.test(res.url()));
      if (sameStack && !expected && res.status() >= 400)
        failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    });

    for (let i = 0; i < 5; i++) {
      try {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      } catch {
        await page.waitForTimeout(1000);
        continue;
      }
      if ((await route.ready(page).count()) > 0) break;
      await page.waitForTimeout(1000);
    }

    await expect(route.ready(page)).toBeVisible({ timeout: 15000 });
    expect(failedRequests, `failed requests on ${route.path}`).toEqual([]);
    expect(consoleErrors, `console errors on ${route.path}`).toEqual([]);
  });
}
