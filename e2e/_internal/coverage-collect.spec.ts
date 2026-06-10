import { test } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

const OUT = "/tmp/pw-coverage";

test.describe("Browser coverage collection", () => {
  test.beforeAll(async () => {
    await fs.mkdir(OUT, { recursive: true });
  });

  for (const url of [
    "/en", "/en/services", "/en/contact", "/en/blog", "/en/store",
    "/en/work", "/en/about", "/en/legal/terms", "/en/legal/privacy",
    "/el",
  ]) {
    test(`collect coverage at ${url}`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium");
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await page.coverage.startCSSCoverage({ resetOnNavigation: false });
      await page.goto(url, { waitUntil: "networkidle" }).catch(() => null);
      const js = await page.coverage.stopJSCoverage();
      const css = await page.coverage.stopCSSCoverage();
      const safe = url.replace(/[/]/g, "_").slice(1) || "root";
      await fs.writeFile(path.join(OUT, `${safe}.json`), JSON.stringify({ js, css }));
    });
  }
});
