import { test, expect } from "@playwright/test";

const STORAGE_KEY = "cloudless-theme-pref";

test.describe("ThemeSwitcher (desktop popover)", () => {
  // Browser context starts with a clean localStorage in Playwright; the
  // addInitScript pattern would clear it on every navigation including
  // page.reload(), which breaks the persistence assertion.

  test("renders next to the LocaleSwitcher and opens a 3-option list", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /Theme:/i });
    await expect(trigger).toBeVisible();

    await trigger.click();
    const listbox = page.getByRole("listbox", { name: /Theme/i });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option")).toHaveCount(3);
  });

  test("picking Light writes localStorage and applies data-theme=light", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Theme:/i }).click();
    await page.getByRole("option", { name: /Light/i }).click();

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe("light");

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(dataTheme).toBe("light");
  });

  test("picking Dark writes localStorage and applies data-theme=dark", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Theme:/i }).click();
    await page.getByRole("option", { name: /Dark/i }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("dark");
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe("dark");
  });

  test("the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Theme:/i }).click();
    await page.getByRole("option", { name: /Dark/i }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("dark");

    await page.reload();
    // ThemePreferenceSync runs in a useEffect; on reload the SSR HTML may
    // briefly carry the route default before the effect re-applies the
    // localStorage override. Poll for the final value.
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-theme"),
        ),
      )
      .toBe("dark");
  });
});

test.describe("ThemeSwitcher (mobile inline)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("appears as a 3-radio group inside the mobile menu", async ({
    page,
  }) => {
    await page.goto("/");
    // Open the mobile hamburger.
    await page.getByRole("button", { name: /toggle menu/i }).click();
    const radios = page.getByRole("radio", { name: /Theme:/i });
    await expect(radios).toHaveCount(3);

    await radios.filter({ hasText: /Light/i }).click();
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe("light");
  });
});
