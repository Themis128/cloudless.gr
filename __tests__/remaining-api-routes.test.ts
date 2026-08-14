/**
 * Unit tests for remaining uncovered API routes:
 *   GET      /api/admin/esp32
 *   GET      /api/cron/slack-digest
 *   GET      /api/user/purchases
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
const mockRequireAuth = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
}));

function adminOk() {
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "a1" } });
}
function adminFail() {
  mockRequireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
}
function req(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

// ── /api/admin/esp32 ──────────────────────────────────────────────────────────

describe("GET /api/admin/esp32", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/esp32/route");
    const res = await GET(req("http://localhost/api/admin/esp32"));
    expect(res.status).toBe(401);
  });

  it("returns 404 with offline:true when ALERT_API_URL is a private LAN address", async () => {
    adminOk();
    process.env.ALERT_API_URL = "http://192.168.1.128:30820";
    const { GET } = await import("@/app/api/admin/esp32/route");
    const res = await GET(req("http://localhost/api/admin/esp32?action=devices"));
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.offline).toBe(true);
    delete process.env.ALERT_API_URL;
  });
});

// ── /api/cron/slack-digest ────────────────────────────────────────────────────

const mockIsCronAuthorized = vi.fn();
vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: (...a: unknown[]) => mockIsCronAuthorized(...a),
  cronUnauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  safeEqual: vi.fn().mockReturnValue(true),
}));

const mockListRecentCheckoutSessions = vi.fn();
const mockGetStripeForPurchases = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...a: unknown[]) => mockListRecentCheckoutSessions(...a),
  getStripe: (...a: unknown[]) => mockGetStripeForPurchases(...a),
  formatPrice: (amount: number, currency: string) =>
    `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`,
}));

class MockSlackClient {
  post = vi.fn().mockResolvedValue(undefined);
}
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: MockSlackClient,
}));

const mockIsSentryConfigured = vi.fn();
const mockGetErrorCounts = vi.fn();
const mockGetTopErrors = vi.fn();
vi.mock("@/lib/sentry", async (orig) => ({
  ...(await orig<typeof import("@/lib/sentry")>()),
  isSentryConfigured: (...a: unknown[]) => mockIsSentryConfigured(...a),
  getErrorCounts: (...a: unknown[]) => mockGetErrorCounts(...a),
  getTopErrors: (...a: unknown[]) => mockGetTopErrors(...a),
}));

describe("GET /api/cron/slack-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not authorized", async () => {
    mockIsCronAuthorized.mockResolvedValue(false);
    const { GET } = await import("@/app/api/cron/slack-digest/route");
    const res = await GET(req("http://localhost/api/cron/slack-digest"));
    expect(res.status).toBe(401);
  });

  it("returns ok:true on success", async () => {
    mockIsCronAuthorized.mockResolvedValue(true);
    mockListRecentCheckoutSessions.mockResolvedValue({ orders: [], hasMore: false });
    mockIsSentryConfigured.mockResolvedValue(false);
    mockGetErrorCounts.mockResolvedValue({ total: 0 });
    mockGetTopErrors.mockResolvedValue([]);
    const { GET } = await import("@/app/api/cron/slack-digest/route");
    const res = await GET(req("http://localhost/api/cron/slack-digest"));
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

// ── /api/user/purchases ───────────────────────────────────────────────────────

const mockIsConfigured = vi.fn();
vi.mock("@/lib/integrations", () => ({
  isConfigured: (...a: unknown[]) => mockIsConfigured(...a),
  isConfiguredAsync: vi.fn().mockResolvedValue(true),
}));

describe("GET /api/user/purchases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("@/app/api/user/purchases/route");
    const res = await GET(req("http://localhost/api/user/purchases"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no email in token", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: "u1" } });
    mockIsConfigured.mockReturnValue(true);
    const { GET } = await import("@/app/api/user/purchases/route");
    const res = await GET(req("http://localhost/api/user/purchases"));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Stripe not configured", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: "u1", email: "a@test.com" } });
    mockIsConfigured.mockReturnValue(false);
    const { GET } = await import("@/app/api/user/purchases/route");
    const res = await GET(req("http://localhost/api/user/purchases"));
    expect(res.status).toBe(503);
  });

  it("returns purchases when authenticated and Stripe configured", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: "u1", email: "a@test.com" } });
    mockIsConfigured.mockReturnValue(true);
    const mockStripe = {
      customers: { list: vi.fn().mockResolvedValue({ data: [] }) },
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
      subscriptions: { list: vi.fn().mockResolvedValue({ data: [] }) },
    };
    mockGetStripeForPurchases.mockResolvedValue(mockStripe);
    const { GET } = await import("@/app/api/user/purchases/route");
    const res = await GET(req("http://localhost/api/user/purchases"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.purchases)).toBe(true);
    expect(Array.isArray(data.subscriptions)).toBe(true);
  });
});
