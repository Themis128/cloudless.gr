"use client";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

interface Purchase {
  id: string;
  status: string;
  amount: number;
  currency: string;
  items: { name: string; quantity: number; amount: number }[];
  date: string;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string;
  items: { name: string; amount: number; currency: string }[];
  cancelAtPeriodEnd: boolean;
  created: string;
}

const statusClasses: Record<string, string> = {
  paid: "text-neon-green bg-neon-green/10",
  complete: "text-neon-green bg-neon-green/10",
  active: "text-neon-green bg-neon-green/10",
  unpaid: "text-yellow-400 bg-yellow-400/10",
  no_payment_required: "text-neon-cyan bg-neon-cyan/10",
  trialing: "text-neon-cyan bg-neon-cyan/10",
  past_due: "text-yellow-400 bg-yellow-400/10",
  canceled: "text-red-400 bg-red-400/10",
  incomplete: "text-yellow-400 bg-yellow-400/10",
};

export default function PurchasesPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "subscriptions">("orders");

  useEffect(() => {
    if (!user?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetchWithAuth("/api/user/purchases");
        if (!res.ok) {
          if (res.status === 503) throw new Error("Stripe not configured");
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setPurchases(data.purchases ?? []);
        setSubscriptions(data.subscriptions ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load purchases",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const totalSpent = purchases
    .filter((p) => p.status === "paid" || p.status === "complete")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">PURCHASES</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          {t("dashboard.purchases", "Your Purchases")}
        </h1>
        <p className="font-body mt-1 text-slate-400">
          {t(
            "dashboard.purchasesDesc",
            "View and manage orders placed with your account.",
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Orders</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : purchases.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Spent</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : `€${totalSpent.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">
            Active Subscriptions
          </p>
          <p className="font-heading text-neon-cyan mt-1 text-2xl font-bold">
            {loading
              ? "…"
              : subscriptions.filter((s) => s.status === "active").length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["orders", "subscriptions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
              tab === t
                ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 border"
                : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t === "orders"
              ? `Orders (${purchases.length})`
              : `Subscriptions (${subscriptions.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            {error === "Stripe not configured"
              ? "Payment system is being set up."
              : "Please try again later."}
          </p>
        </div>
      ) : tab === "orders" ? (
        purchases.length === 0 ? (
          <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
            <div className="bg-neon-cyan/10 border-neon-cyan/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border text-2xl">
              ◇
            </div>
            <h2 className="font-heading mb-2 font-semibold text-white">
              No purchases yet
            </h2>
            <p className="font-body mx-auto max-w-md text-sm text-slate-500">
              When you buy services or products from our store, they&apos;ll
              appear here.
            </p>
            <Link
              href="/store"
              className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 mt-6 inline-block min-h-11 rounded-lg border px-6 py-2.5 font-mono text-sm transition-all"
            >
              Browse Store →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="bg-void-light/50 rounded-xl border border-slate-800 p-5 transition-all hover:border-neon-cyan/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          statusClasses[p.status] ??
                          "bg-slate-800/50 text-slate-400"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        {new Date(p.date).toLocaleDateString("en-IE")}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {p.items.map((item, i) => (
                        <p key={i} className="font-mono text-sm text-white">
                          {item.name}
                          {item.quantity > 1 && (
                            <span className="text-slate-500">
                              {" "}
                              ×{item.quantity}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-lg font-bold text-white">
                      {p.currency === "EUR" ? "€" : p.currency}{" "}
                      {p.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : subscriptions.length === 0 ? (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-heading mb-2 font-semibold text-white">
            No subscriptions
          </p>
          <p className="font-body text-sm text-slate-500">
            Active subscriptions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-void-light/50 rounded-xl border border-slate-800 p-5 transition-all hover:border-neon-cyan/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        statusClasses[sub.status] ??
                        "bg-slate-800/50 text-slate-400"
                      }`}
                    >
                      {sub.status}
                    </span>
                    {sub.cancelAtPeriodEnd && (
                      <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 font-mono text-[10px] text-yellow-400">
                        Cancels at period end
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    {sub.items.map((item, i) => (
                      <p key={i} className="font-mono text-sm text-white">
                        {item.name}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-slate-500">
                    Renews{" "}
                    {new Date(sub.currentPeriodEnd).toLocaleDateString("en-IE")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
