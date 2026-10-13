import { beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/config/env", () => ({ ENV: { APP_URL: "https://app.example" } }));

import { generateSpecificMetadata } from "@/utils/metadata";

describe("generateSpecificMetadata", () => {
  beforeEach(() => {
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers({ "x-full-url": "https://app.example/en/from-header" }));
  });

  it("path given → url is APP_URL + path and headers() is not called", async () => {
    const metadata = await generateSpecificMetadata({ title: "Waitlist", path: "/waitlist" });

    expect(headersMock).not.toHaveBeenCalled();
    expect(metadata.openGraph?.url).toBe("https://app.example/waitlist");
    expect(metadata.alternates?.canonical).toBe("https://app.example/waitlist");
  });

  it("path omitted → url comes from x-full-url", async () => {
    const metadata = await generateSpecificMetadata({ title: "Waitlist" });

    expect(headersMock).toHaveBeenCalledTimes(1);
    expect(metadata.openGraph?.url).toBe("https://app.example/en/from-header");
    expect(metadata.alternates?.canonical).toBe("https://app.example/en/from-header");
  });
});
