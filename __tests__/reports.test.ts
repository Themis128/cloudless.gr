import { describe, it, expect, beforeEach } from "vitest";
import {
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
} from "@/lib/reports";

function clearReports() {
  listReports().forEach((r) => deleteReport(r.id));
}

describe("reports.ts", () => {
  beforeEach(() => {
    clearReports();
  });

  // ── createReport ─────────────────────────────────────────────────────────────

  describe("createReport", () => {
    it("creates a report with generating status", () => {
      const report = createReport({
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
      createReport({ clientName: "A", dateStart: "2026-01-01", dateEnd: "2026-01-31", includeSections: [] });
      await new Promise((r) => setTimeout(r, 5));
      createReport({ clientName: "B", dateStart: "2026-02-01", dateEnd: "2026-02-28", includeSections: [] });
      const reports = listReports();
      expect(reports).toHaveLength(2);
      expect(reports[0].clientName).toBe("B");
      expect(reports[1].clientName).toBe("A");
    });

    it("returns empty array when no reports", () => {
      expect(listReports()).toEqual([]);
    });
  });

  // ── getReport ────────────────────────────────────────────────────────────────

  describe("getReport", () => {
    it("returns report by id", () => {
      const r = createReport({ clientName: "Client X", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      expect(getReport(r.id)?.clientName).toBe("Client X");
    });

    it("returns null for unknown id", () => {
      expect(getReport("report_ghost")).toBeNull();
    });
  });

  // ── updateReport ─────────────────────────────────────────────────────────────

  describe("updateReport", () => {
    it("updates status and sections", () => {
      const r = createReport({ clientName: "Update Me", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      const updated = updateReport(r.id, {
        status: "ready",
        sections: [{ id: "s1", title: "Pipeline", data: { deals: 10 } }],
      });
      expect(updated?.status).toBe("ready");
      expect(updated?.sections).toHaveLength(1);
    });

    it("returns null for unknown id", () => {
      expect(updateReport("report_ghost", { status: "error" })).toBeNull();
    });

    it("persists updates", () => {
      const r = createReport({ clientName: "X", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      updateReport(r.id, { status: "ready" });
      expect(getReport(r.id)?.status).toBe("ready");
    });
  });

  // ── deleteReport ─────────────────────────────────────────────────────────────

  describe("deleteReport", () => {
    it("removes report and returns true", () => {
      const r = createReport({ clientName: "To Delete", dateStart: "2026-04-01", dateEnd: "2026-04-30", includeSections: [] });
      expect(deleteReport(r.id)).toBe(true);
      expect(getReport(r.id)).toBeNull();
    });

    it("returns false for unknown id", () => {
      expect(deleteReport("report_ghost")).toBe(false);
    });
  });
});
