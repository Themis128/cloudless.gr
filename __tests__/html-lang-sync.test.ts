import { describe, expect, it } from "vitest";
import { localeFromPathname } from "@/lib/locale-from-pathname";

describe("localeFromPathname", () => {
  it("reads the locale prefix", () => {
    expect(localeFromPathname("/el/services")).toBe("el");
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/fr/store/srv-cloud")).toBe("fr");
  });

  it("returns null when the first segment is not a locale", () => {
    expect(localeFromPathname("/store")).toBeNull();
    expect(localeFromPathname("/")).toBeNull();
  });
});
