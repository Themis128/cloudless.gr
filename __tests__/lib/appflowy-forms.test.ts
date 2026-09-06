import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  getWorkspaceFolder: vi.fn().mockResolvedValue(null),
  createPage: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { saveSubmission, listSubmissions, updateSubmissionStatus } from "@/lib/appflowy-forms";

describe("appflowy-forms (not configured)", () => {
  it("saveSubmission returns null when AppFlowy is not configured", async () => {
    const result = await saveSubmission({
      name: "Alice",
      email: "alice@example.com",
      message: "Hello",
    });
    expect(result).toBeNull();
  });

  it("listSubmissions returns [] when not configured", async () => {
    expect(await listSubmissions()).toEqual([]);
  });

  it("updateSubmissionStatus returns false when not configured", async () => {
    expect(await updateSubmissionStatus("id1", "resolved")).toBe(false);
  });
});
