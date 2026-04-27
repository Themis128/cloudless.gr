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
      setFormError(
        e instanceof Error ? e.message : "Failed to create workspace",
      );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-blue/20 bg-neon-blue/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-blue font-mono text-xs">MULTI-TENANT</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Workspaces
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Manage isolated workspaces for different clients or brands. Switch
          between them using the sidebar selector.
        </p>
      </div>

      {/* Create form */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-void-light/30 p-6">
        <h2 className="font-heading mb-4 text-sm font-semibold text-white">
          Create Workspace
        </h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ws-name"
                className="font-mono mb-1 block text-xs text-slate-500"
              >
                Name
              </label>
              <input
                id="ws-name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="ws-admin-emails"
                className="font-mono mb-1 block text-xs text-slate-500"
              >
                Admin Emails (comma-separated)
              </label>
              <input
                id="ws-admin-emails"
                type="text"
                value={form.adminEmails}
                onChange={(e) =>
                  setForm((f) => ({ ...f, adminEmails: e.target.value }))
                }
                placeholder="admin@acme.com, manager@acme.com"
                className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="ws-description"
              className="font-mono mb-1 block text-xs text-slate-500"
            >
              Description (optional)
            </label>
            <input
              id="ws-description"
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Main production workspace for Acme Corp"
              className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
            />
          </div>
          {formError && (
            <p className="font-mono text-xs text-red-400">{formError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg border border-neon-blue/30 px-5 py-2 font-mono text-xs text-neon-blue transition hover:border-neon-blue/60 disabled:opacity-50"
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
              className="h-24 animate-pulse rounded-xl border border-slate-800 bg-void-light/30"
            />
          ))}
        </div>
      )}

      {!loading && workspaces.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 px-6 py-12 text-center">
          <div className="mb-3 text-4xl">🏢</div>
          <p className="font-heading text-sm text-slate-400">
            No workspaces yet.
          </p>
          <p className="font-mono mt-1 text-xs text-slate-600">
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
                  : "border-slate-800 bg-void-light/30 hover:border-slate-700"
              }`}
            >
              {editingId === ws.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white focus:border-neon-blue/50 focus:outline-none"
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
                      className="rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white focus:border-neon-blue/50 focus:outline-none"
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
                    className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white focus:border-neon-blue/50 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => save(ws.id)}
                      className="rounded-lg border border-neon-blue/30 px-4 py-1.5 font-mono text-xs text-neon-blue hover:border-neon-blue/60"
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
                      <span className="font-heading font-semibold text-white">
                        {ws.name}
                      </span>
                      {ws.id === current?.id && (
                        <span className="rounded-full border border-neon-magenta/30 bg-neon-magenta/10 px-2 py-0.5 font-mono text-[10px] text-neon-magenta">
                          active
                        </span>
                      )}
                    </div>
                    <div className="font-mono mt-0.5 text-xs text-slate-500">
                      slug: <span className="text-slate-400">{ws.slug}</span>
                    </div>
                    {ws.description && (
                      <p className="font-body mt-1 text-xs text-slate-500">
                        {ws.description}
                      </p>
                    )}
                    {ws.adminEmails.length > 0 && (
                      <p className="font-mono mt-1 text-xs text-slate-600">
                        admins: {ws.adminEmails.join(", ")}
                      </p>
                    )}
                    <p className="font-mono mt-1 text-xs text-slate-700">
                      created{" "}
                      {new Date(ws.createdAt).toLocaleDateString("en-IE")}
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
