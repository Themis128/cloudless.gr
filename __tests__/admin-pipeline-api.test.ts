import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const isHubSpotConfiguredMock = vi.fn();
const getDealsByStageMock = vi.fn();
const getPipelinesMock = vi.fn();
const getPipelineStatsMock = vi.fn();
const moveDealStageMock = vi.fn();
const createNoteMock = vi.fn();
const listNotesMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  getDealsByStage: getDealsByStageMock,
  getPipelines: getPipelinesMock,
  getPipelineStats: getPipelineStatsMock,
  moveDealStage: moveDealStageMock,
  createNote: createNoteMock,
  listNotes: listNotesMock,
}));

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

describe("Admin Pipeline API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isHubSpotConfiguredMock.mockResolvedValue(true);
  });

  // ── GET /api/admin/pipeline/board ────────────────────────────────────────────

  describe("GET /api/admin/pipeline/board", () => {
    it("returns 503 when HubSpot not configured", async () => {
      isHubSpotConfiguredMock.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/pipeline/board/route");
      const res = await GET(makeGet("/api/admin/pipeline/board"));
      expect(res.status).toBe(503);
    });

    it("returns board data with dealsByStage and pipelines", async () => {
      getDealsByStageMock.mockResolvedValueOnce({ closedwon: [{ id: "d1" }] });
      getPipelinesMock.mockResolvedValueOnce([{ id: "p1", label: "Default" }]);
      const { GET } = await import("@/app/api/admin/pipeline/board/route");
      const res = await GET(makeGet("/api/admin/pipeline/board"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.dealsByStage.closedwon).toHaveLength(1);
      expect(data.pipelines[0].id).toBe("p1");
      expect(data.fetchedAt).toBeTruthy();
    });

    it("returns 401 when not authenticated", async () => {
      requireAdminMock.mockReturnValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });
      const { GET } = await import("@/app/api/admin/pipeline/board/route");
      const res = await GET(makeGet("/api/admin/pipeline/board"));
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/admin/pipeline/stats ────────────────────────────────────────────

  describe("GET /api/admin/pipeline/stats", () => {
    it("returns 503 when HubSpot not configured", async () => {
      isHubSpotConfiguredMock.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/pipeline/stats/route");
      const res = await GET(makeGet("/api/admin/pipeline/stats"));
      expect(res.status).toBe(503);
    });

    it("returns pipeline stats", async () => {
      getPipelineStatsMock.mockResolvedValueOnce({
        totalDeals: 5,
        totalValue: 12500,
        byStage: { closedwon: { count: 2, value: 8000 } },
      });
      const { GET } = await import("@/app/api/admin/pipeline/stats/route");
      const res = await GET(makeGet("/api/admin/pipeline/stats"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.totalDeals).toBe(5);
      expect(data.totalValue).toBe(12500);
      expect(data.byStage.closedwon.count).toBe(2);
    });
  });

  // ── POST /api/admin/pipeline/deals/[id]/move ─────────────────────────────────

  describe("POST /api/admin/pipeline/deals/[id]/move", () => {
    const params = Promise.resolve({ id: "deal_1" });

    it("returns 503 when HubSpot not configured", async () => {
      isHubSpotConfiguredMock.mockResolvedValueOnce(false);
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/move/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/move", { stageId: "closedwon" }), { params });
      expect(res.status).toBe(503);
    });

    it("returns 400 when stageId missing", async () => {
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/move/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/move", {}), { params });
      expect(res.status).toBe(400);
    });

    it("moves deal and returns updated deal", async () => {
      moveDealStageMock.mockResolvedValueOnce({ id: "deal_1" });
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/move/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/move", { stageId: "closedwon" }), { params });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.deal.id).toBe("deal_1");
    });

    it("returns 500 when moveDealStage returns null", async () => {
      moveDealStageMock.mockResolvedValueOnce(null);
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/move/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/move", { stageId: "closedwon" }), { params });
      expect(res.status).toBe(500);
    });
  });

  // ── GET+POST /api/admin/pipeline/deals/[id]/notes ────────────────────────────

  describe("GET /api/admin/pipeline/deals/[id]/notes", () => {
    const params = Promise.resolve({ id: "deal_1" });

    it("returns notes list", async () => {
      listNotesMock.mockResolvedValueOnce([{ id: "note_1", properties: { hs_note_body: "Hello" } }]);
      const { GET } = await import("@/app/api/admin/pipeline/deals/[id]/notes/route");
      const res = await GET(makeGet("/api/admin/pipeline/deals/deal_1/notes"), { params });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.notes).toHaveLength(1);
    });
  });

  describe("POST /api/admin/pipeline/deals/[id]/notes", () => {
    const params = Promise.resolve({ id: "deal_1" });

    it("creates note and returns it", async () => {
      createNoteMock.mockResolvedValueOnce({ id: "note_1" });
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/notes/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/notes", { body: "Test note" }), { params });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.note.id).toBe("note_1");
    });

    it("returns 400 when body missing", async () => {
      const { POST } = await import("@/app/api/admin/pipeline/deals/[id]/notes/route");
      const res = await POST(makePost("/api/admin/pipeline/deals/deal_1/notes", {}), { params });
      expect(res.status).toBe(400);
    });
  });
});
