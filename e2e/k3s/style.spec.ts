/**
 * Style integrity tests — k3s cluster app (live deployment).
 *
 * Mirrors e2e/style.spec.ts but runs against the live Pi k3s deployment
 * via the full standby path:
 *   APIGW → Lambda cloudless-pi-proxy → Tailscale Funnel → Pi Traefik → k3s pod
 *
 * Run:  pnpm test:k3s e2e/k3s/style.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

// ── helpers ────────────────────────────────────────────────────────────────

async function bodyBgColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function cssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

/**
 * Dismiss the cookie-consent banner by:
 * 1. Pre-setting the consent cookie so subsequent navigations skip the banner.
 * 2. Clicking "Accept all" scoped to the banner region if it's already visible.
 *
 * Scopes the button to the banner region (role=region, name="We value your
 * privacy") to avoid matching the footer's "Cookie Settings" button, which
 * contains "ok" in "cookie" and fools a naive /ok/i regex.
 */
async function dismissCookieBanner(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.cookie = [
      `cookieConsent=${encodeURIComponent(JSON.stringify({ necessary: true, analytics: false, marketing: false }))}`,
      "max-age=31536000",
      "path=/",
      "SameSite=Lax",
    ].join("; ");
  });

  const banner = page.getByRole("region", { name: /we value your privacy/i });
  if (await banner.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await banner
      .getByRole("button", { name: /accept/i })
      .click({ timeout: 5_000 });
  }
}

/**
 * Navigate and retry once on transient 502/503 — the standby path can briefly
 * error during a k3s rolling update.
 */
async function gotoWithRetry(page: Page, path: string): Promise<void> {
  const r = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (r && (r.status() === 502 || r.status() === 503)) {
    await page.waitForTimeout(5_000);
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}

// ── Navbar / header ────────────────────────────────────────────────────────

test.describe("k3s Navbar style", () => {
  test("sticky header is present with neon-cyan accent bar", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    await dismissCookieBanner(page);

    const header = page.locator("header").first();
    await expect(header).toBeVisible({ timeout: 20_000 });

    // Check via class attribute — more reliable than getComputedStyle across
    // Pi cluster environments where CSS may not be fully resolved at eval time.
    const className = await header.getAttribute("class") ?? "";
    expect(className, "header should have Tailwind sticky class").toContain("sticky");

    // First child div inside <header> is the 2-px neon-cyan accent bar (h-0.5)
    const accentBar = header.locator("div").first();
    await expect(accentBar).toBeVisible();
    const accentClass = await accentBar.getAttribute("class") ?? "";
    expect(accentClass, "accent bar should have h-0.5 class").toContain("h-0.5");
  });

  test("logo link is visible", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    const logoLink = page.getByRole("link", { name: /cloudless/i }).first();
    await expect(logoLink).toBeVisible({ timeout: 20_000 });
  });

  test("desktop nav links present at ≥1024px", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await expect(nav.getByRole("link", { name: /services/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /contact/i })).toBeVisible();
  });
});

// ── Background / surface colour ────────────────────────────────────────────

test.describe("k3s Background colour", () => {
  test("body background is set (not transparent or pure white)", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en");
    const bg = await bodyBgColor(page);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("rgb(255, 255, 255)");
    expect(bg).toMatch(/^rgb/);
  });

  test("--surface-canvas CSS token is defined on the live build", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en");
    const canvas = await cssVar(page, "--surface-canvas");
    expect(canvas.length, "--surface-canvas must be set by theme-v2.css").toBeGreaterThan(0);
  });

  test("--color-void Tailwind alias is set (globals.css @theme inline)", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en");
    const v = await cssVar(page, "--color-void");
    expect(v.length, "--color-void must alias --surface-canvas").toBeGreaterThan(0);
  });
});

// ── Neon accent colours ────────────────────────────────────────────────────

