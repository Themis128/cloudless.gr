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
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Active</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : activeCount}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Admins</p>
          <p className="font-heading text-neon-magenta mt-1 text-2xl font-bold">
            {loading ? "…" : adminCount}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Unconfirmed</p>
          <p className="font-heading mt-1 text-2xl font-bold text-yellow-400">
            {loading ? "…" : unconfirmedCount}
          </p>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className="border-neon-magenta/20 bg-neon-magenta/5 mb-4 rounded-lg border px-4 py-2 font-mono text-sm text-white">
          {actionMsg}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by email, name, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-void-light focus:border-neon-magenta/50 w-full max-w-md rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
        />
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="border-neon-magenta/20 text-neon-magenta hover:bg-neon-magenta/10 min-h-[44px] rounded-lg border px-4 py-2 font-mono text-xs transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="bg-void-light/50 rounded-xl border border-red-900/30 p-6 text-center">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            Make sure COGNITO_USER_POOL_ID is configured and the Lambda/server
            has cognito-idp permissions.
          </p>
        </div>
      ) : (
        <div className="bg-void-light/50 overflow-hidden rounded-xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    User
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Cognito Status
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left font-mono text-xs font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.username}
                    className="hover:bg-void-lighter/30 border-b border-slate-800/50 transition-colors"
                  >
                    {/* User info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="border-neon-magenta/30 bg-neon-magenta/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-white">
                          {(user.name || user.email || "U")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-white">
                            {user.email}
                          </p>
                          {user.name && (
                            <p className="truncate text-xs text-slate-500">
                              {user.name}
                              {user.company ? ` · ${user.company}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${roleClasses[user.role]}`}
                      >
                        {user.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${statusClasses[user.status]}`}
                      >
                        {user.status}
                      </span>
                    </td>

                    {/* Cognito status */}
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${userStatusClasses[user.userStatus] ?? "text-slate-400 bg-slate-800/50"}`}
                      >
                        {user.userStatus}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {user.created
                        ? new Date(user.created).toLocaleDateString("en-IE")
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        {user.status === "active" ? (
                          <button
                            onClick={() =>
                              handleAction("disable", user.username)
                            }
                            disabled={actionLoading !== null}
                            className="min-h-[32px] rounded-lg border border-red-900/30 px-2 py-1 font-mono text-[10px] text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
                          >
                            {actionLoading === `disable-${user.username}`
                              ? "…"
                              : "Disable"}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleAction("enable", user.username)
                            }
                            disabled={actionLoading !== null}
                            className="min-h-[32px] rounded-lg border border-neon-green/20 px-2 py-1 font-mono text-[10px] text-neon-green transition-colors hover:bg-neon-green/10 disabled:opacity-50"
                          >
                            {actionLoading === `enable-${user.username}`
                              ? "…"
                              : "Enable"}
                          </button>
                        )}

                        {user.role === "user" ? (
                          <button
                            onClick={() =>
                              handleAction("promote", user.username)
                            }
                            disabled={actionLoading !== null}
                            className="border-neon-magenta/20 text-neon-magenta hover:bg-neon-magenta/10 min-h-[32px] rounded-lg border px-2 py-1 font-mono text-[10px] transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `promote-${user.username}`
                              ? "…"
                              : "→ Admin"}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleAction("demote", user.username)
                            }
                            disabled={actionLoading !== null}
                            className="min-h-[32px] rounded-lg border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-50"
                          >
                            {actionLoading === `demote-${user.username}`
                              ? "…"
                              : "→ User"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center font-mono text-slate-600"
                    >
                      {search ? "No users match your search" : "No users found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 font-mono text-xs text-slate-600">
        Powered by AWS Cognito · User Pool{" "}
        <span className="text-slate-500">
          {process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "not configured"}
        </span>
      </p>
    </div>
  );
}
