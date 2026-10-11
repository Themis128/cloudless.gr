import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Real-code tests for src/lib/appflowy-projects.ts — the Project/Task
 * tracker built on AppFlowy documents. The `./appflowy` client module is
 * the only fake (network boundary); all field parsing, filtering, sorting,
 * sprint, rollover, and dashboard logic runs for real.
 */

const listAllWorkspaces = vi.fn();
const listAllViewsDeep = vi.fn();
const getDocument = vi.fn();
const extractDocText = vi.fn();
const isAppFlowyConfigured = vi.fn();

vi.mock("@/lib/appflowy", () => ({
  listAllWorkspaces: (...a: unknown[]) => listAllWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => listAllViewsDeep(...a),
  getDocument: (...a: unknown[]) => getDocument(...a),
  extractDocText: (...a: unknown[]) => extractDocText(...a),
  isAppFlowyConfigured: (...a: unknown[]) => isAppFlowyConfigured(...a),
}));

import * as projects from "@/lib/appflowy-projects";

const WS = [{ workspace_id: "ws1", workspace_name: "Main", owner_uid: 1, member_count: 1, created_at: "2026" }];

function docText(text: string) {
  getDocument.mockResolvedValueOnce({ text });
  extractDocText.mockResolvedValueOnce(text);
}

function projectDoc(name: string, extra: Record<string, string> = {}) {
  const fields = { Name: name, Status: "In Progress", Priority: "Medium", Type: "Client", Owner: "Ana", ...extra };
  return Object.entries(fields).map(([k, v]) => `**${k}**: ${v}`).join("\n");
}

function taskDoc(fields: Record<string, string>) {
  return Object.entries({ Status: "Backlog", Priority: "Medium", ...fields })
    .map(([k, v]) => `**${k}**: ${v}`)
    .join("\n");
}

beforeEach(() => {
  for (const m of [listAllWorkspaces, listAllViewsDeep, getDocument, extractDocText, isAppFlowyConfigured]) {
    m.mockReset();
  }
  isAppFlowyConfigured.mockResolvedValue(true);
  listAllWorkspaces.mockResolvedValue(WS);
});

describe("unconfigured + no-workspace guards", () => {
  it("every public API short-circuits when AppFlowy is unconfigured", async () => {
    isAppFlowyConfigured.mockResolvedValue(false);
    expect(await projects.listProjects()).toEqual([]);
    expect(await projects.getProject("p1")).toBeNull();
    expect(await projects.createProject({ name: "X" })).toBeNull();
    expect(await projects.updateProjectStatus("p", "Done")).toBe(false);
    expect(await projects.updateProjectProgress("p", 50)).toBe(false);
    expect(await projects.listTasks()).toEqual([]);
    expect(await projects.createTask({ task: "t" })).toBeNull();
    expect(await projects.updateTaskStatus("t", "Done")).toBe(false);
    expect(await projects.getSprintTasks("S1")).toEqual([]);
    expect(await projects.rolloverSprintTasks("S1", "S2")).toBe(0);
    expect(await projects.bulkUpdateTaskStatus(["t1"], "Done")).toBe(0);
    expect(await projects.getOverdueTasks()).toEqual([]);
    expect(listAllWorkspaces).not.toHaveBeenCalled();
  });

  it("returns empty when there is no primary workspace", async () => {
    listAllWorkspaces.mockResolvedValue([]);
    expect(await projects.listProjects()).toEqual([]);
    expect(await projects.getProject("p1")).toBeNull();
    expect(await projects.listTasks()).toEqual([]);
    listAllWorkspaces.mockRejectedValue(new Error("down"));
    expect(await projects.listProjects()).toEqual([]);
  });
});

