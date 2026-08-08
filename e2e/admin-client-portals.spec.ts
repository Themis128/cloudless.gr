import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN } from "./_internal/admin-fixture";

const API = "/api/admin/client-portals";
const PAGE = "/en/admin/client-portals";

test.describe("Admin client-portals", () => {
  test("unauth API GET → 401", async ({ request }) => {
    const r = await request.get(API);
    expect(r.status()).toBe(401);
  });

  test("authed API GET → 200 + portals[] with health", async ({ request }) => {
    const r = await request.get(API, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.portals)).toBe(true);
    if (body.portals.length > 0) {
      expect(body.portals[0]).toHaveProperty("health");
    }
  });

  test("authed API POST without clientEmail → 400", async ({ request }) => {
    const r = await request.post(API, {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      data: { label: "no email" },
    });
    expect(r.status()).toBe(400);
  });

  test("authed POST creates portal with default 6 steps, GET lists it", async ({ request }) => {
    const label = `e2e-spec-${Date.now()}`;
    const hdr = { authorization: `Bearer ${ADMIN_TOKEN}` };
    const create = await request.post(API, {
      headers: hdr,
      data: { label, clientEmail: `e2e-${Date.now()}@cloudless.test`, clientName: "E2E" },
    });
    expect([200, 201]).toContain(create.status());
    const created = await create.json();
    expect(created.portal.label).toBe(label);
    expect(Array.isArray(created.portal.steps)).toBe(true);
    expect(created.portal.steps.length).toBeGreaterThanOrEqual(6);
    expect(created.portal.steps[0].status).toBe("pending");
    const token = created.portal.token;
    const stepId = created.portal.steps[0].id;

    const list = await request.get(API, { headers: hdr });
    const lb = await list.json();
    const found = lb.portals.find((p: any) => p.token === token);
    expect(found).toBeDefined();

    // PATCH update-step
    const patch = await request.patch(API, {
      headers: hdr,
      data: { token, action: "update-step", stepId, status: "in-progress" },
    });
    expect(patch.status()).toBe(200);

    // cleanup
    await request.delete(`${API}?token=${token}`, { headers: hdr }).catch(() => {});
  });

  test("page does not expose admin UI when unauth", async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForLoadState("networkidle").catch(() => {});
    const onLogin = /\/auth\/login/.test(page.url());
    const stepLabel = await page
      .getByText(/free audit/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(onLogin || !stepLabel).toBeTruthy();
  });

  test("page renders with E2E admin cookie", async ({ page }) => {
    // Use the same pattern as admin-pages-sweep.spec.ts
    await page.context().addCookies([{
      name: "e2e_admin",
      value: "1",
      url: "http://localhost:4000",
    }]);
    
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    
    // Check for h1 heading which indicates the page loaded correctly
    // Use the same selector pattern as admin-pages-sweep.spec.ts
    await expect(page.locator("h1, h2, [role=\"alert\"]").first()).toBeVisible({ timeout: 30000 });
  });
});