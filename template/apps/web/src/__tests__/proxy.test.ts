import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  intl: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => mocks.intl,
}));

// The global setup mocks next-intl without hasLocale, which stripLocalePrefix uses; restore the real one.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return { hasLocale: actual.hasLocale };
});

vi.mock("@/config/middleware-env", () => ({
  ENV: { PUBLIC_API_URL: "http://api.test/" },
}));

import proxy, { isPublicPath } from "../proxy";

const BASE = "http://{{name}}.test:4051";

function jwt(expInSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expInSeconds })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(new URL(path, BASE), { headers: cookie ? { cookie } : {} });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

describe("proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mocks.intl.mockReset();
    mocks.intl.mockImplementation(() => NextResponse.next());
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exempts one path from every public group", async () => {
    for (const path of ["/", "/home", "/login", "/reset/abc", "/offline", "/help", "/en/help/how-to/x", "/oauth/error?error=registration_closed", "/en/oauth/success"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.status, path).toBe(200);
    }
  });

  it("redirects a logged-out user on an app path to login with callbackUrl", async () => {
    const response = await proxy(request("/users"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${BASE}/login?callbackUrl=%2Fusers`);
  });

  it('does not treat /users as exempt because "/" is public', async () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/users")).toBe(false);
    expect(isPublicPath("/homes")).toBe(false);
    expect(isPublicPath("/help/x")).toBe(true);
    const response = await proxy(request("/users"));
    expect(response.status).toBe(307);
  });

  it("rewrites / to /home for a visitor with no refreshToken", async () => {
    const root = await proxy(request("/"));
    expect(root.headers.get("x-middleware-rewrite")).toMatch(/\/home$/);

    const localised = await proxy(request("/en"));
    expect(new URL(localised.headers.get("x-middleware-rewrite")!).pathname).toBe("/en/home");
  });

  it("clears the cookies and rewrites to /home when the refresh fails on /", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await proxy(request("/", { refreshToken: "dead" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-middleware-rewrite")).toMatch(/\/home$/);
    const cookies = setCookies(response);
    expect(cookies.some((c) => c.startsWith("token=;") && /Expires=Thu, 01 Jan 1970/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken=;") && /Expires=Thu, 01 Jan 1970/i.test(c))).toBe(true);
  });

  it("leaves a logged-in user on / in the app", async () => {
    const response = await proxy(request("/", { refreshToken: "ok", token: jwt(3600) }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});
