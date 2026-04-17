"use client";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  activeSubscriptions: number;
  upcomingConsultations: number;
}

export default function DashboardPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    if (!user?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    async function fetchStats() {
      const email = encodeURIComponent(user!.email!);
      const [purchasesRes, consultationsRes] = await Promise.allSettled([
        fetch(`/api/user/purchases?email=${email}`),
        fetchWithAuth("/api/user/consultations"),
      ]);

      let totalOrders = 0;
      let totalSpent = 0;
      let activeSubscriptions = 0;
      let upcomingConsultations = 0;

      if (purchasesRes.status === "fulfilled" && purchasesRes.value.ok) {
        const data = await purchasesRes.value.json();
        const purchases = data.purchases ?? [];
        const subs = data.subscriptions ?? [];
        totalOrders = purchases.length;
        totalSpent = purchases
          .filter(
            (p: { status: string }) =>
              p.status === "paid" || p.status === "complete",
          )
          .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
        activeSubscriptions = subs.filter(
          (s: { status: string }) => s.status === "active",
        ).length;
      }

      if (
        consultationsRes.status === "fulfilled" &&
        consultationsRes.value.ok
      ) {
        const data = await consultationsRes.value.json();
        upcomingConsultations = (data.consultations ?? []).filter(
          (c: { status: string }) => c.status === "upcoming",
        ).length;
      }

      setStats({
        totalOrders,
        totalSpent,
        activeSubscriptions,
        upcomingConsultations,
      });
      setLoading(false);
    }

    fetchStats();
  }, [user]);

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("dashboard.goodMorning", "Good morning")
      : hour < 18
        ? t("dashboard.goodAfternoon", "Good afternoon")
        : t("dashboard.goodEvening", "Good evening");

  const dashboardCards = [
    {
      title: t("dashboard.profile", "Profile"),
      description: t(
        "dashboard.profileCardDesc",
        "Update your name, company, and contact info",
      ),
      icon: "◉",
      href: "/dashboard/profile",
      accent: "cyan" as const,
    },
    {
      title: t("dashboard.purchases", "Purchases"),
      description: loading
        ? "Loading…"
        : stats?.totalOrders
          ? `${stats.totalOrders} orders — €${stats.totalSpent.toFixed(2)} spent`
          : t("dashboard.noPurchasesYet", "No purchases yet"),
      icon: "◇",
      href: "/dashboard/purchases",
      accent: "green" as const,
    },
    {
      title: t("dashboard.consultations", "Consultations"),
      description: loading
        ? "Loading…"
        : stats?.upcomingConsultations
          ? `${stats.upcomingConsultations} upcoming session${stats.upcomingConsultations > 1 ? "s" : ""}`
          : t("dashboard.noConsultations", "No upcoming sessions"),
      icon: "📅",
      href: "/dashboard/consultations",
      accent: "blue" as const,
    },
    {
      title: t("dashboard.settings", "Settings"),
      description: t(
        "dashboard.settingsCardDesc",
        "Theme, language, and notification preferences",
      ),
      icon: "⚙",
      href: "/dashboard/settings",
      accent: "magenta" as const,
    },
  ];

  const accentClasses = {
    cyan: {
      icon: "bg-neon-cyan/10 border-neon-cyan/20",
      hover: "hover:border-neon-cyan/30",
    },
    green: {
      icon: "bg-neon-green/10 border-neon-green/20",
      hover: "hover:border-neon-green/30",
    },
    blue: {
      icon: "bg-neon-blue/10 border-neon-blue/20",
      hover: "hover:border-neon-blue/30",
    },
    magenta: {
      icon: "bg-neon-magenta/10 border-neon-magenta/20",
      hover: "hover:border-neon-magenta/30",
    },
  };

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">DASHBOARD</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          {greeting}, {displayName}
        </h1>
        <p className="font-body mt-1 text-slate-400">
          {user?.company
            ? `${user.company} — ${t("dashboard.overview", "Overview")}`
            : t("dashboard.overview", "Overview")}
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-[10px] text-slate-500">Orders</p>
          <p className="font-heading mt-1 text-xl font-bold text-white">
            {loading ? "…" : (stats?.totalOrders ?? 0)}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-[10px] text-slate-500">Total Spent</p>
          <p className="font-heading text-neon-green mt-1 text-xl font-bold">
            {loading ? "…" : `€${(stats?.totalSpent ?? 0).toFixed(0)}`}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-[10px] text-slate-500">Subscriptions</p>
          <p className="font-heading text-neon-cyan mt-1 text-xl font-bold">
            {loading ? "…" : (stats?.activeSubscriptions ?? 0)}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-[10px] text-slate-500">Consultations</p>
          <p className="font-heading text-neon-blue mt-1 text-xl font-bold">
            {loading ? "…" : (stats?.upcomingConsultations ?? 0)}
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dashboardCards.map((card) => {
          const accent = accentClasses[card.accent];
          return (
            <Link
              key={card.title}
              href={card.href}
              className={`bg-void-light/50 group rounded-xl border border-slate-800 p-6 transition-all ${accent.hover}`}
            >
              <div className="mb-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg ${accent.icon}`}
                >
                  {card.icon}
                </div>
              </div>
              <h3 className="font-heading mb-1 font-semibold text-white">
                {card.title}
              </h3>
              <p className="font-body text-sm text-slate-500">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="bg-void-light/50 mt-8 rounded-xl border border-slate-800 p-6">
        <h2 className="font-heading mb-4 font-semibold text-white">
          {t("dashboard.quickLinks", "Quick Links")}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/store"
            className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 inline-flex min-h-11 items-center rounded-lg border px-4 py-2.5 font-mono text-sm transition-all"
          >
            Browse Store →
          </Link>
          <Link
            href="/services"
            className="bg-neon-blue/10 border-neon-blue/20 text-neon-blue hover:bg-neon-blue/20 inline-flex min-h-11 items-center rounded-lg border px-4 py-2.5 font-mono text-sm transition-all"
          >
            View Services →
          </Link>
          <Link
            href="/contact"
            className="bg-neon-green/10 border-neon-green/20 text-neon-green hover:bg-neon-green/20 inline-flex min-h-11 items-center rounded-lg border px-4 py-2.5 font-mono text-sm transition-all"
          >
            Contact Support →
          </Link>
        </div>
      </div>
    </div>
  );
}
