/**
 * Notion Project & Task Tracker.
 *
 * Provides CRUD operations for the Projects and Tasks databases.
 * Both read and write — supports two-way sync between the app and Notion.
 *
 * DB IDs:
 *   Projects → NOTION_PROJECTS_DB_ID (a9bab34b945e484fb6b0aa6034086e5c)
 *   Tasks    → NOTION_TASKS_DB_ID    (14ce4ff6c400437597b13e70ac909354)
 */

import { notionFetch, notionFetchAll, extractText } from "@/lib/notion";
import { getIntegrationsAsync, requireIntegrationAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "Planning"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";
export type ProjectPriority = "Critical" | "High" | "Medium" | "Low";
export type ProjectType = "Client" | "Internal" | "Maintenance";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  type: ProjectType;
  owner: string;
  startDate: string;
  dueDate: string;
  description: string;
  budget: number | null;
  progress: number;
  tags: string[];
  url: string;
}

export type TaskStatus =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "In Review"
  | "Done"
  | "Blocked";
export type TaskPriority = "Urgent" | "High" | "Medium" | "Low";
export type TaskEstimate = "XS" | "S" | "M" | "L" | "XL";
export type TaskType = "Feature" | "Bug" | "Chore" | "Spike" | "Design";

export interface Task {
  id: string;
  task: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  project: string;
  dueDate: string;
  estimate: TaskEstimate | "";
  type: TaskType | "";
  description: string;
  labels: string[];
  url: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProject(page: any): Project {
  const p = page.properties ?? {};
  return {
    id: page.id,
    name: extractText(p.Name?.title),
    status: (p.Status?.select?.name ?? "Planning") as ProjectStatus,
    priority: (p.Priority?.select?.name ?? "Medium") as ProjectPriority,
    type: (p.Type?.select?.name ?? "Internal") as ProjectType,
    owner:
      (p.Owner?.people ?? []).map((u: any) => u.name ?? "").join(", ") ||
      extractText(p.Owner?.rich_text),
    startDate: p["Start Date"]?.date?.start ?? "",
    dueDate: p["Due Date"]?.date?.start ?? "",
    description: extractText(p.Description?.rich_text),
    budget: p.Budget?.number ?? null,
    progress: p.Progress?.number ?? 0,
    tags: (p.Tags?.multi_select ?? []).map((t: any) => t.name),
    url: page.url,
  };
}

function mapTask(page: any): Task {
  const p = page.properties ?? {};
  return {
    id: page.id,
    task: extractText(p.Task?.title),
    status: (p.Status?.select?.name ?? "Backlog") as TaskStatus,
    priority: (p.Priority?.select?.name ?? "Medium") as TaskPriority,
    assignee:
      (p.Assignee?.people ?? []).map((u: any) => u.name ?? "").join(", ") ||
      extractText(p.Assignee?.rich_text),
    project: p.Project?.relation?.length
      ? p.Project.relation.map((r: { id: string }) => r.id).join(", ")
      : "",
    dueDate: p["Due Date"]?.date?.start ?? "",
    estimate: (p.Estimate?.select?.name ?? "") as TaskEstimate | "",
    type: (p.Type?.select?.name ?? "") as TaskType | "",
    description: extractText(p.Description?.rich_text),
    labels: (p.Labels?.multi_select ?? []).map((t: any) => t.name),
    url: page.url,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Projects API
// ---------------------------------------------------------------------------

export async function listProjects(
  statusFilter?: ProjectStatus,
): Promise<Project[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_PROJECTS_DB_ID");

  const { NOTION_PROJECTS_DB_ID } = await getIntegrationsAsync();
  try {
    const filter = statusFilter
      ? { property: "Status", select: { equals: statusFilter } }
      : undefined;

    const pages = await notionFetchAll(
      `/databases/${NOTION_PROJECTS_DB_ID}/query`,
      {
        ...(filter ? { filter } : {}),
        sorts: [{ property: "Priority", direction: "ascending" }],
      },
    );
    return pages.map(mapProject);
  } catch (err) {
    console.error("[Notion Projects] Failed to list projects:", err);
    return [];
  }
}

export async function getProject(pageId: string): Promise<Project | null> {
  await requireIntegrationAsync("NOTION_API_KEY");
  try {
    const page = await notionFetch(`/pages/${pageId}`);
    return mapProject(page);
  } catch (err) {
    console.error("[Notion Projects] Failed to get project:", err);
    return null;
  }
}

export async function createProject(data: {
  name: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  type?: ProjectType;
  /** Notion user ID (People type) */
  owner?: string;
  description?: string;
}): Promise<string | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_PROJECTS_DB_ID");

  const { NOTION_PROJECTS_DB_ID } = await getIntegrationsAsync();
  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_PROJECTS_DB_ID },
        properties: {
          Name: { title: [{ text: { content: data.name } }] },
          Status: { select: { name: data.status ?? "Planning" } },
          Priority: { select: { name: data.priority ?? "Medium" } },
          Type: { select: { name: data.type ?? "Internal" } },
          ...(data.owner ? { Owner: { people: [{ id: data.owner }] } } : {}),
          ...(data.description
            ? {
                Description: {
                  rich_text: [
                    { text: { content: data.description.slice(0, 2000) } },
                  ],
                },
              }
            : {}),
          "Start Date": {
            date: { start: new Date().toISOString().split("T")[0] },
          },
        },
      }),
    });
    return page.id;
  } catch (err) {
    console.error("[Notion Projects] Failed to create project:", err);
    return null;
  }
}

