import { describe, it, expect } from "vitest";
import {
  locales,
  defaultLocale,
  localeLabels,
  isSupportedLocale,
  getMessages,
  translate,
  translateArray,
} from "@/lib/i18n";

describe("locales", () => {
  it("contains en and el", () => {
    expect(locales).toContain("en");
    expect(locales).toContain("el");
  });
});

describe("defaultLocale", () => {
  it("is 'en'", () => {
    expect(defaultLocale).toBe("en");
  });
});

describe("localeLabels", () => {
  it("has a label for every supported locale", () => {
    for (const locale of locales) {
      expect(typeof localeLabels[locale]).toBe("string");
      expect(localeLabels[locale].length).toBeGreaterThan(0);
    }
  });

  it("English label is 'English'", () => {
    expect(localeLabels.en).toBe("English");
  });
});

describe("isSupportedLocale", () => {
  it("returns true for supported locales", () => {
    for (const locale of locales) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
  });

  it("returns false for unknown locale", () => {
    expect(isSupportedLocale("zz")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });
});

describe("getMessages", () => {
  it("returns messages for English", () => {
    const msgs = getMessages("en");
    expect(typeof msgs).toBe("object");
    expect(msgs).not.toBeNull();
  });

  it("returns messages for Greek", () => {
    const msgs = getMessages("el");
    expect(typeof msgs).toBe("object");
    expect(msgs).not.toBeNull();
  });
});

describe("translate", () => {
  it("returns fallback for a non-existent key", () => {
    expect(translate("en", "nonexistent.key.here", "fallback")).toBe("fallback");
  });

  it("resolves nested keys in English messages", () => {
    const msgs = getMessages("en");
    // Find any top-level string key to verify resolution works
    const topKey = Object.keys(msgs).find((k) => {
      const val = (msgs as Record<string, unknown>)[k];
      return typeof val === "object" && val !== null;
    });
    if (!topKey) return; // skip if messages have no nested objects
    const nested = (msgs as Record<string, Record<string, unknown>>)[topKey];
    const nestedKey = Object.keys(nested).find((k) => typeof nested[k] === "string");
    if (!nestedKey) return;
    const result = translate("en", `${topKey}.${nestedKey}`, "fallback");
    expect(result).toBe(nested[nestedKey] as string);
  });
});

describe("translateArray", () => {
  it("returns fallback when key is missing", () => {
    expect(translateArray("en", "missing.array.key", ["a", "b"])).toEqual(["a", "b"]);
  });
});
