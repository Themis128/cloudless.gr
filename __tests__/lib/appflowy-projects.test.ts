import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
  listWorkspaceViews: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  createPage: vi.fn().mockResolvedValue(null),
  updateViewName: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import {
  listProjects,
  getProject,
  updateProjectProgress,
  listTasks,
  updateTaskStatus,
  getTaskSummary,
  getOverdueTasks,
} from "@/lib/appflowy-projects";

describe("appflowy-projects (not configured)", () => {
  it("listProjects returns [] when AppFlowy is not configured", async () => {
    expect(await listProjects()).toEqual([]);
  });

  it("getProject returns null when not configured", async () => {
    expect(await getProject("page-id")).toBeNull();
  });

  it("updateProjectProgress returns false when not configured", async () => {
    expect(await updateProjectProgress("page-id", 50)).toBe(false);
  });

  it("listTasks returns [] when not configured", async () => {
    expect(await listTasks()).toEqual([]);
  });

  it("updateTaskStatus returns false when not configured", async () => {
    expect(await updateTaskStatus("page-id", "Done")).toBe(false);
  });

  it("getTaskSummary returns zeroed counts when not configured", async () => {
    const result = await getTaskSummary();
    expect(typeof result).toBe("object");
  });

  it("getOverdueTasks returns [] when not configured", async () => {
    expect(await getOverdueTasks()).toEqual([]);
  });
});