export async function updateProjectStatus(
  pageId: string,
  status: ProjectStatus,
): Promise<boolean> {
  await requireIntegrationAsync("NOTION_API_KEY");
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: { Status: { select: { name: status } } },
      }),
    });
    return true;
  } catch (err) {
    console.error("[Notion Projects] Failed to update project status:", err);
    return false;
  }
}

export async function updateProjectProgress(
  pageId: string,
  progress: number,
): Promise<boolean> {
  await requireIntegrationAsync("NOTION_API_KEY");
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Progress: { number: Math.min(100, Math.max(0, progress)) },
        },
      }),
    });
    return true;
  } catch (err) {
    console.error("[Notion Projects] Failed to update project progress:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tasks API
// ---------------------------------------------------------------------------

export async function listTasks(filters?: {
  status?: TaskStatus;
  project?: string;
  assignee?: string;
}): Promise<Task[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID");

  const { NOTION_TASKS_DB_ID } = await getIntegrationsAsync();
  try {
    const conditions: Record<string, unknown>[] = [];
    if (filters?.status) {
      conditions.push({
        property: "Status",
        select: { equals: filters.status },
      });
    }
    if (filters?.project) {
      conditions.push({
        property: "Project",
        relation: { contains: filters.project },
      });
    }
    if (filters?.assignee) {
      conditions.push({
        property: "Assignee",
        people: { contains: filters.assignee },
      });
    }

    const filter =
      conditions.length > 1
        ? { and: conditions }
        : conditions.length === 1
          ? conditions[0]
          : undefined;

    const pages = await notionFetchAll(
      `/databases/${NOTION_TASKS_DB_ID}/query`,
      {
        ...(filter ? { filter } : {}),
        sorts: [
          { property: "Status", direction: "ascending" },
          { property: "Priority", direction: "ascending" },
        ],
      },
    );
    return pages.map(mapTask);
  } catch (err) {
    console.error("[Notion Tasks] Failed to list tasks:", err);
    return [];
  }
}

export async function createTask(data: {
  task: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  /** Notion user ID (People type) */
  assignee?: string;
  type?: TaskType;
  description?: string;
  dueDate?: string;
}): Promise<string | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID");

  const { NOTION_TASKS_DB_ID } = await getIntegrationsAsync();
  try {
    const page = await notionFetch<{ id: string }>("/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_TASKS_DB_ID },
        properties: {
          Task: { title: [{ text: { content: data.task } }] },
          Status: { select: { name: data.status ?? "To Do" } },
          Priority: { select: { name: data.priority ?? "Medium" } },
          ...(data.project
            ? { Project: { relation: [{ id: data.project }] } }
            : {}),
          ...(data.assignee
            ? { Assignee: { people: [{ id: data.assignee }] } }
            : {}),
          ...(data.type ? { Type: { select: { name: data.type } } } : {}),
          ...(data.description
            ? {
                Description: {
                  rich_text: [
                    { text: { content: data.description.slice(0, 2000) } },
                  ],
                },
              }
            : {}),
          ...(data.dueDate
            ? { "Due Date": { date: { start: data.dueDate } } }
            : {}),
        },
      }),
    });
    return page.id;
  } catch (err) {
    console.error("[Notion Tasks] Failed to create task:", err);
    return null;
  }
}

export async function updateTaskStatus(
  pageId: string,
  status: TaskStatus,
): Promise<boolean> {
  await requireIntegrationAsync("NOTION_API_KEY");
  try {
    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: { Status: { select: { name: status } } },
      }),
    });
    return true;
  } catch (err) {
    console.error("[Notion Tasks] Failed to update task status:", err);
    return false;
  }
}

