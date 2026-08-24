import { expect, test } from "@playwright/test";

/**
 * EXEMPLAR SPEC — the `chromium-smoke` project, which runs with the
 * administrator storageState saved by tests/setup/seed.setup.ts.
 *
 * Three assertions, and the third is the point of the file. Copy the shape when
 * you add a route: anchor on a `data-testid` that only appears once the page's
 * data has actually rendered, never on a bare 200.
 */

test.describe("authenticated shell", () => {
  test("the home page renders for an administrator", async ({ page }) => {
    await page.goto("/");

    // For a platform administrator the index route renders AdminIndexContainer,
    // whose section links carry admin-index-<key> testids.
    await expect(page.getByTestId("admin-index-companies")).toBeVisible();
  });

  test("the administration index renders for an administrator", async ({ page }) => {
    await page.goto("/administration");

    await expect(page.getByTestId("admin-index-companies")).toBeVisible();
    await expect(page.getByTestId("admin-index-users")).toBeVisible();
  });
});

/**
 * The (admin) route group's role gate.
 *
 * This is the highest-value test in the template. The routes inside (admin)
 * carry no authorisation code of their own: the layout's
 * `ServerSession.hasRole(RoleId.Administrator)` check is the ONLY thing between
 * an ordinary authenticated user and every administration page. The api
 * separately refuses the underlying requests, so a regression here is a UI
 * exposure rather than a data leak — but it is a regression that a route-level
 * smoke test can never catch, because for an administrator everything looks
 * right.
 *
 * The fixture is a REAL user with a REAL session: tests/support/db.ts creates it
 * with the Company Administrator role — privileged inside its own company — and
 * tests/setup/seed.setup.ts logs it in through `POST /auth/login` and fails the
 * whole run if the api hands it the Administrator role after all.
 */
test.describe("the (admin) route group refuses a non-administrator", () => {
  test.use({ storageState: "playwright/.auth/member.json" });

  test("a non-administrator gets the 403 instead of the administration pages", async ({ page }) => {
    await page.goto("/administration");

    // ErrorDetails code={403} — the card the (admin) layout renders in place of
    // its children. Matching either half of the copy keeps the assertion alive
    // through a rewording of one line.
    await expect(page.getByText(/unauthoris(ed|zed)|not allowed to access/i).first()).toBeVisible();

    // And, decisively, none of the administration surface rendered.
    await expect(page.getByTestId("admin-index-companies")).toHaveCount(0);
    await expect(page.getByTestId("admin-index-users")).toHaveCount(0);
    await expect(page.getByTestId("admin-index-rbac")).toHaveCount(0);

    // The gate is on the LAYOUT, so it must cover the children too, not just the
    // index route. A guard that only protects /administration is not a guard.
    await page.goto("/administration/companies");
    await expect(page.getByText(/unauthoris(ed|zed)|not allowed to access/i).first()).toBeVisible();

    // Sanity: this user really is authenticated, so the refusal above is the
    // role gate and not a logged-out redirect to /login.
    expect(new URL(page.url()).pathname, "the refusal must not be a redirect to the login page").not.toContain(
      "/login",
    );
    await page.goto("/");
    await expect(page.getByTestId("admin-index-companies")).toHaveCount(0);
    expect(new URL(page.url()).pathname).not.toContain("/login");
  });
});
