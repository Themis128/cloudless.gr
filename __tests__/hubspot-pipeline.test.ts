import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

import {
  updateDeal,
  moveDealStage,
  getDealsByStage,
  listNotes,
  createNote,
  getPipelineStats,
} from "@/lib/hubspot";

const STAGE_CLOSEDWON = "closedwon";
const STAGE_APPT_SCHEDULED = "appointmentscheduled";

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
      const result = await updateDeal("deal_1", { dealname: "Updated" });
      expect(result?.id).toBe("deal_1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/crm/v3/objects/deals/deal_1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
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
      const result = await moveDealStage("deal_1", STAGE_CLOSEDWON);
      expect(result?.id).toBe("deal_1");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.properties.dealstage).toBe(STAGE_CLOSEDWON);
    });
  });

  // ── getDealsByStage ─────────────────────────────────────────────────────────

  describe("getDealsByStage", () => {
    it("groups deals by dealstage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: "d1", properties: { dealname: "A", dealstage: STAGE_CLOSEDWON, amount: "100" } },
            { id: "d2", properties: { dealname: "B", dealstage: STAGE_CLOSEDWON, amount: "200" } },
            { id: "d3", properties: { dealname: "C", dealstage: STAGE_APPT_SCHEDULED, amount: "50" } },
          ],
        }),
      });
      const grouped = await getDealsByStage();
      expect(grouped[STAGE_CLOSEDWON]).toHaveLength(2);
      expect(grouped[STAGE_APPT_SCHEDULED]).toHaveLength(1);
    });

    it("paginates across multiple pages", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ id: "d1", properties: { dealstage: STAGE_CLOSEDWON } }],
            paging: { next: { after: "cursor_abc" } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ id: "d2", properties: { dealstage: STAGE_CLOSEDWON } }],
          }),
        });
      const grouped = await getDealsByStage();
      expect(grouped[STAGE_CLOSEDWON]).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondUrl: string = mockFetch.mock.calls[1][0];
      expect(secondUrl).toContain("after=cursor_abc");
    });

    it("returns empty object on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const grouped = await getDealsByStage();
      expect(grouped).toEqual({});
    });
  });

  // ── listNotes ───────────────────────────────────────────────────────────────

  describe("listNotes", () => {
    it("returns notes via batch read", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ id: "n1" }, { id: "n2" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { id: "n1", properties: { hs_note_body: "First note", hs_timestamp: "2025-01-01T00:00:00Z" } },
              { id: "n2", properties: { hs_note_body: "Second note", hs_timestamp: "2025-01-02T00:00:00Z" } },
            ],
          }),
        });
      const notes = await listNotes("deal_1");
      expect(notes).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const batchCall = mockFetch.mock.calls[1];
      expect(batchCall[0]).toContain("/crm/v3/objects/notes/batch/read");
      expect(batchCall[1].method).toBe("POST");
      const batchBody = JSON.parse(batchCall[1].body as string);
      expect(batchBody.inputs).toEqual([{ id: "n1" }, { id: "n2" }]);
    });

    it("returns [] when deal has no associated notes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
      const notes = await listNotes("deal_1");
      expect(notes).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("returns [] when associations fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
      const notes = await listNotes("deal_1");
      expect(notes).toEqual([]);
    });

    it("returns [] when batch read fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: "n1" }] }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const notes = await listNotes("deal_1");
      expect(notes).toEqual([]);
    });
  });

  // ── createNote ──────────────────────────────────────────────────────────────

  describe("createNote", () => {
    it("creates a note with the correct body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "note_1" }),
      });
      const result = await createNote("deal_1", "Test note");
      expect(result?.id).toBe("note_1");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.properties.hs_note_body).toBe("Test note");
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
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
            { id: "d1", properties: { dealname: "A", amount: "1000", dealstage: STAGE_CLOSEDWON } },
            { id: "d2", properties: { dealname: "B", amount: "500", dealstage: STAGE_CLOSEDWON } },
            { id: "d3", properties: { dealname: "C", amount: "250", dealstage: STAGE_APPT_SCHEDULED } },
          ],
        }),
      });
      const stats = await getPipelineStats();
      expect(stats.totalDeals).toBe(3);
      expect(stats.totalValue).toBe(1750);
      expect(stats.byStage[STAGE_CLOSEDWON].count).toBe(2);
      expect(stats.byStage[STAGE_CLOSEDWON].value).toBe(1500);
      expect(stats.byStage[STAGE_APPT_SCHEDULED].count).toBe(1);
    });

    it("paginates to collect all deals", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { id: "d1", properties: { amount: "100", dealstage: STAGE_CLOSEDWON } },
            ],
            paging: { next: { after: "pg2" } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { id: "d2", properties: { amount: "200", dealstage: STAGE_CLOSEDWON } },
            ],
          }),
        });
      const stats = await getPipelineStats();
      expect(stats.totalDeals).toBe(2);
      expect(stats.totalValue).toBe(300);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns zero stats on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const stats = await getPipelineStats();
      expect(stats.totalDeals).toBe(0);
      expect(stats.totalValue).toBe(0);
    });

    it("handles deals with no amount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: "d1", properties: { dealname: "A", amount: "", dealstage: STAGE_APPT_SCHEDULED } },
          ],
        }),
      });
      const stats = await getPipelineStats();
      expect(stats.totalValue).toBe(0);
      expect(stats.byStage[STAGE_APPT_SCHEDULED].value).toBe(0);
    });
  });
});
