import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E } from "../e2e.env";

/**
 * GET /users/* seen from the api directly: the bearer guard and tenant
 * isolation. Both personas are seeded by tests/setup/seed.setup.ts; the
 * member belongs to "E2E Company", the administrator to no company at all.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const JSON_API = "application/vnd.api+json";

async function bearer(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${E2E.apiBase}/auth/login`, {
    headers: { "Content-Type": JSON_API, Accept: JSON_API },
    data: { data: { type: "auth", attributes: { email, password } } },
  });
  // NestJS POST default status is 201, not 200.
  expect(res.status(), `login ${email}`).toBe(201);
  const body = (await res.json()) as { data?: { attributes?: { token?: string } } };
  const token = body.data?.attributes?.token;
  if (!token) throw new Error(`login ${email}: no token in ${JSON.stringify(body)}`);
  return token;
}

// The library's JwtAuthGuard answers a missing bearer with 403, not 401.
test.describe("GET /users — authentication", () => {
  test("/users/me/full is refused without a token", async ({ request }) => {
    const res = await request.get(`${E2E.apiBase}/users/me/full`, { headers: { Accept: JSON_API } });
    expect(res.status()).toBe(403);
  });

  test("/users/:userId is refused without a token", async ({ request }) => {
    const res = await request.get(`${E2E.apiBase}/users/${E2E.member.id}`, { headers: { Accept: JSON_API } });
    expect(res.status()).toBe(403);
  });
});

test.describe("GET /users/:userId — tenant isolation", () => {
  test("an unknown user id is 404 for the platform administrator", async ({ request }) => {
    const token = await bearer(request, E2E.administrator.email, E2E.administrator.password);
    const res = await request.get(`${E2E.apiBase}/users/00000000-0000-0000-0000-000000000000`, {
      headers: { Accept: JSON_API, Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test("a company member cannot read a user outside its company", async ({ request }) => {
    // Both personas share one plaintext: createNonAdministratorUser copies the
    // administrator's password hash onto the member node.
    const token = await bearer(request, E2E.member.email, E2E.administrator.password);
    const res = await request.get(`${E2E.apiBase}/users/${E2E.administrator.id}`, {
      headers: { Accept: JSON_API, Authorization: `Bearer ${token}` },
    });
    // The isolation property is what matters; whether the api says 403 or 404
    // is its choice. What it must NEVER do is answer 2xx with the other
    // tenant's data.
    expect(res.status(), "a cross-tenant read must be refused").toBeGreaterThanOrEqual(400);
    expect(await res.text()).not.toContain(E2E.administrator.email);
  });
});
