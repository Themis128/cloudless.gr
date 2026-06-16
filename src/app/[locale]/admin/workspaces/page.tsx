"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { Workspace } from "@/app/api/admin/workspaces/route";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    adminEmails: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    adminEmails: "",
  });
  const { setWorkspaces: setCtxWorkspaces, current } = useWorkspace();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/workspaces");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
      setCtxWorkspaces(data.workspaces ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          adminEmails: form.adminEmails
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setForm({ name: "", description: "", adminEmails: "" });
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  async function save(id: string) {
    try {
      const res = await fetchWithAuth("/api/admin/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          adminEmails: editForm.adminEmails
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update workspace");
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete workspace "${name}"?`)) return;
    try {
      await fetchWithAuth("/api/admin/workspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      load();
    } catch {
      setError("Failed to delete workspace");
    }
  }

  function startEdit(ws: Workspace) {
    setEditingId(ws.id);
    setEditForm({
      name: ws.name,
      description: ws.description,
      adminEmails: ws.adminEmails.join(", "),
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-blue/20 bg-neon-blue/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-blue font-mono text-xs">MULTI-TENANT</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Workspaces</h1>
        <p className="font-body mt-1 text-slate-400">
          Manage isolated workspaces for different clients or brands. Switch between them using the
          sidebar selector.
        </p>
      </div>

      {/* How it works */}
      <details className="bg-void-light/30 mb-6 rounded-xl border border-slate-800 p-5 [&[open]>summary]:mb-3">
        <summary className="font-heading flex cursor-pointer items-center gap-2 text-sm font-semibold text-white select-none">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform [details[open]>summary>&]:rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          How the workspaces flow works
        </summary>
        <ol className="font-body mt-1 space-y-3 text-sm text-slate-300">
          <li>
            <span className="text-neon-blue font-mono text-xs">1 · STORAGE</span>
            <p className="mt-1 text-slate-400">
              Workspaces are persisted in AWS SSM at{" "}
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                /cloudless/WORKSPACES_JSON
              </code>{" "}
              as a single JSON array. The API caches reads server-side for 30&nbsp;s; writes
              invalidate the cache immediately.
            </p>
          </li>
          <li>
            <span className="text-neon-blue font-mono text-xs">2 · CRUD API</span>
            <p className="mt-1 text-slate-400">
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                GET / POST / PATCH / DELETE /api/admin/workspaces
              </code>{" "}
              — all admin-gated. The form above POSTs to create; <em>Edit</em> sends PATCH;{" "}
              <em>Delete</em> sends DELETE. Slugs are auto-derived from the name and must be unique
              across the org (409 on collision).
            </p>
          </li>
          <li>
            <span className="text-neon-blue font-mono text-xs">3 · ACTIVE WORKSPACE</span>
            <p className="mt-1 text-slate-400">
              The sidebar selector and this page share state via{" "}
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                useWorkspace()
              </code>
              . The active id is persisted in <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">localStorage</code> under{" "}
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                cloudless_workspace_id
              </code>
              . A fresh visit auto-selects the stored id if it still exists, otherwise the first
              workspace in the list.
            </p>
          </li>
          <li>
            <span className="text-neon-blue font-mono text-xs">4 · DATA SCOPING</span>
            <p className="mt-1 text-slate-400">
              Other admin surfaces (analytics, calendar, postiz, …) read{" "}
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                current.id
              </code>{" "}
              and filter their queries by it. Switching workspace re-runs each page&rsquo;s fetches
              against the new context — no full reload needed.
            </p>
          </li>
        </ol>
      </details>

      {/* Create form */}
      <div className="bg-void-light/30 mb-8 rounded-xl border border-slate-800 p-6">
        <h2 className="font-heading mb-4 text-sm font-semibold text-white">Create Workspace</h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ws-name" className="mb-1 block font-mono text-xs text-slate-500">
                Name
              </label>
              <input
                id="ws-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Corp"
                className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="ws-admin-emails"
                className="mb-1 block font-mono text-xs text-slate-500"
              >
                Admin Emails (comma-separated)
              </label>
              <input
                id="ws-admin-emails"
                type="text"
                value={form.adminEmails}
                onChange={(e) => setForm((f) => ({ ...f, adminEmails: e.target.value }))}
                placeholder="admin@acme.com, manager@acme.com"
                className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ws-description" className="mb-1 block font-mono text-xs text-slate-500">
              Description (optional)
            </label>
            <input
              id="ws-description"
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Main production workspace for Acme Corp"
              className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
            />
          </div>
          {formError && <p className="font-mono text-xs text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="border-neon-blue/30 text-neon-blue hover:border-neon-blue/60 rounded-lg border px-5 py-2 font-mono text-xs transition disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Workspace"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {["skel-1", "skel-2", "skel-3"].map((k) => (
            <div
              key={k}
              className="bg-void-light/30 h-24 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && workspaces.length === 0 && (
        <div className="bg-void-light/30 rounded-xl border border-slate-800 px-6 py-12 text-center">
          <div className="mb-3 text-4xl">🏢</div>
          <p className="font-heading text-sm text-slate-400">No workspaces yet.</p>
          <p className="mt-1 font-mono text-xs text-slate-600">
            Create your first workspace above.
          </p>
        </div>
      )}

      {!loading && workspaces.length > 0 && (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`rounded-xl border p-4 transition ${
                ws.id === current?.id
                  ? "border-neon-magenta/30 bg-neon-magenta/5"
                  : "bg-void-light/30 border-slate-800 hover:border-slate-700"
              }`}
            >
              {editingId === ws.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="bg-void focus:border-neon-blue/50 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editForm.adminEmails}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          adminEmails: e.target.value,
                        }))
                      }
                      placeholder="admin@acme.com"
                      className="bg-void focus:border-neon-blue/50 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => save(ws.id)}
                      className="border-neon-blue/30 text-neon-blue hover:border-neon-blue/60 rounded-lg border px-4 py-1.5 font-mono text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-700 px-4 py-1.5 font-mono text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-white">{ws.name}</span>
                      {ws.id === current?.id && (
                        <span className="border-neon-magenta/30 bg-neon-magenta/10 text-neon-magenta rounded-full border px-2 py-0.5 font-mono text-[10px]">
                          active
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">
                      slug: <span className="text-slate-400">{ws.slug}</span>
                    </div>
                    {ws.description && (
                      <p className="font-body mt-1 text-xs text-slate-500">{ws.description}</p>
                    )}
                    {ws.adminEmails.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        admins: {ws.adminEmails.join(", ")}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs text-slate-700">
                      created {new Date(ws.createdAt).toLocaleDateString("en-IE")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(ws)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-300 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(ws.id, ws.name)}
                      className="rounded-lg border border-red-900/40 px-3 py-1.5 font-mono text-xs text-red-400 hover:border-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
