import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN } from "./_internal/admin-fixture";

const API = "/api/admin/workspaces";
const PAGE = "/en/admin/workspaces";

test.describe("Admin workspaces", () => {
  test("unauth API GET → 401", async ({ request }) => {
    const r = await request.get(API);
    expect(r.status()).toBe(401);
  });

  test("authed API GET → 200 + workspaces array", async ({ request }) => {
    const r = await request.get(API, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.workspaces)).toBe(true);
  });

  test("authed API POST without name → 400", async ({ request }) => {
    const r = await request.post(API, {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      data: { description: "no name" },
    });
    expect(r.status()).toBe(400);
  });

  test("authed API POST creates workspace + GET lists it", async ({ request }) => {
    const name = `e2e-spec-${Date.now()}`;
    const hdr = { authorization: `Bearer ${ADMIN_TOKEN}` };
    const create = await request.post(API, { headers: hdr, data: { name, description: "playwright" } });
    expect([200, 201]).toContain(create.status());
    const created = await create.json();
    expect(created.workspace.name).toBe(name);
    const id = created.workspace.id;
    expect(id).toBeTruthy();

    const list = await request.get(API, { headers: hdr });
    const lb = await list.json();
    const found = lb.workspaces.find((w: any) => w.id === id);
    expect(found).toBeDefined();

    // cleanup
    await request.delete(`${API}?id=${id}`, { headers: hdr }).catch(() => {});
  });

  test("page does not expose admin UI when unauth", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle").catch(() => {});
    const onLogin = /\/auth\/login/.test(page.url());
    const createBtn = await page.getByRole("button", { name: /create/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(onLogin || !createBtn).toBeTruthy();
  });

  test("page renders with E2E admin cookie", async ({ page }) => {
    // Use the same pattern as admin-pages-sweep.spec.ts
    await page.context().addCookies([{
      name: "e2e_admin",
      value: "1",
      url: "http://localhost:4000",
    }]);
    
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    
    // Use the same selector pattern as admin-pages-sweep.spec.pt
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30000 });
  });
});
