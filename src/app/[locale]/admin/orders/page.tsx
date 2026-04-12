"use client";

import { useEffect, useState } from "react";

interface Order {
  id: string;
  email: string;
  amount: number;
  currency: string;
  status: string;
  mode: string;
  items: { description: string; quantity: number; amount: number }[];
  created: string;
}

interface Subscription {
  id: string;
  status: string;
  plan: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  created: string;
}

const statusClasses: Record<string, string> = {
  paid: "text-neon-green bg-neon-green/10",
  complete: "text-neon-green bg-neon-green/10",
  active: "text-neon-green bg-neon-green/10",
  unpaid: "text-yellow-400 bg-yellow-400/10",
  no_payment_required: "text-neon-cyan bg-neon-cyan/10",
  canceled: "text-red-400 bg-red-400/10",
  past_due: "text-red-400 bg-red-400/10",
  trialing: "text-neon-blue bg-neon-blue/10",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "subscriptions">("orders");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/admin/orders?limit=20");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOrders(data.orders ?? []);
        setSubscriptions(data.subscriptions ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ORDERS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Order Management
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Live data from Stripe — checkout sessions and subscriptions.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Orders</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : orders.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Revenue</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : `€${totalRevenue.toFixed(2)}`}
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
      <div className="mb-4 flex gap-2">
        {(["orders", "subscriptions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[36px] rounded-lg px-3 py-1.5 font-mono text-xs transition-all ${
              tab === t
                ? "bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20 border"
                : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} (
            {t === "orders" ? orders.length : subscriptions.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            Make sure STRIPE_SECRET_KEY is configured in SSM.
          </p>
        </div>
      ) : tab === "orders" ? (
        <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                