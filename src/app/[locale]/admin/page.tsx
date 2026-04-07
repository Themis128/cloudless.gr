"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashStats {
  orders: { total: number; revenue: number } | null;
  contacts: { total: number } | null;
  errors: { total: number } | null;
  health: { status: string; version: string } | null;
}

const adminCards = [
  {
    title: "Orders & Revenue",
    description: "Stripe checkout sessions and subscriptions",
    icon: "◇",
    href: "/admin/orders",
    statKey: "orders" as const,
    render: (s: DashStats) =>
      s.orders ? `${s.orders.total} orders · €${s.orders.revenue.toFixed(0)}` : "—",
  },
  {
    title: "CRM Contacts",
    description: "HubSpot leads and customer contacts",
    icon: "◉",
    href: "/admin/crm",
    statKey: "contacts" as const,
    render: (s: DashStats) => (s.contacts ? `${s.contacts.total} contacts` : "—"),
  },
  {
    title: "SEO & Analytics",
    description: "Traffic, keywords, and domain rating",
    icon: "📊",
    href: "/admin/analytics",
    statKey: null,
    render: () => "View →",
  },
  {
    title: "Error Monitoring",
    description: "Unresolved Sentry issues",
    icon: "⚠",
    href: "/admin/errors",
    statKey: "errors" as const,
    render: (s: DashStats) => (s.errors ? `${s.errors.total} unresolved` : "—"),
  },
  {
    title: "Notifications",
    description: "Send test Slack notifications",
    icon: "🔔",
    href: "/admin/notifications",
    statKey: null,
    render: () => "Manage →",
  },
  {
    title: "Settings",
    description: "Site configuration and preferences",
    icon: "⚙",
    href: "/admin/settings",
    statKey: null,
    render: () => "Configure →",
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats>({
    orders: null,
    contacts: null,
    errors: null,
    health: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [ordersRes, contactsRes, errorsRes, healthRes] = await Promise.allSettled([
          fetch("/api/admin/orders?limit=50"),
          fetch("/api/admin/crm/contacts?limit=1"),
          fetch("/api/admin/ops/errors"),
          fetch("/api/health"),
        ]);

        const orders =
          ordersRes.status === "fulfilled" && ordersRes.value.ok
            ? await ordersRes.value.json()
            : null;
        const contacts =
          contactsRes.status === "fulfilled" && contactsRes.value.ok
            ? await contactsRes.value.json()
            : null;
        const errors =
          errorsRes.status === "fulfilled" && errorsRes.value.ok
            ? await errorsRes.value.json()
            : null;
        const health =
          healthRes.status === "fulfilled" && healthRes.value.ok
            ? await healthRes.value.json()
            : null;

        setStats({
          orders: orders
            ? {
                total: orders.orders?.length ?? 0,
                revenue:
                  orders.orders?.reduce(
                    (sum: number, o: { amount: number }) => sum + (o.amount ?? 0),
                    0,
                  ) ?? 0,
              }
            : null,
          contacts: contacts ? { total: contacts.total ?? 0 } : null,
          errors: errors ? { total: errors.total ?? 0 } : null,
          health: health ? { status: health.status, version: health.version } : null,
        });
      } catch {
        /* stats are best-effort */
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ADMIN_DASH</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="font-body mt-1 text-slate-400">Manage your Cloudless platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <div className="bg-void-light/50 hover:border-neon-magenta/30 rounded-xl border border-slate-800 p-6 transition-all">
              <div className="mb-4 flex items-start justify-between">
                <div className="bg-neon-magenta/10 border-neon-magenta/20 flex h-10 w-10 items-center justify-center rounded-lg border text-lg">
                  {card.icon}
                </div>
                {loading ? (
                  <span className="bg-slate-800/50 h-4 w-16 animate-pulse rounded" />
                ) : (
                  <span className="text-neon-green font-mono text-xs">{card.render(stats)}</span>
                )}
              </div>
              <h3 className="font-heading mb-1 font-semibold text-white">{card.title}</h3>
              <p className="font-body text-sm text-slate-500">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* System Status */}
      <div className="bg-void-light/50 mt-8 rounded-xl border border-slate-800 p-6">
        <h2 className="font-heading mb-4 font-semibold text-white">System Status</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "API",
              status: stats.health?.status === "ok" ? "Operational" : "Unknown",
              ok: stats.health?.status === "ok",
            },
            {
              label: "Version",
              status: stats.health?.version ?? "—",
              ok: !!stats.health?.version,
            },
            {
              label: "Errors",
              status:
                stats.errors !== null
                  ? stats.errors.total === 0
                    ? "All Clear"
                    : `${stats.errors.total} unresolved`
                  : "Not connected",
              ok: stats.errors !== null && stats.errors.total === 0,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-void flex items-center gap-3 rounded-lg border border-slate-800 px-4 py-3"
            >
              <span
                className={`h-2 w-2 rounded-full ${item.ok ? "bg-neon-green" : "bg-slate-600"}`}
              />
              <span className="font-mono text-sm text-slate-400">{item.label}</span>
              <span
                className={`ml-auto font-mono text-xs ${item.ok ? "text-neon-green" : "text-slate-500"}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