/**
 * Get task counts grouped by status (for Kanban board summary).
 */
export async function getTaskSummary(): Promise<Record<TaskStatus, number>> {
  const tasks = await listTasks();
  const summary: Record<string, number> = {
    Backlog: 0,
    "To Do": 0,
    "In Progress": 0,
    "In Review": 0,
    Done: 0,
    Blocked: 0,
  };
  for (const t of tasks) {
    summary[t.status] = (summary[t.status] ?? 0) + 1;
  }
  return summary as Record<TaskStatus, number>;
}

// ---------------------------------------------------------------------------
// Sprint Support (from notion-projects Academy skill)
// ---------------------------------------------------------------------------

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "Planning" | "Active" | "Completed";
  taskCount: number;
  completedCount: number;
}

/**
 * List tasks for a specific sprint name.
 * Sprint is typically stored as a Select property on the Task.
 */
export async function getSprintTasks(sprintName: string): Promise<Task[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID");

  const { NOTION_TASKS_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_TASKS_DB_ID}/query`,
      {
        filter: {
          property: "Sprint",
          rich_text: { equals: sprintName },
        },
        sorts: [
          { property: "Status", direction: "ascending" },
          { property: "Priority", direction: "ascending" },
        ],
      },
    );
    return pages.map(mapTask);
  } catch (err) {
    console.error("[Notion Tasks] Failed to get sprint tasks:", err);
    return [];
  }
}

/**
 * Get sprint progress — how many tasks are done vs total.
 */
export async function getSprintProgress(
  sprintName: string,
): Promise<{ total: number; done: number; percent: number }> {
  const tasks = await getSprintTasks(sprintName);
  const done = tasks.filter((t) => t.status === "Done").length;
  const total = tasks.length;
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Bulk Operations
// ---------------------------------------------------------------------------

/**
 * Move all incomplete tasks from one sprint to another.
 * Useful for sprint rollovers.
 */
export async function rolloverSprintTasks(
  fromSprint: string,
  toSprint: string,
): Promise<number> {
  await requireIntegrationAsync("NOTION_API_KEY");

  const tasks = await getSprintTasks(fromSprint);
  const incomplete = tasks.filter((t) => t.status !== "Done");

  let moved = 0;
  for (const task of incomplete) {
    try {
      await notionFetch(`/pages/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            Sprint: { rich_text: [{ text: { content: toSprint } }] },
          },
        }),
      });
      moved++;
    } catch (err) {
      console.error(`[Notion Tasks] Failed to move task ${task.id}:`, err);
    }
  }

  return moved;
}

/**
 * Bulk update status for multiple tasks.
 */
export async function bulkUpdateTaskStatus(
  taskIds: string[],
  status: TaskStatus,
): Promise<number> {
  await requireIntegrationAsync("NOTION_API_KEY");

  let updated = 0;
  for (const id of taskIds) {
    const ok = await updateTaskStatus(id, status);
    if (ok) updated++;
  }
  return updated;
}

/**
 * Get overdue tasks — tasks with a due date before today that aren't Done.
 */
export async function getOverdueTasks(): Promise<Task[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID");

  const { NOTION_TASKS_DB_ID } = await getIntegrationsAsync();
  const today = new Date().toISOString().split("T")[0];

  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_TASKS_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Due Date", date: { before: today } },
            {
              property: "Status",
              select: { does_not_equal: "Done" },
            },
          ],
        },
        sorts: [{ property: "Due Date", direction: "ascending" }],
      },
    );
    return pages.map(mapTask);
  } catch (err) {
    console.error("[Notion Tasks] Failed to get overdue tasks:", err);
    return [];
  }
}

/**
 * Get project dashboard — project with its tasks and progress.
 */
export async function getProjectDashboard(projectName: string): Promise<{
  project: Project | null;
  tasks: Task[];
  summary: Record<TaskStatus, number>;
  overdueTasks: Task[];
} | null> {
  const projects = await listProjects();
  const project = projects.find((p) => p.name === projectName) ?? null;
  const tasks = await listTasks({ project: projectName });

  const summary: Record<string, number> = {
    Backlog: 0,
    "To Do": 0,
    "In Progress": 0,
    "In Review": 0,
    Done: 0,
    Blocked: 0,
  };
  for (const t of tasks) {
    summary[t.status] = (summary[t.status] ?? 0) + 1;
  }

  const today = new Date().toISOString().split("T")[0];
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "Done",
  );

  return {
    project,
    tasks,
    summary: summary as Record<TaskStatus, number>,
    overdueTasks,
  };
}
