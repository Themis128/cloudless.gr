"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface Task {
  id: string;
  task: string;
  status: string;
  priority: string;
  assignee: string;
  project: string;
  dueDate: string;
  estimate: string;
  type: string;
  description: string;
  labels: string[];
  sprint?: string;
  url: string;
}

type TaskStatus =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "In Review"
  | "Done"
  | "Blocked";
type TaskPriority = "Urgent" | "High" | "Medium" | "Low";

const COLUMNS: TaskStatus[] = [
  "Backlog",
  "To Do",
  "In Progress",
  "In Review",
  "Done",
  "Blocked",
];

const COLUMN_STYLES: Record<
  string,
  { border: string; header: string; dot: string }
> = {
  Backlog: {
    border: "border-slate-700",
    header: "text-slate-400",
    dot: "bg-slate-500",
  },
  "To Do": {
    border: "border-neon-blue/30",
    header: "text-neon-blue",
    dot: "bg-neon-blue",
  },
  "In Progress": {
    border: "border-neon-cyan/30",
    header: "text-neon-cyan",
    dot: "bg-neon-cyan",
  },
  "In Review": {
    border: "border-neon-magenta/30",
    header: "text-neon-magenta",
    dot: "bg-neon-magenta",
  },
  Done: {
    border: "border-neon-green/30",
    header: "text-neon-green",
    dot: "bg-neon-green",
  },
  Blocked: {
    border: "border-red-500/30",
    header: "text-red-400",
    dot: "bg-red-500",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-slate-700/40 text-slate-500 border-slate-600/30",
};

const TYPE_ICONS: Record<string, string> = {
  Feature: "✦",
  Bug: "🐛",
  Chore: "⚙",
  Spike: "🔬",
  Design: "🎨",
};

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate || status === "Done") return false;
  return new Date(dueDate) < new Date();
}

