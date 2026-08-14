import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { locales, defaultLocale, isSupportedLocale, type Locale } from "@/lib/i18n";

describe("i18n utilities", () => {
  it("should export supported locales", () => {
    expect(locales).toEqual(["en", "el", "fr", "de"]);
  });

  it("should have en as default locale", () => {
    expect(defaultLocale).toBe("en");
  });

  it("should validate supported locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("el")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(true);
    expect(isSupportedLocale("de")).toBe(true);
  });

  it("should reject unsupported locales", () => {
    expect(isSupportedLocale("es")).toBe(false);
    expect(isSupportedLocale("invalid")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });

  it("should type-check locale values", () => {
    const validLocale: Locale = "en";
    const anotherValid: Locale = "el";
    const another: Locale = "fr";
    const german: Locale = "de";

    expect(validLocale).toBeDefined();
    expect(anotherValid).toBeDefined();
    expect(another).toBeDefined();
    expect(german).toBeDefined();
  });

  it("should have consistent locale definitions", () => {
    locales.forEach((locale) => {
      expect(isSupportedLocale(locale)).toBe(true);
    });
  });

  it("loads next-intl messages from static locale JSON (no Turbopack dynamic import)", () => {
    const source = readFileSync(resolve(__dirname, "../src/i18n/request.ts"), "utf-8");
    expect(source).toContain('from "@/lib/i18n"');
    expect(source).not.toMatch(/import\(\s*["'][^"']*locales\/[^"']+\.json["']\s*\)/);
  });
});
