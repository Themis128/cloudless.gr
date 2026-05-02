import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache, IntegrationNotConfiguredError } from "@/lib/integrations";

const mockNotionFetch = vi.fn();
const mockNotionFetchAll = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
  extractText: (rt: { plain_text: string }[] | undefined) =>
    (rt ?? []).map((t) => t.plain_text).join(""),
}));

function makeProjectPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    url: "https://notion.so/proj-1",
    properties: {
      Name: { title: [{ plain_text: "Website Redesign" }] },
      Status: { select: { name: "In Progress" } },
      Priority: { select: { name: "High" } },
      Type: { select: { name: "Client" } },
      Owner: { people: [{ name: "Themis" }] },
      "Start Date": { date: { start: "2026-03-01" } },
      "Due Date": { date: { start: "2026-06-01" } },
      Description: { rich_text: [{ plain_text: "Full redesign" }] },
      Budget: { number: 5000 },
      Progress: { number: 45 },
      Tags: { multi_select: [{ name: "web" }, { name: "design" }] },
    },
    ...overrides,
  };
}

function makeTaskPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    url: "https://notion.so/task-1",
    properties: {
      Task: { title: [{ plain_text: "Fix header layout" }] },
      Status: { select: { name: "In Progress" } },
      Priority: { select: { name: "High" } },
      Assignee: { people: [{ name: "Themis" }] },
      Project: { relation: [{ id: "project-1" }] },
      "Due Date": { date: { start: "2026-04-15" } },
      Estimate: { select: { name: "M" } },
      Type: { select: { name: "Bug" } },
      Description: { rich_text: [{ plain_text: "Header breaks on mobile" }] },
      Labels: { multi_select: [{ name: "frontend" }] },
    },
    ...overrides,
  };
}

