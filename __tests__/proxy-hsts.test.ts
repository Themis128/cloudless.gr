/**
 * Pin the HSTS header value in src/proxy.ts to be preload-list eligible.
 *
 * The hstspreload.org submission requirements are:
 *   - max-age >= 31536000 (1 year)
 *   - includeSubDomains
 *   - preload
 *   - HTTPS-only and HTTP→HTTPS redirect
 *
 * If a future commit lowers max-age or removes a directive, this test
 * fails immediately — preload submissions can't be reverted, and a
 * weakened HSTS quietly breaks "should browsers force HTTPS forever" by
 * months until the cached value expires.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PROXY = resolve(__dirname, "../src/proxy.ts");
const source = readFileSync(PROXY, "utf-8");

describe("proxy.ts HSTS header — preload eligibility", () => {
  // Match the .set("Strict-Transport-Security", "...") call's value string.
  const m = /Strict-Transport-Security['"]\s*,\s*['"`]([^'"`]+)['"`]/i.exec(source);

  it("Strict-Transport-Security is set", () => {
    expect(m, "no Strict-Transport-Security header found in proxy.ts").toBeTruthy();
  });

  const hsts = m?.[1] ?? "";

  it("max-age >= 1 year (31_536_000s)", () => {
    const ma = /max-age=(\d+)/.exec(hsts);
    expect(ma, "no max-age in HSTS").toBeTruthy();
    expect(Number(ma![1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it("includes 'includeSubDomains'", () => {
    expect(hsts).toMatch(/includeSubDomains/);
  });

  it("includes 'preload'", () => {
    expect(hsts).toMatch(/preload/);
  });
});

describe("proxy.ts HTTP→HTTPS redirect (preload prerequisite)", () => {
  it("redirects production HTTP traffic to HTTPS", () => {
    // The actual middleware code that does the upgrade must be present.
    expect(source).toMatch(/x-forwarded-proto/);
    expect(source).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]production['"]/);
  });
});