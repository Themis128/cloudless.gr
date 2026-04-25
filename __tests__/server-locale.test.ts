import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetLocale = vi.fn();

vi.mock("next-intl/server", () => ({
  getLocale: () => mockGetLocale(),
}));

vi.mock("@/lib/i18n", () => ({
  defaultLocale: "en",
  isSupportedLocale: (l: string) => ["en", "el"].includes(l),
}));

describe("server-locale.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the locale from next-intl when it is supported", async () => {
    mockGetLocale.mockResolvedValueOnce("el");
    const { getServerLocale } = await import("@/lib/server-locale");
    const locale = await getServerLocale();
    expect(locale).toBe("el");
  });

  it("returns defaultLocale when next-intl returns an unsupported locale", async () => {
    mockGetLocale.mockResolvedValueOnce("zh");
    const { getServerLocale } = await import("@/lib/server-locale");
    const locale = await getServerLocale();
    expect(locale).toBe("en");
  });

  it("returns defaultLocale when getLocale throws (outside middleware context)", async () => {
    mockGetLocale.mockRejectedValueOnce(new Error("No request context"));
    const { getServerLocale } = await import("@/lib/server-locale");
    const locale = await getServerLocale();
    expect(locale).toBe("en");
  });
});
