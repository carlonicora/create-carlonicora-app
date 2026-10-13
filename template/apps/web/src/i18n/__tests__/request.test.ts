import { beforeEach, describe, expect, it, vi } from "vitest";

const { localeMock } = vi.hoisted(() => ({ localeMock: vi.fn() }));

vi.mock("next/root-params", () => ({ locale: localeMock }));

// getRequestConfig is an identity wrapper, so the default export is the config factory itself.
vi.mock("next-intl/server", () => ({
  getRequestConfig: (factory: unknown) => factory,
}));

// The global setup mocks next-intl without hasLocale; restore the real one.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return { hasLocale: actual.hasLocale };
});

type ConfigFactory = (params: {
  locale?: string;
  requestLocale: Promise<string | undefined>;
}) => Promise<{ locale: string; messages: unknown }>;

async function loadFactory(): Promise<ConfigFactory> {
  const mod = await import("../request");
  return mod.default as unknown as ConfigFactory;
}

describe("i18n request config", () => {
  beforeEach(() => {
    localeMock.mockReset();
  });

  it("uses the root param locale", async () => {
    localeMock.mockResolvedValue("en");
    const factory = await loadFactory();

    const config = await factory({ requestLocale: Promise.resolve(undefined) });

    expect(localeMock).toHaveBeenCalled();
    expect(config.locale).toBe("en");
    expect(config.messages).toBeDefined();
  });

  it("honours an explicit locale override", async () => {
    localeMock.mockResolvedValue("xx");
    const factory = await loadFactory();

    const config = await factory({ locale: "en", requestLocale: Promise.resolve("yy") });

    expect(localeMock).not.toHaveBeenCalled();
    expect(config.locale).toBe("en");
  });

  it("falls back to requestLocale when root params are unavailable", async () => {
    localeMock.mockRejectedValue(new Error("root params are not available in Server Actions"));
    const factory = await loadFactory();

    const config = await factory({ requestLocale: Promise.resolve("en") });

    expect(localeMock).toHaveBeenCalled();
    expect(config.locale).toBe("en");
  });

  it("falls back to the default for an unknown locale", async () => {
    localeMock.mockResolvedValue("zz");
    const factory = await loadFactory();

    const config = await factory({ requestLocale: Promise.resolve("qq") });

    expect(config.locale).toBe("en");
  });
});
