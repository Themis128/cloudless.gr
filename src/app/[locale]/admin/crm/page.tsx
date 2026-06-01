"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

interface Contact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    service_interest?: string;
    lead_source?: string;
    createdate?: string;
    hs_lead_status?: string;
  };
}

type ContactFormData = {
  email: string;
  firstname: string;
  lastname: string;
  company: string;
  service_interest: string;
  lead_source: string;
  hs_lead_status: string;
};

type Toast = { id: number; message: string; ok: boolean };

const LEAD_STATUS_OPTIONS = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "OPEN_DEAL",
  "UNQUALIFIED",
  "ATTEMPTED_TO_CONTACT",
  "CONNECTED",
  "BAD_TIMING",
] as const;

const SERVICE_INTEREST_OPTIONS = [
  "cloud-architecture",
  "serverless",
  "analytics",
  "digital-marketing",
  "full-bundle",
] as const;

const leadStatusClasses: Record<string, string> = {
  NEW: "text-neon-cyan bg-neon-cyan/10",
  OPEN: "text-neon-green bg-neon-green/10",
  IN_PROGRESS: "text-yellow-400 bg-yellow-400/10",
  OPEN_DEAL: "text-neon-magenta bg-neon-magenta/10",
  UNQUALIFIED: "text-slate-400 bg-slate-800/50",
  ATTEMPTED_TO_CONTACT: "text-orange-400 bg-orange-400/10",
  CONNECTED: "text-blue-400 bg-blue-400/10",
  BAD_TIMING: "text-slate-500 bg-slate-700/30",
};

const EMPTY_FORM: ContactFormData = {
  email: "",
  firstname: "",
  lastname: "",
  company: "",
  service_interest: "",
  lead_source: "",
  hs_lead_status: "",
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L2.046 11.48a.75.75 0 0 0-.197.384l-.748 3.993a.75.75 0 0 0 .88.88l3.993-.748a.75.75 0 0 0 .384-.196l8.967-8.967a1.75 1.75 0 0 0 0-2.475ZM11.73 3.574l.697.697-7.467 7.466-.928.174.174-.928 7.524-7.409Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path
        fillRule="evenodd"
        d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────

interface ContactModalProps {
  editingContact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string, ok: boolean) => void;
}

