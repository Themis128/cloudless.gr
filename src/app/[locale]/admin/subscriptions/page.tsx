"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type { AdminSubscription } from "@/app/api/admin/subscriptions/route";

type StatusFilter = "active" | "past_due" | "trialing" | "canceled" | "all";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 border-green-900/40 bg-green-950/20",
  trialing: "text-neon-blue border-neon-blue/30 bg-neon-blue/10",
  past_due: "text-yellow-400 border-yellow-900/40 bg-yellow-950/20",
  canceled: "text-slate-500 border-slate-700 bg-slate-900/30",
  unpaid: "text-red-400 border-red-900/40 bg-red-950/20",
};

function formatAmount(amount: number, currency: string, interval: string) {
  const formatted = (amount / 100).toLocaleString("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  });
  return `${formatted}/${interval}`;
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function load(status: StatusFilter) {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetchWithAuth(
        `/api/admin/subscriptions?status=${status}&limit=50`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(statusFilter);
  }, [statusFilter]);

  async function openPortal(customerId: string) {
    setActionLoading(customerId);
    try {
      const res = await fetchWithAuth("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal", customerId }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setActionMessage(data.error ?? "Could not open portal");
      }
    } catch {
      setActionMessage("Failed to open billing portal");
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelSubscription(subscriptionId: string) {
    if (!confirm("Schedule cancellation at period end?")) return;
    setActionLoading(subscriptionId);
    try {
      const res = await fetchWithAuth("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", subscriptionId }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMessage(
          "Subscription scheduled for cancellation at period end.",
        );
        load(statusFilter);
      } else {
        setActionMessage(data.error ?? "Cancellation failed");
      }
    } catch {
      setActionMessage("Failed to cancel subscription");
    } finally {
      setActionLoading(null);
    }
  }

  const totalMRR = subscriptions
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((acc, s) => {
      const monthly = s.interval === "year" ? s.amount / 12 : s.amount;
      return acc + monthly;
    }, 0);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="border-neon-blue/20 bg-neon-blue/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <span className="bg-neon-blue h-2 w-2 animate-pulse rounded-full" />
            <span className="text-neon-blue font-mono text-xs">
              STRIPE BILLING
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">
            Subscriptions
          </h1>
          <p className="font-body mt-1 text-slate-400">
            Manage recurring billing, access customer portals, and monitor MRR.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(statusFilter)}
          disabled={loading}
          className="mt-2 rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-4">
          <div className="font-mono text-xs text-slate-500">Active</div>
          <div className="font-heading mt-1 text-2xl font-bold text-white">
            {subscriptions.filter((s) => s.status === "active").length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-4">
          <div className="font-mono text-xs text-slate-500">Trialing</div>
          <div className="font-heading mt-1 text-2xl font-bold text-neon-blue">
            {subscriptions.filter((s) => s.status === "trialing").length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-4">
          <div className="font-mono text-xs text-slate-500">Past Due</div>
          <div className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {subscriptions.filter((s) => s.status === "past_due").length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-void-light/30 p-4">
          <div className="font-mono text-xs text-slate-500">Est. MRR</div>
          <div className="font-heading mt-1 text-2xl font-bold text-green-400">
            {(totalMRR / 100).toLocaleString("en-IE", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            "active",
            "trialing",
            "past_due",
            "canceled",
            "all",
          ] as StatusFilter[]
        ).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
              statusFilter === s
                ? "border-neon-blue/50 bg-neon-blue/10 text-neon-blue"
                : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 font-mono text-xs text-slate-300">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-800 bg-void-light/30"
            />
          ))}
        </div>
      )}

      {!loading && subscriptions.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-void-light/30 px-6 py-12 text-center">
          <div className="mb-3 text-4xl">💳</div>
          <p className="font-heading text-sm text-slate-400">
            No subscriptions found.
          </p>
          <p className="font-mono mt-1 text-xs text-slate-600">
            {statusFilter === "all"
              ? "Your Stripe account has no subscriptions yet."
              : `No ${statusFilter.replace("_", " ")} subscriptions.`}
          </p>
        </div>
      )}

      {!loading && subscriptions.length > 0 && (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const statusClass =
              STATUS_COLORS[sub.status] ?? "text-slate-400 border-slate-700";
            const busy =
              actionLoading === sub.id || actionLoading === sub.customerId;
            return (
              <div
                key={sub.id}
                className="rounded-xl border border-slate-800 bg-void-light/30 p-4 transition hover:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading font-semibold text-white">
                        {sub.customerEmail ?? sub.customerId}
                      </span>
                      {sub.customerName && (
                        <span className="font-mono text-xs text-slate-500">
                          {sub.customerName}
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${statusClass}`}
                      >
                        {sub.status.replace("_", " ")}
                      </span>
                      {sub.cancelAtPeriodEnd && (
                        <span className="rounded-full border border-orange-900/40 bg-orange-950/20 px-2 py-0.5 font-mono text-[10px] text-orange-400">
                          cancels {formatDate(sub.currentPeriodEnd)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4">
                      <span className="font-mono text-xs text-slate-400">
                        {sub.planName} —{" "}
                        <span className="text-white">
                          {formatAmount(sub.amount, sub.currency, sub.interval)}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        renews {formatDate(sub.currentPeriodEnd)}
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        since {formatDate(sub.created)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openPortal(sub.customerId)}
                      disabled={busy}
                      className="rounded-lg border border-neon-blue/30 px-3 py-1.5 font-mono text-xs text-neon-blue transition hover:border-neon-blue/60 disabled:opacity-50"
                    >
                      {actionLoading === sub.customerId ? "Opening…" : "Portal"}
                    </button>
                    {sub.status !== "canceled" && !sub.cancelAtPeriodEnd && (
                      <button
                        type="button"
                        onClick={() => cancelSubscription(sub.id)}
                        disabled={busy}
                        className="rounded-lg border border-red-900/40 px-3 py-1.5 font-mono text-xs text-red-400 transition hover:border-red-700 disabled:opacity-50"
                      >
                        {actionLoading === sub.id ? "Canceling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
