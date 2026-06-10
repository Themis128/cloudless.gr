import { test, expect } from "@playwright/test";

const rand = () => Math.random().toString(36).slice(2, 10);
const validReject = (s: number) => s === 400 || s === 422 || s === 429;

test.describe("Public API — contract", () => {
  test("GET /api/health returns 200 with status+timestamp+version", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("version");
  });

  test("POST /api/contact rejects empty body", async ({ request }) => {
    const r = await request.post("/api/contact", { data: {} });
    expect(validReject(r.status())).toBe(true);
  });

  test("POST /api/contact rejects invalid email", async ({ request }) => {
    const r = await request.post("/api/contact", {
      data: { name: `n-${rand()}`, email: "not-an-email", message: `m-${rand()}` },
    });
    expect(validReject(r.status())).toBe(true);
  });

  test("POST /api/subscribe rejects missing email", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { _id: rand() } });
    expect(validReject(r.status())).toBe(true);
  });

  test("POST /api/subscribe rejects invalid email", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { email: `nope-${rand()}` } });
    expect(validReject(r.status())).toBe(true);
  });

  test("GET /api/unsubscribe without token returns 4xx", async ({ request }) => {
    const r = await request.get("/api/unsubscribe");
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("POST /api/csp-report accepts an empty body", async ({ request }) => {
    const r = await request.post("/api/csp-report", { data: {} });
    expect([200, 204]).toContain(r.status());
  });

  test("GET /api/pwa-manifest returns JSON manifest", async ({ request }) => {
    const r = await request.get("/api/pwa-manifest");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("icons");
  });
});
