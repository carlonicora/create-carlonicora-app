import { gzipSync } from "node:zlib";
import type { Browser } from "@playwright/test";
import { E2E } from "../e2e.env";

const JSON_API = "application/vnd.api+json";

/**
 * Everything the app's session cookies are built from. Derived from the REAL
 * `POST /auth/login` response — nothing here is invented by the suite, so a
 * test that depends on a role is testing the role the API actually granted.
 */
export type Session = {
  token: string;
  refreshToken?: string;
  userId: string;
  companyId?: string;
  roleIds: string[];
  featureIds: string[];
  modules: { id: string; permissions: unknown }[];
};

type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | { id: string; type: string }[] }>;
};

type JsonApiDocument = { data?: JsonApiResource; included?: JsonApiResource[] };

function relatedIds(resource: JsonApiResource | undefined, ...keys: string[]): string[] {
  for (const key of keys) {
    const data = resource?.relationships?.[key]?.data;
    if (Array.isArray(data)) return data.map((entry) => entry.id);
    if (data) return [data.id];
  }
  return [];
}

/**
 * Authenticates against the api the way the login form does: e-mail + password
 * to `POST /auth/login`. Deliberately no SSO branch and no dev-token shortcut —
 * a session minted by a back door proves nothing about the real login path, and
 * a shortcut that only exists in development rots silently.
 */
export async function login(params: { email: string; password: string }): Promise<Session> {
  const response = await fetch(`${E2E.apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": JSON_API, Accept: JSON_API },
    body: JSON.stringify({
      data: { type: "auth", attributes: { email: params.email, password: params.password } },
    }),
  });

  if (!response.ok) {
    throw new Error(`login ${params.email} -> HTTP ${response.status}: ${await response.text()}`);
  }

  const document = (await response.json()) as JsonApiDocument;
  const token = document.data?.attributes?.token as string | undefined;
  if (!token) throw new Error(`login ${params.email}: no token in ${JSON.stringify(document)}`);

  const userId = relatedIds(document.data, "user")[0];
  if (!userId) throw new Error(`login ${params.email}: the auth resource carries no user relationship`);

  const included = document.included ?? [];
  const user = included.find((resource) => resource.id === userId);
  if (!user) throw new Error(`login ${params.email}: the user resource is not in "included"`);

  const company = included.find((resource) => resource.id === relatedIds(user, "company")[0]);

  return {
    token,
    refreshToken: document.data?.attributes?.refreshToken as string | undefined,
    userId,
    companyId: company?.id,
    // The serialiser names these from the entity's dtoKey; accept the singular
    // form too so a descriptor rename does not silently yield an empty session.
    roleIds: relatedIds(user, "roles", "role"),
    featureIds: relatedIds(company, "features", "feature"),
    modules: relatedIds(user, "modules", "module")
      .map((id) => included.find((resource) => resource.id === id))
      .filter((resource): resource is JsonApiResource => !!resource)
      .map((resource) => ({ id: resource.id, permissions: resource.attributes?.permissions })),
  };
}

/**
 * Logs in and writes a Playwright storageState file for the resulting session.
 *
 * The cookies are planted directly into the browser context rather than being
 * collected from the app's own `Set-Cookie` headers, for one reason: the
 * library marks its auth cookies `secure` whenever NODE_ENV is "production",
 * and the e2e web server is a production build served over plain http, so the
 * browser would reject every one of them. Playwright's cookie jar is not
 * subject to that rule. The VALUES are still entirely the api's — the token,
 * the roles and the modules all come out of the login response above.
 *
 * The names, encodings and httpOnly flags mirror the library's `updateToken`
 * (features/auth/utils/AuthCookies.ts) exactly, because that is what
 * `ServerSession` reads back on the server: `roles` is a JSON array string that
 * `hasRole` substring-matches, and `modules` is gzip + base64 + JSON-quoted.
 */
/**
 * The dehydrated `currentUser` the app keeps in localStorage.
 *
 * Planting cookies alone produces a HALF-authenticated session: the server
 * sees it (ServerSession reads the cookies), but every client component reads
 * the user from an `atomWithStorage("user")` that is still null — so
 * `hasRole()` is false in the browser and role-gated CLIENT chrome (the
 * sidebar's administration group, AdminIndexContainer's sections) never
 * renders, while the server-gated routes work fine. That split is invisible
 * until a spec asserts on something a client component drew.
 *
 * `AbstractApiData.dehydrate()` returns exactly `{ jsonApi, included }`, so the
 * stored value is reproducible from the same `users/me/full` document the app's
 * own `UserService.findFullUser()` fetches. Nothing is invented here.
 */
async function fetchDehydratedUser(token: string): Promise<string> {
  const response = await fetch(`${E2E.apiBase}/users/me/full`, {
    headers: { Accept: JSON_API, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`users/me/full -> HTTP ${response.status}: ${await response.text()}`);
  }
  const document = (await response.json()) as JsonApiDocument;
  return JSON.stringify({ jsonApi: document.data, included: document.included ?? [] });
}

export async function loginAndSaveState(params: {
  browser: Browser;
  email: string;
  password: string;
  authFile: string;
  /**
   * Origin the session is established against, and the cookie domain that goes
   * with it. Defaults to the suite's configured web host. Cookies are
   * domain-scoped, so a state saved for that host does NOT authenticate
   * http://localhost — pass both to build a localhost state.
   */
  webBase?: string;
  cookieDomain?: string;
}): Promise<Session> {
  const session = await login({ email: params.email, password: params.password });
  const webBase = params.webBase ?? E2E.webBase;
  const domain = params.cookieDomain ?? E2E.cookieDomain;

  const context = await params.browser.newContext({ baseURL: webBase });
  type CookieParam = Parameters<typeof context.addCookies>[0][number];
  const base = { domain, path: "/", secure: false } as const;

  const cookies: CookieParam[] = [
    { ...base, name: "token", value: session.token, httpOnly: false },
    { ...base, name: "userId", value: session.userId, httpOnly: true },
    { ...base, name: "roles", value: JSON.stringify(session.roleIds), httpOnly: true },
    { ...base, name: "features", value: JSON.stringify(session.featureIds), httpOnly: true },
  ];
  if (session.refreshToken)
    cookies.push({ ...base, name: "refreshToken", value: session.refreshToken, httpOnly: true });
  if (session.companyId) cookies.push({ ...base, name: "companyId", value: session.companyId, httpOnly: true });
  if (session.modules.length)
    cookies.push({
      ...base,
      name: "modules",
      value: JSON.stringify(gzipSync(Buffer.from(JSON.stringify(session.modules))).toString("base64")),
      httpOnly: true,
    });

  await context.addCookies(cookies);

  // One real navigation before the state is saved: it proves the planted
  // session survives the proxy's auth gate (which redirects to /login when the
  // refresh token is missing) instead of discovering it in every later spec.
  const page = await context.newPage();
  await page.goto("/");
  if (new URL(page.url()).pathname.includes("/login")) {
    throw new Error(`loginAndSaveState(${params.email}): the planted session was rejected — landed on ${page.url()}`);
  }

  // Hydrate the CLIENT half of the session. Must happen against a page already
  // on this origin, because localStorage is origin-scoped and storageState only
  // records origins the context actually visited.
  const dehydratedUser = await fetchDehydratedUser(session.token);
  await page.evaluate((value) => window.localStorage.setItem("user", value), dehydratedUser);

  await context.storageState({ path: params.authFile });
  await context.close();
  return session;
}
