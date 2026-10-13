import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isLogged: vi.fn(),
  hasRole: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
// routing.ts: defaultLocale "en", localePrefix "as-needed".
vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => (locale === "en" ? href : `/${locale}${href}`),
}));
vi.mock("@carlonicora/nextjs-jsonapi/server", () => ({
  ServerSession: { isLogged: mocks.isLogged, hasRole: mocks.hasRole },
}));
vi.mock("@{{name}}/shared", () => ({ RoleId: { Administrator: "administrator-role" } }));

import { requireAdministrator } from "../requireAdministrator";

describe("requireAdministrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a logged-out user to the locale login", async () => {
    mocks.isLogged.mockResolvedValue(false);
    mocks.hasRole.mockResolvedValue(false);

    await expect(requireAdministrator("it")).rejects.toThrow("NEXT_REDIRECT:/it/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/it/login");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("redirects to /login, without a prefix, for the default locale", async () => {
    mocks.isLogged.mockResolvedValue(false);

    await expect(requireAdministrator("en")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("returns not-found for a non-administrator", async () => {
    mocks.isLogged.mockResolvedValue(true);
    mocks.hasRole.mockResolvedValue(false);

    await expect(requireAdministrator("en")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.hasRole).toHaveBeenCalledWith("administrator-role");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("passes for an administrator", async () => {
    mocks.isLogged.mockResolvedValue(true);
    mocks.hasRole.mockResolvedValue(true);

    await expect(requireAdministrator("en")).resolves.toBeUndefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
