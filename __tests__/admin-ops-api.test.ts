/**
 * Unit tests for admin ops routes:
 *   GET  /api/admin/ops/monitor
 *   PUT  /api/admin/ops/errors/[id]
 *   GET  /api/admin/crm/tickets
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));

function adminOk() {
  mockRequireAdmin.mockResolvedValue({ ok: true, user: { sub: "admin1" } });
}
function adminFail() {
  mockRequireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
}

// ── /api/admin/ops/monitor ────────────────────────────────────────────────────

describe("GET /api/admin/ops/monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/monitor"));
    expect(res.status).toBe(401);
  });

  it("returns 503 with offline:true when ALERT_API_URL is a private LAN address", async () => {
    adminOk();
    process.env.ALERT_API_URL = "http://192.168.1.128:30820";
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=status")
    );
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.offline).toBe(true);
    delete process.env.ALERT_API_URL;
  });

  it("returns 400 for unknown resource", async () => {
    adminOk();
    process.env.ALERT_API_URL = "https://external-api.example.com";
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=unknown")
    );
    expect(res.status).toBe(400);
    delete process.env.ALERT_API_URL;
  });

  it("forwards whitelisted query params and returns upstream JSON", async () => {
    adminOk();
    process.env.ALERT_API_URL = "https://alert-api.example.com";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, pods: 12 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=alerts&severity=critical&resource2=x")
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, pods: 12 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/alerts?severity=critical");
    vi.unstubAllGlobals();
    delete process.env.ALERT_API_URL;
  });

  it("passes through upstream non-OK statuses with the error text", async () => {
    adminOk();
    process.env.ALERT_API_URL = "https://alert-api.example.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 502 }))
    );
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=status")
    );
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.error).toContain("502");
    vi.unstubAllGlobals();
    delete process.env.ALERT_API_URL;
  });

  it("returns 503 offline when the alert API is unreachable", async () => {
    adminOk();
    process.env.ALERT_API_URL = "https://alert-api.example.com";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns fail")));
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=status")
    );
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.offline).toBe(true);
    vi.unstubAllGlobals();
    delete process.env.ALERT_API_URL;
  });

  it("treats an unparseable ALERT_API_URL as public and forwards upstream", async () => {
    adminOk();
    process.env.ALERT_API_URL = ":::not a url";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(
      new NextRequest("http://localhost/api/admin/ops/monitor?resource=status")
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete process.env.ALERT_API_URL;
  });
});

// ── /api/admin/ops/errors/[id] ────────────────────────────────────────────────

const mockIsSentryConfigured = vi.fn();
const mockUpdateIssueStatus = vi.fn();
const mockGetUnresolvedIssues = vi.fn();
const mockVerifySentryToken = vi.fn();
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: (...a: unknown[]) => mockIsSentryConfigured(...a),
  updateIssueStatus: (...a: unknown[]) => mockUpdateIssueStatus(...a),
  getUnresolvedIssues: (...a: unknown[]) => mockGetUnresolvedIssues(...a),
  verifySentryToken: (...a: unknown[]) => mockVerifySentryToken(...a),
}));

describe("GET /api/admin/ops/errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns an empty list in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    adminOk();
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.issues).toEqual([]);
    expect(j.total).toBe(0);
  });

  it("503s with auth_rejected when the Sentry token is rejected", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    mockGetUnresolvedIssues.mockResolvedValue(null);
    mockVerifySentryToken.mockResolvedValue({ status: "rejected", message: "bad scope" });
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("auth_rejected");
  });
});

describe("PUT /api/admin/ops/errors/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when Sentry not configured", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(false);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: JSON.stringify({ status: "resolved" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 for a malformed JSON body", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: "{not-json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/);
  });

  it("returns 502 when the Sentry update fails", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    mockUpdateIssueStatus.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: JSON.stringify({ status: "resolved" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(502);
  });

  it("returns 400 for invalid status", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: JSON.stringify({ status: "deleted" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(400);
  });

  it("calls updateIssueStatus and returns 200 on success", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    mockUpdateIssueStatus.mockResolvedValue({ id: "abc", status: "resolved" });
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/ops/errors/abc", {
        method: "PUT",
        body: JSON.stringify({ status: "resolved" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpdateIssueStatus).toHaveBeenCalledWith("abc", "resolved");
  });
});

// ── /api/admin/crm/tickets ────────────────────────────────────────────────────

const mockIsHubSpotConfigured = vi.fn();
const mockListTickets = vi.fn();
vi.mock("@/lib/espocrm", async (orig) => ({
  ...(await orig<typeof import("@/lib/espocrm")>()),
  isEspoCRMConfigured: (...a: unknown[]) => mockIsHubSpotConfigured(...a),
  listTickets: (...a: unknown[]) => mockListTickets(...a),
}));

describe("GET /api/admin/crm/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/crm/tickets/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/crm/tickets"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when EspoCRM not configured", async () => {
    adminOk();
    mockIsHubSpotConfigured.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/crm/tickets/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/crm/tickets"));
    expect(res.status).toBe(503);
  });

  it("returns tickets list when configured", async () => {
    adminOk();
    mockIsHubSpotConfigured.mockResolvedValue(true);
    mockListTickets.mockResolvedValue([{ id: "t1", subject: "Issue 1" }]);
    const { GET } = await import("@/app/api/admin/crm/tickets/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/crm/tickets"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tickets).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("clamps limit between 1 and 100", async () => {
    adminOk();
    mockIsHubSpotConfigured.mockResolvedValue(true);
    mockListTickets.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/crm/tickets/route");
    await GET(new NextRequest("http://localhost/api/admin/crm/tickets?limit=999"));
    expect(mockListTickets).toHaveBeenCalledWith(100);
  });
});
