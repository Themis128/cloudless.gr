import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/about",
}));

import { readLocaleFromCookie, setAppLocale } from "@/lib/use-locale";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readLocaleFromCookie", () => {
  it("returns 'en' when document is undefined (SSR)", () => {
    const orig = globalThis.document;
    Object.defineProperty(globalThis, "document", { value: undefined, configurable: true });
    expect(readLocaleFromCookie()).toBe("en");
    Object.defineProperty(globalThis, "document", { value: orig, configurable: true });
  });

  it("returns defaultLocale when cookie is missing", () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "" },
      configurable: true,
    });
    expect(readLocaleFromCookie()).toBe("en");
  });

  it("returns locale from NEXT_LOCALE cookie when valid", () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "NEXT_LOCALE=el; other=value" },
      configurable: true,
    });
    expect(readLocaleFromCookie()).toBe("el");
  });

  it("returns defaultLocale when NEXT_LOCALE is an unsupported locale", () => {
    Object.defineProperty(globalThis, "document", {
      value: { cookie: "NEXT_LOCALE=zz" },
      configurable: true,
    });
    expect(readLocaleFromCookie()).toBe("en");
  });
});

describe("setAppLocale", () => {
  it("is a no-op and does not throw", () => {
    expect(() => setAppLocale("el")).not.toThrow();
    expect(() => setAppLocale("en")).not.toThrow();
  });
});
