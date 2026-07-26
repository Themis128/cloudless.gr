import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUseLocale = vi.fn();
const mockReplace = vi.fn();
const mockUseRouter = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => mockUseLocale(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/lib/i18n", () => ({
  defaultLocale: "en",
  isSupportedLocale: (l: string) => ["en", "el"].includes(l),
}));

describe("use-locale.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocale.mockReturnValue("en");
    mockUseRouter.mockReturnValue({ replace: mockReplace });
    mockUsePathname.mockReturnValue("/about");
    document.cookie = "NEXT_LOCALE=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
  });

  describe("useCurrentLocale()", () => {
    it("returns locale from useLocale()", async () => {
      mockUseLocale.mockReturnValue("el");
      const { useCurrentLocale } = await import("@/lib/use-locale");
      const { result } = renderHook(() => useCurrentLocale());
      expect(result.current[0]).toBe("el");
    });

    it("returns [locale, setLocale] tuple", async () => {
      const { useCurrentLocale } = await import("@/lib/use-locale");
      const { result } = renderHook(() => useCurrentLocale());
      expect(Array.isArray(result.current)).toBe(true);
      expect(typeof result.current[1]).toBe("function");
    });

    it("setLocale calls router.replace with new locale and current pathname", async () => {
      const { useCurrentLocale } = await import("@/lib/use-locale");
      const { result } = renderHook(() => useCurrentLocale());
      act(() => {
        result.current[1]("el");
      });
      expect(mockReplace).toHaveBeenCalledWith("/about", { locale: "el" });
    });
  });

  describe("readLocaleFromCookie()", () => {
    it("returns supported locale from NEXT_LOCALE cookie", async () => {
      document.cookie = "NEXT_LOCALE=el";
      const { readLocaleFromCookie } = await import("@/lib/use-locale");
      expect(readLocaleFromCookie()).toBe("el");
    });

    it("returns defaultLocale when NEXT_LOCALE is unsupported", async () => {
      document.cookie = "NEXT_LOCALE=zh";
      const { readLocaleFromCookie } = await import("@/lib/use-locale");
      expect(readLocaleFromCookie()).toBe("en");
    });

    it("returns defaultLocale when NEXT_LOCALE cookie is absent", async () => {
      const { readLocaleFromCookie } = await import("@/lib/use-locale");
      expect(readLocaleFromCookie()).toBe("en");
    });
  });

  describe("setAppLocale()", () => {
    it("is a no-op and does not throw", async () => {
      const { setAppLocale } = await import("@/lib/use-locale");
      expect(() => setAppLocale("el")).not.toThrow();
    });
  });
});
