/**
 * Unit tests for admin Notion routes:
 *   GET/POST /api/admin/notion/analytics
 *   GET/POST /api/admin/notion/comments
 *   GET/POST /api/admin/notion/projects
 *   GET      /api/admin/notion/status
 *   GET      /api/admin/reports/[id]/pdf
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/api-errors", () => ({ mapIntegrationError: () => null }));

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

// ── /api/admin/notion/analytics ───────────────────────────────────────────────

const mockIsConfiguredAsync = vi.fn();
vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...a: unknown[]) => mockIsConfiguredAsync(...a),
  isConfigured: vi.fn().mockReturnValue(true),
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
}));

const mockGetAnalyticsSummary = vi.fn();
const mockGetRecentEvents = vi.fn();
const mockCreateWeeklyRollup = vi.fn();
const mockArchiveOldEvents = vi.fn();
vi.mock("@/lib/notion-analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/notion-analytics")>()),
  getAnalyticsSummary: (...a: unknown[]) => mockGetAnalyticsSummary(...a),
  getRecentEvents: (...a: unknown[]) => mockGetRecentEvents(...a),
  createWeeklyRollup: (...a: unknown[]) => mockCreateWeeklyRollup(...a),
  archiveOldEvents: (...a: unknown[]) => mockArchiveOldEvents(...a),
}));

describe("GET /api/admin/notion/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/notion/analytics/route");
    const res = await GET(req("http://localhost/api/admin/notion/analytics"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(false);
    const { GET } = await import("@/app/api/admin/notion/analytics/route");
    const res = await GET(req("http://localhost/api/admin/notion/analytics"));
    expect(res.status).toBe(503);
  });

  it("returns summary by default", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetAnalyticsSummary.mockResolvedValue({ totalEvents: 42 });
    const { GET } = await import("@/app/api/admin/notion/analytics/route");
    const res = await GET(req("http://localhost/api/admin/notion/analytics?days=7"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalEvents).toBe(42);
  });

  it("returns events when type param provided", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockGetRecentEvents.mockResolvedValue([{ id: "e1", event: "Page: /en" }]);
    const { GET } = await import("@/app/api/admin/notion/analytics/route");
    const res = await GET(req("http://localhost/api/admin/notion/analytics?type=page_view"));
    const data = await res.json();
    expect(data.events).toHaveLength(1);
  });
});

describe("POST /api/admin/notion/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for unknown action", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/notion/analytics/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/analytics", "POST", { action: "unknown" })
    );
    expect(res.status).toBe(400);
  });

  it("handles rollup action", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockCreateWeeklyRollup.mockResolvedValue("rollup-id-123");
    const { POST } = await import("@/app/api/admin/notion/analytics/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/analytics", "POST", { action: "rollup" })
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.rollupId).toBe("rollup-id-123");
  });

  it("handles archive action", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockArchiveOldEvents.mockResolvedValue({ archived: 5 });
    const { POST } = await import("@/app/api/admin/notion/analytics/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/analytics", "POST", {
        action: "archive",
        daysToKeep: 30,
      })
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.archived).toBe(5);
  });

  it("handles maintain action", async () => {
    adminOk();
    mockIsConfiguredAsync.mockResolvedValue(true);
    mockCreateWeeklyRollup.mockResolvedValue("r1");
    mockArchiveOldEvents.mockResolvedValue({ archived: 2 });
    const { POST } = await import("@/app/api/admin/notion/analytics/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/analytics", "POST", { action: "maintain" })
    );
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.rollupId).toBe("r1");
  });
});

// ── /api/admin/notion/comments ────────────────────────────────────────────────

const mockListComments = vi.fn();
const mockAddComment = vi.fn();
vi.mock("@/lib/notion-comments", () => ({
  listComments: (...a: unknown[]) => mockListComments(...a),
  addComment: (...a: unknown[]) => mockAddComment(...a),
}));

describe("GET /api/admin/notion/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/notion/comments/route");
    const res = await GET(req("http://localhost/api/admin/notion/comments?page_id=p1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when page_id missing", async () => {
    adminOk();
    const { GET } = await import("@/app/api/admin/notion/comments/route");
    const res = await GET(req("http://localhost/api/admin/notion/comments"));
    expect(res.status).toBe(400);
  });

  it("returns comments list", async () => {
    adminOk();
    mockListComments.mockResolvedValue([{ id: "c1", text: "Hello" }]);
    const { GET } = await import("@/app/api/admin/notion/comments/route");
    const res = await GET(req("http://localhost/api/admin/notion/comments?page_id=page-1"));
    const data = await res.json();
    expect(data.comments).toHaveLength(1);
  });
});

describe("POST /api/admin/notion/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when page_id or text missing", async () => {
    adminOk();
    const { POST } = await import("@/app/api/admin/notion/comments/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/comments", "POST", { page_id: "p1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 5000 chars", async () => {
    adminOk();
    const { POST } = await import("@/app/api/admin/notion/comments/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/comments", "POST", {
        page_id: "p1",
        text: "x".repeat(5001),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 when comment created", async () => {
    adminOk();
    mockAddComment.mockResolvedValue({ id: "c1", text: "Nice!" });
    const { POST } = await import("@/app/api/admin/notion/comments/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/comments", "POST", { page_id: "p1", text: "Nice!" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.text).toBe("Nice!");
  });

  it("returns 500 when addComment returns null", async () => {
    adminOk();
    mockAddComment.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/notion/comments/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/comments", "POST", { page_id: "p1", text: "Hi" })
    );
    expect(res.status).toBe(500);
  });
});

// ── /api/admin/notion/projects ────────────────────────────────────────────────
// Route now backed by AppFlowy — mock @/lib/appflowy instead of notion-projects.

const mockListAllWorkspaces = vi.fn();
const mockListWorkspaceViews = vi.fn();
const mockCreatePage = vi.fn();
vi.mock("@/lib/appflowy", async (orig) => {
  const mod = await orig<typeof import("@/lib/appflowy")>();
  return {
    ...mod,
    listAllWorkspaces: (...a: unknown[]) => mockListAllWorkspaces(...a),
    listWorkspaceViews: (...a: unknown[]) => mockListWorkspaceViews(...a),
    createPage: (...a: unknown[]) => mockCreatePage(...a),
  };
});

describe("GET /api/admin/notion/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/notion/projects/route");
    const res = await GET(req("http://localhost/api/admin/notion/projects"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    adminOk();
    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    mockListAllWorkspaces.mockRejectedValue(new AppFlowyNotConfiguredError());
    const { GET } = await import("@/app/api/admin/notion/projects/route");
    const res = await GET(req("http://localhost/api/admin/notion/projects"));
    expect(res.status).toBe(503);
  });

  it("returns project list when configured", async () => {
    adminOk();
    mockListAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    mockListWorkspaceViews.mockResolvedValue([
      { view_id: "v1", name: "Alpha", layout: "Document", created_at: "", last_edited_time: "" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/projects/route");
    const res = await GET(req("http://localhost/api/admin/notion/projects"));
    const data = await res.json();
    expect(data.projects).toHaveLength(1);
    expect(data.count).toBe(1);
  });
});

describe("POST /api/admin/notion/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when name missing", async () => {
    adminOk();
    mockListAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    const { POST } = await import("@/app/api/admin/notion/projects/route");
    const res = await POST(req("http://localhost/api/admin/notion/projects", "POST", {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name too long", async () => {
    adminOk();
    mockListAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    const { POST } = await import("@/app/api/admin/notion/projects/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/projects", "POST", { name: "x".repeat(201) })
    );
    expect(res.status).toBe(400);
  });

  it("creates project and returns id", async () => {
    adminOk();
    mockListAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    mockListWorkspaceViews.mockResolvedValue([
      { view_id: "root-view", name: "Root", layout: "Document", created_at: "", last_edited_time: "" },
    ]);
    mockCreatePage.mockResolvedValue({ view_id: "proj-123", name: "New Project" });
    const { POST } = await import("@/app/api/admin/notion/projects/route");
    const res = await POST(
      req("http://localhost/api/admin/notion/projects", "POST", { name: "New Project" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("proj-123");
  });
});

// ── /api/admin/reports/[id]/pdf ───────────────────────────────────────────────

const mockGetReport = vi.fn();
vi.mock("@/lib/reports", () => ({
  getReport: (...a: unknown[]) => mockGetReport(...a),
}));
vi.mock("@/lib/escape-html", () => ({
  escapeHtml: (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}));

describe("GET /api/admin/reports/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when not admin", async () => {
    adminFail();
    const { GET } = await import("@/app/api/admin/reports/[id]/pdf/route");
    const res = await GET(req("http://localhost/api/admin/reports/r1/pdf"), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when report not found", async () => {
    adminOk();
    mockGetReport.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/reports/[id]/pdf/route");
    const res = await GET(req("http://localhost/api/admin/reports/r1/pdf"), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns HTML with content-type text/html when report found", async () => {
    adminOk();
    mockGetReport.mockResolvedValue({
      id: "r1",
      title: "Q1 Report",
      clientName: "ACME",
      status: "complete",
      dateRange: { start: "2024-01-01", end: "2024-01-31" },
      period: "2024-Q1",
      generatedAt: "2024-01-31",
      sections: [{ title: "Revenue", data: { total: 5000 }, insights: "Good quarter." }],
    });
    const { GET } = await import("@/app/api/admin/reports/[id]/pdf/route");
    const res = await GET(req("http://localhost/api/admin/reports/r1/pdf"), {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("ACME");
  });
});
