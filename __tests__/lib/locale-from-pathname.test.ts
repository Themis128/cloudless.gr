import { describe, it, expect, vi } from "vitest";

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "el"] as const,
  },
}));

import { localeFromPathname } from "@/lib/locale-from-pathname";

describe("localeFromPathname", () => {
  it("returns 'en' for /en/services", () => {
    expect(localeFromPathname("/en/services")).toBe("en");
  });

  it("returns 'el' for /el/blog", () => {
    expect(localeFromPathname("/el/blog")).toBe("el");
  });

  it("returns null for a non-locale first segment", () => {
    expect(localeFromPathname("/admin/users")).toBeNull();
  });

  it("returns null for empty path", () => {
    expect(localeFromPathname("")).toBeNull();
  });

  it("returns null for bare /", () => {
    expect(localeFromPathname("/")).toBeNull();
  });

  it("returns the locale even without a trailing path", () => {
    expect(localeFromPathname("/en")).toBe("en");
  });
});
