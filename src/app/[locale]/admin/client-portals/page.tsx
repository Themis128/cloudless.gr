"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type {
  ClientPortal,
  PortalStep,
} from "@/app/api/admin/client-portals/route";
import type { PendingClient } from "@/lib/pending-clients";

const STEP_STATUS_OPTIONS: {
  value: PortalStep["status"];
  label: string;
  color: string;
}[] = [
  { value: "pending", label: "Pending", color: "text-slate-400" },
  { value: "in-progress", label: "In Progress", color: "text-neon-cyan" },
  { value: "completed", label: "Completed", color: "text-neon-green" },
  { value: "blocked", label: "Blocked", color: "text-yellow-400" },
];

function StepManager({
  portal,
  onUpdate,
}: {
  portal: ClientPortal;
  onUpdate: () => void;
}) {
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentAuthor, setCommentAuthor] = useState("Cloudless Team");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(
    portal.steps.find((s) => s.status === "in-progress")?.id ?? null,
  );
  const [newStepName, setNewStepName] = useState("");
  const [addingStep, setAddingStep] = useState(false);

  async function updateStepStatus(
    stepId: string,
    status: PortalStep["status"],
  ) {
    await fetchWithAuth("/api/admin/client-portals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: portal.token,
        action: "update-step",
        stepId,
        status,
      }),
    });
    onUpdate();
  }

  async function submitComment(stepId: string) {
    const text = commentDraft[stepId]?.trim();
    if (!text) return;
    setSubmitting(stepId);
    try {
      await fetchWithAuth("/api/admin/client-portals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portal.token,
          action: "add-comment",
          stepId,
          author: commentAuthor || "Cloudless Team",
          text,
        }),
      });
      setCommentDraft((d) => ({ ...d, [stepId]: "" }));
      onUpdate();
    } finally {
      setSubmitting(null);
    }
  }

  async function deleteComment(stepId: string, commentId: string) {
    if (!confirm("Delete this comment? The client will no longer see it."))
      return;
    await fetchWithAuth("/api/admin/client-portals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: portal.token,
        action: "delete-comment",
        stepId,
        commentId,
      }),
    });
    onUpdate();
  }

  async function addStep() {
    if (!newStepName.trim()) return;
    setAddingStep(true);
    try {
      await fetchWithAuth("/api/admin/client-portals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: portal.token,
          action: "add-step",
          name: newStepName.trim(),
        }),
      });
      setNewStepName("");
      onUpdate();
    } finally {
      setAddingStep(false);
    }
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Remove this step? This cannot be undone.")) return;
    await fetchWithAuth("/api/admin/client-portals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: portal.token,
        action: "delete-step",
        stepId,
      }),
    });
    onUpdate();
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Author name (shared across step comments) */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="portal-comment-author"
          className="font-mono text-xs text-slate-500 shrink-0"
        >
          Comment as:
        </label>
        <input
          id="portal-comment-author"
          type="text"
          value={commentAuthor}
          onChange={(e) => setCommentAuthor(e.target.value)}
          className="rounded-lg border border-slate-700 bg-void px-2 py-1 font-mono text-xs text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
          placeholder="Cloudless Team"
        />
      </div>

      {portal.steps.map((step, idx) => {
        const isOpen = expanded === step.id;
        const statusCfg = STEP_STATUS_OPTIONS.find(
          (o) => o.value === step.status,
        );

        return (
          <div
            key={step.id}
            className="rounded-xl border border-slate-800 bg-void-light/20"
          >
            {/* Step header */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              className="flex cursor-pointer items-center gap-3 px-4 py-3"
              onClick={() => setExpanded(isOpen ? null : step.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded(isOpen ? null : step.id);
                }
              }}
            >
              <span className="font-mono text-xs text-slate-600 w-5 shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-mono text-sm text-white truncate">
                {step.name}
              </span>

              {/* Status selector */}
              <select
                value={step.status}
                onChange={(e) => {
                  e.stopPropagation();
                  updateStepStatus(
                    step.id,
                    e.target.value as PortalStep["status"],
                  );
                }}
                onClick={(e) => e.stopPropagation()}
                className={`rounded-lg border border-slate-700 bg-void px-2 py-1 font-mono text-xs focus:outline-none ${statusCfg?.color ?? "text-slate-400"}`}
              >
                {STEP_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="text-white">
                    {o.label}
                  </option>
                ))}
              </select>

              {step.comments.length > 0 && (
                <span className="font-mono text-[10px] text-slate-500">
                  {step.comments.length} comment
                  {step.comments.length === 1 ? "" : "s"}
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteStep(step.id);
                }}
                className="rounded p-1 text-slate-700 transition hover:text-red-400"
                title="Remove step"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <svg
                className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>

            {/* Comments + compose */}
            {isOpen && (
              <div className="border-t border-slate-800 px-4 py-4 space-y-4">
                {step.comments.length > 0 ? (
                  <div className="space-y-3">
                    {step.comments.map((c) => (
                      <div key={c.id} className="group flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-void font-mono text-[10px] uppercase text-slate-400">
                          {c.author.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-300">
                              {c.author}
                            </span>
                            <span className="font-mono text-[10px] text-slate-600">
                              {new Date(c.createdAt).toLocaleString("en-IE", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-400 whitespace-pre-wrap">
                            {c.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteComment(step.id, c.id)}
                          className="shrink-0 rounded p-1 text-slate-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                          title="Delete comment"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-slate-600">
                    No comments yet for this step.
                  </p>
                )}

                {/* Add comment */}
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={commentDraft[step.id] ?? ""}
                    onChange={(e) =>
                      setCommentDraft((d) => ({
                        ...d,
                        [step.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitComment(step.id);
                      }
                    }}
                    placeholder="Add an update for the client… (Ctrl+Enter to send)"
                    className="flex-1 resize-none rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={
                      submitting === step.id || !commentDraft[step.id]?.trim()
                    }
                    onClick={() => submitComment(step.id)}
                    className="self-end rounded-lg border border-neon-blue/30 px-3 py-2 font-mono text-xs text-neon-blue transition hover:border-neon-blue/60 disabled:opacity-40"
                  >
                    {submitting === step.id ? "..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add step */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newStepName}
          onChange={(e) => setNewStepName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addStep();
          }}
          placeholder="Add custom step…"
          className="flex-1 rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
        />
        <button
          type="button"
          disabled={addingStep || !newStepName.trim()}
          onClick={addStep}
          className="rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-400 transition hover:border-slate-600 hover:text-white disabled:opacity-40"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function PendingClients({ onApproved }: { onApproved: () => void }) {
  const [clients, setClients] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/pending-clients");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClients(
        (data.clients ?? []).filter(
          (c: PendingClient) => c.status === "waiting",
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load pending clients",
      );
    } finally {
      setLoading(false);
    }
  }

  async function approve(client: PendingClient) {
    setApproving(client.email);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/pending-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: client.email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Reload both pending list and portal list
      load();
      onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(null);
    }
  }

  async function decline(client: PendingClient) {
    if (!confirm(`Decline ${client.email}? They'll need to sign up again.`))
      return;
    try {
      await fetchWithAuth("/api/admin/pending-clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: client.email }),
      });
      load();
    } catch {
      setError("Failed to decline");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-6">
        <div className="h-16 animate-pulse rounded bg-yellow-900/20" />
      </div>
    );
  }

  if (clients.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-yellow-900/40 bg-yellow-950/10 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-base">
          ⏳
        </span>
        <div>
          <h2 className="font-heading text-base font-semibold text-yellow-200">
            {clients.length} client{clients.length === 1 ? "" : "s"} waiting for
            portal access
          </h2>
          <p className="font-mono text-xs text-yellow-700">
            Review their order and click Approve to create their portal.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-900/30 bg-red-950/10 px-3 py-2 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {clients.map((c) => (
          <div
            key={c.email}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-900/30 bg-yellow-950/5 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-heading text-sm font-semibold text-white">
                  {c.name || c.email}
                </span>
                {c.name && (
                  <span className="font-mono text-xs text-slate-500">
                    {c.email}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-yellow-900/40 bg-yellow-950/20 px-2 py-0.5 font-mono text-[10px] text-yellow-400">
                  {c.planLabel ?? c.plan}
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Submitted{" "}
                  {new Date(c.submittedAt).toLocaleString("en-IE", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {c.notes && (
                <p className="mt-2 font-mono text-xs text-slate-400 italic">
                  &ldquo;{c.notes}&rdquo;
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => decline(c)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-400 transition hover:border-red-900/40 hover:text-red-400"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={approving === c.email}
                onClick={() => approve(c)}
                className="rounded-lg border border-neon-green/40 bg-neon-green/10 px-4 py-1.5 font-mono text-xs font-semibold text-neon-green transition hover:bg-neon-green/20 disabled:opacity-50"
              >
                {approving === c.email
                  ? "Creating portal…"
                  : "Approve & Create Portal"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientPortalsPage() {
  const [portals, setPortals] = useState<ClientPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    clientEmail: "",
    clientName: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/client-portals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPortals(data.portals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portals");
    } finally {
      setLoading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.label.trim() || !form.clientEmail.trim()) {
      setFormError("Label and client email are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/client-portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { portal } = await res.json();
      setForm({ label: "", clientEmail: "", clientName: "" });
      setExpanded(portal.token);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create portal");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token: string) {
    if (
      !confirm(
        "Revoke this portal link? The client will lose access immediately.",
      )
    )
      return;
    try {
      await fetchWithAuth("/api/admin/client-portals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      load();
    } catch {
      setError("Failed to revoke portal");
    }
  }

  function copyLink(token: string) {
    const baseUrl = globalThis.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/portal/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-blue/20 bg-neon-blue/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-blue font-mono text-xs">
            CLIENT ACCESS
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Client Portals
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Generate secure portal links. Clients see their project timeline,
          step-by-step updates, invoices, and subscription — no account needed.
        </p>
      </div>

      {/* Pending Clients (waiting room) */}
      <PendingClients onApproved={load} />

      {/* Create form */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-void-light/30 p-6">
        <h2 className="font-heading mb-4 text-sm font-semibold text-white">
          Generate New Portal
        </h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="font-mono mb-1 block text-xs text-slate-500">
                Label
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Acme Corp — Cloud Migration"
                className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-mono mb-1 block text-xs text-slate-500">
                Client Email
              </label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientEmail: e.target.value }))
                }
                placeholder="client@example.com"
                className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="font-mono mb-1 block text-xs text-slate-500">
                Client Name (optional)
              </label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientName: e.target.value }))
                }
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-blue/50 focus:outline-none"
              />
            </div>
          </div>
          <p className="font-mono text-[10px] text-slate-600">
            Portal is created with 6 default steps matching the Cloudless
            workflow. You can customise steps after creation.
          </p>
          {formError && (
            <p className="font-mono text-xs text-red-400">{formError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg border border-neon-blue/30 px-5 py-2 font-mono text-xs text-neon-blue transition hover:border-neon-blue/60 disabled:opacity-50"
          >
            {creating ? "Generating…" : "Generate Portal Link"}
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
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-800 bg-void-light/30"
            />
          ))}
        </div>
      )}

      {!loading && portals.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 px-6 py-12 text-center">
          <div className="mb-3 text-4xl">🔗</div>
          <p className="font-heading text-sm text-slate-400">
            No portals created yet.
          </p>
          <p className="font-mono mt-1 text-xs text-slate-600">
            Generate a portal above to share with a client.
          </p>
        </div>
      )}

      {!loading && portals.length > 0 && (
        <div className="space-y-3">
          {portals.map((portal) => {
            const isOpen = expanded === portal.token;
            const completedSteps = portal.steps.filter(
              (s) => s.status === "completed",
            ).length;

            return (
              <div
                key={portal.token}
                className={`rounded-xl border bg-void-light/30 transition-colors ${
                  isOpen ? "border-neon-blue/30" : "border-slate-800"
                }`}
              >
                {/* Portal header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  className="flex cursor-pointer flex-wrap items-start justify-between gap-3 p-4"
                  onClick={() => setExpanded(isOpen ? null : portal.token)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpanded(isOpen ? null : portal.token);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-heading font-semibold text-white">
                        {portal.label}
                      </div>
                      {portal.steps.length > 0 && (
                        <span className="font-mono text-[10px] text-slate-500">
                          {completedSteps}/{portal.steps.length} steps
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3">
                      <span className="font-mono text-xs text-slate-400">
                        {portal.clientEmail}
                      </span>
                      {portal.clientName && (
                        <span className="font-mono text-xs text-slate-500">
                          {portal.clientName}
                        </span>
                      )}
                      <span className="font-mono text-xs text-slate-600">
                        {new Date(portal.createdAt).toLocaleDateString("en-IE")}
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    {portal.steps.length > 0 && (
                      <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green transition-all"
                          style={{
                            width: `${Math.round((completedSteps / portal.steps.length) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(portal.token);
                      }}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      {copied === portal.token ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        revoke(portal.token);
                      }}
                      className="rounded-lg border border-red-900/40 px-3 py-1.5 font-mono text-xs text-red-400 transition hover:border-red-700"
                    >
                      Revoke
                    </button>
                    <svg
                      className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded: step manager */}
                {isOpen && (
                  <div className="border-t border-slate-800 px-4 pt-4 pb-5">
                    <p className="mb-1 font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                      Project Steps
                    </p>
                    <StepManager portal={portal} onUpdate={load} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* In-app help — how the portal flow works */}
      <details className="mt-12 group rounded-xl border border-slate-800 bg-void-light/20 open:border-neon-cyan/30">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
          <span className="bg-neon-cyan/15 border-neon-cyan/30 flex h-7 w-7 items-center justify-center rounded-full border text-base">
            ?
          </span>
          <span className="font-mono">How the portal flow works</span>
          <svg
            className="ml-auto h-4 w-4 text-slate-500 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </summary>
        <div className="border-t border-slate-800 px-5 py-5 space-y-4 text-sm leading-relaxed text-slate-300">
          <div>
            <p className="font-mono text-xs tracking-widest text-neon-cyan uppercase mb-2">
              The flow, end-to-end
            </p>
            <ol className="ml-5 list-decimal space-y-2 text-slate-400">
              <li>
                Client clicks a service or bundle CTA on{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  /services
                </code>{" "}
                — they get sent to{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  /auth/signup?plan=...
                </code>
              </li>
              <li>
                Cognito sign-up + email verification → client lands in{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  /portal/waiting
                </code>
              </li>
              <li>
                Waiting room creates a pending entry. <strong>You</strong> get a
                Slack ping +{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  tbaltzakis@cloudless.gr
                </code>{" "}
                email with the client&rsquo;s name, email, and plan.
              </li>
              <li>
                You see them in the &ldquo;
                <span className="text-yellow-400">⏳ N clients waiting</span>
                &rdquo; section above. One click on{" "}
                <span className="text-neon-green">
                  Approve & Create Portal
                </span>{" "}
                creates the portal with 6 default steps and emails the client a
                link to{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  /portal/[token]
                </code>{" "}
                from{" "}
                <code className="rounded bg-void px-1 text-neon-cyan">
                  noreply@cloudless.gr
                </code>
                .
              </li>
              <li>
                Manage the project from the expanded portal card below — set
                step statuses (pending → in-progress → completed), post comments
                that appear in the client&rsquo;s timeline, add custom steps if
                needed.
              </li>
            </ol>
          </div>

          <div>
            <p className="font-mono text-xs tracking-widest text-neon-cyan uppercase mb-2">
              Default project steps
            </p>
            <p className="text-slate-400">
              Free Audit → Proposal & Scope → Setup & Kickoff → Implementation →
              Review & Feedback → Delivery & Handoff. You can rename, reorder
              (delete + re-add), or add custom steps per portal.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs tracking-widest text-neon-cyan uppercase mb-2">
              What the client sees
            </p>
            <ul className="ml-5 list-disc space-y-1 text-slate-400">
              <li>
                Visual project timeline (horizontal on desktop, vertical on
                mobile)
              </li>
              <li>
                Per-step status indicator and your comment thread per step
              </li>
              <li>
                Linked Stripe subscriptions and paid invoices (if their email is
                in Stripe)
              </li>
              <li>
                Live updates — they don&rsquo;t need to refresh; their portal
                polls for changes
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs tracking-widest text-neon-cyan uppercase mb-2">
              Storage and security
            </p>
            <p className="text-slate-400">
              Pending clients live in SSM at{" "}
              <code className="rounded bg-void px-1 text-neon-cyan">
                /cloudless/PENDING_CLIENTS_JSON
              </code>
              ; portals at{" "}
              <code className="rounded bg-void px-1 text-neon-cyan">
                /cloudless/CLIENT_PORTALS_JSON
              </code>
              . The portal token is a UUID v4 (
              <code className="rounded bg-void px-1 text-neon-cyan">
                crypto.randomUUID
              </code>
              ) — anyone with the link can view that client&rsquo;s portal, so
              share it via email only. Use Revoke to invalidate immediately.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
