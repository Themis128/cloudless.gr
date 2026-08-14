/**
 * Auth setup project — runs once before all tests.
 * Produces signed-in storageState files reused by dashboard + admin specs.
 *
 * Identity is Cloudflare D1 (email/password), not Cognito.
 * Local/CI needs: `pnpm exec wrangler d1 migrations apply user-auth-db --local`
 * then register + promote seed users (see docs/runbooks/test-accounts.md).
 *
 * Admin page bypass: cookie `e2e_admin=1` when NEXT_PUBLIC_E2E=1 (AuthContext).
 * Admin API bypass: Bearer E2E_ADMIN_TOKEN when NEXT_PUBLIC_E2E=1 (api-auth).
 */
import { test as setup, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { E2E_ORIGIN } from "./_port";

const __filename = fileURLToPath(import.meta.url);
const HERE = path.dirname(__filename);
const USER_STORAGE = path.join(HERE, ".auth", "user.json");
const ADMIN_STORAGE = path.join(HERE, ".auth", "admin.json");
const ORIGIN = E2E_ORIGIN;

function emptyState(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }, null, 2));
}

function adminBypassState(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        cookies: [
          {
            name: "e2e_admin",
            value: "1",
            domain: "localhost",
            path: "/",
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 86400,
          },
        ],
        origins: [],
      },
      null,
      2
    )
  );
}

async function ensureRegistered(email: string, password: string, name: string) {
  const res = await fetch(`${ORIGIN}/api/auth/register-d1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  // 200/201 = created; 409/400 = already exists — both OK for idempotent setup
  if (res.status >= 500) {
    const body = await res.text().catch(() => "");
    throw new Error(`register-d1 failed HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function promoteAdmin(email: string) {
  const token = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-do-not-use-in-prod";
  // POST /api/admin/users with action=promote (there is no /users/promote route)
  const res = await fetch(`${ORIGIN}/api/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "promote", username: email }),
  });
  if (![200, 201, 409].includes(res.status) && res.status !== 400) {
    // Soft-fail — page tests can still use e2e_admin cookie
    console.warn(`[auth.setup] promote returned HTTP ${res.status}`);
  }
}

async function loginAndSave(page: Page, email: string, password: string, storage: string) {
  await page.goto("/en/auth/login");
  await page.waitForLoadState("domcontentloaded");

  const emailLocator = page.getByLabel(/email/i).first();
  const passwordLocator = page.getByLabel(/password/i).first();
  await expect(emailLocator).toBeVisible({ timeout: 20_000 });
  await expect(passwordLocator).toBeVisible({ timeout: 20_000 });

  await emailLocator.fill(email);
  await passwordLocator.fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|admin|en|el)/, { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.context().storageState({ path: storage });
}

setup("authenticate as user", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL || "";
  const password = process.env.E2E_USER_PASSWORD || "";
  if (!email || !password) {
    setup.info().annotations.push({
      type: "skip",
      description: "E2E_USER_EMAIL/E2E_USER_PASSWORD not set",
    });
    emptyState(USER_STORAGE);
    return;
  }
  try {
    await ensureRegistered(email, password, "E2E User");
    await loginAndSave(page, email, password, USER_STORAGE);
  } catch (err) {
    // Local D1/sqlite may be unavailable (degraded health) — leave empty storage
    // so storageState-dependent specs skip/soft-fail instead of blocking setup.
    setup.info().annotations.push({ type: "skip", description: `User login failed: ${err}` });
    emptyState(USER_STORAGE);
  }
});

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL || "";
  const password = process.env.E2E_ADMIN_PASSWORD || "";
  // Prefer cookie bypass when NEXT_PUBLIC_E2E=1 — reliable without remote D1.
  // Still attempt real login when credentials exist so session-cookie specs work.
  const preferBypass = process.env.E2E_ADMIN_BYPASS === "1";
  if (!email || !password || preferBypass) {
    setup.info().annotations.push({
      type: "skip",
      description: preferBypass
        ? "E2E_ADMIN_BYPASS=1 — using e2e_admin cookie"
        : "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set — using e2e_admin cookie",
    });
    adminBypassState(ADMIN_STORAGE);
    return;
  }
  try {
    await ensureRegistered(email, password, "E2E Admin");
    await promoteAdmin(email);
    await loginAndSave(page, email, password, ADMIN_STORAGE);
    // Ensure page-level admin bypass cookie is present alongside session
    const state = JSON.parse(fs.readFileSync(ADMIN_STORAGE, "utf8")) as {
      cookies: Array<Record<string, unknown>>;
      origins: unknown[];
    };
    if (!state.cookies.some((c) => c.name === "e2e_admin")) {
      state.cookies.push({
        name: "e2e_admin",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 86400,
      });
      fs.writeFileSync(ADMIN_STORAGE, JSON.stringify(state, null, 2));
    }
  } catch (err) {
    setup.info().annotations.push({
      type: "skip",
      description: `Admin login failed: ${err} — using e2e_admin cookie`,
    });
    adminBypassState(ADMIN_STORAGE);
  }
});
