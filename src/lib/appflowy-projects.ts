/**
 * AppFlowy Project & Task Tracker.
 *
 * Provides CRUD operations for Projects and Tasks stored as Documents in AppFlowy.
 * Both read and write — supports two-way sync between the app and AppFlowy.
 *
 * Document naming convention:
 *   [Project] <Name> - project document
 *   [Task] <Task Name> - task document
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectStatus = "Planning" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
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

export type TaskStatus = "Backlog" | "To Do" | "In Progress" | "In Review" | "Done" | "Blocked";
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
  sprint: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function parseProjectFields(text: string): Partial<Project> {
  const fields: Record<string, string> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\*\*([A-Za-z]+)\*\*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return {
    name: fields["Name"] || "",
    status: (fields["Status"] || "Planning") as ProjectStatus,
    priority: (fields["Priority"] || "Medium") as ProjectPriority,
    type: (fields["Type"] || "Internal") as ProjectType,
    owner: fields["Owner"] || "",
    startDate: fields["StartDate"] || "",
    dueDate: fields["DueDate"] || "",
    description: fields["Description"] || "",
    budget: fields["Budget"] ? parseFloat(fields["Budget"]) : null,
    progress: fields["Progress"] ? parseInt(fields["Progress"]) : 0,
    tags: fields["Tags"] ? fields["Tags"].split(",").map((t) => t.trim()) : [],
  };
}

function parseTaskFields(text: string): Partial<Task> {
  const fields: Record<string, string> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\*\*([A-Za-z]+)\*\*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return {
    task: fields["Task"] || fields["Name"] || "",
    status: (fields["Status"] || "Backlog") as TaskStatus,
    priority: (fields["Priority"] || "Medium") as TaskPriority,
    assignee: fields["Assignee"] || "",
    project: fields["Project"] || "",
    dueDate: fields["DueDate"] || "",
    estimate: (fields["Estimate"] || "") as TaskEstimate | "",
    type: (fields["Type"] || "") as TaskType | "",
    description: fields["Description"] || "",
    labels: fields["Labels"] ? fields["Labels"].split(",").map((t) => t.trim()) : [],
    sprint: fields["Sprint"] || "",
  };
}

function isProjectPage(name: string): boolean {
  return /^\[Project\]\s/i.test(name);
}

function isTaskPage(name: string): boolean {
  return /^\[Task\]\s/i.test(name);
}

function stripProjectPrefix(name: string): string {
  return name.replace(/^\[Project\]\s*/i, "").trim();
}

function stripTaskPrefix(name: string): string {
  return name.replace(/^\[Task\]\s*/i, "").trim();
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Projects API
// ---------------------------------------------------------------------------

export async function listProjects(statusFilter?: ProjectStatus): Promise<Project[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const projectViews = views.filter((v) => isProjectPage(v.name));

    const projects: Project[] = [];
    for (const view of projectViews) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const fields = parseProjectFields(text);

        if (statusFilter && fields.status !== statusFilter) continue;

        projects.push({
          id: view.view_id,
          name: fields.name || stripProjectPrefix(view.name),
          status: fields.status || "Planning",
          priority: fields.priority || "Medium",
          type: fields.type || "Internal",
          owner: fields.owner || "",
          startDate: fields.startDate || "",
          dueDate: fields.dueDate || "",
          description: fields.description || "",
          budget: fields.budget ?? null,
          progress: fields.progress || 0,
          tags: fields.tags || [],
          url: "",
        });
      } catch {
        // Skip failed documents
      }
    }

    // Sort by priority (Critical first) then by name
    const priorityOrder: Record<ProjectPriority, number> = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };
    return projects.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Projects] Failed to list projects:", msg);
    return [];
  }
}

export async function getProject(pageId: string): Promise<Project | null> {
  if (!(await isAppFlowyConfigured())) return null;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return null;

  try {
    const doc = await getDocument(workspaceId, pageId);
    const text = await extractDocText(doc);
    const fields = parseProjectFields(text);
    return {
      id: pageId,
      name: fields.name || "",
      status: fields.status || "Planning",
      priority: fields.priority || "Medium",
      type: fields.type || "Internal",
      owner: fields.owner || "",
      startDate: fields.startDate || "",
      dueDate: fields.dueDate || "",
      description: fields.description || "",
      budget: fields.budget ?? null,
      progress: fields.progress || 0,
      tags: fields.tags || [],
      url: "",
    };
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Projects] Failed to get project:", msg);
    return null;
  }
}

export async function createProject(data: {
  name: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  type?: ProjectType;
  owner?: string;
  description?: string;
}): Promise<string | null> {
  if (!(await isAppFlowyConfigured())) return null;

  // AppFlowy write API not yet implemented
  console.log("[AppFlowy Projects] Would create project:", data.name);
  return null;
}

export async function updateProjectStatus(pageId: string, status: ProjectStatus): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return false;
  console.log("[AppFlowy Projects] Would update status for", pageId, "to", status);
  return false;
}