export default function TasksKanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "sprint">(
    "kanban",
  );
  const [selectedSprint, setSelectedSprint] = useState<string>("all");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>("To Do");

  // Create form state
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("Medium");
  const [newProject, setNewProject] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newType, setNewType] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/tasks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tasks: Task[] };
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const updateStatus = async (pageId: string, status: TaskStatus) => {
    setUpdating(pageId);
    try {
      const res = await fetchWithAuth("/api/admin/notion/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTasks((prev) =>
        prev.map((t) => (t.id === pageId ? { ...t, status } : t)),
      );
    } catch (err) {
      console.error("Failed to update task:", err);
    } finally {
      setUpdating(null);
    }
  };

  const bulkUpdateStatus = async () => {
    if (bulkSelected.size === 0) return;
    setUpdating("bulk");
    try {
      const promises = Array.from(bulkSelected).map((id) =>
        fetchWithAuth("/api/admin/notion/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: id, status: bulkStatus }),
        }),
      );
      await Promise.all(promises);
      setTasks((prev) =>
        prev.map((t) =>
          bulkSelected.has(t.id) ? { ...t, status: bulkStatus } : t,
        ),
      );
      setBulkSelected(new Set());
    } catch (err) {
      console.error("Bulk update failed:", err);
    } finally {
      setUpdating(null);
    }
  };

  const createTask = async () => {
    if (!newTask.trim()) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/notion/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: newTask,
          priority: newPriority,
          project: newProject || undefined,
          assignee: newAssignee || undefined,
          type: newType || undefined,
          dueDate: newDueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewTask("");
      setNewProject("");
      setNewAssignee("");
      setNewDueDate("");
      setShowCreate(false);
      load();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreating(false);
    }
  };

  // Get unique sprints
  const sprints = [
    ...new Set(tasks.map((t) => t.sprint).filter(Boolean)),
  ] as string[];

  // Filter tasks
  const filteredTasks =
    selectedSprint === "all"
      ? tasks
      : selectedSprint === "overdue"
        ? tasks.filter((t) => isOverdue(t.dueDate, t.status))
        : tasks.filter((t) => t.sprint === selectedSprint);

  const tasksByStatus = (status: string) =>
    filteredTasks.filter((t) => t.status === status);
  const overdueCount = tasks.filter((t) =>
    isOverdue(t.dueDate, t.status),
  ).length;

  // Sprint progress
  const sprintTotal = filteredTasks.length;
  const sprintDone = filteredTasks.filter((t) => t.status === "Done").length;
  const sprintPercent =
    sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0;

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---------- Task card component ----------
  const TaskCard = ({ task }: { task: Task }) => {
    const overdue = isOverdue(task.dueDate, task.status);
    return (
      <div
        className={`group rounded-lg border p-3 transition-all hover:border-slate-600 ${
          overdue
            ? "border-red-500/30 bg-red-500/5"
            : "border-slate-700/50 bg-void/60"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {viewMode === "list" && (
                <input
                  type="checkbox"
                  checked={bulkSelected.has(task.id)}
                  onChange={() => toggleBulk(task.id)}
                  className="mr-1 accent-neon-cyan"
                />
              )}
              {task.type && (
                <span className="text-xs" title={task.type}>
                  {TYPE_ICONS[task.type] ?? "•"}
                </span>
              )}
              <h4 className="truncate text-sm font-medium text-white">
                {task.task}
              </h4>
              {overdue && (
                <span className="ml-1 rounded bg-red-500/20 px-1 py-0.5 font-mono text-[8px] text-red-400">
                  OVERDUE
                </span>
              )}
            </div>
            {task.description && (
              <p className="font-body mt-1 text-xs text-slate-500 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-slate-600 opacity-0 transition-all hover:text-slate-400 group-hover:opacity-100"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9 6.5v3a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4a1 1 0 011-1H5.5M7.5 1.5h3m0 0v3m0-3L5.5 6.5" />
              </svg>
            </a>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Medium}`}
          >
            {task.priority}
          </span>
          {task.estimate && (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
              {task.estimate}
            </span>
          )}
          {task.sprint && (
            <span className="rounded bg-neon-blue/5 px-1.5 py-0.5 font-mono text-[9px] text-neon-blue/60">
              {task.sprint}
            </span>
          )}
          {task.dueDate && (
            <span
              className={`font-mono text-[9px] ${overdue ? "text-red-400" : "text-slate-600"}`}
            >
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {task.project && (
              <span className="rounded bg-neon-cyan/5 px-1.5 py-0.5 font-mono text-[9px] text-neon-cyan/60">
                {task.project}
              </span>
            )}
            {task.assignee && (
              <span className="rounded bg-neon-magenta/5 px-1.5 py-0.5 font-mono text-[9px] text-neon-magenta/60">
                {task.assignee}
              </span>
            )}
          </div>
          <select
            value={task.status}
            disabled={updating === task.id || updating === "bulk"}
            onChange={(e) =>
              updateStatus(task.id, e.target.value as TaskStatus)
            }
            className="rounded border border-slate-700 bg-void px-1 py-0.5 font-mono text-[9px] text-slate-400 focus:border-neon-cyan/50 focus:outline-none disabled:opacity-50"
          >
            {COLUMNS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {task.labels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.labels.map((label) => (
              <span
                key={label}
                className="rounded bg-slate-800/50 px-1.5 py-0.5 font-mono text-[8px] text-slate-600"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">
              NOTION_TASKS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Task Board
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Kanban view of your Notion tasks database.
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-2 font-mono text-xs transition-colors ${
                viewMode === "kanban"
                  ? "bg-neon-magenta/10 text-neon-magenta"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              ☰ Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 font-mono text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-neon-magenta/10 text-neon-magenta"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              ≡ List
            </button>
            <button
              onClick={() => setViewMode("sprint")}
              className={`px-3 py-2 font-mono text-xs transition-colors ${
                viewMode === "sprint"
                  ? "bg-neon-magenta/10 text-neon-magenta"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              ⟳ Sprint
            </button>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors"
          >
            + New Task
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Sprint filter + progress */}
      {sprints.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-slate-500">Sprint:</span>
          <button
            onClick={() => setSelectedSprint("all")}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              selectedSprint === "all"
                ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                : "border-slate-700 text-slate-500 hover:border-slate-600"
            }`}
          >
            All ({tasks.length})
          </button>
          {sprints.map((sprint) => (
            <button
              key={sprint}
              onClick={() => setSelectedSprint(sprint)}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                selectedSprint === sprint
                  ? "border-neon-blue/50 bg-neon-blue/10 text-neon-blue"
                  : "border-slate-700 text-slate-500 hover:border-slate-600"
              }`}
            >
              {sprint} ({tasks.filter((t) => t.sprint === sprint).length})
            </button>
          ))}
          {overdueCount > 0 && (
            <button
              onClick={() => setSelectedSprint("overdue")}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                selectedSprint === "overdue"
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-slate-700 text-red-400/70 hover:border-red-500/30"
              }`}
            >
              Overdue ({overdueCount})
            </button>
          )}

          {/* Sprint progress bar */}
          {selectedSprint !== "all" && selectedSprint !== "overdue" && (
            <div className="ml-auto flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-neon-green transition-all"
                  style={{ width: `${sprintPercent}%` }}
                />
              </div>
              <span className="font-mono text-xs text-slate-500">
                {sprintDone}/{sprintTotal} ({sprintPercent}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions */}
      {viewMode === "list" && bulkSelected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-3">
          <span className="font-mono text-xs text-neon-cyan">
            {bulkSelected.size} selected
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
            className="rounded border border-slate-700 bg-void px-2 py-1 font-mono text-xs text-slate-300 focus:outline-none"
          >
            {COLUMNS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={bulkUpdateStatus}
            disabled={updating === "bulk"}
            className="rounded border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-50"
          >
            {updating === "bulk" ? "Updating…" : "Update All"}
          </button>
          <button
            onClick={() => setBulkSelected(new Set())}
            className="font-mono text-xs text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-6">
          <h3 className="font-heading mb-4 font-semibold text-white">
            Create Task
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input
              type="text"
              placeholder="Task title *"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="bg-void sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-magenta/50 focus:outline-none"
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-neon-magenta/50 focus:outline-none"
            >
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-neon-magenta/50 focus:outline-none"
            >
              <option value="">Type (optional)</option>
              <option value="Feature">Feature</option>
              <option value="Bug">Bug</option>
              <option value="Chore">Chore</option>
              <option value="Spike">Spike</option>
              <option value="Design">Design</option>
            </select>
            <input
              type="text"
              placeholder="Project"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-magenta/50 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Assignee"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-magenta/50 focus:outline-none"
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-neon-magenta/50 focus:outline-none"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={createTask}
              disabled={creating || !newTask.trim()}
              className="bg-neon-magenta/10 border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/20 rounded-lg border px-6 py-2 font-mono text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-sm text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-6 gap-3">
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/30 p-4"
            >
              <div className="mb-3 h-4 w-20 rounded bg-slate-700/60" />
              <div className="space-y-2">
                <div className="h-16 rounded bg-slate-800/40" />
                <div className="h-16 rounded bg-slate-800/40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kanban view */}
      {!loading && viewMode === "kanban" && (
        <div
          className="grid gap-3 overflow-x-auto"
          style={{
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
          }}
        >
          {COLUMNS.map((col) => {
            const style = COLUMN_STYLES[col];
            const colTasks = tasksByStatus(col);
            return (
              <div
                key={col}
                className={`rounded-xl border bg-void-light/20 p-3 ${style.border}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <span
                    className={`font-mono text-xs font-semibold ${style.header}`}
                  >
                    {col}
                  </span>
                  <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="py-4 text-center font-mono text-[10px] text-slate-700">
                      Empty
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sprint view — grouped by sprint */}
      {!loading && viewMode === "sprint" && (
        <div className="space-y-6">
          {sprints.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
              <p className="font-mono text-slate-500">
                No sprints assigned to tasks yet.
              </p>
              <p className="font-body mt-2 text-sm text-slate-600">
                Add a Sprint property to your tasks in Notion.
              </p>
            </div>
          ) : (
            sprints.map((sprint) => {
              const sprintTasks = tasks.filter((t) => t.sprint === sprint);
              const done = sprintTasks.filter(
                (t) => t.status === "Done",
              ).length;
              const pct =
                sprintTasks.length > 0
                  ? Math.round((done / sprintTasks.length) * 100)
                  : 0;
              return (
                <div
                  key={sprint}
                  className="rounded-xl border border-slate-800 bg-void-light/30 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-heading font-semibold text-white">
                        {sprint}
                      </h3>
                      <span className="font-mono text-xs text-slate-500">
                        {done}/{sprintTasks.length} done
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-neon-green" : "bg-neon-cyan"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-500">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sprintTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* Unassigned tasks */}
          {(() => {
            const unassigned = tasks.filter((t) => !t.sprint);
            if (unassigned.length === 0) return null;
            return (
              <div className="rounded-xl border border-slate-700/50 bg-void-light/20 p-5">
                <h3 className="font-heading mb-4 font-semibold text-slate-400">
                  No Sprint ({unassigned.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unassigned.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* List view */}
      {!loading && viewMode === "list" && (
        <div className="space-y-2">
          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
              <p className="font-mono text-slate-500">No tasks found.</p>
            </div>
          )}
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
                isOverdue(task.dueDate, task.status)
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-slate-800 bg-void-light/50"
              }`}
            >
              <input
                type="checkbox"
                checked={bulkSelected.has(task.id)}
                onChange={() => toggleBulk(task.id)}
                className="accent-neon-cyan"
              />
              <span className="text-xs">{TYPE_ICONS[task.type] ?? "•"}</span>
              <span className="min-w-0 flex-1 text-sm font-medium text-white">
                {task.task}
              </span>
              {isOverdue(task.dueDate, task.status) && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] text-red-400">
                  OVERDUE
                </span>
              )}
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${PRIORITY_STYLES[task.priority] ?? ""}`}
              >
                {task.priority}
              </span>
              {task.sprint && (
                <span className="font-mono text-[10px] text-neon-blue/60">
                  {task.sprint}
                </span>
              )}
              {task.project && (
                <span className="font-mono text-[10px] text-slate-500">
                  {task.project}
                </span>
              )}
              {task.assignee && (
                <span className="font-mono text-[10px] text-neon-magenta/60">
                  {task.assignee}
                </span>
              )}
              <select
                value={task.status}
                disabled={updating === task.id || updating === "bulk"}
                onChange={(e) =>
                  updateStatus(task.id, e.target.value as TaskStatus)
                }
                className="rounded border border-slate-700 bg-void px-2 py-1 font-mono text-[10px] text-slate-300 focus:border-neon-magenta/50 focus:outline-none disabled:opacity-50"
              >
                {COLUMNS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && filteredTasks.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          {selectedSprint !== "all" &&
            ` in ${selectedSprint === "overdue" ? "overdue" : selectedSprint}`}
        </p>
      )}
    </div>
  );
}
