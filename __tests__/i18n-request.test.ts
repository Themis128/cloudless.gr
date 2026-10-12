/**
 * src/i18n/request.ts — getRequestConfig callback resolves supported,
 * unsupported, and missing requestLocales against real locale messages.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

describe("i18n request config", () => {
  it("resolves supported, unsupported, and missing locales", async () => {
    const { default: config } = await import("@/i18n/request");
    const fn = config as unknown as (args: {
      requestLocale: Promise<string | undefined>;
    }) => Promise<{ locale: string; messages: unknown }>;

    const el = await fn({ requestLocale: Promise.resolve("el") });
    expect(el.locale).toBe("el");
    expect(el.messages).toBeTruthy();

    const bad = await fn({ requestLocale: Promise.resolve("xx") });
    expect(bad.locale).toBe("en");

    const missing = await fn({ requestLocale: Promise.resolve(undefined) });
    expect(missing.locale).toBe("en");
  });
});
