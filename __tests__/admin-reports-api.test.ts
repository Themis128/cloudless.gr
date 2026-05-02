import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { deleteReport, listReports } from "@/lib/reports";

const requireAdminMock = vi.fn();
const isHubSpotConfiguredMock = vi.fn();
const isActiveCampaignConfiguredMock = vi.fn();
const getPipelineStatsMock = vi.fn();
const getEmailStatsMock = vi.fn();
const getConfigMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  getPipelineStats: getPipelineStatsMock,
}));

vi.mock("@/lib/activecampaign", () => ({
  isActiveCampaignConfigured: isActiveCampaignConfiguredMock,
  getEmailStats: getEmailStatsMock,
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
}));

vi.mock("@/lib/notion-reports", () => ({
  notionListReports: vi.fn().mockResolvedValue(null),
  notionGetReport: vi.fn().mockResolvedValue(null),
  notionCreateReport: vi.fn().mockResolvedValue(null),
  notionUpdateReport: vi.fn().mockResolvedValue(false),
  notionDeleteReport: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations")>();
  return {
    ...actual,
    getIntegrationsAsync: vi.fn().mockResolvedValue({}),
    isConfiguredAsync: vi.fn().mockResolvedValue(false),
    isConfigured: vi.fn().mockReturnValue(false),
    getIntegrations: vi.fn().mockReturnValue({}),
    resetIntegrationCacheAsync: vi.fn(),
  };
});

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

function makePost(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "DELETE" });
}

async function clearReports() {
  const all = await listReports();
  for (const r of all) {
    await deleteReport(r.id);
  }
}

describe("Admin Reports API routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isHubSpotConfiguredMock.mockResolvedValue(true);
    isActiveCampaignConfiguredMock.mockResolvedValue(true);
    getPipelineStatsMock.mockResolvedValue({ totalDeals: 5, totalValue: 5000, byStage: {} });
    getEmailStatsMock.mockResolvedValue({ totalContacts: 300, totalCampaigns: 10, totalLists: 2 });
    getConfigMock.mockResolvedValue({ ANTHROPIC_API_KEY: "" });
    // Re-apply Notion/integrations mocks after clearAllMocks
    const notionReports = await import("@/lib/notion-reports");
    vi.mocked(notionReports.notionListReports).mockResolvedValue(null);
    vi.mocked(notionReports.notionGetReport).mockResolvedValue(null);
    vi.mocked(notionReports.notionCreateReport).mockResolvedValue(null);
    vi.mocked(notionReports.notionUpdateReport).mockResolvedValue(false);
    vi.mocked(notionReports.notionDeleteReport).mockResolvedValue(false);
    const integrations = await import("@/lib/integrations");
    vi.mocked(integrations.getIntegrationsAsync).mockResolvedValue({});
    await clearReports();
  });

  // ── GET /api/admin/reports ───────────────────────────────────────────────────

  describe("GET /api/admin/reports", () => {
    it("returns empty list initially", async () => {
      const { GET } = await import("@/app/api/admin/reports/route");
      const res = await GET(makeGet("/api/admin/reports"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.reports).toEqual([]);
      expect(data.total).toBe(0);
    });

    it("returns 401 when not authenticated", async () => {
      requireAdminMock.mockReturnValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });
      const { GET } = await import("@/app/api/admin/reports/route");
      const res = await GET(makeGet("/api/admin/reports"));
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/admin/reports/generate ────────────────────────────────────────

  describe("POST /api/admin/reports/generate", () => {
    it("returns 400 when clientName missing", async () => {
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      const res = await POST(makePost("/api/admin/reports/generate", { dateStart: "2026-04-01", dateEnd: "2026-04-30" }));
      expect(res.status).toBe(400);
    });

    it("generates report with pipeline and email sections", async () => {
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      const res = await POST(makePost("/api/admin/reports/generate", {
        clientName: "Acme Corp",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: ["pipeline", "email"],
      }));
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.report.clientName).toBe("Acme Corp");
      expect(data.report.status).toBe("ready");
      expect(data.report.sections.some((s: { id: string }) => s.id === "pipeline")).toBe(true);
      expect(data.report.sections.some((s: { id: string }) => s.id === "email")).toBe(true);
    });

    it("skips pipeline section when HubSpot not configured", async () => {
      isHubSpotConfiguredMock.mockResolvedValue(false);
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      const res = await POST(makePost("/api/admin/reports/generate", {
        clientName: "Client X",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: ["pipeline", "email"],
      }));
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.report.sections.some((s: { id: string }) => s.id === "pipeline")).toBe(false);
      expect(data.report.sections.some((s: { id: string }) => s.id === "email")).toBe(true);
    });

    it("generates report and appears in list", async () => {
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      await POST(makePost("/api/admin/reports/generate", {
        clientName: "Listed Client",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: ["email"],
      }));

      const { GET } = await import("@/app/api/admin/reports/route");
      const listRes = await GET(makeGet("/api/admin/reports"));
      const listData = await listRes.json();
      expect(listData.reports.some((r: { clientName: string }) => r.clientName === "Listed Client")).toBe(true);
    });
  });

  // ── GET /api/admin/reports/[id] ─────────────────────────────────────────────

  describe("GET /api/admin/reports/[id]", () => {
    it("returns 404 for unknown id", async () => {
      const { GET } = await import("@/app/api/admin/reports/[id]/route");
      const res = await GET(makeGet("/api/admin/reports/report_ghost"), { params: Promise.resolve({ id: "report_ghost" }) });
      expect(res.status).toBe(404);
    });

    it("returns report by id", async () => {
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      const genRes = await POST(makePost("/api/admin/reports/generate", {
        clientName: "Find Me",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: ["email"],
      }));
      const { report } = await genRes.json();

      const { GET } = await import("@/app/api/admin/reports/[id]/route");
      const res = await GET(makeGet(`/api/admin/reports/${report.id}`), { params: Promise.resolve({ id: report.id }) });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.report.clientName).toBe("Find Me");
    });
  });

  // ── DELETE /api/admin/reports/[id] ──────────────────────────────────────────

  describe("DELETE /api/admin/reports/[id]", () => {
    it("returns 404 for unknown id", async () => {
      const { DELETE } = await import("@/app/api/admin/reports/[id]/route");
      const res = await DELETE(makeDelete("/api/admin/reports/report_ghost"), { params: Promise.resolve({ id: "report_ghost" }) });
      expect(res.status).toBe(404);
    });

    it("deletes report and returns 200", async () => {
      const { POST } = await import("@/app/api/admin/reports/generate/route");
      const genRes = await POST(makePost("/api/admin/reports/generate", {
        clientName: "Delete Me",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: [],
      }));
      const { report } = await genRes.json();

      const { DELETE } = await import("@/app/api/admin/reports/[id]/route");
      const res = await DELETE(makeDelete(`/api/admin/reports/${report.id}`), { params: Promise.resolve({ id: report.id }) });
      expect(res.status).toBe(200);

      const { GET } = await import("@/app/api/admin/reports/[id]/route");
      const getRes = await GET(makeGet(`/api/admin/reports/${report.id}`), { params: Promise.resolve({ id: report.id }) });
      expect(getRes.status).toBe(404);
    });
  });
});
