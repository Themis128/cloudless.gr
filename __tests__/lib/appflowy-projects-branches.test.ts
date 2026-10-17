import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Branch tests for src/lib/appflowy-projects.ts, using the same harness as
 * appflowy-projects.test.ts (only the ./appflowy client is faked). Covers
 * unknown priority/status values in sorting and summaries, non-Error
 * failures, assignee filter misses, unreadable task docs, prose lines in
 * documents, and a missing workspace for sprint lookups.
 */

const listAllWorkspaces = vi.fn();
const listAllViewsDeep = vi.fn();
const getDocument = vi.fn();
const extractDocText = vi.fn();
const isAppFlowyConfigured = vi.fn();

vi.mock("@/lib/appflowy", () => ({
  listAllWorkspaces: (...a: unknown[]) => listAllWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => listAllViewsDeep(...a),
  fetchViewMarkdownMap: async (_ws: string, views: { view_id: string }[]) =>
    new Map(
      await Promise.all(
        views.map(async (v) => {
          try {
            return [v.view_id, await extractDocText(await getDocument(_ws, v.view_id))] as const;
          } catch {
            return [v.view_id, null] as const;
          }
        })
      )
    ),
  getDocument: (...a: unknown[]) => getDocument(...a),
  extractDocText: (...a: unknown[]) => extractDocText(...a),
  isAppFlowyConfigured: (...a: unknown[]) => isAppFlowyConfigured(...a),
}));

import * as projects from "@/lib/appflowy-projects";

const WS = [
  {
    workspace_id: "ws1",
    workspace_name: "Main",
    owner_uid: 1,
    member_count: 1,
    created_at: "2026",
  },
];

function docText(text: string) {
  getDocument.mockResolvedValueOnce({ text });
  extractDocText.mockResolvedValueOnce(text);
}

function projectDoc(name: string, extra: Record<string, string> = {}) {
  const fields = {
    Name: name,
    Status: "In Progress",
    Priority: "Medium",
    Type: "Client",
    Owner: "Ana",
    ...extra,
  };
  return Object.entries(fields)
    .map(([k, v]) => `**${k}**: ${v}`)
    .join("\n");
}

function taskDoc(fields: Record<string, string>) {
  return Object.entries({ Status: "Backlog", Priority: "Medium", ...fields })
    .map(([k, v]) => `**${k}**: ${v}`)
    .join("\n");
}

beforeEach(() => {
  for (const m of [
    listAllWorkspaces,
    listAllViewsDeep,
    getDocument,
    extractDocText,
    isAppFlowyConfigured,
  ]) {
    m.mockReset();
  }
  isAppFlowyConfigured.mockResolvedValue(true);
  listAllWorkspaces.mockResolvedValue(WS);
});

const views = (...v: [string, string][]) =>
  v.map(([view_id, name]) => ({ view_id, name, type: "document" }));

describe("appflowy-projects — residual branches", () => {
  it("projects with an unknown priority sort as Medium; prose lines are ignored", async () => {
    listAllViewsDeep.mockResolvedValue(
      views(["p1", "[Project] Odd"], ["p2", "[Project] Low one"], ["p3", "[Project] Crit"])
    );
    docText(`Intro paragraph without a field\n${projectDoc("Odd", { Priority: "Whenever" })}`);
    docText(projectDoc("Low one", { Priority: "Low" }));
    docText(projectDoc("Crit", { Priority: "Critical" }));
    const out = await projects.listProjects();
    expect(out.map((p) => p.name)).toEqual(["Crit", "Odd", "Low one"]);
    expect(out[1].priority).toBe("Whenever");
  });

  it("tasks with unknown status/priority sort as Backlog/Medium and count in the summary", async () => {
    listAllViewsDeep.mockResolvedValue(
      views(["t1", "[Task] A"], ["t2", "[Task] B"], ["t3", "[Task] C"], ["t4", "[Task] D"])
    );
    docText(taskDoc({ Task: "A", Status: "To Do", Priority: "Low" }));
    docText(taskDoc({ Task: "B", Status: "Parked", Priority: "Someday" }));
    docText(taskDoc({ Task: "C", Status: "Backlog", Priority: "Urgent" }));
    docText(taskDoc({ Task: "D", Status: "Backlog", Priority: "Someday" }));
    const out = await projects.listTasks();
    // Backlog-equivalent first (Urgent < unknown=Medium), then To Do
    expect(out.map((t) => t.task)).toEqual(["C", "B", "D", "A"]);

    listAllViewsDeep.mockResolvedValue(views(["t1", "[Task] A"], ["t2", "[Task] B"]));
    docText(taskDoc({ Task: "A", Status: "Parked" }));
    docText(taskDoc({ Task: "B", Status: "Parked" }));
    const summary = await projects.getTaskSummary();
    expect(summary).toMatchObject({ Backlog: 0, Done: 0 });
    expect((summary as Record<string, number>).Parked).toBe(2);
  });

  it("assignee filter drops other assignees; unreadable task docs are skipped", async () => {
    listAllViewsDeep.mockResolvedValue(
      views(["t1", "[Task] Mine"], ["t2", "[Task] Theirs"], ["t3", "[Task] Broken"])
    );
    docText(taskDoc({ Task: "Mine", Assignee: "Ana" }));
    docText(taskDoc({ Task: "Theirs", Assignee: "Bo" }));
    getDocument.mockRejectedValueOnce(new Error("404"));
    const out = await projects.listTasks({ assignee: "Ana" });
    expect(out.map((t) => t.task)).toEqual(["Mine"]);
    expect(getDocument).toHaveBeenCalledTimes(3);
  });

  it("non-Error failures are logged as 'unknown error'", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    listAllViewsDeep.mockRejectedValue(null);
    expect(await projects.listProjects()).toEqual([]);
    expect(await projects.listTasks()).toEqual([]);
    expect(await projects.getSprintTasks("S1")).toEqual([]);
    getDocument.mockRejectedValueOnce(undefined);
    expect(await projects.getProject("p1")).toBeNull();
    const msgs = err.mock.calls.map((c) => c[1]);
    expect(msgs).toEqual(["unknown error", "unknown error", "unknown error", "unknown error"]);
    err.mockRestore();
  });

  it("error messages have newlines flattened before logging", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    listAllViewsDeep.mockRejectedValue(new Error("line1\nline2\rline3"));
    await projects.listTasks();
    expect(err).toHaveBeenCalledWith(expect.any(String), "line1 line2 line3");
    err.mockRestore();
  });

  it("sprint lookups return [] without a primary workspace", async () => {
    listAllWorkspaces.mockResolvedValue([]);
    expect(await projects.getSprintTasks("S1")).toEqual([]);
    expect(await projects.getSprintProgress("S1")).toEqual({ total: 0, done: 0, percent: 0 });
    expect(listAllViewsDeep).not.toHaveBeenCalled();
  });

  it("project dashboard: unknown project → null project, unknown task status counted", async () => {
    listAllViewsDeep
      .mockResolvedValueOnce(views(["p1", "[Project] Other"]))
      .mockResolvedValueOnce(views(["t1", "[Task] X"]));
    docText(projectDoc("Other"));
    docText(taskDoc({ Task: "X", Project: "Ghost", Status: "Parked" }));
    const dash = await projects.getProjectDashboard("Ghost");
    expect(dash!.project).toBeNull();
    expect(dash!.tasks.map((t) => t.task)).toEqual(["X"]);
    expect((dash!.summary as Record<string, number>).Parked).toBe(1);
    expect(dash!.overdueTasks).toEqual([]);
  });
});
