import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

describe("proxy config matcher", () => {
  it("excludes manifest, service worker and offline html from intl middleware", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("manifest\\.webmanifest");
    expect(matcher).toContain("sw\\.js");
    expect(matcher).toContain("offline\\.html");
  });

  it("excludes all Next.js internals from intl middleware", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("_next");
  });

  it("excludes common static file extensions", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("svg");
    expect(matcher).toContain("png");
    expect(matcher).toContain("html");
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

  it("covers /api/hubspot/ticket", () => {
    expect(proxySrc).toContain('"/api/hubspot/ticket"');
  });

  it("covers /api/crm/contact", () => {
    expect(proxySrc).toContain('"/api/crm/contact"');
  });

  it("has ADMIN_RATE_LIMIT for /api/admin/* routes", () => {
    expect(proxySrc).toContain("ADMIN_RATE_LIMIT");
    expect(proxySrc).toContain('startsWith("/api/admin/")');
  });
});
