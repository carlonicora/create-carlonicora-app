import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isLogged: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
// routing.ts: defaultLocale "en", localePrefix "as-needed".
vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => (locale === "en" ? href : `/${locale}${href}`),
}));
vi.mock("@carlonicora/nextjs-jsonapi/server", () => ({ ServerSession: { isLogged: mocks.isLogged } }));
vi.mock("../[locale]/(auth)/oauth/authorize/OAuthAuthorizeClient", () => ({ OAuthAuthorizeClient: () => null }));

import OAuthAuthorizePage from "../[locale]/(auth)/oauth/authorize/page";

function callbackParams(prefix = "/it"): URLSearchParams {
  const target = new URL(mocks.redirect.mock.calls[0][0], "http://localhost");
  expect(target.pathname).toBe(`${prefix}/login`);
  const callback = new URL(target.searchParams.get("callbackUrl")!, "http://localhost");
  expect(callback.pathname).toBe(`${prefix}/oauth/authorize`);
  return callback.searchParams;
}

describe("OAuth authorize page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a signed-out user to login with every incoming query parameter in the callback URL", async () => {
    mocks.isLogged.mockResolvedValue(false);
    const query = {
      response_type: "code",
      client_id: "client-1",
      redirect_uri: "https://client.example/cb?x=1&y=2",
      scope: "read write",
      state: "s t&ate",
      code_challenge: "challenge",
      code_challenge_method: "S256",
      resource: ["https://a.example", "https://b.example"],
      nonce: "n-1",
    };

    await expect(
      OAuthAuthorizePage({
        params: Promise.resolve({ locale: "it" }),
        searchParams: Promise.resolve(query as unknown as Record<string, string | undefined>),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:");

    const params = callbackParams();
    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("client-1");
    expect(params.get("redirect_uri")).toBe("https://client.example/cb?x=1&y=2");
    expect(params.get("scope")).toBe("read write");
    expect(params.get("state")).toBe("s t&ate");
    expect(params.get("code_challenge")).toBe("challenge");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("nonce")).toBe("n-1");
    expect(params.getAll("resource")).toEqual(["https://a.example", "https://b.example"]);
    expect([...new Set(params.keys())].sort()).toEqual(Object.keys(query).sort());
  });

  it("drops the prefix for the default locale, so the login form's client navigation is not redirected", async () => {
    mocks.isLogged.mockResolvedValue(false);

    await expect(
      OAuthAuthorizePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ response_type: "code", client_id: "client-1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:");

    expect(callbackParams("").get("response_type")).toBe("code");
  });

  it("does not redirect a signed-in user", async () => {
    mocks.isLogged.mockResolvedValue(true);

    await OAuthAuthorizePage({
      params: Promise.resolve({ locale: "it" }),
      searchParams: Promise.resolve({ response_type: "code", client_id: "client-1" }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
