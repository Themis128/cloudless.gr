/**
 * Unit tests for GET/PATCH /api/admin/notifications
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("GET /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns empty notifications list initially", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "u1" } });
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.notifications)).toBe(true);
  });

  it("pushNotification adds to store, GET returns it", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "u1" } });
    const mod = await import("@/app/api/admin/notifications/route");
    mod.pushNotification({ title: "Test", message: "Hello", type: "info" });
    const res = await mod.GET(makeReq("GET"));
    const data = await res.json();
    expect(data.notifications.some((n: { title: string }) => n.title === "Test")).toBe(true);
  });
});

describe("PATCH /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(makeReq("PATCH", { markAllRead: true }));
    expect(res.status).toBe(401);
  });

  it("marks all notifications read", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "u1" } });
    const mod = await import("@/app/api/admin/notifications/route");
    mod.pushNotification({ title: "T1", message: "M1", type: "warning" });
    const res = await mod.PATCH(makeReq("PATCH", { markAllRead: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 when neither id nor markAllRead provided", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "u1" } });
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(makeReq("PATCH", {}));
    expect(res.status).toBe(400);
  });
});
