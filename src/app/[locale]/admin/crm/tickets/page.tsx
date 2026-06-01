"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const REFRESH_INTERVAL = 10_000;
const TH_CLASS = "px-6 py-3 text-left font-mono text-xs font-medium text-slate-500";

const FALLBACK_STAGES: PipelineStage[] = [
  { id: "1", label: "New" },
  { id: "2", label: "Waiting on contact" },
  { id: "3", label: "Waiting on us" },
  { id: "4", label: "Closed" },
];

const PRIORITY_OPTIONS = ["HIGH", "MEDIUM", "LOW"] as const;

interface PipelineStage {
  id: string;
  label: string;
}

interface Pipeline {
  id: string;
  label: string;
  stages: PipelineStage[];
}

interface Ticket {
  id: string;
  properties: {
    subject?: string;
    content?: string;
    hs_pipeline?: string;
    hs_pipeline_stage?: string;
    hs_ticket_priority?: string;
    createdate?: string;
  };
}

interface TicketFormData {
  subject: string;
  content: string;
  hs_ticket_priority: string;
  hs_pipeline_stage: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const priorityClasses: Record<string, string> = {
  HIGH: "text-red-400 bg-red-400/10",
  MEDIUM: "text-yellow-400 bg-yellow-400/10",
  LOW: "text-neon-green bg-neon-green/10",
};

function getStageLabel(stageId: string, stages: PipelineStage[]): string {
  return (stages.find((s) => s.id === stageId)?.label ?? stageId) || "—";
}

function isClosedStage(stageId: string, stages: PipelineStage[]): boolean {
  const label = getStageLabel(stageId, stages).toLowerCase();
  return label === "closed";
}

// ── Toast component ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 font-mono text-sm shadow-lg transition-all ${
            t.type === "success"
              ? "border-neon-magenta/30 bg-slate-900 text-neon-magenta"
              : "border-red-900/40 bg-slate-900 text-red-400"
          }`}
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="ml-auto text-slate-500 hover:text-slate-300"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Ticket modal ───────────────────────────────────────────────────────────────
interface TicketModalProps {
  ticket: Ticket | null; // null = create mode
  stages: PipelineStage[];
  onClose: () => void;
  onSave: (data: TicketFormData, id?: string) => Promise<void>;
}

function TicketModal({ ticket, stages, onClose, onSave }: TicketModalProps) {
  const isEdit = ticket !== null;
  const [form, setForm] = useState<TicketFormData>({
    subject: ticket?.properties.subject ?? "",
    content: ticket?.properties.content ?? "",
    hs_ticket_priority: ticket?.properties.hs_ticket_priority?.toUpperCase() ?? "MEDIUM",
    hs_pipeline_stage: ticket?.properties.hs_pipeline_stage ?? (stages[0]?.id ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) { setFormError("Subject is required"); return; }
    if (!form.content.trim()) { setFormError("Content is required"); return; }
    setFormError(null);
    setSaving(true);
    try {
      await onSave(form, ticket?.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus:border-neon-magenta/50 focus:outline-none transition-colors";

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-white">
            {isEdit ? "Edit Ticket" : "New Ticket"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-slate-500 hover:text-slate-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-mono text-xs text-slate-500">Subject *</label>
            <input
              className={inputClass}
              placeholder="Brief description of the issue"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs text-slate-500">Content *</label>
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              placeholder="Detailed description…"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-mono text-xs text-slate-500">Priority</label>
              <select
                className={inputClass}
                value={form.hs_ticket_priority}
                onChange={(e) => setForm((f) => ({ ...f, hs_ticket_priority: e.target.value }))}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-mono text-xs text-slate-500">Stage</label>
              <select
                className={inputClass}
                value={form.hs_pipeline_stage}
                onChange={(e) => setForm((f) => ({ ...f, hs_pipeline_stage: e.target.value }))}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p className="font-mono text-xs text-red-400">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/20 rounded-lg border px-4 py-2 font-mono text-xs transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [modalTicket, setModalTicket] = useState<Ticket | "new" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load pipeline stages once on mount
  useEffect(() => {
    fetchWithAuth("/api/admin/crm/pipelines?objectType=tickets")
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data: { pipelines?: Pipeline[] } | undefined) => {
        const allStages = data?.pipelines?.flatMap((p) => p.stages) ?? [];
        if (allStages.length > 0) setStages(allStages);
      })
      .catch(() => {
        // silently fall back to hard-coded stages
      });
  }, []);

  const fetchTickets = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchWithAuth("/api/admin/crm/tickets?limit=100");
      if (!res.ok) {
        if (res.status === 503) throw new Error("HubSpot not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tickets?: Ticket[] };
      setTickets(data.tickets ?? []);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets().catch(() => {});
    const interval = setInterval(() => { fetchTickets().catch(() => {}); }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchTickets().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchTickets]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data: TicketFormData, id?: string) => {
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/admin/crm/tickets/${id}` : "/api/admin/crm/tickets";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    await fetchTickets();
    showToast(isEdit ? "Ticket updated" : "Ticket created");
  }, [fetchTickets, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/admin/crm/tickets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setDeleteTarget(null);
      await fetchTickets();
      showToast("Ticket deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }, [fetchTickets, showToast]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const filtered = tickets.filter((t) =>
    (t.properties.subject ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const open = tickets.filter((t) => !isClosedStage(t.properties.hs_pipeline_stage ?? "", stages)).length;

  // ── Render helpers ─────────────────────────────────────────────────────────
  let mainContent: React.ReactElement;

  if (loading) {
    mainContent = (
      <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  } else if (error) {
    mainContent = (
      <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
        <p className="font-mono text-sm text-red-400">{error}</p>
        <p className="mt-2 text-xs text-slate-500">
          {error === "HubSpot not configured"
            ? "Set HUBSPOT_API_KEY in your environment to enable CRM."
            : "Check your HubSpot API key configuration."}
        </p>
      </div>
    );
  } else {
    mainContent = (
      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className={TH_CLASS}>Subject</th>
                <th className={TH_CLASS}>Priority</th>
                <th className={TH_CLASS}>Stage</th>
                <th className={TH_CLASS}>Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const priority = t.properties.hs_ticket_priority?.toUpperCase() ?? "";
                const stageId = t.properties.hs_pipeline_stage ?? "";
                const closed = isClosedStage(stageId, stages);
                const isConfirmingDelete = deleteTarget === t.id;

                return (
                  <tr
                    key={t.id}
                    className="group hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="max-w-xs px-6 py-4 text-white">
                      <span className="line-clamp-2">{t.properties.subject || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {priority ? (
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${priorityClasses[priority] ?? "bg-slate-800/50 text-slate-400"}`}>
                          {priority}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${closed ? "text-neon-green bg-neon-green/10" : "bg-yellow-400/10 text-yellow-400"}`}>
                        {getStageLabel(stageId, stages)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {t.properties.createdate
                        ? new Date(t.properties.createdate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      {isConfirmingDelete ? (
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-red-400">Delete?</span>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => handleDelete(t.id)}
                            className="rounded border border-red-900/40 px-2 py-0.5 font-mono text-[10px] text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {deleting ? "…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(null)}
                            className="rounded border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:bg-slate-800 transition-colors"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => { setModalTicket(t); setModalOpen(true); }}
                            className="rounded p-1 text-slate-500 hover:text-neon-magenta hover:bg-neon-magenta/10 transition-colors"
                            aria-label="Edit ticket"
                            title="Edit"
                          >
                            {/* pencil icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(t.id)}
                            className="rounded p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            aria-label="Delete ticket"
                            title="Delete"
                          >
                            {/* trash icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center font-mono text-slate-600">
                    {search ? "No tickets match your search" : "No tickets yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const editTicket = modalTicket !== "new" ? modalTicket : null;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CRM</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Support Tickets</h1>
          <p className="font-body mt-1 text-slate-400">
            Customer support tickets synced from HubSpot.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setModalTicket("new"); setModalOpen(true); }}
              className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/20 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors"
            >
              + New Ticket
            </button>
            <button
              type="button"
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              className="border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {fetchedAt && (
            <span className="font-mono text-[10px] text-slate-600">
              Updated {new Date(fetchedAt).toLocaleTimeString("en-IE")}
            </span>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Tickets</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : tickets.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Open</p>
          <p className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {loading ? "…" : open}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Closed</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : tickets.length - open}
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {mainContent}

      {/* ── Modal ── */}
      {modalOpen && (
        <TicketModal
          ticket={editTicket}
          stages={stages}
          onClose={() => { setModalOpen(false); setModalTicket(null); }}
          onSave={handleSave}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