describe("listProjects", () => {
  it("parses [Project] docs, filters by status, sorts Critical-first then name", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "p1", name: "[Project] Zeta", type: "document" },
      { view_id: "p2", name: "[Project] Alpha", type: "document" },
      { view_id: "p3", name: "[Task] not a project", type: "document" },
      { view_id: "p4", name: "plain doc", type: "document" },
    ]);
    docText(projectDoc("Zeta", { Priority: "Low", Status: "Planning", Budget: "5000", Progress: "40", Tags: "a, b" }));
    docText(projectDoc("Alpha", { Priority: "Critical", Status: "In Progress" }));
    const out = await projects.listProjects();
    expect(out.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
    const zeta = out[1]!;
    expect(zeta).toMatchObject({ id: "p1", status: "Planning", priority: "Low", type: "Client", owner: "Ana", budget: 5000, progress: 40, tags: ["a", "b"] });

    // status filter
    listAllViewsDeep.mockResolvedValue([
      { view_id: "p1", name: "[Project] Zeta", type: "document" },
      { view_id: "p2", name: "[Project] Alpha", type: "document" },
    ]);
    docText(projectDoc("Zeta", { Status: "Planning" }));
    docText(projectDoc("Alpha", { Status: "In Progress" }));
    const filtered = await projects.listProjects("In Progress");
    expect(filtered.map((p) => p.name)).toEqual(["Alpha"]);
  });

  it("falls back to the stripped page name and skips failed documents", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "p1", name: "[Project] From Title", type: "document" },
      { view_id: "p2", name: "[Project] Broken", type: "document" },
    ]);
    docText("no fields here"); // name falls back to stripped prefix, defaults fill in
    getDocument.mockRejectedValueOnce(new Error("bad doc"));
    const out = await projects.listProjects();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "From Title", status: "Planning", priority: "Medium", type: "Internal", budget: null });
  });

  it("returns [] when the views fetch fails", async () => {
    listAllViewsDeep.mockRejectedValue(new Error("views down"));
    expect(await projects.listProjects()).toEqual([]);
  });
});

describe("getProject", () => {
  it("maps a document to a Project and returns null on errors", async () => {
    docText(projectDoc("Dash", { Status: "Completed", Priority: "High", DueDate: "2026-12-01" }));
    const p = await projects.getProject("p9");
    expect(p).toMatchObject({ id: "p9", name: "Dash", status: "Completed", priority: "High", dueDate: "2026-12-01" });
    getDocument.mockRejectedValueOnce(new Error("x"));
    expect(await projects.getProject("p9")).toBeNull();
  });
});

describe("listTasks + filters + summary", () => {
  it("parses [Task] docs, applies status/project/assignee filters, sorts", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] Fix bug", type: "document" },
      { view_id: "t2", name: "[Task] Ship feat", type: "document" },
      { view_id: "t3", name: "[Project] not a task", type: "document" },
    ]);
    docText(taskDoc({ Task: "Fix bug", Status: "Done", Priority: "High", Assignee: "Ana", Project: "P1", Sprint: "S1", Labels: "x, y", Estimate: "S", Type: "Bug" }));
    docText(taskDoc({ Task: "Ship feat", Status: "In Progress", Priority: "Urgent", Assignee: "Bo", Project: "P2" }));
    const all = await projects.listTasks();
    expect(all.map((t) => t.task)).toEqual(["Ship feat", "Fix bug"]); // In Progress < Done
    expect(all[1]).toMatchObject({ labels: ["x", "y"], estimate: "S", type: "Bug", sprint: "S1" });

    listAllViewsDeep.mockResolvedValue([{ view_id: "t1", name: "[Task] Fix bug", type: "document" }]);
    docText(taskDoc({ Task: "Fix bug", Status: "Done", Assignee: "Ana", Project: "P1" }));
    expect(await projects.listTasks({ status: "Backlog" })).toEqual([]);

    listAllViewsDeep.mockResolvedValue([{ view_id: "t1", name: "[Task] Fix bug", type: "document" }]);
    docText(taskDoc({ Task: "Fix bug", Assignee: "Ana", Project: "P1" }));
    expect(await projects.listTasks({ project: "P1", assignee: "Ana" })).toHaveLength(1);

    listAllViewsDeep.mockResolvedValue([{ view_id: "t1", name: "[Task] Fix bug", type: "document" }]);
    docText(taskDoc({ Task: "Fix bug", Assignee: "Ana", Project: "P1" }));
    expect(await projects.listTasks({ project: "OTHER" })).toEqual([]);
  });

  it("getTaskSummary counts per status", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] a", type: "document" },
      { view_id: "t2", name: "[Task] b", type: "document" },
      { view_id: "t3", name: "[Task] c", type: "document" },
    ]);
    docText(taskDoc({ Task: "a", Status: "Done" }));
    docText(taskDoc({ Task: "b", Status: "Done" }));
    docText(taskDoc({ Task: "c", Status: "Blocked" }));
    const s = await projects.getTaskSummary();
    expect(s.Done).toBe(2);
    expect(s.Blocked).toBe(1);
    expect(s.Backlog).toBe(0);
  });

  it("listTasks returns [] when views fetch fails", async () => {
    listAllViewsDeep.mockRejectedValue(new Error("nope"));
    expect(await projects.listTasks()).toEqual([]);
  });
});

