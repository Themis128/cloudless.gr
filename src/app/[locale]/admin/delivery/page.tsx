"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { AgencyProject } from "@/app/api/admin/delivery/projects/route";
import type { TimeEntry } from "@/app/api/admin/delivery/projects/[id]/time/route";

const STATUS_COLORS: Record<string, string> = {
  active: "text-neon-cyan border-neon-cyan/30 bg-cyan-950/20",
  on_hold: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  done: "text-neon-green border-neon-green/30 bg-green-950/20",
  cancelled: "text-slate-500 border-slate-700 bg-slate-900/30",
};

function formatHours(minutes: number) {
  const h = minutes / 60;
  return `${h.toFixed(h >= 10 ? 0 : 1)}h`;
}

function todayAthens() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
}

export default function DeliveryPage() {
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [form, setForm] = useState({
    name: "",
    clientEmail: "",
    hourlyRateEur: "",
  });
  const [timeForm, setTimeForm] = useState({
    workDate: todayAthens(),
    hours: "1",
    description: "",
  });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/delivery/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { projects: AgencyProject[] };
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async (projectId: string) => {
    setEntriesLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/delivery/projects/${projectId}/time`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { entries: TimeEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      setEntries([]);
      setMessage("Failed to load time entries");
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadProjects().catch(() => {});
    });
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      return;
    }
    queueMicrotask(() => {
      loadEntries(selectedId).catch(() => {});
    });
  }, [selectedId, loadEntries]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth("/api/admin/delivery/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: form.name,
          clientEmail: form.clientEmail || undefined,
          hourlyRateEur: form.hourlyRateEur ? Number(form.hourlyRateEur) : undefined,
        }),
      });
      const data = (await res.json()) as { project?: AgencyProject; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setForm({ name: "", clientEmail: "", hourlyRateEur: "" });
      setMessage(`Created ${data.project?.name}`);
      await loadProjects();
      if (data.project?.id) setSelectedId(data.project.id);
    } catch {
      setMessage("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function logTime(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLogging(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`/api/admin/delivery/projects/${selectedId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: timeForm.workDate,
          hours: Number(timeForm.hours),
          description: timeForm.description,
        }),
      });
      const data = (await res.json()) as { entry?: TimeEntry; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTimeForm((prev) => ({ ...prev, hours: "1", description: "" }));
      setMessage(`Logged ${formatHours(data.entry?.minutes ?? 0)}`);
      await Promise.all([loadProjects(), loadEntries(selectedId)]);
    } catch {
      setMessage("Failed to log time");
    } finally {
      setLogging(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setMessage(null);
    const res = await fetchWithAuth("/api/admin/delivery/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", id, status }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? `HTTP ${res.status}`);
      return;
    }
    await loadProjects();
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl tracking-tight text-white">Delivery</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Agency projects and billable hours on D1. CMS portfolio stays under Content → Projects
          (AppFlowy). Invoice unbilled hours from System → Invoices when ready.
        </p>
      </div>

      {message && (
        <p className="bg-void-light/50 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
          {message}
        </p>
      )}

      <form
        onSubmit={createProject}
        className="bg-void-light/40 grid gap-3 rounded-xl border border-slate-800 p-4 md:grid-cols-4"
      >
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Project name"
          className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <input
          type="email"
          value={form.clientEmail}
          onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
          placeholder="Client email (optional)"
          className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.hourlyRateEur}
          onChange={(e) => setForm((f) => ({ ...f, hourlyRateEur: e.target.value }))}
          placeholder="€ / hour (optional)"
          className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          disabled={creating}
          className="border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          {creating ? "Creating…" : "Add project"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Unbilled</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-slate-500">
                      No delivery projects yet.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-void-lighter/40 cursor-pointer border-b border-slate-900/80 ${
                        selectedId === p.id ? "bg-void-lighter/60" : ""
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {p.clientEmail || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {formatHours(p.totalMinutes)}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">
                        {formatHours(p.unbilledMinutes)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setStatus(p.id, e.target.value).catch(() => {});
                          }}
                          className={`rounded border bg-transparent px-2 py-0.5 text-xs ${STATUS_COLORS[p.status] ?? ""}`}
                        >
                          <option value="active">active</option>
                          <option value="on_hold">on_hold</option>
                          <option value="done">done</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-void-light/30 space-y-4 rounded-xl border border-slate-800 p-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a project to log hours.</p>
            ) : (
              <>
                <div>
                  <h2 className="font-heading text-lg text-white">{selected.name}</h2>
                  <p className="text-xs text-slate-500">
                    Rate{" "}
                    {selected.hourlyRateCents != null
                      ? `${(selected.hourlyRateCents / 100).toFixed(2)} ${selected.currency}/h`
                      : "unset"}{" "}
                    · unbilled {formatHours(selected.unbilledMinutes)}
                  </p>
                </div>
                <form onSubmit={logTime} className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="date"
                    required
                    value={timeForm.workDate}
                    onChange={(e) => setTimeForm((f) => ({ ...f, workDate: e.target.value }))}
                    className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    required
                    min="0.25"
                    step="0.25"
                    value={timeForm.hours}
                    onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                    placeholder="Hours"
                    className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={timeForm.description}
                    onChange={(e) => setTimeForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What did you work on?"
                    className="bg-void rounded-lg border border-slate-700 px-3 py-2 text-sm text-white sm:col-span-2"
                  />
                  <button
                    type="submit"
                    disabled={logging}
                    className="border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta rounded-lg border px-3 py-2 text-sm disabled:opacity-50 sm:col-span-2"
                  >
                    {logging ? "Logging…" : "Log time"}
                  </button>
                </form>
                {entriesLoading ? (
                  <p className="text-sm text-slate-500">Loading entries…</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                    {entries.length === 0 ? (
                      <li className="text-slate-500">No time logged yet.</li>
                    ) : (
                      entries.map((en) => (
                        <li
                          key={en.id}
                          className="flex items-start justify-between gap-3 border-b border-slate-900/80 py-2"
                        >
                          <div>
                            <div className="text-slate-200">{en.description || "—"}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {en.workDate}
                              {!en.billable ? " · non-billable" : ""}
                              {en.stripeInvoiceId ? ` · ${en.stripeInvoiceId}` : ""}
                            </div>
                          </div>
                          <span className="font-mono text-slate-300">
                            {formatHours(en.minutes)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
