"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface Project {
  id: string;
  name: string;
  status: string;
  priority: string;
  type: string;
  owner: string;
  startDate: string;
  dueDate: string;
  description: string;
  budget: number | null;
  progress: number;
  tags: string[];
  url: string;
}

type ProjectStatus =
  | "Planning"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";
type ProjectPriority = "Critical" | "High" | "Medium" | "Low";

const STATUS_STYLES: Record<string, string> = {
  Planning: "bg-neon-blue/10 text-neon-blue border-neon-blue/30",
  "In Progress": "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  "On Hold": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Completed: "bg-neon-green/10 text-neon-green border-neon-green/30",
  Cancelled: "bg-slate-700/40 text-slate-500 border-slate-600/30",
};

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-neon-magenta",
  Medium: "text-yellow-400",
  Low: "text-slate-500",
};

const PRIORITY_ICONS: Record<string, string> = {
  Critical: "▲▲",
  High: "▲",
  Medium: "◆",
  Low: "▽",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate || status === "Completed" || status === "Cancelled")
    return false;
  return new Date(dueDate) < new Date();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newPriority, setNewPriority] = useState<ProjectPriority>("Medium");
  const [newType, setNewType] = useState("Internal");
  const [newOwner, setNewOwner] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        filterStatus === "all"
          ? "/api/admin/notion/projects"
          : `/api/admin/notion/projects?status=${encodeURIComponent(filterStatus)}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { projects: Project[] };
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const updateStatus = async (pageId: string, status: ProjectStatus) => {
    setUpdating(pageId);
    try {
      const res = await fetchWithAuth("/api/admin/notion/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProjects((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, status } : p)),
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(null);
    }
  };

  const updateProgress = async (pageId: string, progress: number) => {
    setUpdating(pageId);
    try {
      const res = await fetchWithAuth("/api/admin/notion/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, progress }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProjects((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, progress } : p)),
      );
    } catch (err) {
      console.error("Failed to update progress:", err);
    } finally {
      setUpdating(null);
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/notion/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          priority: newPriority,
          type: newType,
          owner: newOwner || undefined,
          description: newDescription || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewName("");
      setNewDescription("");
      setNewOwner("");
      setShowCreate(false);
      load();
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  };

  const statuses: ProjectStatus[] = [
    "Planning",
    "In Progress",
    "On Hold",
    "Completed",
    "Cancelled",
  ];
  const countByStatus = (s: string) =>
    projects.filter((p) => p.status === s).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-cyan font-mono text-xs">
              NOTION_PROJECTS
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Projects
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Manage projects from your Notion workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="border-neon-green/30 text-neon-green hover:bg-neon-green/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors"
          >
            + New Project
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus("all")}
          className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
            filterStatus === "all"
              ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
              : "border-slate-700 text-slate-500 hover:border-slate-600"
          }`}
        >
          All ({projects.length})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              filterStatus === s
                ? STATUS_STYLES[s]
                : "border-slate-700 text-slate-500 hover:border-slate-600"
            }`}
          >
            {s} ({countByStatus(s)})
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-6">
          <h3 className="font-heading mb-4 font-semibold text-white">
            Create Project
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Project name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-cyan/50 focus:outline-none"
            />
            <select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as ProjectPriority)
              }
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-neon-cyan/50 focus:outline-none"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-neon-cyan/50 focus:outline-none"
            >
              <option value="Client">Client</option>
              <option value="Internal">Internal</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <input
              type="text"
              placeholder="Owner"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className="bg-void rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-cyan/50 focus:outline-none"
            />
            <textarea
              placeholder="Description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="bg-void col-span-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-cyan/50 focus:outline-none"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={createProject}
              disabled={creating || !newName.trim()}
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-6 py-2 font-mono text-sm font-semibold transition-colors disabled:opacity-50"
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

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-void-light/50 p-5"
            >
              <div className="mb-3 h-4 w-48 rounded bg-slate-700/60" />
              <div className="h-3 w-32 rounded bg-slate-800/80" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && projects.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-12 text-center">
          <p className="font-mono text-slate-500">No projects found.</p>
          <p className="font-body mt-2 text-sm text-slate-600">
            Create your first project above or add one in Notion.
          </p>
        </div>
      )}

      {/* Projects list */}
      {!loading && projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((project) => {
            const overdue = isOverdue(project.dueDate, project.status);
            return (
              <div
                key={project.id}
                className={`rounded-xl border p-5 transition-all hover:border-slate-700 ${
                  overdue
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-slate-800 bg-void-light/50"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-mono text-xs ${PRIORITY_STYLES[project.priority] ?? ""}`}
                      >
                        {PRIORITY_ICONS[project.priority] ?? "◆"}
                      </span>
                      <h3 className="font-heading font-semibold text-white">
                        {project.name}
                      </h3>
                      {overdue && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] text-red-400">
                          OVERDUE
                        </span>
                      )}
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        {project.type}
                      </span>
                    </div>
                    {project.description && (
                      <p className="font-body mt-1 text-sm text-slate-500 line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-slate-600">
                      {project.owner && <span>Owner: {project.owner}</span>}
                      <span>Start: {formatDate(project.startDate)}</span>
                      {project.dueDate && (
                        <span>Due: {formatDate(project.dueDate)}</span>
                      )}
                      {project.budget !== null && (
                        <span>Budget: €{project.budget.toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {/* Status selector */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-xs ${STATUS_STYLES[project.status] ?? STATUS_STYLES.Planning}`}
                      >
                        {project.status}
                      </span>
                      <select
                        value={project.status}
                        disabled={updating === project.id}
                        onChange={(e) =>
                          updateStatus(
                            project.id,
                            e.target.value as ProjectStatus,
                          )
                        }
                        className="rounded border border-slate-700 bg-void px-2 py-1 font-mono text-xs text-slate-300 focus:border-neon-cyan/50 focus:outline-none disabled:opacity-50"
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-neon-cyan transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={project.progress}
                        disabled={updating === project.id}
                        onChange={(e) => {
                          const val = Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value) || 0),
                          );
                          setProjects((prev) =>
                            prev.map((p) =>
                              p.id === project.id ? { ...p, progress: val } : p,
                            ),
                          );
                        }}
                        onBlur={(e) => {
                          const val = Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value) || 0),
                          );
                          updateProgress(project.id, val);
                        }}
                        className="w-12 rounded border border-slate-700 bg-void px-1 py-0.5 text-center font-mono text-xs text-slate-300 focus:border-neon-cyan/50 focus:outline-none disabled:opacity-50"
                      />
                      <span className="font-mono text-[10px] text-slate-600">
                        %
                      </span>
                    </div>

                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan/60 hover:text-neon-cyan font-mono text-[10px] transition-colors"
                      >
                        Open in Notion →
                      </a>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {project.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-slate-700 bg-slate-800/50 px-2 py-0.5 font-mono text-[9px] text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && projects.length > 0 && (
        <p className="mt-4 text-right font-mono text-xs text-slate-600">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
