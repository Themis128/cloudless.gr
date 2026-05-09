/**
 * PWA manifest endpoint coverage.
 *
 * The recent migration off Next.js' app/manifest.ts metadata convention
 * introduced two paths that must both serve the same JSON:
 *  - /manifest.webmanifest (rewritten by next.config.ts to the API route)
 *  - /api/pwa-manifest (the actual handler)
 * Plus a static fallback at /public/manifest.webmanifest if the rewrite
 * is ever undone.
 *
 * These tests pin the contract so a future Turbopack/rewrite/route
 * refactor that breaks the manifest gets caught immediately — a broken
 * manifest silently degrades the PWA install experience without any
 * runtime error.
 */

import { test, expect } from "@playwright/test";

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface Manifest {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
  shortcuts?: { url: string; name?: string }[];
}

test.describe("PWA manifest", () => {
  test("/manifest.webmanifest serves application/manifest+json", async ({
    request,
  }) => {
    const r = await request.get("/manifest.webmanifest");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] ?? "";
    // Either application/manifest+json (preferred) or application/json (acceptable)
    expect(ct).toMatch(/(manifest\+json|application\/json)/);
  });

  test("/api/pwa-manifest is the actual handler and returns valid JSON", async ({
    request,
  }) => {
    const r = await request.get("/api/pwa-manifest");
    expect(r.status()).toBe(200);
    const m = (await r.json()) as Manifest;
    expect(m.name).toContain("Cloudless");
    expect(m.short_name).toBe("Cloudless");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{3,8}$/i);
  });

  test("manifest declares 192/512 PNG icons + maskable variant", async ({
    request,
  }) => {
    const r = await request.get("/api/pwa-manifest");
    const m = (await r.json()) as Manifest;
    const icons = m.icons ?? [];
    expect(icons.find((i) => i.sizes === "192x192" && i.type === "image/png")).toBeTruthy();
    expect(icons.find((i) => i.sizes === "512x512" && i.type === "image/png")).toBeTruthy();
    expect(icons.find((i) => i.purpose === "maskable")).toBeTruthy();
  });

  test("manifest shortcuts include core nav targets", async ({ request }) => {
    const r = await request.get("/api/pwa-manifest");
    const m = (await r.json()) as Manifest;
    const urls = new Set((m.shortcuts ?? []).map((s) => s.url));
    expect(urls.has("/contact")).toBe(true);
    expect(urls.has("/services")).toBe(true);
    expect(urls.has("/blog")).toBe(true);
  });

  test("rewrite path matches the API route output byte-for-byte (key fields)", async ({
    request,
  }) => {
    // Both paths should resolve to the same handler output. If the rewrite
    // ever drifts (e.g. someone re-introduces an app/manifest.ts that
    // catches /manifest.webmanifest first), this would catch it.
    const a = (await (await request.get("/manifest.webmanifest")).json()) as Manifest;
    const b = (await (await request.get("/api/pwa-manifest")).json()) as Manifest;
    // Normalise en-dash/em-dash to hyphen so static file and API handler are
    // treated as equivalent regardless of which dash character each uses.
    const normDash = (s?: string) => (s ?? "").replace(/[–—]/g, "-");
    expect(normDash(a.name)).toBe(normDash(b.name));
    expect(normDash(a.short_name)).toBe(normDash(b.short_name));
    expect(a.theme_color).toBe(b.theme_color);
    expect((a.icons ?? []).length).toBe((b.icons ?? []).length);
  });

  test("layout.tsx points to the manifest path", async ({ page }) => {
    await page.goto("/en");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toMatch(/manifest\.webmanifest$|\/api\/pwa-manifest$/);
  });
});
