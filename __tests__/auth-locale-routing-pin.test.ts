/**
 * Pin the `[locale]` vs `/api/auth/*` routing split.
 *
 * Turbopack can bind `/api/auth/session` as locale=`api` (HTML 404) instead of
 * the D1 session handler. The identity beforeFiles rewrite claims `/api`, and
 * `dynamicParams = false` on the locale layout rejects unknown locale segments.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

describe("auth vs [locale] routing pins", () => {
  it("claims /api/* in next.config.ts beforeFiles before [locale] matching", () => {
    const source = readFileSync(resolve(ROOT, "next.config.ts"), "utf-8");
    expect(source).toMatch(
      /source:\s*["']\/api\/:path\*["']\s*,\s*destination:\s*["']\/api\/:path\*["']/
    );
  });

  it("rejects unknown [locale] segments (dynamicParams = false)", () => {
    const source = readFileSync(
      resolve(ROOT, "src/app/[locale]/layout.tsx"),
      "utf-8"
    );
    expect(source).toMatch(/export const dynamicParams = false/);
  });
});
