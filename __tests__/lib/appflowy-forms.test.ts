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

describe("appflowy-forms tails", () => {
  it("updateSubmissionStatus logs the stub path when configured", async () => {
    const appflowy = await import("@/lib/appflowy");
    (appflowy.isAppFlowyConfigured as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(updateSubmissionStatus("p1", "In Review")).resolves.toBe(false);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Would update status")
    );
    spy.mockRestore();
  });
});
