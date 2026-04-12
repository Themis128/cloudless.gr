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
      icon: "bg-neon-blue/10