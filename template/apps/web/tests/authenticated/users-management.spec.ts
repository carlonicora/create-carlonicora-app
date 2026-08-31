import { expect, test } from "@playwright/test";
import { E2E } from "../e2e.env";
import { gotoWithRetry } from "../support/actions";

/**
 * The `chromium-auth` project — administrator storageState.
 * PlatformUsersContainer (`/administration/users`) is a ContentListTable with
 * search; the two rows it must show are the two seeded personas.
 */
test.describe("users list", () => {
  test("lists both seeded personas", async ({ page }) => {
    await gotoWithRetry(page, "/administration/users", (p) => p.getByTestId("content-table-search-trigger"));
    // "cell": the email also renders in the sidebar user footer.
    await expect(page.getByRole("cell", { name: E2E.administrator.email })).toBeVisible();
    await expect(page.getByRole("cell", { name: E2E.member.email })).toBeVisible();
  });

  test("search narrows the list to the matching user", async ({ page }) => {
    // KNOWN LIBRARY DEFECT — remove this fixme when it is fixed upstream.
    // @carlonicora/nestjs-neo4jsonapi UserRepository.findMany, search branch:
    //   WHERE (node)-[:BELONGS_TO]->(company)
    // `company` is never bound, so Neo4j rejects the query (42001,
    // "PatternExpressions are not allowed to introduce new variables") and
    // GET /users?search=… answers 500. The list stays unfiltered.
    test.fixme(true, "GET /users?search= 500s: unbound `company` in UserRepository.findMany (library defect)");

    await gotoWithRetry(page, "/administration/users", (p) => p.getByTestId("content-table-search-trigger"));
    await expect(page.getByRole("cell", { name: E2E.administrator.email })).toBeVisible();

    await page.getByTestId("content-table-search-trigger").click();
    const input = page.getByTestId("content-table-search-input");
    await expect(input).toBeVisible();
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/users") && res.url().includes("search")),
      input.fill(E2E.member.name),
    ]);

    await expect(page.getByRole("cell", { name: E2E.member.email })).toBeVisible();
    await expect(page.getByRole("cell", { name: E2E.administrator.email })).toHaveCount(0);
  });
});

test.describe("logout", () => {
  test("clears the session cookies", async ({ page, context }) => {
    const before = await context.cookies();
    expect(before.find((c) => c.name === "token")).toBeTruthy();

    await page.goto("/logout");
    await page.waitForURL((url) => !url.pathname.includes("/logout"), { timeout: 30000 });

    const after = await context.cookies();
    expect(after.find((c) => c.name === "token")).toBeUndefined();
    expect(after.find((c) => c.name === "refreshToken")).toBeUndefined();
  });
});
