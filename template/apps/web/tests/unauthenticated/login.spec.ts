import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../e2e.env";

/**
 * FormFieldWrapper puts the SAME data-testid on the field's wrapper <div> and on
 * the <input> inside it, so `getByTestId("form-login-input-*")` resolves to two
 * elements and Playwright's strict mode fails the call. Anchor on the control
 * itself; the wrapper is not what a user types into.
 */
const emailInput = (page: Page) => page.locator('input[data-testid="form-login-input-email"]');
const passwordInput = (page: Page) => page.locator('input[data-testid="form-login-input-password"]');
const submitButton = (page: Page) => page.locator('button[data-testid="form-login-button-submit"]');


/**
 * EXEMPLAR SPEC — the `chromium-unauth` project, which carries no storageState.
 *
 * Copy its shape when you add an unauthenticated flow: anchor on the
 * `data-testid`s the library's forms ship (they survive copy changes and
 * translation, which `getByText` does not), and assert on an observable
 * outcome, never on a timeout.
 */
test.describe("login", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    // Login.tsx: CardHeader data-testid="page-login-container".
    await expect(page.getByTestId("page-login-container")).toBeVisible();
    await expect(emailInput(page)).toBeVisible();
    await expect(passwordInput(page)).toBeVisible();
    await expect(submitButton(page)).toBeVisible();
  });

  test("rejects bad credentials and stays on the login page", async ({ page }) => {
    await page.goto("/login");

    await emailInput(page).fill(E2E.administrator.email);
    await passwordInput(page).fill("definitely-not-the-password");

    // The form posts to the api and surfaces the failure through an error toast;
    // waiting for the RESPONSE rather than for the toast keeps the assertion
    // independent of the toast library and of the copy in messages/en.json.
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/auth/login") && res.request().method() === "POST"),
      submitButton(page).click(),
    ]);

    expect(response.status(), "the api must refuse invalid credentials").toBeGreaterThanOrEqual(400);

    // The decisive assertion: no session was established. The login form is
    // still on screen and the app did not navigate anywhere authenticated.
    await expect(page.getByTestId("page-login-container")).toBeVisible();
    expect(new URL(page.url()).pathname).toContain("/login");

    const cookies = await page.context().cookies();
    expect(
      cookies.filter((cookie) => cookie.name === "token" || cookie.name === "refreshToken"),
      "a failed login must not leave session cookies behind",
    ).toEqual([]);
  });
});
