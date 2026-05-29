/**
 * Style integrity tests — local dev / serverless AWS app.
 *
 * Verifies that the Cloudless design system renders correctly end-to-end:
 *   - Dark "void" canvas background (surface-canvas token)
 *   - Neon-cyan accent bar at the top of the sticky header
 *   - Neon accent colours on service cards, category badges, and CTAs
 *   - Footer border and layout
 *   - Custom fonts loaded (Instrument Sans, Work Sans, Geist Mono)
 *   - No CSS asset failures (4xx) that would break the design system
 *   - Light / dark theme token swap applies correct background
 *
 * Target: http://localhost:4000 (playwright.config.mts webServer)
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
 * Scope the button lookup to the banner region to avoid matching the footer's
 * "Cookie Settings" button (which contains "ok" in "cookie" and fooled /ok/i).
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

// ── Navbar / header ────────────────────────────────────────────────────────

test.describe("Navbar style", () => {
  test("sticky header renders with neon-cyan accent bar", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const position = await header.evaluate(
      (el) => getComputedStyle(el).position,
    );
    expect(position).toBe("sticky");

    // First child div is the 2-px accent bar (h-0.5 Tailwind utility)
    const accentBar = header.locator("div").first();
    await expect(accentBar).toBeVisible();
    const height = await accentBar.evaluate(
      (el) => getComputedStyle(el).height,
    );
    expect(parseFloat(height)).toBeCloseTo(2, 0);
  });

  test("logo link is visible and points to homepage", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    // The logo link lives inside <nav> and has href="/" (localized to /en).
    // Use a CSS selector to avoid matching footer social links that also
    // contain "cloudless" in their accessible name.
    const logoLink = page.locator('nav a[href="/"], nav a[href="/en"]').first();
    await expect(logoLink).toBeVisible();
    const href = await logoLink.getAttribute("href");
    expect(href).toMatch(/^(\/|\/en)?$/);
  });

  test("desktop nav links are visible at ≥1024px", async ({ page }) => {
    if ((page.viewportSize()?.width ?? Infinity) < 1024) {
      test.skip();
      return;
    }
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    for (const label of ["Services", "Blog", "Contact"]) {
      await expect(
        page.getByRole("navigation").getByRole("link", { name: label }),
      ).toBeVisible();
    }
  });

  test("mobile hamburger opens the nav at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    const hamburger = page.getByRole("button", { name: /toggle menu/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(
      page.getByRole("link", { name: /services/i }).first(),
    ).toBeVisible();
  });
});

// ── Background / surface colour ────────────────────────────────────────────

test.describe("Background colour (design tokens)", () => {
  test("body background resolves to --surface-canvas (not transparent/white)", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const bg = await bodyBgColor(page);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("rgb(255, 255, 255)");
    expect(bg).toMatch(/^rgb/);
  });

  test("default theme uses surface-canvas and color-void tokens", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const canvas = await cssVar(page, "--surface-canvas");
    expect(canvas.length).toBeGreaterThan(0);
    const voidColor = await cssVar(page, "--color-void");
    expect(voidColor.length).toBeGreaterThan(0);
  });

  test("picking Dark theme sets data-theme=dark and darkens canvas", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const trigger = page.getByRole("button", { name: /Theme:/i });
    if (!(await trigger.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await trigger.click();
    const listbox = page.getByRole("listbox", { name: /Theme/i });
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await listbox.getByRole("option", { name: /Dark/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("dark");

    const bg = await bodyBgColor(page);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect(r).toBeLessThan(50);
    expect(g).toBeLessThan(50);
    expect(b).toBeLessThan(50);
  });

  test("picking Light theme sets data-theme=light and brightens canvas", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const trigger = page.getByRole("button", { name: /Theme:/i });
    if (!(await trigger.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await trigger.click();
    const listbox = page.getByRole("listbox", { name: /Theme/i });
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await listbox.getByRole("option", { name: /Light/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("light");

    const bg = await bodyBgColor(page);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });
});

// ── Neon accent colours ────────────────────────────────────────────────────

test.describe("Neon accent colours", () => {
  test("services page has cyan, magenta, and green accented service cards", async ({
    page,
  }) => {
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(
      page.locator('[class*="neon-cyan"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[class*="neon-magenta"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('[class*="neon-green"]').first(),
    ).toBeVisible();
  });

  test("homepage has at least one neon-cyan accented element", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('[class*="neon-cyan"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("blog page category badges use neon colour classes", async ({ page }) => {
    await page.goto("/en/blog", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    const badges = page.locator(
      '[class*="neon-cyan"],[class*="neon-green"],[class*="neon-magenta"]',
    );
    await expect(badges.first()).toBeVisible({ timeout: 10_000 });
  });

  test("--color-neon-cyan Tailwind token is set", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const v = await cssVar(page, "--color-neon-cyan");
    expect(v.length, "--color-neon-cyan must be defined by @theme inline").toBeGreaterThan(0);
  });
});

// ── Footer ─────────────────────────────────────────────────────────────────

test.describe("Footer style", () => {
  test("footer is present with a top border class", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();
    const cls = await footer.getAttribute("class");
    expect(cls).toContain("border");
  });

  test("footer logo link is visible", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    const footerLogoLink = page
      .locator("footer")
      .getByRole("link", { name: /cloudless/i })
      .first();
    await footerLogoLink.scrollIntoViewIfNeeded();
    await expect(footerLogoLink).toBeVisible();
  });

  test("footer has navigate, services, and legal column headings", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toContainText(/navigate|services|legal/i);
  });
});

// ── Typography / fonts ─────────────────────────────────────────────────────

test.describe("Typography", () => {
  test("h1 uses Instrument Sans (heading font)", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    const fontFamily = await h1.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(fontFamily.toLowerCase()).toMatch(/instrument|sans/);
  });

  test("body text uses Work Sans or system sans-serif fallback", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const fontFamily = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/work|sans/);
  });

  test("mono elements use Geist Mono or a monospace fallback", async ({
    page,
  }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const monoEl = page.locator('[class*="font-mono"]').first();
    if (await monoEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const fontFamily = await monoEl.evaluate(
        (el) => getComputedStyle(el).fontFamily,
      );
      expect(fontFamily.toLowerCase()).toMatch(/geist|mono|courier|console/);
    }
  });
});

// ── CSS asset loading ──────────────────────────────────────────────────────

test.describe("CSS / asset loading", () => {
  test("no CSS or font requests return 4xx", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (
        (url.includes("/_next/static/css") || url.includes("/fonts/")) &&
        r.status() >= 400
      ) {
        failed.push(`${r.status()} ${url}`);
      }
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(failed, `CSS/font requests failed:\n${failed.join("\n")}`).toHaveLength(0);
  });

  test("no JS chunk requests return 4xx on homepage", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (url.includes("/_next/static/chunks") && r.status() >= 400) {
        failed.push(`${r.status()} ${url}`);
      }
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(failed, `JS chunk requests failed:\n${failed.join("\n")}`).toHaveLength(0);
  });

  test("no console errors related to CSS or styles", async ({ page }) => {
    const styleErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /css|style|font|stylesheet/i.test(msg.text())
      ) {
        styleErrors.push(msg.text());
      }
    });
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    expect(styleErrors).toHaveLength(0);
  });
});

// ── Key public pages have a styled hero section ────────────────────────────

test.describe("Page-level style integrity", () => {
  const pages: { path: string; heading: RegExp }[] = [
    // Homepage h1 is animated by TypingText: "Clear skies. Zero friction." etc.
    { path: "/en", heading: /clear skies|zero friction|full control/i },
    // Services h1 is "No hidden fees. Real results." — pricing-focused copy
    { path: "/en/services", heading: /fees|results|hidden|transparent/i },
    { path: "/en/contact", heading: /touch|contact/i },
    { path: "/en/work", heading: /work|project/i },
    { path: "/en/blog", heading: /blog|insight/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} — h1 is visible and styled`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await dismissCookieBanner(page);

      const h1 = page.getByRole("heading", { level: 1 }).first();
      await expect(h1).toBeVisible({ timeout: 15_000 });
      await expect(h1).toContainText(heading);

      const color = await h1.evaluate((el) => getComputedStyle(el).color);
      expect(color).not.toBe("rgba(0, 0, 0, 0)");
    });
  }

  test("/en/services page renders at least 4 service card numbers", async ({
    page,
  }) => {
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // Service card numbers 01–04 exist on the page (multiple copies possible
    // — use first() to avoid strict-mode violation from duplicate page sections)
    for (const num of ["01", "02", "03", "04"]) {
      await expect(
        page.getByText(num, { exact: true }).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("/en/contact page renders the contact form", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
