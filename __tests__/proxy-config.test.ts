import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

describe("proxy config matcher", () => {
  it("excludes manifest, service worker and offline html from intl middleware", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("manifest\\.webmanifest");
    expect(matcher).toContain("sw\\.js");
    expect(matcher).toContain("offline\\.html");
  });

  it("excludes /_next/static and /_next/image as separate alternatives", () => {
    // Regression: `_next/static/_next/image` (missing `|`) lets locale
    // middleware 307 `/_next/static/*.css` → `/en/_next/static/...` (HTML 404).
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("_next/static|_next/image");
    expect(matcher).not.toContain("_next/static/_next/image");
  });

  it("excludes common static file extensions", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("svg");
    expect(matcher).toContain("png");
    expect(matcher).toContain("html");
  });

  it("excludes static assets in subdirectories (e.g. /icons/*.png)", () => {
    // Regression: `[^/]+\.ext` could not see past the `/` separator, so
    // /icons/icon-192.png ran the middleware. The /_next/image optimizer's
    // headerless mock request then hit the prod 308 redirect, received an
    // HTML body and every optimized image 400'd "isn't a valid image".
    const matcher = config.matcher?.[0] ?? "";
    const re = new RegExp(matcher);
    expect(re.test("/icons/icon-192.png")).toBe(false);
    expect(re.test("/icons/deep/dir/logo.svg")).toBe(false);
    expect(re.test("/favicon.ico")).toBe(false);
    expect(re.test("/en")).toBe(true);
    expect(re.test("/en/pricing")).toBe(true);
    expect(re.test("/api/users")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proxy RATE_LIMITS coverage
// Verify that every mutation endpoint that accepts untrusted POST input
// is listed in the RATE_LIMITS map so the middleware enforces throttling.
// ---------------------------------------------------------------------------

// Read proxy source to verify RATE_LIMITS entries without running middleware.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const proxySrc = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf-8");

describe("proxy RATE_LIMITS", () => {
  it("covers /api/contact", () => {
    expect(proxySrc).toContain('"/api/contact"');
  });

  it("covers /api/subscribe", () => {
    expect(proxySrc).toContain('"/api/subscribe"');
  });

  it("covers /api/unsubscribe", () => {
    expect(proxySrc).toContain('"/api/unsubscribe"');
  });

  it("covers /api/checkout", () => {
    expect(proxySrc).toContain('"/api/checkout"');
  });

  it("covers /api/calendar/book", () => {
    expect(proxySrc).toContain('"/api/calendar/book"');
  });

  it("covers /api/crm/contact", () => {
    expect(proxySrc).toContain('"/api/crm/contact"');
  });

  it("has ADMIN_RATE_LIMIT for /api/admin/* routes", () => {
    expect(proxySrc).toContain("ADMIN_RATE_LIMIT");
    expect(proxySrc).toContain('startsWith("/api/admin/")');
  });
});
