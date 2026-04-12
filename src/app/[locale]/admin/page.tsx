"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
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
      s.orders
        ? `${s.orders.total} orders · €${s.orders.revenue.toFixed(0)}`
        : "—",
  },
  {
    title: "CRM Contacts",
    description: "HubSpot leads and customer contacts",
    icon: "◉",
    href: "/admin/crm",
    statKey: "contacts" as const,
    render: (s: DashStats) =>
      s.contacts ? `${s.contacts.total} contacts` : "—",
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
        const [ordersRes, contactsRes, errorsRes, healthRes] =
          await Promise.allSettled([
            fetchWithAuth("/api/admin/orders?limit=50"),
            fetchWithAuth("/api/admin/crm/contacts?limit=1"),
            fetchWithAuth("/api/admin/ops/errors"),
            fetchWithAuth("/api/health"),
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
                    (sum: number, o: { amount: number }) =>
                      sum + (o.amount ?? 0),
                    0,
                  ) ?? 0,
              }
            : null,
          contacts: contacts ? { total: contacts.total ?? 0 } : null,
          errors: errors ? { total: errors.total ?? 0 } : null,
          health: health
            ? { status: health.status, version: health.version }
            : null,
        });
      } catch {
        /* stats are best-effort */
      } finally {
        setLoading(