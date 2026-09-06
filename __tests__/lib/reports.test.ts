import { describe, it, expect } from "vitest";
import { listReports, getReport, createReport, updateReport, deleteReport } from "@/lib/reports";

describe("reports (in-memory store)", () => {
  it("listReports returns an array", async () => {
    expect(Array.isArray(await listReports())).toBe(true);
  });

  it("getReport returns null for unknown id", async () => {
    expect(await getReport("nonexistent-id")).toBeNull();
  });

  it("createReport adds a report and it can be retrieved", async () => {
    const report = await createReport({
      clientName: "Acme",
      dateStart: "2026-01-01",
      dateEnd: "2026-01-31",
    });
    expect(report.id).toBeTruthy();
    expect(report.clientName).toBe("Acme");
    expect(report.status).toBe("generating");

    const found = await getReport(report.id);
    expect(found?.id).toBe(report.id);
  });

  it("updateReport returns null for unknown id", async () => {
    expect(await updateReport("nonexistent-id", { status: "complete" })).toBeNull();
  });

  it("deleteReport returns false for unknown id", async () => {
    expect(await deleteReport("nonexistent-id")).toBe(false);
  });
});
