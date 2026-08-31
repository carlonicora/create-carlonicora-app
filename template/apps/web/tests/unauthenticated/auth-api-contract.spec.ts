import { expect, test } from "@playwright/test";
import { E2E } from "../e2e.env";

/**
 * POST /auth/login request-contract assertions, against the api directly.
 *
 * These exercise the DTO / ValidationPipe layer, not the UI: the login form
 * cannot produce a numeric email or a wrong `data.type`, so the 400 branches
 * are unreachable from any page-driven spec.
 *
 * RATE LIMITING IS OFF IN THIS STACK: scripts/e2e.sh starts the api with
 * RATE_LIMIT_ENABLED=false. If that pin is ever removed, POST /auth/login is
 * throttled per IP and this file's six logins would 429. Fix the stack, not
 * this file.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const loginBody = (attributes: Record<string, unknown>) => ({
  data: { type: "auth", attributes },
});

test.describe("POST /auth/login — request contract", () => {
  const cases: Array<{ label: string; body: unknown; status: number }> = [
    { label: "an invalid email format is rejected", body: loginBody({ email: "invalid-email", password: "password" }), status: 400 },
    { label: "a missing password is rejected", body: loginBody({ email: "someone@example.test" }), status: 400 },
    { label: "a missing email is rejected", body: loginBody({ password: "password" }), status: 400 },
    { label: "a non-string email is rejected", body: loginBody({ email: 12345, password: "password" }), status: 400 },
    {
      label: "a wrong JSON:API resource type is rejected",
      body: { data: { type: "wrong-type", attributes: { email: "someone@example.test", password: "password" } } },
      status: 400,
    },
    {
      label: "well-formed but unknown credentials are 401, not 400",
      body: loginBody({ email: "nonexistent@example.test", password: "wrongpassword" }),
      status: 401,
    },
  ];

  for (const c of cases) {
    test(c.label, async ({ request }) => {
      const res = await request.post(`${E2E.apiBase}/auth/login`, { data: c.body });
      expect(res.status()).toBe(c.status);
    });
  }
});
