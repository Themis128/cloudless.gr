#!/usr/bin/env node
/**
 * Debug script to fetch and save HTML of a route.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = "https://cloudless.gr/en";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ userAgent: "cloudless-debug/1.0" });
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    if (!resp || !resp.ok()) {
      console.error(`HTTP ${resp ? resp.status() : "no response"}`);
    } else {
      const html = await page.content();
      await writeFile("/tmp/en_homepage.html", html);
      console.log("Saved HTML to /tmp/en_homepage.html");
      // Also print the first 2000 chars
      console.log("--- First 2000 chars ---");
      console.log(html.slice(0, 2000));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await page.close();
    await browser.close();
  }
})();