"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useState } from "react";
import type { AdminInvoiceSummary } from "@/app/api/admin/invoices/route";

type StatusFilter = "all" | "draft" | "open" | "paid" | "void" | "uncollectible";

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-400 border-slate-700 bg-slate-900/30",
  open: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  paid: "text-green-400 border-green-900/40 bg-green-950/20",
  void: "text-slate-500 border-slate-700 bg-slate-900/30",
  uncollectible: "text-red-400 border-red-900/40 bg-red-950/20",
};

function formatMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString("en-IE", {
    style: "currency",
    currency: currency || "EUR",
  });
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Athens",
  });
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    description: "",
    amountEur: "",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/admin/invoices?status=${status}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { invoices: AdminInvoiceSummary[] };
      setInvoices(data.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load(statusFilter).catch(() => {});
    });
  }, [statusFilter, load]);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          email: form.email,
          description: form.description,
          amountEur: Number(form.amountEur),
        }),
      });
      const data = (await res.json()) as { invoice?: AdminInvoiceSummary; error?: string };
      if (!res.ok) {
        setMessage(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setForm({ email: "", description: "", amountEur: "" });
      setMessage(`Draft ${data.invoice?.id} created`);
      await load(statusFilter);
    } catch {
      setMessage("Failed to create draft");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(action: "finalize" | "send", invoiceId: string) {
    setActionLoading(invoiceId);
    setMessage(null);
    try {
      const res = await fetchWithAuth("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, invoiceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setMessage(`${action} ok for ${invoiceId}`);
      await load(statusFilter);
    } catch {
      setMessage(`Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">STRIPE INVOICING</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Invoices</h1>
        <p className="font-body mt-1 text-slate-400">
          Agency one-off invoices via Stripe Invoicing. Stripe is the ledger — no custom finance-db.
        </p>
      </div>

      <form
        onSubmit={createDraft}
        className="bg-void-light/50 grid gap-3 rounded-xl border border-slate-800 p-4 sm:grid-cols-4"
      >
        <input
          required
          type="email"
          placeholder="client@email.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
        />
        <input
          required
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white sm:col-span-2"
        />
        <div className="flex gap-2">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="EUR"
            value={form.amountEur}
            onChange={(e) => setForm((f) => ({ ...f, amountEur: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white"
          />
          <button
            type="submit"
            disabled={creating}
            className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan rounded-lg border px-3 py-2 font-mono text-xs whitespace-nowrap disabled:opacity-50"
          >
            {creating ? "…" : "Draft"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "open", "paid", "void", "uncollectible"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${
              statusFilter === s
                ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
                : "border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {message ? <p className="font-mono text-xs text-slate-400">{message}</p> : null}
      {loading ? <p className="font-mono text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="font-mono text-sm text-red-400">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-void-light font-mono text-[10px] tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 font-mono text-xs text-slate-600">
                    No invoices in this filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-800/80">
                    <td className="px-4 py-2 font-mono text-xs text-white">
                      {inv.number ?? inv.id}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-300">
                      {inv.customerEmail ?? inv.customerId ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${STATUS_COLORS[inv.status] ?? "border-slate-700 text-slate-400"}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-white">
                      {formatMoney(inv.amountDue || inv.amountPaid, inv.currency)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {formatDate(inv.created)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <div className="flex flex-wrap gap-2">
                        {inv.status === "draft" ? (
                          <button
                            type="button"
                            disabled={actionLoading === inv.id}
                            onClick={() => runAction("finalize", inv.id)}
                            className="text-neon-cyan hover:underline disabled:opacity-50"
                          >
                            Finalize
                          </button>
                        ) : null}
                        {inv.status === "open" ? (
                          <button
                            type="button"
                            disabled={actionLoading === inv.id}
                            onClick={() => runAction("send", inv.id)}
                            className="text-neon-cyan hover:underline disabled:opacity-50"
                          >
                            Send
                          </button>
                        ) : null}
                        {inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white"
                          >
                            Open
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
