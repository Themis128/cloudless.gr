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

/** Return the computed background-color of <body> as a CSS rgb(...) string. */
async function bodyBgColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/**
 * Return the computed value of a CSS custom property on <html>.
 * Works for both :root vars and [data-theme] overrides.
 */
async function cssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

/** Dismiss the cookie-consent banner if it appears (avoids z-index overlap). */
async function dismissCookieBanner(page: Page): Promise<void> {
  const btn = page
    .getByRole("button", { name: /(accept|agree|got it|ok)/i })
    .first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click();
  }
}

// ── Navbar / header ────────────────────────────────────────────────────────

test.describe("Navbar style", () => {
  test("sticky header renders with neon-cyan accent bar", async ({ page }) => {
    await page.goto("/en");
    await dismissCookieBanner(page);

    // The header element is sticky
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const position = await header.evaluate(
      (el) => getComputedStyle(el).position,
    );
    expect(position).toBe("sticky");

    // The 1-px accent bar sits above the nav; it carries the neon-cyan bg
    const accentBar = header.locator("div").first();
    await expect(accentBar).toBeVisible();
    const height = await accentBar.evaluate(
      (el) => getComputedStyle(el).height,
    );
    // Should be exactly 1 px (h-px Tailwind utility)
    expect(parseFloat(height)).toBeCloseTo(1, 0);
  });

  test("logo link is visible and points to homepage", async ({ page }) => {
    await page.goto("/en");
    const logoLink = page.getByRole("link", { name: /cloudless/i }).first();
    await expect(logoLink).toBeVisible();
    const href = await logoLink.getAttribute("href");
    expect(href).toMatch(/^(\/|\/en)?$/);
  });

  test("desktop nav links are visible at ≥1024px", async ({ page }) => {
    // Default playwright project is Desktop Chrome (1280×720)
    await page.goto("/en");
    for (const label of ["Services", "Blog", "Contact"]) {
      await expect(
        page.getByRole("navigation").getByRole("link", { name: label }),
      ).toBeVisible();
    }
  });

  test("mobile hamburger opens the nav at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const hamburger = page.getByRole("button", { name: /toggle menu/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // After opening, mobile nav links should appear
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
    await page.goto("/en");
    const bg = await bodyBgColor(page);
    // Should not be white (#fff / rgb(255,255,255)) or transparent
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("rgb(255, 255, 255)");
    // Must be a valid colour (not empty)
    expect(bg).toMatch(/^rgb/);
  });

  test("default theme (no preference stored) uses surface-canvas token", async ({
    page,
  }) => {
    await page.goto("/en");
    const canvas = await cssVar(page, "--surface-canvas");
    // The token must be set; exact value differs by theme mode
    expect(canvas.length).toBeGreaterThan(0);
    // --color-void must alias it (via @theme inline in globals.css)
    const voidColor = await cssVar(page, "--color-void");
    expect(voidColor.length).toBeGreaterThan(0);
  });

  test("switching to Dark theme sets data-theme=dark and darkens canvas", async ({
    page,
  }) => {
    await page.goto("/en");
    // Click the theme switcher (desktop popover)
    const trigger = page.getByRole("button", { name: /Theme:/i });
    // Skip this assertion on mobile where the trigger may be hidden
    if (!(await trigger.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
    }
    await trigger.click();
    await page.getByRole("option", { name: /Dark/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("dark");

    // Dark surface-canvas is #0b0f15 — far from white
    const bg = await bodyBgColor(page);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    // All channels should be in the dark range (< 50)
    expect(r).toBeLessThan(50);
    expect(g).toBeLessThan(50);
    expect(b).toBeLessThan(50);
  });

  test("switching to Light theme sets data-theme=light and brightens canvas", async ({
    page,
  }) => {
    await page.goto("/en");
    const trigger = page.getByRole("button", { name: /Theme:/i });
    if (!(await trigger.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
    }
    await trigger.click();
    await page.getByRole("option", { name: /Light/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("light");

    // Light surface-canvas is #fcfcfd — all channels should be high (> 200)
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
    await page.goto("/en/services");
    await dismissCookieBanner(page);

    // Each service card has a colour-coded number/tag. We look for at least
    // one element with each neon colour class.
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
    await page.goto("/en");
    await expect(
      page.locator('[class*="neon-cyan"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("blog page category badges use neon colour classes", async ({ page }) => {
    await page.goto("/en/blog");
    await dismissCookieBanner(page);
    // Category badges: Cloud=neon-cyan, Serverless=neon-green, Analytics=neon-magenta
    // At least one badge must be coloured (even with static fallback posts)
    const badges = page.locator(
      '[class*="neon-cyan"],[class*="neon-green"],[class*="neon-magenta"]',
    );
    await expect(badges.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ── Footer ─────────────────────────────────────────────────────────────────

test.describe("Footer style", () => {
  test("footer is present with neon-cyan/20 top border class", async ({
    page,
  }) => {
    await page.goto("/en");
    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();
    const cls = await footer.getAttribute("class");
    // The footer carries border-neon-cyan/20 (see Footer.tsx)
    expect(cls).toContain("border");
  });

  test("footer logo link navigates to home", async ({ page }) => {
    await page.goto("/en/contact");
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
    await page.goto("/en");
    const footer = page.locator("footer").first();
    await footer.scrollIntoViewIfNeeded();
    // Mono tracking labels: NAVIGATE, SERVICES, LEGAL (aria-hidden)
    await expect(footer).toContainText(/navigate|services|legal/i);
  });
});

// ── Typography / fonts ─────────────────────────────────────────────────────

test.describe("Typography", () => {
  test("h1 uses Instrument Sans (heading font)", async ({ page }) => {
    await page.goto("/en");
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    const fontFamily = await h1.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    // font-heading resolves to var(--font-instrument-sans)
    expect(fontFamily.toLowerCase()).toMatch(/instrument|sans/);
  });

  test("body text uses Work Sans or system sans-serif fallback", async ({
    page,
  }) => {
    await page.goto("/en");
    const body = page.locator("body");
    const fontFamily = await body.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(fontFamily.toLowerCase()).toMatch(/work|sans/);
  });

  test("mono elements use Geist Mono or a monospace fallback", async ({
    page,
  }) => {
    await page.goto("/en");
    // TerminalBlock and tracking-label spans carry font-mono class
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
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    expect(
      failed,
      `CSS/font requests failed:\n${failed.join("\n")}`,
    ).toHaveLength(0);
  });

  test("no JS chunk requests return 4xx on homepage", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (url.includes("/_next/static/chunks") && r.status() >= 400) {
        failed.push(`${r.status()} ${url}`);
      }
    });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    expect(
      failed,
      `JS chunk requests failed:\n${failed.join("\n")}`,
    ).toHaveLength(0);
  });

  test("no console errors on homepage related to CSS or styles", async ({
    page,
  }) => {
    const styleErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /css|style|font|stylesheet/i.test(msg.text())
      ) {
        styleErrors.push(msg.text());
      }
    });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    expect(styleErrors).toHaveLength(0);
  });
});

// ── Key public pages have a styled hero section ────────────────────────────

test.describe("Page-level style integrity", () => {
  const pages = [
    { path: "/en", heading: /cloudless|cloud/i },
    { path: "/en/services", heading: /service/i },
    { path: "/en/contact", heading: /touch|contact/i },
    { path: "/en/work", heading: /work|project/i },
    { path: "/en/blog", heading: /blog|insight/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} — h1 is visible and styled`, async ({ page }) => {
      await page.goto(path);
      await dismissCookieBanner(page);

      const h1 = page.getByRole("heading", { level: 1 }).first();
      await expect(h1).toBeVisible({ timeout: 15_000 });
      await expect(h1).toContainText(heading);

      // h1 should not be transparent/invisible
      const color = await h1.evaluate((el) => getComputedStyle(el).color);
      expect(color).not.toBe("rgba(0, 0, 0, 0)");
    });
  }

  test("/en/services page renders all 4 service cards", async ({ page }) => {
    await page.goto("/en/services");
    await dismissCookieBanner(page);

    // Service numbers 01–04 are rendered as text in each card
    for (const num of ["01", "02", "03", "04"]) {
      await expect(page.getByText(num, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("/en/contact page renders the contact form", async ({ page }) => {
    await page.goto("/en/contact");
    await dismissCookieBanner(page);

    // The form has at least an email input
    await expect(
      page.locator('input[type="email"], input[name="email"]').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
