"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type Category = "contact" | "subscribe" | "booking" | "order" | "error" | "auth" | "portal";

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "contact", label: "Contact" },
  { value: "subscribe", label: "Subscribe" },
  { value: "booking", label: "Booking" },
  { value: "order", label: "Order" },
  { value: "auth", label: "Auth" },
  { value: "portal", label: "Portal" },
  { value: "error", label: "Error" },
];

const WINDOWS: { value: number; label: string }[] = [
  { value: 1, label: "24h" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  category: Category;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
  actor?: string;
  route?: string;
}

interface Analytics {
  window: { since: string; until: string };
  total: number;
  byCategory: Record<Category, number>;
  byDay: Record<string, number>;
}

function windowSinceISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function ringForType(type: Notification["type"]): string {
  switch (type) {
    case "error":
      return "border-red-500/30 bg-red-500/5";
    case "warning":
      return "border-yellow-500/30 bg-yellow-500/5";
    case "success":
      return "border-emerald-500/30 bg-emerald-500/5";
    default:
      return "border-neon-magenta/20 bg-neon-magenta/5";
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [windowDays, setWindowDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(() => windowSinceISO(windowDays), [windowDays]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listParams = new URLSearchParams({ since, limit: "100" });
      if (category !== "all") listParams.set("category", category);
      const analyticsParams = new URLSearchParams({ since });

      const [listRes, statsRes] = await Promise.all([
        fetchWithAuth(`/api/admin/notifications?${listParams.toString()}`),
        fetchWithAuth(`/api/admin/notifications/analytics?${analyticsParams.toString()}`),
      ]);

      if (listRes.status === 503 || statsRes.status === 503) {
        setError("Notifications store not configured yet -- check back after deploy completes.");
        setNotifications([]);
        setAnalytics(null);
        return;
      }

      const listJson = (((((await listRes.json()) as any)) as any)) as { notifications?: Notification[] };
      const statsJson = (((((await statsRes.json()) as any)) as any)) as Analytics;
      setNotifications(listJson.notifications ?? []);
      setAnalytics(statsJson);
    } catch (e) {
      console.error("[notifications] load failed", e);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [category, since]);

  useEffect(() => {
    // react-hooks/set-state-in-effect: do not call setState synchronously in
    // the effect body. Defer to the next microtask so we leave the
    // commit-phase before `load()` calls setLoading/setData.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const markAllRead = async () => {
    await fetchWithAuth("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    void load();
  };

  const markOne = async (id: string) => {
    await fetchWithAuth("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void load();
  };

  const days = analytics ? Object.keys(analytics.byDay).sort() : [];
  const maxDay = days.length ? Math.max(...days.map((d) => analytics!.byDay[d])) : 0;

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">NOTIFICATIONS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Notifications</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          Durable audit log of client interactions and captured errors. 90-day hot window in
          DynamoDB; older rows archived to S3.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                category === c.value
                  ? "border-neon-magenta bg-neon-magenta/20 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {c.label}
              {analytics && c.value !== "all" && (
                <span className="ml-1.5 text-slate-500">{analytics.byCategory[c.value]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindowDays(w.value)}
                className={`rounded border px-2 py-1 font-mono text-[10px] transition ${
                  windowDays === w.value
                    ? "border-neon-magenta bg-neon-magenta/10 text-white"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            onClick={markAllRead}
            className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-400 hover:border-slate-500 hover:text-white"
          >
            Mark all read
          </button>
        </div>
      </div>

      {analytics && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                Last {windowDays}d
              </div>
              <div className="font-heading text-2xl font-bold text-white">
                {analytics.total} events
              </div>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              {new Date(analytics.window.since).toLocaleDateString()} to{" "}
              {new Date(analytics.window.until).toLocaleDateString()}
            </div>
          </div>
          {days.length > 0 && (
            <div className="flex items-end gap-1">
              {days.map((d) => {
                const count = analytics.byDay[d];
                const height = maxDay > 0 ? Math.max(6, Math.round((count / maxDay) * 48)) : 6;
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      title={`${d}: ${count}`}
                      className="bg-neon-magenta/60 w-full rounded-sm"
                      style={{ height: `${height}px` }}
                    />
                    <div className="font-mono text-[9px] text-slate-600">{d.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
          <p className="font-mono text-sm text-yellow-200">{error}</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-sm text-slate-500">
            No notifications in the selected window.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 transition ${
                n.read ? "border-slate-800 bg-slate-900/20" : ringForType(n.type)
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="bg-neon-magenta h-2 w-2 rounded-full" />}
                  <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 uppercase">
                    {n.category}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">{n.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                  {!n.read && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="font-mono text-[10px] text-slate-500 hover:text-white"
                    >
                      mark read
                    </button>
                  )}
                </div>
              </div>
              <p className="font-mono text-xs text-slate-400">{n.message}</p>
              {(n.actor || n.route) && (
                <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-slate-600">
                  {n.actor && <span>by {n.actor}</span>}
                  {n.route && <span>via {n.route}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
