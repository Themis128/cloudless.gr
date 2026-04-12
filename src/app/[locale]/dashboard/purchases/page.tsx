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
        <h