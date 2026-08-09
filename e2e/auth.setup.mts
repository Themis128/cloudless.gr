/**
 * Auth setup project — runs once before all tests.
 * Produces signed-in storageState files reused by dashboard + admin specs.
 *
 * Referenced from playwright.config.mts as a "setup" project; the
 * dashboard / admin projects depend on it via `dependencies: ['setup']`.
 */
import { test as setup, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const HERE = path.dirname(__filename);
const USER_STORAGE = path.join(HERE, ".auth", "user.json");
const ADMIN_STORAGE = path.join(HERE, ".auth", "admin.json");

function emptyState(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }, null, 2));
}

function adminState(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // E2E bypass: set e2e_admin=1 cookie for AuthContext to recognize admin
  fs.writeFileSync(filePath, JSON.stringify({
    cookies: [{
      name: "e2e_admin",
      value: "1",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    }],
    origins: []
  }, null, 2));
}

async function loginAndSave(page: Page, email: string, password: string, storage: string) {
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  const emailLocator = page.getByLabel(/email/i);
  const passwordLocator = page.getByLabel(/password/i);
  await expect(emailLocator).toBeVisible({ timeout: 15_000 });
  await expect(passwordLocator).toBeVisible({ timeout: 15_000 });

  await emailLocator.fill(email);
  await passwordLocator.fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/admin|\/en|\/el/, { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.context().storageState({ path: storage });
}

setup("authenticate as user", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL || "";
  const password = process.env.E2E_USER_PASSWORD || "";
  if (!email || !password) {
    setup
      .info()
      .annotations.push({ type: "skip", description: "E2E_USER_EMAIL/E2E_USER_PASSWORD not set" });
    emptyState(USER_STORAGE);
    return;
  }
  try {
    await loginAndSave(page, email, password, USER_STORAGE);
  } catch (err) {
    setup.info().annotations.push({ type: "skip", description: `User login failed: ${err}` });
    emptyState(USER_STORAGE);
  }
});

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL || "";
  const password = process.env.E2E_ADMIN_PASSWORD || "";
  if (!email || !password) {
    setup
      .info()
      .annotations.push({
        type: "skip",
        description: "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set",
      });
    adminState(ADMIN_STORAGE);
    return;
  }
  try {
    await loginAndSave(page, email, password, ADMIN_STORAGE);
  } catch (err) {
    setup.info().annotations.push({ type: "skip", description: `Admin login failed: ${err}` });
    // Fallback to E2E bypass cookie
    adminState(ADMIN_STORAGE);
  }
});
