import { describe, it, expect, vi } from "vitest";

const { mockGetLocale } = vi.hoisted(() => ({
  mockGetLocale: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getLocale: mockGetLocale,
}));

import { getServerLocale } from "@/lib/server-locale";

describe("getServerLocale", () => {
  it("returns locale from next-intl when valid", async () => {
    mockGetLocale.mockResolvedValue("el");
    const locale = await getServerLocale();
    expect(locale).toBe("el");
  });

  it("returns defaultLocale when next-intl returns unsupported locale", async () => {
    mockGetLocale.mockResolvedValue("zz");
    const locale = await getServerLocale();
    expect(locale).toBe("en");
  });

  it("returns defaultLocale when next-intl throws (outside middleware context)", async () => {
    mockGetLocale.mockRejectedValue(new Error("No context"));
    const locale = await getServerLocale();
    expect(locale).toBe("en");
  });
});
