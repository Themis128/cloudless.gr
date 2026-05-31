/**
 * Unit tests for admin ops routes:
 *   GET  /api/admin/ops/monitor
 *   PUT  /api/admin/ops/errors/[id]
 *   GET  /api/admin/notion/search
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
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/monitor"));
    expect(res.status).toBe(401);
  });

  it("returns 503 with offline:true when Pi LAN is unreachable", async () => {
    adminOk();
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/monitor?resource=status"));
    const data = await res.json();
    expect(data.offline).toBe(true);
  });

  it("returns 400 for unknown resource", async () => {
    adminOk();
    process.env.ALERT_API_URL = "https://external-api.example.com";
    const { GET } = await import("@/app/api/admin/ops/monitor/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/ops/monitor?resource=unknown"));
    expect(res.status).toBe(400);
    delete process.env.ALERT_API_URL;
  });
});

// ── /api/admin/ops/errors/[id] ────────────────────────────────────────────────

const mockIsSentryConfigured = vi.fn();
const mockUpdateIssueStatus = vi.fn();
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: (...a: unknown[]) => mockIsSentryConfigured(...a),
  updateIssueStatus: (...a: unknown[]) => mockUpdateIssueStatus(...a),
}));

describe("PUT /api/admin/ops/errors/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(new NextRequest("http://localhost/api/admin/ops/errors/abc", { method: "PUT", body: "{}", headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(401);
  });

  it("returns 503 when Sentry not configured", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(false);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(new NextRequest("http://localhost/api/admin/ops/errors/abc", { method: "PUT", body: JSON.stringify({ status: "resolved" }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid status", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(new NextRequest("http://localhost/api/admin/ops/errors/abc", { method: "PUT", body: JSON.stringify({ status: "deleted" }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("calls updateIssueStatus and returns 200 on success", async () => {
    adminOk();
    mockIsSentryConfigured.mockResolvedValue(true);
    mockUpdateIssueStatus.mockResolvedValue({ id: "abc", status: "resolved" });
    const { PUT } = await import("@/app/api/admin/ops/errors/[id]/route");
    const res = await PUT(new NextRequest("http://localhost/api/admin/ops/errors/abc", { method: "PUT", body: JSON.stringify({ status: "resolved" }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    expect(mockUpdateIssueStatus).toHaveBeenCalledWith("abc", "resolved");
  });
});

// ── /api/admin/notion/search ──────────────────────────────────────────────────

const mockSearchPages = vi.fn();
const mockSearchDatabases = vi.fn();
const mockListUsers = vi.fn();
const mockGetDatabaseSchema = vi.fn();
vi.mock("@/lib/notion-search", () => ({
  searchPages: (...a: unknown[]) => mockSearchPages(...a),
  searchDatabases: (...a: unknown[]) => mockSearchDatabases(...a),
  listUsers: (...a: unknown[]) => mockListUsers(...a),
  getDatabaseSchema: (...a: unknown[]) => mockGetDatabaseSchema(...a),
}));
vi.mock("@/lib/api-errors", () => ({
  mapIntegrationError: () => null,
}));

describe("GET /api/admin/notion/search", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?q=test"));
    expect(res.status).toBe(401);
  });

  it("returns users list when type=users", async () => {
    adminOk();
    mockListUsers.mockResolvedValue([{ id: "u1", name: "Alice" }]);
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?type=users"));
    const data = await res.json();
    expect(data.users).toHaveLength(1);
  });

  it("returns 400 when type=schema without database_id", async () => {
    adminOk();
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?type=schema"));
    expect(res.status).toBe(400);
  });

  it("returns database schema when type=schema with database_id", async () => {
    adminOk();
    mockGetDatabaseSchema.mockResolvedValue({ properties: {} });
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?type=schema&database_id=db-123"));
    const data = await res.json();
    expect(data.schema).toBeDefined();
  });

  it("returns database results when type=database", async () => {
    adminOk();
    mockSearchDatabases.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?type=database&q=test"));
    expect(res.status).toBe(200);
  });

  it("defaults to searching all pages", async () => {
    adminOk();
    mockSearchPages.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notion/search/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/notion/search?q=test"));
    expect(res.status).toBe(200);
  });
});

// ── /api/admin/crm/tickets ────────────────────────────────────────────────────

const mockIsHubSpotConfigured = vi.fn();
const mockListTickets = vi.fn();
vi.mock("@/lib/hubspot", async (orig) => ({
  ...(await orig<typeof import("@/lib/hubspot")>()),
  isHubSpotConfigured: (...a: unknown[]) => mockIsHubSpotConfigured(...a),
  listTickets: (...a: unknown[]) => mockListTickets(...a),
}));

describe("GET /api/admin/crm/tickets", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/crm/tickets/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/crm/tickets"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot not configured", async () => {
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
