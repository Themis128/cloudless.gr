import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import el from "@/locales/el.json";
import fr from "@/locales/fr.json";

function collectLeafKeys(
  value: unknown,
  parent = "",
  target: string[] = [],
): string[] {
  if (value === null || value === undefined) {
    return target;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    if (parent) {
      target.push(parent);
    }
    return target;
  }

  for (const [key, nested] of Object.entries(value)) {
    const next = parent ? `${parent}.${key}` : key;
    collectLeafKeys(nested, next, target);
  }

  return target;
}

function missingKeys(from: Record<string, unknown>, to: Record<string, unknown>) {
  const a = new Set(collectLeafKeys(from));
  const b = new Set(collectLeafKeys(to));
  return [...a].filter((key) => !b.has(key));
}

describe("locale dictionaries parity", () => {
  it("keeps en, el, fr translation key sets aligned", () => {
    const missingInEl = missingKeys(en as Record<string, unknown>, el as Record<string, unknown>);
    const missingInFr = missingKeys(en as Record<string, unknown>, fr as Record<string, unknown>);
    const extraInEl = missingKeys(el as Record<string, unknown>, en as Record<string, unknown>);
    const extraInFr = missingKeys(fr as Record<string, unknown>, en as Record<string, unknown>);

    expect(missingInEl).toEqual([]);
    expect(missingInFr).toEqual([]);
    expect(extraInEl).toEqual([]);
    expect(extraInFr).toEqual([]);
  });

  it("includes critical sections for legal, auth, and storefront flows", () => {
    for (const locale of [en, el, fr] as const) {
      expect(locale).toHaveProperty("legal.privacyTitle");
      expect(locale).toHaveProperty("legal.termsTitle");
      expect(locale).toHaveProperty("legal.cookiePolicyTitle");
      expect(locale).toHaveProperty("legal.refundTitle");

      expect(locale).toHaveProperty("auth.login");
      expect(locale).toHaveProperty("auth.signup");
      expect(locale).toHaveProperty("auth.forgotPassword");

      expect(locale).toHaveProperty("store.addToCart");
      expect(locale).toHaveProperty("cart.checkout");
      expect(locale).toHaveProperty("pwa.installTitle");
      expect(locale).toHaveProperty("cookies.settingsTitle");
    }
  });
});