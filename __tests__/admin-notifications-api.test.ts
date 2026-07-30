/**
 * Unit tests for GET/PATCH /api/admin/notifications and
 * GET /api/admin/notifications/analytics
 *
 * The route handlers delegate to src/lib/admin-notifications. We mock that
 * lib so these tests stay fast and don't need D1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAdmin, mockList, mockMarkRead, mockAnalytics, mockGetAuthDb } = vi.hoisted(
  () => ({
    mockRequireAdmin: vi.fn(),
    mockList: vi.fn(),
    mockMarkRead: vi.fn(),
    mockAnalytics: vi.fn(),
    mockGetAuthDb: vi.fn(),
  })
);

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: (...a: unknown[]) => mockGetAuthDb(...a),
}));

vi.mock("@/lib/admin-notifications", () => ({
  listNotifications: (...a: unknown[]) => mockList(...a),
  markNotificationsRead: (...a: unknown[]) => mockMarkRead(...a),
  notificationAnalytics: (...a: unknown[]) => mockAnalytics(...a),
}));

function makeReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const OK_ADMIN = { ok: true as const, user: { sub: "u1" } };
const FAKE_DB = { prepare: vi.fn() };

describe("GET /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthDb.mockReturnValue(FAKE_DB);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications", "GET"));
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns 503 when AUTH_DB is unbound", async () => {
    mockGetAuthDb.mockReturnValue(null);
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications", "GET"));
    expect(res.status).toBe(503);
  });

  it("returns the lib's list verbatim", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockResolvedValue([
      {
        id: "n_1",
        createdAt: "2026-06-12T20:00:00Z",
        category: "contact",
        type: "info",
        title: "T",
        message: "M",
        read: false,
      },
    ]);
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications", "GET"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notifications: { id: string }[] };
    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0].id).toBe("n_1");
  });

  it("forwards known category, since, until, limit to the lib", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notifications/route");
    await GET(
      makeReq(
        "http://localhost/api/admin/notifications?category=order&since=2026-06-01T00:00:00Z&until=2026-06-12T00:00:00Z&limit=25&includeArchived=1",
        "GET"
      )
    );
    expect(mockList).toHaveBeenCalledWith({
      category: "order",
      since: "2026-06-01T00:00:00Z",
      until: "2026-06-12T00:00:00Z",
      limit: 25,
      includeArchived: true,
    });
  });

  it("drops unknown category and unparseable dates", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notifications/route");
    await GET(
      makeReq(
        "http://localhost/api/admin/notifications?category=banana&since=not-a-date&limit=abc",
        "GET"
      )
    );
    expect(mockList).toHaveBeenCalledWith({
      category: undefined,
      since: undefined,
      until: undefined,
      limit: undefined,
      includeArchived: false,
    });
  });

  it("clamps limit to 1..200", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notifications/route");
    await GET(makeReq("http://localhost/api/admin/notifications?limit=9999", "GET"));
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ limit: 200 }));
    await GET(makeReq("http://localhost/api/admin/notifications?limit=0", "GET"));
    expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it("returns 500 when the lib throws", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockRejectedValue(new Error("d1 down"));
    const { GET } = await import("@/app/api/admin/notifications/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications", "GET"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthDb.mockReturnValue(FAKE_DB);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { markAllRead: true })
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when AUTH_DB is unbound", async () => {
    mockGetAuthDb.mockReturnValue(null);
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { id: "x" })
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 on invalid JSON", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const req = new NextRequest("http://localhost/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither id nor ids nor markAllRead provided", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(makeReq("http://localhost/api/admin/notifications", "PATCH", {}));
    expect(res.status).toBe(400);
  });

  it("marks a single id read", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockMarkRead.mockResolvedValue(undefined);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { id: "n_1" })
    );
    expect(res.status).toBe(200);
    expect(mockMarkRead).toHaveBeenCalledWith(["n_1"]);
  });

  it("marks a batch of ids read", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockMarkRead.mockResolvedValue(undefined);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { ids: ["a", "b", "c"] })
    );
    expect(mockMarkRead).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("markAllRead fetches unread + marks them", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockList.mockResolvedValue([
      { id: "u1", read: false },
      { id: "u2", read: false },
      { id: "r1", read: true },
    ]);
    mockMarkRead.mockResolvedValue(undefined);
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { markAllRead: true })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { updated: number };
    expect(data.updated).toBe(2);
    expect(mockMarkRead).toHaveBeenCalledWith(["u1", "u2"]);
  });

  it("returns 500 when the lib throws", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockMarkRead.mockRejectedValue(new Error("boom"));
    const { PATCH } = await import("@/app/api/admin/notifications/route");
    const res = await PATCH(
      makeReq("http://localhost/api/admin/notifications", "PATCH", { id: "n_1" })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/admin/notifications/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthDb.mockReturnValue(FAKE_DB);
  });

  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("@/app/api/admin/notifications/analytics/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications/analytics", "GET"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AUTH_DB is unbound", async () => {
    mockGetAuthDb.mockReturnValue(null);
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    const { GET } = await import("@/app/api/admin/notifications/analytics/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications/analytics", "GET"));
    expect(res.status).toBe(503);
  });

  it("uses a default 7-day window when no since/until provided", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockAnalytics.mockResolvedValue({
      total: 0,
      byCategory: {
        contact: 0,
        subscribe: 0,
        booking: 0,
        order: 0,
        error: 0,
        auth: 0,
        portal: 0,
      },
      byDay: {},
    });
    const { GET } = await import("@/app/api/admin/notifications/analytics/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications/analytics", "GET"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      window: { since: string; until: string };
      total: number;
    };
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const span = Date.parse(data.window.until) - Date.parse(data.window.since);
    expect(Math.abs(span - sevenDays)).toBeLessThan(5_000);
    expect(data.total).toBe(0);
  });

  it("respects explicit since/until", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockAnalytics.mockResolvedValue({
      total: 3,
      byCategory: {
        contact: 1,
        subscribe: 0,
        booking: 0,
        order: 2,
        error: 0,
        auth: 0,
        portal: 0,
      },
      byDay: { "2026-06-10": 1, "2026-06-11": 2 },
    });
    const { GET } = await import("@/app/api/admin/notifications/analytics/route");
    const res = await GET(
      makeReq(
        "http://localhost/api/admin/notifications/analytics?since=2026-06-10T00:00:00Z&until=2026-06-12T00:00:00Z",
        "GET"
      )
    );
    expect(res.status).toBe(200);
    expect(mockAnalytics).toHaveBeenCalledWith({
      since: "2026-06-10T00:00:00Z",
      until: "2026-06-12T00:00:00Z",
    });
    const data = (await res.json()) as { total: number };
    expect(data.total).toBe(3);
  });

  it("returns 500 when the lib throws", async () => {
    mockRequireAdmin.mockResolvedValue(OK_ADMIN);
    mockAnalytics.mockRejectedValue(new Error("boom"));
    const { GET } = await import("@/app/api/admin/notifications/analytics/route");
    const res = await GET(makeReq("http://localhost/api/admin/notifications/analytics", "GET"));
    expect(res.status).toBe(500);
  });
});
