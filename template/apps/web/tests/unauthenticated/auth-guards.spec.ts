import { expect, test } from "@playwright/test";

/**
 * The proxy's session gate (apps/web/src/proxy.ts) and the (auth) route group,
 * seen without any session. `/` is deliberately exempt from the gate, so the
 * redirect is asserted on /administration.
 */
test.describe("session gate", () => {
  test("an unauthenticated visit to /administration is redirected to /login", async ({ page }) => {
    await page.goto("/administration");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 30000 });
    await expect(page.getByTestId("page-login-container")).toBeVisible();
  });

  test("/logout without a session leaves the logout page without an error", async ({ page }) => {
    await page.goto("/logout");
    await page.waitForURL((url) => !url.pathname.includes("/logout"), { timeout: 30000 });
    // Logout.tsx sends the browser to "/" (exempt) — the gate must not bounce it
    // back through /logout, and nothing may have thrown on the way.
    expect(["/", "/login"]).toContain(new URL(page.url()).pathname);
    await expect(page.getByText(/application error/i)).toHaveCount(0);
  });
});

test.describe("(auth) pages render", () => {
  test("/register renders the registration form", async ({ page }) => {
    await page.goto("/register");
    // Register.tsx renders FormInput/FormPassword; the inputs carry no id, and
    // their accessible name is the placeholder (en.json company/user/common fields).
    await expect(page.getByPlaceholder("Enter Company Name")).toBeVisible();
    await expect(page.getByPlaceholder("Enter Name")).toBeVisible();
    await expect(page.getByPlaceholder("Add email address")).toBeVisible();
    await expect(page.getByPlaceholder("Enter Password")).toBeVisible();
    await expect(page.locator("button[type='submit']").first()).toBeVisible();
  });

  test("/reset/<code> renders the password reset page", async ({ page }) => {
    await page.goto("/reset/00000000-0000-0000-0000-000000000000");
    // ResetPassword.tsx heading: t("auth.password_reset") = "Reset Password".
    await expect(page.getByText(/reset password/i).first()).toBeVisible();
  });

  test("/activation/<unknown code> reports the failure instead of hanging", async ({ page }) => {
    await page.goto("/activation/00000000-0000-0000-0000-000000000000");
    // ActivateAccount.tsx: after the api refuses the code the card switches
    // from "Please wait…" to t("auth.errors.activating_account").
    await expect(page.getByText(/error occurred while activating/i)).toBeVisible({ timeout: 30000 });
  });
});
