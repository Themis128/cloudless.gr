"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState, useCallback } from "react";

interface CognitoUser {
  username: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  status: "active" | "disabled";
  emailVerified: boolean;
  userStatus: string;
  role: "admin" | "user";
  created: string;
  lastModified: string;
}

const statusClasses: Record<string, string> = {
  active: "text-neon-green bg-neon-green/10",
  disabled: "text-red-400 bg-red-400/10",
};

const roleClasses: Record<string, string> = {
  admin: "text-neon-magenta bg-neon-magenta/10",
  user: "text-slate-400 bg-slate-800/50",
};

const userStatusClasses: Record<string, string> = {
  CONFIRMED: "text-neon-green bg-neon-green/10",
  UNCONFIRMED: "text-yellow-400 bg-yellow-400/10",
  FORCE_CHANGE_PASSWORD: "text-yellow-400 bg-yellow-400/10",
  RESET_REQUIRED: "text-yellow-400 bg-yellow-400/10",
  COMPROMISED: "text-red-400 bg-red-400/10",
  UNKNOWN: "text-slate-400 bg-slate-800/50",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth("/api/admin/users?limit=60");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (action: string, username: string) => {
    const confirmMsg: Record<string, string> = {
      disable: "Disable this user? They won't be able to sign in.",
      enable: "Re-enable this user?",
      promote: "Promote this user to admin? They'll have full admin access.",
      demote: "Remove admin privileges from this user?",
    };

    if (!window.confirm(confirmMsg[action] ?? `Perform ${action}?`)) return;

    setActionLoading(`${action}-${username}`);
    setActionMsg(null);

    try {
      const res = await fetchWithAuth("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setActionMsg(data.message);
      // Refresh the list
      await fetchUsers();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.company.toLowerCase().includes(search.toLowerCase()),
  );

  const adminCount = users.filter((u) => u.role === "admin").length;
  const activeCount = users.filter((u) => u.status === "active").length;
  const unconfirmedCount = users.filter(
    (u) => u.userStatus !== "CONFIRMED",
  ).length;

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">USERS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          User Management
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Cognito user pool — manage accounts, roles, and access.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Total Users</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : users.length}
          </p>
        </div>
        <div className="bg-void-light/50 