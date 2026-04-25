"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { Project, Task, ProjectStatus, TaskStatus } from "@/lib/notion-projects";

type Tab = "projects" | "tasks";

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  Planning: "border-slate-700 text-slate-400",
  "In Progress": "border-neon-cyan/30 text-neon-cyan",
  "On Hold": "border-yellow-500/30 text-yellow-400",
  Completed: "border-neon-green/30 text-neon-green",
  Cancelled: "border-red-500/30 text-red-400",
};

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  Backlog: "border-slate-700 text-slate-500",
  "To Do": "border-slate-600 text-slate-400",
  "In Progress": "border-neon-cyan/30 text-neon-cyan",
  "In Review": "border-yellow-500/30 text-yellow-400",
  Done: "border-neon-green/30 text-neon-green",
  Blocked: "border-red-500/30 text-red-400",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-neon-cyan transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-slate-500">{pct}%</span>
    </div>
  );
}

export default function AdminProjectsPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [errorProjects, setErrorProjects] = useState<string | null>(null);
  const [errorTasks, setErrorTasks] = useState<string | null>(null);
  const [fetchedTasks, setFetchedTasks] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadProjects() {
    setLoadingProjects(true);
    setErrorProjects(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (err) {
      setErrorProjects(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadTasks() {
    setLoadingTasks(true);
    setErrorTasks(null);
    try {
      const res = await fetchWithAuth("/api/admin/notion/tasks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setFetchedTasks(true);
    } catch (err) {
      setErrorTasks(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, []);

  useEffect(() => {
    if (tab === "tasks" && !fetchedTasks) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTasks();
    }
  }, [tab, fetchedTasks]);

  async function updateProjectStatus(id: string, status: ProjectStatus) {
    setUpdatingId(id);
    try {
      await fetchWithAuth("/api/admin/notion/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, status }),
      });
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateTaskStatus(id: string, status: TaskStatus) {
    setUpdatingId(id);
    try {
      await fetchWithAuth("/api/admin/notion/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, status }),
      });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">PROJECTS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Projects & Tasks</h1>
        <p className="font-body mt-1 text-slate-400">
          Manage projects and tasks from your Notion workspace.
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {(["projects", "tasks"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg border px-4 py-1.5 font-mono text-xs transition-all capitalize ${
              tab === t
                ? "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan"
                : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t}
            {t === "projects" && !loadingProjects && (
              <span className="ml-1.5 opacity-60">{projects.length}</span>
            )}
            {t === "tasks" && fetchedTasks && !loadingTasks && (
              <span className="ml-1.5 opacity-60">{tasks.length}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { if (tab === "projects") loadProjects(); else loadTasks(); }}
          className="ml-auto rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-400 hover:text-white transition-colors"
        >
          ↺ Refresh
        </button>
      </div>

      {tab === "projects" && (
        <>
          {errorProjects && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">{errorProjects}</div>
          )}
          {loadingProjects && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5">
                  <div className="mb-2 h-4 w-1/2 rounded bg-slate-700/60" />
                  <div className="h-3 w-1/4 rounded bg-slate-800/80" />
                </div>
              ))}
            </div>
          )}
          {!loadingProjects && projects.length === 0 && !errorProjects && (
            <div className="rounded-xl border border-slate-800 bg-void-light/30 py-12 text-center">
              <p className="font-mono text-sm text-slate-500">No projects in Notion yet.</p>
            </div>
          )}
          {!loadingProjects && projects.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-void-light/50">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Project</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Progress</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Priority</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Owner</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-void-lighter/20 border-b border-slate-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{p.name || "(Untitled)"}</div>
                          {p.type && <div className="font-mono text-[10px] text-slate-600">{p.type}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={p.status}
                            disabled={updatingId === p.id}
                            onChange={(e) => updateProjectStatus(p.id, e.target.value as ProjectStatus)}
                            className={`rounded border bg-void px-2 py-1 font-mono text-[10px] focus:outline-none disabled:opacity-50 ${PROJECT_STATUS_COLORS[p.status] ?? "border-slate-700 text-slate-400"}`}
                          >
                            {(["Planning", "In Progress", "On Hold", "Completed", "Cancelled"] as ProjectStatus[]).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3"><ProgressBar value={p.progress} /></td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.priority}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.owner || "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{formatDate(p.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-800 px-5 py-2.5 text-right font-mono text-[10px] text-slate-600">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "tasks" && (
        <>
          {errorTasks && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400">{errorTasks}</div>
          )}
          {loadingTasks && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-4">
                  <div className="mb-1.5 h-3.5 w-1/2 rounded bg-slate-700/60" />
                  <div className="h-3 w-1/4 rounded bg-slate-800/80" />
                </div>
              ))}
            </div>
          )}
          {!loadingTasks && fetchedTasks && tasks.length === 0 && !errorTasks && (
            <div className="rounded-xl border border-slate-800 bg-void-light/30 py-12 text-center">
              <p className="font-mono text-sm text-slate-500">No tasks in Notion yet.</p>
            </div>
          )}
          {!loadingTasks && tasks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-void-light/50">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Task</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Status</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Priority</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Assignee</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Type</th>
                      <th className="px-5 py-3 text-left font-mono text-xs text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-void-lighter/20 border-b border-slate-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{t.task || "(Untitled)"}</div>
                          {t.estimate && (
                            <span className="mt-0.5 inline-block rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                              {t.estimate}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={t.status}
                            disabled={updatingId === t.id}
                            onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                            className={`rounded border bg-void px-2 py-1 font-mono text-[10px] focus:outline-none disabled:opacity-50 ${TASK_STATUS_COLORS[t.status] ?? "border-slate-700 text-slate-400"}`}
                          >
                            {(["Backlog", "To Do", "In Progress", "In Review", "Done", "Blocked"] as TaskStatus[]).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{t.priority}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{t.assignee || "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.type || "—"}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{formatDate(t.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-800 px-5 py-2.5 text-right font-mono text-[10px] text-slate-600">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