describe("notion-projects.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
  });

  describe("listProjects", () => {
    it("returns mapped projects", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeProjectPage()]);

      const { listProjects } = await import("@/lib/notion-projects");
      const projects = await listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("Website Redesign");
      expect(projects[0].status).toBe("In Progress");
      expect(projects[0].priority).toBe("High");
      expect(projects[0].progress).toBe(45);
      expect(projects[0].tags).toEqual(["web", "design"]);
    });

    it("applies status filter when provided", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { listProjects } = await import("@/lib/notion-projects");
      await listProjects("Completed");

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter).toEqual({
        property: "Status",
        select: { equals: "Completed" },
      });
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { listProjects } = await import("@/lib/notion-projects");
      await expect(listProjects()).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("createProject", () => {
    it("creates a project page", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new-proj" });

      const { createProject } = await import("@/lib/notion-projects");
      const id = await createProject({
        name: "New Project",
        priority: "Critical",
        type: "Internal",
        owner: "331d872b-594c-81a8-a2b9-00022873ac1a",
      });

      expect(id).toBe("new-proj");
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.parent.database_id).toBe("projects-db-123");
      expect(body.properties.Name.title[0].text.content).toBe("New Project");
      expect(body.properties.Priority.select.name).toBe("Critical");
    });

    it("returns null on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { createProject } = await import("@/lib/notion-projects");
      expect(await createProject({ name: "X" })).toBeNull();
    });
  });

  describe("updateProjectStatus", () => {
    it("patches status", async () => {
      mockNotionFetch.mockResolvedValueOnce({});

      const { updateProjectStatus } = await import("@/lib/notion-projects");
      const ok = await updateProjectStatus("proj-1", "Completed");

      expect(ok).toBe(true);
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("Completed");
    });
  });

  describe("updateProjectProgress", () => {
    it("clamps progress to 0-100", async () => {
      mockNotionFetch.mockResolvedValueOnce({});

      const { updateProjectProgress } = await import("@/lib/notion-projects");
      await updateProjectProgress("proj-1", 150);

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Progress.number).toBe(100);
    });

    it("clamps negative to 0", async () => {
      mockNotionFetch.mockResolvedValueOnce({});

      const { updateProjectProgress } = await import("@/lib/notion-projects");
      await updateProjectProgress("proj-1", -10);

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Progress.number).toBe(0);
    });
  });

  describe("listTasks", () => {
    it("returns mapped tasks", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([makeTaskPage()]);

      const { listTasks } = await import("@/lib/notion-projects");
      const tasks = await listTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].task).toBe("Fix header layout");
      expect(tasks[0].status).toBe("In Progress");
      expect(tasks[0].type).toBe("Bug");
      expect(tasks[0].labels).toEqual(["frontend"]);
    });

    it("builds compound filter with multiple conditions", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { listTasks } = await import("@/lib/notion-projects");
      await listTasks({ status: "Done", project: "project-1" });

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter.and).toHaveLength(2);
    });
  });

  describe("createTask", () => {
    it("creates a task page with all fields", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new-task" });

      const { createTask } = await import("@/lib/notion-projects");
      const id = await createTask({
        task: "Implement feature",
        priority: "Urgent",
        type: "Feature",
        project: "project-1",
        assignee: "331d872b-594c-81a8-a2b9-00022873ac1a",
        dueDate: "2026-05-01",
      });

      expect(id).toBe("new-task");
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Task.title[0].text.content).toBe("Implement feature");
      expect(body.properties["Due Date"].date.start).toBe("2026-05-01");
    });
  });

  describe("getTaskSummary", () => {
    it("returns counts by status", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        makeTaskPage(),
        makeTaskPage({ id: "t2", properties: { ...makeTaskPage().properties, Status: { select: { name: "Done" } } } }),
        makeTaskPage({ id: "t3", properties: { ...makeTaskPage().properties, Status: { select: { name: "Done" } } } }),
      ]);

      const { getTaskSummary } = await import("@/lib/notion-projects");
      const summary = await getTaskSummary();

      expect(summary["In Progress"]).toBe(1);
      expect(summary["Done"]).toBe(2);
      expect(summary["Backlog"]).toBe(0);
    });

    it("initializes all statuses to 0", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { getTaskSummary } = await import("@/lib/notion-projects");
      const summary = await getTaskSummary();

      expect(summary["Backlog"]).toBe(0);
      expect(summary["To Do"]).toBe(0);
      expect(summary["In Progress"]).toBe(0);
      expect(summary["In Review"]).toBe(0);
      expect(summary["Done"]).toBe(0);
      expect(summary["Blocked"]).toBe(0);
    });
  });

  describe("getProject", () => {
    it("fetches a single project by page ID", async () => {
      mockNotionFetch.mockResolvedValueOnce(makeProjectPage());

      const { getProject } = await import("@/lib/notion-projects");
      const project = await getProject("proj-1");

      expect(project).not.toBeNull();
      expect(project!.name).toBe("Website Redesign");
      expect(project!.progress).toBe(45);
      expect(mockNotionFetch).toHaveBeenCalledWith("/pages/proj-1");
    });

    it("returns null on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { getProject } = await import("@/lib/notion-projects");
      expect(await getProject("bad-id")).toBeNull();
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { getProject } = await import("@/lib/notion-projects");
      await expect(getProject("proj-1")).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("updateTaskStatus", () => {
    it("patches task status", async () => {
      mockNotionFetch.mockResolvedValueOnce({});

      const { updateTaskStatus } = await import("@/lib/notion-projects");
      const ok = await updateTaskStatus("task-1", "Done");

      expect(ok).toBe(true);
      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("Done");
    });

    it("returns false on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { updateTaskStatus } = await import("@/lib/notion-projects");
      expect(await updateTaskStatus("task-1", "Done")).toBe(false);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { updateTaskStatus } = await import("@/lib/notion-projects");
      await expect(updateTaskStatus("task-1", "Done")).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("updateProjectStatus edge cases", () => {
    it("returns false on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { updateProjectStatus } = await import("@/lib/notion-projects");
      // Intentionally pass an out-of-domain status to verify the catch path.
      expect(
        await updateProjectStatus(
          "proj-1",
          "Done" as unknown as Parameters<typeof updateProjectStatus>[1],
        ),
      ).toBe(false);
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { updateProjectStatus } = await import("@/lib/notion-projects");
      await expect(updateProjectStatus("proj-1", "Completed")).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("listTasks edge cases", () => {
    it("builds single filter for one condition", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { listTasks } = await import("@/lib/notion-projects");
      await listTasks({ assignee: "Themis" });

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      // Single condition should NOT be wrapped in { and: [...] }
      expect(callBody.filter.property).toBe("Assignee");
      expect(callBody.filter.people.contains).toBe("Themis");
    });

    it("passes no filter when no conditions", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([]);

      const { listTasks } = await import("@/lib/notion-projects");
      await listTasks({});

      const callBody = mockNotionFetchAll.mock.calls[0][1];
      expect(callBody.filter).toBeUndefined();
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { listTasks } = await import("@/lib/notion-projects");
      await expect(listTasks()).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });

    it("returns empty on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("fail"));

      const { listTasks } = await import("@/lib/notion-projects");
      expect(await listTasks()).toEqual([]);
    });
  });

  describe("createProject edge cases", () => {
    it("uses default values for optional fields", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new" });

      const { createProject } = await import("@/lib/notion-projects");
      await createProject({ name: "Minimal" });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("Planning");
      expect(body.properties.Priority.select.name).toBe("Medium");
      expect(body.properties.Type.select.name).toBe("Internal");
      expect(body.properties.Owner).toBeUndefined();
      expect(body.properties.Description).toBeUndefined();
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { createProject } = await import("@/lib/notion-projects");
      await expect(createProject({ name: "X" })).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("createTask edge cases", () => {
    it("uses default values for optional fields", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "t1" });

      const { createTask } = await import("@/lib/notion-projects");
      await createTask({ task: "Minimal task" });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("To Do");
      expect(body.properties.Priority.select.name).toBe("Medium");
      expect(body.properties.Project).toBeUndefined();
      expect(body.properties.Assignee).toBeUndefined();
      expect(body.properties.Type).toBeUndefined();
      expect(body.properties["Due Date"]).toBeUndefined();
    });

    it("returns null on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("fail"));

      const { createTask } = await import("@/lib/notion-projects");
      expect(await createTask({ task: "X" })).toBeNull();
    });

    it("throws when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const { createTask } = await import("@/lib/notion-projects");
      await expect(createTask({ task: "X" })).rejects.toBeInstanceOf(IntegrationNotConfiguredError);
    });
  });

  describe("mapProject edge cases", () => {
    it("defaults to expected values for missing properties", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        {
          id: "proj-empty",
          url: "https://notion.so/proj-empty",
          properties: {},
        },
      ]);

      const { listProjects } = await import("@/lib/notion-projects");
      const projects = await listProjects();

      expect(projects[0].name).toBe("");
      expect(projects[0].status).toBe("Planning");
      expect(projects[0].priority).toBe("Medium");
      expect(projects[0].type).toBe("Internal");
      expect(projects[0].budget).toBeNull();
      expect(projects[0].progress).toBe(0);
      expect(projects[0].tags).toEqual([]);
    });
  });

  describe("mapTask edge cases", () => {
    it("defaults to expected values for missing properties", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        {
          id: "task-empty",
          url: "https://notion.so/task-empty",
          properties: {},
        },
      ]);

      const { listTasks } = await import("@/lib/notion-projects");
      const tasks = await listTasks();

      expect(tasks[0].task).toBe("");
      expect(tasks[0].status).toBe("Backlog");
      expect(tasks[0].priority).toBe("Medium");
      expect(tasks[0].estimate).toBe("");
      expect(tasks[0].type).toBe("");
      expect(tasks[0].labels).toEqual([]);
    });
  });
});
