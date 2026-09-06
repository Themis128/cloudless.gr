import { describe, it, expect } from "vitest";
import { buildReportHtml } from "@/lib/client-report-email";
import type { ClientPortal } from "@/lib/client-report-email";

const minimalPortal: ClientPortal = {
  token: "tok123",
  clientName: "Alice",
  label: "Q3 Project",
  steps: [],
  paymentLinks: [],
  deliverables: [],
};

describe("buildReportHtml", () => {
  it("returns a string containing the portal label", () => {
    const html = buildReportHtml(minimalPortal);
    expect(typeof html).toBe("string");
    expect(html).toContain("Q3 Project");
  });

  it("includes the client name", () => {
    expect(buildReportHtml(minimalPortal)).toContain("Alice");
  });

  it("shows no deliverables message when list is empty", () => {
    expect(buildReportHtml(minimalPortal)).toContain("No deliverables shared yet");
  });
});