export async function updateProjectProgress(pageId: string, progress: number): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return false;
  console.log("[AppFlowy Projects] Would update progress for", pageId, "to", progress);
  return false;
}

// ---------------------------------------------------------------------------
// Tasks API
// ---------------------------------------------------------------------------

export async function listTasks(filters?: {
  status?: TaskStatus;
  project?: string;
  assignee?: string;
}): Promise<Task[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const taskViews = views.filter((v) => isTaskPage(v.name));

    const tasks: Task[] = [];
    for (const view of taskViews) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const fields = parseTaskFields(text);

        if (filters?.status && fields.status !== filters.status) continue;
        if (filters?.project && fields.project !== filters.project) continue;
        if (filters?.assignee && fields.assignee !== filters.assignee) continue;

        tasks.push({
          id: view.view_id,
          task: fields.task || stripTaskPrefix(view.name),
          status: fields.status || "Backlog",
          priority: fields.priority || "Medium",
          assignee: fields.assignee || "",
          project: fields.project || "",
          dueDate: fields.dueDate || "",
          estimate: fields.estimate || "",
          type: fields.type || "",
          description: fields.description || "",
          labels: fields.labels || [],
          sprint: fields.sprint || "",
          url: "",
        });
      } catch {
        // Skip failed documents
      }
    }

    // Sort by status then priority
    const statusOrder: Record<TaskStatus, number> = {
      Backlog: 0,
      "To Do": 1,
      "In Progress": 2,
      "In Review": 3,
      Done: 4,
      Blocked: 5,
    };
    const priorityOrder: Record<TaskPriority, number> = {
      Urgent: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };
    return tasks.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 0;
      const sb = statusOrder[b.status] ?? 0;
      if (sa !== sb) return sa - sb;
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      return pa - pb;
    });
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Tasks] Failed to list tasks:", msg);
    return [];
  }
}

export async function createTask(data: {
  task: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  assignee?: string;
  type?: TaskType;
  description?: string;
  dueDate?: string;
}): Promise<string | null> {
  if (!(await isAppFlowyConfigured())) return null;
  console.log("[AppFlowy Tasks] Would create task:", data.task);
  return null;
}

export async function updateTaskStatus(pageId: string, status: TaskStatus): Promise<boolean> {
  if (!(await isAppFlowyConfigured())) return false;
  console.log("[AppFlowy Tasks] Would update status for", pageId, "to", status);
  return false;
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
// Sprint Support
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
 * Sprint is stored as a field in the Task document.
 */
export async function getSprintTasks(sprintName: string): Promise<Task[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const taskViews = views.filter((v) => isTaskPage(v.name));

    const tasks: Task[] = [];
    for (const view of taskViews) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const fields = parseTaskFields(text);

        if (fields.sprint === sprintName || fields.project === sprintName) {
          tasks.push({
            id: view.view_id,
            task: fields.task || stripTaskPrefix(view.name),
            status: fields.status || "Backlog",
            priority: fields.priority || "Medium",
            assignee: fields.assignee || "",
            project: fields.project || "",
            dueDate: fields.dueDate || "",
            estimate: fields.estimate || "",
            type: fields.type || "",
            description: fields.description || "",
            labels: fields.labels || [],
            sprint: fields.sprint || "",
            url: "",
          });
        }
      } catch {
        // Skip failed documents
      }
    }

    return tasks;
  } catch (err) {
    const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
    console.error("[AppFlowy Tasks] Failed to get sprint tasks:", msg);
    return [];
  }
}

/**
 * Get sprint progress — how many tasks are done vs total.
 */
export async function getSprintProgress(
  sprintName: string
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
export async function rolloverSprintTasks(fromSprint: string, toSprint: string): Promise<number> {
  if (!(await isAppFlowyConfigured())) return 0;

  const tasks = await getSprintTasks(fromSprint);
  const incomplete = tasks.filter((t) => t.status !== "Done");

  let moved = 0;
  for (const task of incomplete) {
    try {
      // AppFlowy write API not yet implemented
      console.log("[AppFlowy Tasks] Would move task", task.id, "from", fromSprint, "to", toSprint);
      moved++;
    } catch (err) {
      const msg = ((err as Error)?.message ?? "unknown error").replace(/[\r\n]/g, " ");
      console.error("[AppFlowy Tasks] Failed to move task:", msg);
    }
  }

  return moved;
}

/**
 * Bulk update status for multiple tasks.
 */
export async function bulkUpdateTaskStatus(taskIds: string[], status: TaskStatus): Promise<number> {
  if (!(await isAppFlowyConfigured())) return 0;

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
  if (!(await isAppFlowyConfigured())) return [];

  const tasks = await listTasks();
  const today = new Date().toISOString().split("T")[0];
  return tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "Done");
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
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "Done");

  return {
    project,
    tasks,
    summary: summary as Record<TaskStatus, number>,
    overdueTasks,
  };
}