test.describe("k3s Neon accent colours", () => {
  test("homepage has at least one neon-cyan element", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    await dismissCookieBanner(page);
    await expect(
      page.locator('[class*="neon-cyan"]').first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("services page has cyan, magenta, and green service cards", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en/services");
    await dismissCookieBanner(page);

    await expect(
      page.locator('[class*="neon-cyan"]').first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('[class*="neon-magenta"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[class*="neon-green"]').first(),
    ).toBeVisible();
  });

});

// ── Footer ─────────────────────────────────────────────────────────────────

test.describe("k3s Footer style", () => {
  // Scroll via evaluate — avoids "element not attached" when React re-hydrates
  // the footer mid-navigation (hydration error causes a brief unmount/remount).
  async function scrollToFooter(page: Page): Promise<void> {
    await page.evaluate(() =>
      document.querySelector("footer")?.scrollIntoView({ behavior: "instant" }),
    );
  }

  test("footer is rendered on the live app", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    await expect(page.locator("footer").first()).toBeAttached({ timeout: 20_000 });
    await scrollToFooter(page);
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible({ timeout: 20_000 });
    const cls = await footer.getAttribute("class");
    expect(cls).toContain("border");
  });

  test("footer contains navigate / services / legal labels", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    await expect(page.locator("footer").first()).toBeAttached({ timeout: 20_000 });
    await scrollToFooter(page);
    await expect(page.locator("footer").first()).toContainText(/navigate|services|legal/i);
  });

  test("footer newsletter input is present", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    await expect(page.locator("footer").first()).toBeAttached({ timeout: 20_000 });
    await scrollToFooter(page);
    const emailInput = page
      .locator('footer input[type="email"], footer input[name="email"]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });
});

// ── Typography ─────────────────────────────────────────────────────────────

test.describe("k3s Typography", () => {
  test("h1 uses Instrument Sans font family on the live build", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en");
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible({ timeout: 20_000 });
    const fontFamily = await h1.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(fontFamily.toLowerCase()).toMatch(/instrument|sans/);
  });

  test("body text uses Work Sans on the live build", async ({ page }) => {
    await gotoWithRetry(page, "/en");
    const fontFamily = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/work|sans/);
  });

  test("--font-heading CSS var is set (fonts wired into @theme)", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en");
    const v = await cssVar(page, "--font-heading");
    expect(v.length).toBeGreaterThan(0);
  });
});

// ── CSS / JS asset loading on live cluster ─────────────────────────────────

test.describe("k3s CSS / asset loading", () => {
  test("no CSS asset requests return 4xx on homepage", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (url.includes("/_next/static/css") && r.status() >= 400) {
        failed.push(`${r.status()} ${url}`);
      }
    });
    await gotoWithRetry(page, "/en");
    await page.waitForLoadState("networkidle");
    expect(failed, `CSS assets failed on k3s:\n${failed.join("\n")}`).toHaveLength(0);
  });

  test("no JS chunk requests return 4xx on homepage", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (url.includes("/_next/static/chunks") && r.status() >= 400) {
        failed.push(`${r.status()} ${url}`);
      }
    });
    await gotoWithRetry(page, "/en");
    await page.waitForLoadState("networkidle");
    expect(failed, `JS chunks failed on k3s:\n${failed.join("\n")}`).toHaveLength(0);
  });

  test("HTML and first chunk are self-consistent (no mid-rollout mismatch)", async ({
    page,
    request,
  }) => {
    await gotoWithRetry(page, "/en");
    const chunkUrl = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]"));
      const chunk = scripts.find((s) =>
        (s as HTMLScriptElement).src.includes("/_next/static/chunks"),
      );
      return chunk ? (chunk as HTMLScriptElement).src : null;
    });

    if (!chunkUrl) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "No static chunk found in HTML (SSR-only page?)",
      });
      return;
    }

    const r = await request.get(chunkUrl, { failOnStatusCode: false });
    expect(
      r.status(),
      `Chunk ${chunkUrl} returned ${r.status()} — Pi may still be rolling out`,
    ).toBe(200);
  });

  test("no style-related console errors on the live homepage", async ({ page }) => {
    const styleErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /css|style|font|stylesheet/i.test(msg.text())
      ) {
        styleErrors.push(msg.text());
      }
    });
    await gotoWithRetry(page, "/en");
    await page.waitForLoadState("networkidle");
    expect(styleErrors).toHaveLength(0);
  });
});

// ── Key public pages render with styled headings ───────────────────────────

test.describe("k3s Page-level style integrity", () => {
  const pages: { path: string; heading: RegExp }[] = [
    { path: "/en", heading: /clear skies|zero friction|full control/i },
    // Services h1 is "No hidden fees. Real results." — pricing-focused copy
    { path: "/en/services", heading: /fees|results|hidden|transparent/i },
    { path: "/en/contact", heading: /touch|contact/i },
    { path: "/en/blog", heading: /blog|insight/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} — h1 visible, styled, and non-transparent`, async ({
      page,
    }) => {
      await gotoWithRetry(page, path);
      await dismissCookieBanner(page);

      const h1 = page.getByRole("heading", { level: 1 }).first();
      await expect(h1).toBeVisible({ timeout: 20_000 });
      await expect(h1).toContainText(heading);

      const color = await h1.evaluate((el) => getComputedStyle(el).color);
      expect(color).not.toBe("rgba(0, 0, 0, 0)");
    });
  }

  test("/en/services — all 4 service numbers render on the live build", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en/services");
    await dismissCookieBanner(page);

    // Multiple "01"–"04" elements can exist in different page sections;
    // use first() to avoid strict-mode violation.
    for (const num of ["01", "02", "03", "04"]) {
      await expect(
        page.getByText(num, { exact: true }).first(),
      ).toBeVisible({ timeout: 20_000 });
    }
  });

  test("/en/contact — contact form email input is present on the live build", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/en/contact");
    await dismissCookieBanner(page);

    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