function ContactModal({ editingContact, onClose, onSaved, onToast }: ContactModalProps) {
  const [form, setForm] = useState<ContactFormData>(() => {
    if (!editingContact) return EMPTY_FORM;
    const p = editingContact.properties;
    return {
      email: p.email ?? "",
      firstname: p.firstname ?? "",
      lastname: p.lastname ?? "",
      company: p.company ?? "",
      service_interest: p.service_interest ?? "",
      lead_source: p.lead_source ?? "",
      hs_lead_status: p.hs_lead_status ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) return;
    setSaving(true);
    try {
      const body: Partial<ContactFormData> = {};
      for (const key of Object.keys(form) as (keyof ContactFormData)[]) {
        if (form[key].trim()) body[key] = form[key].trim();
      }

      const res = editingContact
        ? await fetchWithAuth(`/api/admin/crm/contacts/${editingContact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetchWithAuth("/api/admin/crm/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg =
          (errJson as { error?: string }).error ??
          `HTTP ${res.status}`;
        throw new Error(msg);
      }
      onToast(editingContact ? "Contact updated." : "Contact created.", true);
      onSaved();
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Something went wrong.", false);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-neon-magenta/50 focus:outline-none transition-colors";
  const labelClass = "block font-mono text-xs text-slate-400 mb-1";
  const selectClass = `${inputClass} appearance-none`;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-white">
            {editingContact ? "Edit Contact" : "New Contact"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 transition-colors hover:text-slate-300"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email — required */}
          <div>
            <label htmlFor="modal-email" className={labelClass}>
              Email <span className="text-neon-magenta">*</span>
            </label>
            <input
              id="modal-email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="contact@example.com"
              className={inputClass}
            />
          </div>

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="modal-firstname" className={labelClass}>
                First Name
              </label>
              <input
                id="modal-firstname"
                name="firstname"
                type="text"
                value={form.firstname}
                onChange={handleChange}
                placeholder="Jane"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="modal-lastname" className={labelClass}>
                Last Name
              </label>
              <input
                id="modal-lastname"
                name="lastname"
                type="text"
                value={form.lastname}
                onChange={handleChange}
                placeholder="Doe"
                className={inputClass}
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label htmlFor="modal-company" className={labelClass}>
              Company
            </label>
            <input
              id="modal-company"
              name="company"
              type="text"
              value={form.company}
              onChange={handleChange}
              placeholder="Acme Ltd."
              className={inputClass}
            />
          </div>

          {/* Service Interest */}
          <div>
            <label htmlFor="modal-service" className={labelClass}>
              Service Interest
            </label>
            <select
              id="modal-service"
              name="service_interest"
              value={form.service_interest}
              onChange={handleChange}
              className={selectClass}
            >
              <option value="">— none —</option>
              {SERVICE_INTEREST_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Lead Source */}
          <div>
            <label htmlFor="modal-lead-source" className={labelClass}>
              Lead Source
            </label>
            <input
              id="modal-lead-source"
              name="lead_source"
              type="text"
              value={form.lead_source}
              onChange={handleChange}
              placeholder="e.g. website, referral…"
              className={inputClass}
            />
          </div>

          {/* Lead Status */}
          <div>
            <label htmlFor="modal-status" className={labelClass}>
              Lead Status
            </label>
            <select
              id="modal-status"
              name="hs_lead_status"
              value={form.hs_lead_status}
              onChange={handleChange}
              className={selectClass}
            >
              <option value="">— none —</option>
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 rounded-lg border px-4 py-2 font-mono text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : editingContact ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Delete confirmation state — stores the id being confirmed
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const pushToast = useCallback((message: string, ok: boolean) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/crm/contacts?limit=50");
      if (!res.ok) {
        if (res.status === 503) throw new Error("HubSpot not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { contacts?: Contact[] };
      setContacts(data.contacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContacts();
    const interval = setInterval(() => void fetchContacts(), 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchContacts();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchContacts]);

  const handleDeleteConfirm = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/admin/crm/contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast("Contact deleted.", true);
      setConfirmDeleteId(null);
      await fetchContacts();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Delete failed.", false);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditingContact(null);
    setModalOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setModalOpen(true);
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const p = c.properties;
    return (
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.firstname ?? "").toLowerCase().includes(q) ||
      (p.lastname ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q)
    );
  });

  let content;
  if (loading) {
    content = (
      <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  } else if (error) {
    content = (
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
    content = (
      <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Company
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Lead Status
                </th>
                <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                  Added
                </th>
                <th className="px-6 py-3 text-right font-mono text-xs font-medium text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isConfirming = confirmDeleteId === c.id;
                return isConfirming ? (
                  <tr key={c.id} className="border-b border-slate-800/50 bg-red-950/20">
                    <td colSpan={6} className="px-6 py-3">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-red-400">
                          Delete{" "}
                          <span className="font-semibold text-red-300">
                            {c.properties.email ?? "this contact"}
                          </span>
                          ? This cannot be undone.
                        </span>
                        <button
                          onClick={() => void handleDeleteConfirm(c.id)}
                          disabled={deleting}
                          className="rounded border border-red-600 px-3 py-1 font-mono text-xs text-red-400 transition-colors hover:bg-red-600/20 disabled:opacity-50"
                        >
                          {deleting ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deleting}
                          className="rounded border border-slate-700 px-3 py-1 font-mono text-xs text-slate-400 transition-colors hover:border-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={c.id}
                    className="group hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-white">
                      {[c.properties.firstname, c.properties.lastname]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                      {c.properties.email ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {c.properties.company || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${leadStatusClasses[c.properties.hs_lead_status ?? ""] ?? "bg-slate-800/50 text-slate-400"}`}
                      >
                        {c.properties.hs_lead_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {c.properties.createdate
                        ? new Date(c.properties.createdate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(c)}
                          title="Edit contact"
                          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-neon-cyan"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          title="Delete contact"
                          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center font-mono text-slate-600">
                    {search ? "No contacts match your search" : "No contacts yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CRM</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">CRM Contacts</h1>
            <p className="font-body mt-1 text-slate-400">
              Leads and contacts synced from HubSpot.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-sm transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New Contact
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Contacts</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : contacts.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">New Leads</p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : contacts.filter((c) => c.properties.hs_lead_status === "NEW").length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Open Deal</p>
          <p className="font-heading text-neon-magenta mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : contacts.filter((c) => c.properties.hs_lead_status === "OPEN_DEAL").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {content}

      {/* Modal */}
      {modalOpen && (
        <ContactModal
          editingContact={editingContact}
          onClose={() => setModalOpen(false)}
          onSaved={() => void fetchContacts()}
          onToast={pushToast}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 font-mono text-sm shadow-lg transition-all ${
              t.ok
                ? "border-neon-green/30 bg-slate-900 text-neon-green"
                : "border-red-700/40 bg-slate-900 text-red-400"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
