import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  createPage: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { getReports, getReport, updateReport } from "@/lib/appflowy-reports";

describe("appflowy-reports (not configured)", () => {
  it("getReports returns [] when AppFlowy is not configured", async () => {
    expect(await getReports()).toEqual([]);
  });

  it("getReport returns null when not configured", async () => {
    expect(await getReport("any-id")).toBeNull();
  });

  it("updateReport returns false when not configured", async () => {
    expect(await updateReport("any-id", {})).toBe(false);
  });
});
