"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/admin/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">NOTIFICATIONS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-slate-800 p-12 text-center">
          <p className="font-mono text-sm text-slate-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.read
                  ? "border-slate-800 bg-slate-900/20"
                  : "border-neon-magenta/20 bg-neon-magenta/5"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="bg-neon-magenta h-2 w-2 rounded-full" />}
                  <span className="font-mono text-sm font-semibold text-white">{n.title}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400">{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
