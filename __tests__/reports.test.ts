import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
} from "@/lib/reports";

// Simulate Notion not configured so tests use the in-memory fallback
vi.mock("@/lib/notion-reports", () => ({
  notionListReports: vi.fn().mockResolvedValue(null),
  notionGetReport: vi.fn().mockResolvedValue(null),
  notionCreateReport: vi.fn().mockResolvedValue(null),
  notionUpdateReport: vi.fn().mockResolvedValue(false),
  notionDeleteReport: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
  isConfiguredAsync: vi.fn().mockResolvedValue(false),
  isConfigured: vi.fn().mockReturnValue(false),
  getIntegrations: vi.fn().mockReturnValue({}),
  resetIntegrationCacheAsync: vi.fn(),
}));

async function clearReports() {
  const all = await listReports();
  for (const r of all) {
    await deleteReport(r.id);
  }
}

describe("reports.ts", () => {
  beforeEach(async () => {
    await clearReports();
  });

  // ── createReport ─────────────────────────────────────────────────────────────

  describe("createReport", () => {
    it("creates a report with generating status", async () => {
      const report = await createReport({
        clientName: "Acme Corp",
        dateStart: "2026-04-01",
        dateEnd: "2026-04-30",
        includeSections: ["hubspot", "email"],
      });
      expect(report.id).toMatch(/^report_/);
      expect(report.clientName).toBe("Acme Corp");
      expect(report.status).toBe("generating");
      expect(report.sections).toEqual([]);
      expect(report.dateRange.start).toBe("2026-04-01");
      expect(report.dateRange.end).toBe("2026-04-30");
    });
  });

  // ── listReports ──────────────────────────────────────────────────────────────

  describe("listReports", () => {
    it("returns all reports sorted newest first", async () => {
      await createReport({ clientName: "A", dateStart: "2026-01-01", dateEnd: "2026-01-31", includeSections: [] });
      await new Promise((r) => setTimeout(r, 5));
      await createReport({ clientName: "B", dateStart: "2026-02-01", dateEnd: "2026-02-28", includeSections: [] });
      const reports = await listReports();
      expect(reports).toHaveLength(2);
      expect(reports[0].clientName).toBe("B");
      expect(reports[1].clientName).toBe("A");
    });

    it("returns empty array when no reports", async () => {
      expect(await listReports()).toEqual([]);
    });
  });

  // ── getReport ────────────────────────────────────────────────────────────────

  describe("getReport", () => {
    it("returns report by id", async () => {
      const r = await createReport({ clientName: "Client X", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      expect((await getReport(r.id))?.clientName).toBe("Client X");
    });

    it("returns null for unknown id", async () => {
      expect(await getReport("report_ghost")).toBeNull();
    });
  });

  // ── updateReport ─────────────────────────────────────────────────────────────

  describe("updateReport", () => {
    it("updates status and sections", async () => {
      const r = await createReport({ clientName: "Update Me", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      const updated = await updateReport(r.id, {
        status: "ready",
        sections: [{ id: "s1", title: "Pipeline", data: { deals: 10 } }],
      });
      expect(updated?.status).toBe("ready");
      expect(updated?.sections).toHaveLength(1);
    });

    it("returns null for unknown id", async () => {
      expect(await updateReport("report_ghost", { status: "error" })).toBeNull();
    });

    it("persists updates", async () => {
      const r = await createReport({ clientName: "X", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      await updateReport(r.id, { status: "ready" });
      expect((await getReport(r.id))?.status).toBe("ready");
    });
  });

  // ── deleteReport ─────────────────────────────────────────────────────────────

  describe("deleteReport", () => {
    it("removes report and returns true", async () => {
      const r = await createReport({ clientName: "To Delete", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      expect(await deleteReport(r.id)).toBe(true);
      expect(await getReport(r.id)).toBeNull();
    });

    it("returns false for unknown id", async () => {
      expect(await deleteReport("report_ghost")).toBe(false);
    });
  });
});
