"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const REFRESH_INTERVAL = 10_000;
const TH_CLASS = "px-6 py-3 text-left font-mono text-xs font-medium text-slate-500";

interface Company {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    city?: string;
    country?: string;
    phone?: string;
    industry?: string;
    createdate?: string;
  };
}

interface CompanyFormData {
  name: string;
  domain: string;
  city: string;
  country: string;
  phone: string;
  industry: string;
}

const EMPTY_FORM: CompanyFormData = {
  name: "",
  domain: "",
  city: "",
  country: "",
  phone: "",
  industry: "",
};

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return { toasts, show };
}

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  form: CompanyFormData;
  onChange: (field: keyof CompanyFormData, value: string) => void;
  submitLabel: string;
}

function CompanyModal({ title, onClose, onSubmit, submitting, form, onChange, submitLabel }: ModalProps) {
  const fields: { key: keyof CompanyFormData; label: string; required?: boolean; placeholder?: string }[] = [
    { key: "name", label: "Company Name", required: true, placeholder: "Acme Corp" },
    { key: "domain", label: "Domain", placeholder: "acme.com" },
    { key: "city", label: "City", placeholder: "Dublin" },
    { key: "country", label: "Country", placeholder: "Ireland" },
    { key: "phone", label: "Phone", placeholder: "+353 1 234 5678" },
    { key: "industry", label: "Industry", placeholder: "Technology" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-void-light w-full max-w-md rounded-2xl border border-slate-700 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block font-mono text-xs text-slate-400">
                {f.label}
                {f.required && <span className="text-neon-magenta ml-0.5">*</span>}
              </label>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) => onChange(f.key, e.target.value)}
                required={f.required}
                placeholder={f.placeholder}
                className="bg-void focus:border-neon-magenta/50 w-full rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 transition-colors focus:outline-none"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2 font-mono text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-neon-magenta/10 border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/20 flex-1 rounded-lg border py-2 font-mono text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Row hover state
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const { toasts, show: showToast } = useToast();

  const fetchCompanies = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchWithAuth("/api/admin/crm/companies?limit=100");
      if (!res.ok) {
        if (res.status === 503) throw new Error("HubSpot not configured");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as { companies?: Company[] };
      setCompanies(data.companies ?? []);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies().catch(() => {});
    const interval = setInterval(() => {
      fetchCompanies().catch(() => {});
    }, REFRESH_INTERVAL);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchCompanies().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchCompanies]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const p = c.properties;
    return (
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.domain ?? "").toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.country ?? "").toLowerCase().includes(q)
    );
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  }

  function openEdit(company: Company) {
    setForm({
      name: company.properties.name ?? "",
      domain: company.properties.domain ?? "",
      city: company.properties.city ?? "",
      country: company.properties.country ?? "",
      phone: company.properties.phone ?? "",
      industry: company.properties.industry ?? "",
    });
    setEditTarget(company);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  function handleFormChange(field: keyof CompanyFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Partial<CompanyFormData> = { name: form.name };
      if (form.domain) body.domain = form.domain;
      if (form.city) body.city = form.city;
      if (form.country) body.country = form.country;
      if (form.phone) body.phone = form.phone;
      if (form.industry) body.industry = form.industry;

      const res = await fetchWithAuth("/api/admin/crm/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeModal();
      showToast("Company created successfully", "success");
      await fetchCompanies(true);
    } catch {
      showToast("Failed to create company", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSubmitting(true);
    try {
      const body: Partial<CompanyFormData> = {};
      if (form.name) body.name = form.name;
      if (form.domain !== undefined) body.domain = form.domain;
      if (form.city !== undefined) body.city = form.city;
      if (form.country !== undefined) body.country = form.country;
      if (form.phone !== undefined) body.phone = form.phone;
      if (form.industry !== undefined) body.industry = form.industry;

      const res = await fetchWithAuth(`/api/admin/crm/companies/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeModal();
      showToast("Company updated successfully", "success");
      await fetchCompanies(true);
    } catch {
      showToast("Failed to update company", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/admin/crm/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteId(null);
      showToast("Company deleted", "success");
      await fetchCompanies(true);
    } catch {
      showToast("Failed to delete company", "error");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
                <th className={TH_CLASS}>Company</th>
                <th className={TH_CLASS}>Domain</th>
                <th className={TH_CLASS}>Location</th>
                <th className={TH_CLASS}>Added</th>
                <th className={TH_CLASS + " w-20"}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  onMouseEnter={() => setHoveredRow(c.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    className="cursor-pointer px-6 py-4 font-medium text-white"
                    onClick={() => openEdit(c)}
                  >
                    {c.properties.name || "—"}
                  </td>
                  <td className="text-neon-cyan px-6 py-4 font-mono text-xs">
                    {c.properties.domain ? (
                      <a
                        href={`https://${c.properties.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.properties.domain}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {[c.properties.city, c.properties.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    {c.properties.createdate
                      ? new Date(c.properties.createdate).toLocaleDateString("en-IE")
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {deleteId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting}
                          className="rounded bg-red-900/30 px-2 py-0.5 font-mono text-xs text-red-400 transition-colors hover:bg-red-900/50 disabled:opacity-50"
                        >
                          {deleting ? "…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(null)}
                          className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400 transition-colors hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 transition-opacity"
                        style={{ opacity: hoveredRow === c.id ? 1 : 0 }}
                      >
                        <button
                          type="button"
                          title="Edit company"
                          onClick={() => openEdit(c)}
                          className="text-slate-400 transition-colors hover:text-white"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Delete company"
                          onClick={() => setDeleteId(c.id)}
                          className="text-slate-400 transition-colors hover:text-red-400"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center font-mono text-slate-600">
                    {search ? "No companies match your search" : "No companies yet"}
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
      {/* Toast notifications */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 font-mono text-sm shadow-lg transition-all ${
              t.type === "success"
                ? "border-green-800 bg-green-900/80 text-green-300"
                : "border-red-800 bg-red-900/80 text-red-300"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-magenta font-mono text-xs">CRM</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">Companies</h1>
          <p className="font-body mt-1 text-slate-400">Company accounts synced from HubSpot.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="bg-neon-magenta/10 border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/20 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors"
            >
              + New Company
            </button>
            <button
              type="button"
              onClick={() => fetchCompanies(true)}
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

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Companies</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : companies.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">With Domain</p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading ? "…" : companies.filter((c) => c.properties.domain).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, domain, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 placeholder:text-slate-600 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors"
        />
      </div>

      {mainContent}

      {/* Modals */}
      {modalMode === "create" && (
        <CompanyModal
          title="New Company"
          onClose={closeModal}
          onSubmit={handleCreate}
          submitting={submitting}
          form={form}
          onChange={handleFormChange}
          submitLabel="Create Company"
        />
      )}
      {modalMode === "edit" && (
        <CompanyModal
          title="Edit Company"
          onClose={closeModal}
          onSubmit={handleEdit}
          submitting={submitting}
          form={form}
          onChange={handleFormChange}
          submitLabel="Save Changes"
        />
      )}
    </div>
  );
}
