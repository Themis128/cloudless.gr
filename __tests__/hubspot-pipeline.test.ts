import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("hubspot.ts — pipeline extensions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetIntegrationCache();
    process.env.HUBSPOT_API_KEY = "test-hs-token";
  });

  // ── updateDeal ──────────────────────────────────────────────────────────────

  describe("updateDeal", () => {
    it("PATCHes the deal and returns the result", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "deal_1" }),
      });
      const { updateDeal } = await import("@/lib/hubspot");
      const result = await updateDeal("deal_1", { dealname: "Updated" });
      expect(result?.id).toBe("deal_1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v3/objects/deals/deal_1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const { updateDeal } = await import("@/lib/hubspot");
      const result = await updateDeal("deal_1", {});
      expect(result).toBeNull();
    });
  });

  // ── moveDealStage ───────────────────────────────────────────────────────────

  describe("moveDealStage", () => {
    it("updates dealstage property", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "deal_1" }),
      });
      const { moveDealStage } = await import("@/lib/hubspot");
      const result = await moveDealStage("deal_1", "closedwon");
      expect(result?.id).toBe("deal_1");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.properties.dealstage).toBe("closedwon");
    });
  });

  // ── getDealsByStage ─────────────────────────────────────────────────────────

  describe("getDealsByStage", () => {
    it("groups deals by dealstage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: "d1", properties: { dealname: "A", dealstage: "closedwon", amount: "100" } },
            { id: "d2", properties: { dealname: "B", dealstage: "closedwon", amount: "200" } },
            { id: "d3", properties: { dealname: "C", dealstage: "appointmentscheduled", amount: "50" } },
          ],
        }),
      });
      const { getDealsByStage } = await import("@/lib/hubspot");
      const grouped = await getDealsByStage();
      expect(grouped["closedwon"]).toHaveLength(2);
      expect(grouped["appointmentscheduled"]).toHaveLength(1);
    });

    it("returns empty object on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const { getDealsByStage } = await import("@/lib/hubspot");
      const grouped = await getDealsByStage();
      expect(grouped).toEqual({});
    });
  });

  // ── createNote ──────────────────────────────────────────────────────────────

  describe("createNote", () => {
    it("creates a note with the correct body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "note_1" }),
      });
      const { createNote } = await import("@/lib/hubspot");
      const result = await createNote("deal_1", "Test note");
      expect(result?.id).toBe("note_1");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.properties.hs_note_body).toBe("Test note");
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
      const { createNote } = await import("@/lib/hubspot");
      const result = await createNote("deal_1", "Test");
      expect(result).toBeNull();
    });
  });

  // ── getPipelineStats ────────────────────────────────────────────────────────

  describe("getPipelineStats", () => {
    it("calculates totalDeals, totalValue and byStage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: "d1", properties: { dealname: "A", amount: "1000", dealstage: "closedwon" } },
            { id: "d2", properties: { dealname: "B", amount: "500", dealstage: "closedwon" } },
            { id: "d3", properties: { dealname: "C", amount: "250", dealstage: "appointmentscheduled" } },
          ],
        }),
      });
      const { getPipelineStats } = await import("@/lib/hubspot");
      const stats = await getPipelineStats();
      expect(stats.totalDeals).toBe(3);
      expect(stats.totalValue).toBe(1750);
      expect(stats.byStage["closedwon"].count).toBe(2);
      expect(stats.byStage["closedwon"].value).toBe(1500);
      expect(stats.byStage["appointmentscheduled"].count).toBe(1);
    });

    it("returns zero stats on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const { getPipelineStats } = await import("@/lib/hubspot");
      const stats = await getPipelineStats();
      expect(stats.totalDeals).toBe(0);
      expect(stats.totalValue).toBe(0);
    });

    it("handles deals with no amount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: "d1", properties: { dealname: "A", amount: "", dealstage: "appointmentscheduled" } },
          ],
        }),
      });
      const { getPipelineStats } = await import("@/lib/hubspot");
      const stats = await getPipelineStats();
      expect(stats.totalValue).toBe(0);
      expect(stats.byStage["appointmentscheduled"].value).toBe(0);
    });
  });
});