describe("sprints", () => {
  it("getSprintTasks matches on sprint name or project field", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] a", type: "document" },
      { view_id: "t2", name: "[Task] b", type: "document" },
      { view_id: "t3", name: "[Task] c", type: "document" },
    ]);
    docText(taskDoc({ Task: "a", Sprint: "S9" }));
    docText(taskDoc({ Task: "b", Project: "S9" }));
    docText(taskDoc({ Task: "c", Sprint: "other" }));
    const tasks = await projects.getSprintTasks("S9");
    expect(tasks.map((t) => t.task).sort()).toEqual(["a", "b"]);

    // empty sprint → zero progress (re-queue an empty views list)
    listAllViewsDeep.mockResolvedValue([]);
    expect(await projects.getSprintProgress("nope")).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it("getSprintProgress computes done/total percent", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] a", type: "document" },
      { view_id: "t2", name: "[Task] b", type: "document" },
    ]);
    docText(taskDoc({ Task: "a", Sprint: "S1", Status: "Done" }));
    docText(taskDoc({ Task: "b", Sprint: "S1", Status: "To Do" }));
    expect(await projects.getSprintProgress("S1")).toEqual({ total: 2, done: 1, percent: 50 });
  });

  it("rolloverSprintTasks counts incomplete tasks", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] a", type: "document" },
      { view_id: "t2", name: "[Task] b", type: "document" },
      { view_id: "t3", name: "[Task] c", type: "document" },
    ]);
    docText(taskDoc({ Task: "a", Sprint: "S1", Status: "Done" }));
    docText(taskDoc({ Task: "b", Sprint: "S1", Status: "To Do" }));
    docText(taskDoc({ Task: "c", Sprint: "S1", Status: "Blocked" }));
    expect(await projects.rolloverSprintTasks("S1", "S2")).toBe(2);
  });

  it("getSprintTasks returns [] when views fetch fails", async () => {
    listAllViewsDeep.mockRejectedValue(new Error("bad"));
    expect(await projects.getSprintTasks("S1")).toEqual([]);
  });
});

describe("bulk + overdue + dashboard", () => {
  it("bulkUpdateTaskStatus counts successful updates (stub always fails)", async () => {
    expect(await projects.bulkUpdateTaskStatus(["t1", "t2", "t3"], "Done")).toBe(0);
  });

  it("getOverdueTasks filters past-due non-Done tasks", async () => {
    const today = new Date().toISOString().split("T")[0]!;
    listAllViewsDeep.mockResolvedValue([
      { view_id: "t1", name: "[Task] a", type: "document" },
      { view_id: "t2", name: "[Task] b", type: "document" },
      { view_id: "t3", name: "[Task] c", type: "document" },
      { view_id: "t4", name: "[Task] d", type: "document" },
    ]);
    docText(taskDoc({ Task: "a", Status: "To Do", DueDate: "2020-01-01" }));
    docText(taskDoc({ Task: "b", Status: "Done", DueDate: "2020-01-01" }));
    docText(taskDoc({ Task: "c", Status: "To Do", DueDate: "2999-01-01" }));
    docText(taskDoc({ Task: "d", Status: "To Do" })); // no due date
    const overdue = await projects.getOverdueTasks();
    expect(overdue.map((t) => t.task)).toEqual(["a"]);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getProjectDashboard aggregates project, tasks, summary, overdue", async () => {
    listAllViewsDeep.mockResolvedValue([
      { view_id: "p1", name: "[Project] Alpha", type: "document" },
      { view_id: "t1", name: "[Task] one", type: "document" },
      { view_id: "t2", name: "[Task] two", type: "document" },
    ]);
    // listProjects pass
    docText(projectDoc("Alpha", { Status: "In Progress" }));
    // listTasks({project: "Alpha"}) pass
    docText(taskDoc({ Task: "one", Project: "Alpha", Status: "To Do", DueDate: "2020-01-01" }));
    docText(taskDoc({ Task: "two", Project: "Alpha", Status: "Done" }));
    const dash = await projects.getProjectDashboard("Alpha");
    expect(dash!.project?.name).toBe("Alpha");
    expect(dash!.tasks).toHaveLength(2);
    expect(dash!.summary["To Do"]).toBe(1);
    expect(dash!.summary.Done).toBe(1);
    expect(dash!.overdueTasks.map((t) => t.task)).toEqual(["one"]);
  });
});
