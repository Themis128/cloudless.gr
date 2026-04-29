import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

const ROOT = path.resolve("src", "app");
const LOCALE_ROOT = path.join(ROOT, "[locale]");

const REQUIRED_ROUTE_FILES = [
  "layout.tsx",
  "page.tsx",
  path.join("services", "page.tsx"),
  path.join("contact", "page.tsx"),
  path.join("store", "page.tsx"),
  path.join("blog", "page.tsx"),
  path.join("auth", "login", "page.tsx"),
  path.join("auth", "signup", "page.tsx"),
  path.join("auth", "forgot-password", "page.tsx"),
  path.join("dashboard", "page.tsx"),
  path.join("admin", "page.tsx"),
  path.join("privacy", "page.tsx"),
  path.join("terms", "page.tsx"),
  path.join("cookies", "page.tsx"),
  path.join("refund", "page.tsx"),
];

describe("locale route smoke coverage", () => {
  it("keeps next-intl locale contract stable", () => {
    expect(routing.locales).toEqual(["en", "el", "fr", "de"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("always");
  });

  it("contains all key locale route group page files", () => {
    for (const relativeFile of REQUIRED_ROUTE_FILES) {
      const fullPath = path.join(LOCALE_ROOT, relativeFile);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  it("keeps root redirect wrappers for default-locale UX", () => {
    expect(existsSync(path.join(ROOT, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(ROOT, "services", "page.tsx"))).toBe(true);
  });
});
