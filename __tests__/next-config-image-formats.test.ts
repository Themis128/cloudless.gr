/**
 * Pin next.config.ts image-format ordering. Regression check for the
 * AVIF + WebP perf change — if a future commit drops AVIF or reorders
 * to put WebP first, served images get bigger and slower.
 *
 * This is a static source-file check because the alternative (importing
 * next.config.ts directly) requires the Next.js plugin chain (next-intl
 * wrapper, etc.) and adds runtime dependencies for a 1-line assertion.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CONFIG = resolve(__dirname, "../next.config.ts");
const source = readFileSync(CONFIG, "utf-8");

describe("next.config.ts — image format negotiation", () => {
  it("declares AVIF first, then WebP in images.formats", () => {
    // Match `formats: ["image/avif", "image/webp"]` allowing whitespace + smart quotes.
    expect(source).toMatch(/formats:\s*\[\s*["']image\/avif["']\s*,\s*["']image\/webp["']\s*\]/);
  });

  it("trimmed the 3840 deviceSize entry (one fewer optimizer pass per image)", () => {
    // Extract just the deviceSizes array literal — the doc comment above
    // it intentionally lists the default 8 entries (including 3840), so
    // we can't grep the whole file for "3840" — we have to look at the
    // actual code line.
    const m = /deviceSizes:\s*(\[[^\]]+\])/.exec(source);
    expect(m, "deviceSizes line not found in next.config.ts").toBeTruthy();
    const arrayLiteral = m![1];
    expect(arrayLiteral).toContain("640");
    expect(arrayLiteral).toContain("2048");
    expect(arrayLiteral, "3840 should be removed from deviceSizes").not.toContain("3840");
  });

  it("sets a long minimumCacheTTL on the optimizer", () => {
    expect(source).toMatch(/minimumCacheTTL:\s*60\s*\*\s*60\s*\*\s*24\s*\*\s*30/);
  });

  it("compress: true is explicit", () => {
    expect(source).toMatch(/compress:\s*true/);
  });

  it("poweredByHeader: false is explicit", () => {
    expect(source).toMatch(/poweredByHeader:\s*false/);
  });
});
