"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { Workspace } from "@/app/api/admin/workspaces/route";
import { useWorkspace } from "@/context/WorkspaceContext";

interface PostizGroupOption {
  id: string;
  name: string;
}

const EMPTY_FORM = { name: "", description: "", adminEmails: "", postizGroupId: "", notionTag: "" };

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  /** Postiz groups for the dropdown. `null` = not loaded yet, `[]` = either
   *  Postiz isn't configured (503) or the org has no groups — both cases
   *  fall back to a free-text input. */
  const [postizGroups, setPostizGroups] = useState<PostizGroupOption[] | null>(null);
  const { setWorkspaces: setCtxWorkspaces, current } = useWorkspace();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/workspaces");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as any as any as any;
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
          postizGroupId: form.postizGroupId.trim() || undefined,
          notionTag: form.notionTag.trim() || undefined,
        }),
      });
      const data = (await res.json()) as any as any as any;
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
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
          // Pass through whether set or cleared — backend treats "" as a
          // clear instruction, undefined as "leave unchanged".
          postizGroupId: editForm.postizGroupId.trim(),
          notionTag: editForm.notionTag.trim(),
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as any as any as any;
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
      postizGroupId: ws.postizGroupId ?? "",
      notionTag: ws.notionTag ?? "",
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimistically fetch Postiz groups once on mount. 503 (not configured)
  // and other errors leave `postizGroups` at `null` so the inputs degrade
  // to free text. The `groups` route on the server reads from SSM, so this
  // is a single round-trip per page visit.
  useEffect(() => {
    fetchWithAuth("/api/admin/postiz/groups")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (Array.isArray(data?.groups)) {
          setPostizGroups(data.groups as PostizGroupOption[]);
        }
      })
      .catch(() => {
        /* silent — UI just falls back to free-text */
      });
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
              . The active id is persisted in{" "}
              <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
                localStorage
              </code>{" "}
              under{" "}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <PostizGroupField
              id="ws-postiz"
              value={form.postizGroupId}
              onChange={(v) => setForm((f) => ({ ...f, postizGroupId: v }))}
              groups={postizGroups}
            />
            <NotionTagField
              id="ws-notion"
              value={form.notionTag}
              onChange={(v) => setForm((f) => ({ ...f, notionTag: v }))}
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PostizGroupField
                      id={`ws-postiz-${ws.id}`}
                      value={editForm.postizGroupId}
                      onChange={(v) => setEditForm((f) => ({ ...f, postizGroupId: v }))}
                      groups={postizGroups}
                    />
                    <NotionTagField
                      id={`ws-notion-${ws.id}`}
                      value={editForm.notionTag}
                      onChange={(v) => setEditForm((f) => ({ ...f, notionTag: v }))}
                    />
                  </div>
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
                    {(ws.postizGroupId || ws.notionTag) && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-600">
                        {ws.postizGroupId && (
                          <span className="rounded border border-slate-800 px-1.5 py-0.5">
                            postiz:{" "}
                            <span className="text-slate-400">
                              {postizGroups?.find((g) => g.id === ws.postizGroupId)?.name ??
                                ws.postizGroupId}
                            </span>
                          </span>
                        )}
                        {ws.notionTag && (
                          <span className="rounded border border-slate-800 px-1.5 py-0.5">
                            notion: <span className="text-slate-400">{ws.notionTag}</span>
                          </span>
                        )}
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

/** Postiz group picker — dropdown of `/api/admin/postiz/groups` when the
 *  upstream is reachable, free-text fallback when it isn't (Postiz not
 *  configured, network error, etc.). The Workspace.postizGroupId stores the
 *  group id; the dropdown shows the friendly name. */
function PostizGroupField({
  id,
  value,
  onChange,
  groups,
}: Readonly<{
  id: string;
  value: string;
  onChange: (next: string) => void;
  groups: PostizGroupOption[] | null;
}>) {
  const helper = "Filter this workspace's Postiz channels + posts to one Postiz group (customer).";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-xs text-slate-500">
        Postiz group (optional)
      </label>
      {groups && groups.length > 0 ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white focus:outline-none"
        >
          <option value="">— None (all groups) —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.id.slice(0, 8)}…)
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="paste the Postiz group id"
          className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
        />
      )}
      <p className="mt-1 font-mono text-[10px] text-slate-600">{helper}</p>
    </div>
  );
}

/** Notion workspace tag — written into the WorkspaceID rich-text column on
 *  calendar items so the calendar GET can filter by it. Free text — usually
 *  matches the workspace slug. */
function NotionTagField({
  id,
  value,
  onChange,
}: Readonly<{ id: string; value: string; onChange: (next: string) => void }>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-xs text-slate-500">
        Notion tag (optional)
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="acme-corp"
        className="bg-void focus:border-neon-blue/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
      />
      <p className="mt-1 font-mono text-[10px] text-slate-600">
        Tag written to the Notion calendar WorkspaceID column for filtering.
      </p>
    </div>
  );
}
