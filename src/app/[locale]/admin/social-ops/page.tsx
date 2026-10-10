"use client";

import { useCallback, useEffect, useState } from "react";
import type { SaOpsConsole } from "@/lib/socialauto";

/**
 * Social Ops admin page — /[locale]/admin/social-ops
 *
 * Read-mostly surface over SocialAuto's /api/v1/ops/console, proxied through
 * /api/admin/postiz/ops so the SocialAuto admin credentials stay server-side.
 * Actions (session heal, browser-lock release) POST to the same route.
 */

const AUDIT_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  not_submitted: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const ACCOUNT_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function Badge({ text, tone }: { text: string; tone: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{text}</span>
  );
}

export default function SocialOpsPage() {
  const [data, setData] = useState<SaOpsConsole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/postiz/ops", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      setData((await res.json()) as SaOpsConsole);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the fetch to a microtask — setState in a callback, not the
    // effect body (react-hooks/set-state-in-effect).
    Promise.resolve().then(load);
  }, [load]);

  const runAction = async (action: SaOpsActionButton) => {
    setBusy(action.action);
    try {
      const res = await fetch("/api/admin/postiz/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const queue = data?.publish_queue ?? {};
  const audit = data?.tiktok_audit ?? null;
  const auditStatus = audit ? String(audit.status) : "not_submitted";
  const byPlatform = (data?.accounts ?? []).reduce<Record<string, SaOpsConsole["accounts"]>>(
    (acc, a) => {
      (acc[a.platform] ??= []).push(a);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Social Ops</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            SocialAuto platform health — services, accounts, queue, media pipeline
            {data?.checked_at && <> · checked {new Date(data.checked_at).toLocaleTimeString()}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => void runAction({ action: "session-heal" })}
            disabled={busy !== null}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "session-heal" ? "Healing…" : "Heal sessions"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Services */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Services
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(data?.services ?? []).map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="text-sm font-medium">{s.name}</span>
              <Badge
                text={s.online ? "online" : "offline"}
                tone={
                  s.online
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                }
              />
            </div>
          ))}
          {!data && loading && <p className="text-sm text-gray-500">Loading…</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Accounts */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Connected accounts ({data?.accounts.length ?? 0})
          </h2>
          <div className="space-y-3">
            {Object.entries(byPlatform).map(([platform, accounts]) => (
              <div key={platform}>
                <div className="mb-1 text-sm font-medium capitalize">
                  {platform} <span className="text-xs text-gray-500">({accounts.length})</span>
                </div>
                <div className="space-y-1">
                  {accounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700"
                    >
                      <span>{a.display_name || a.username || a.id.slice(0, 8)}</span>
                      <span className="flex items-center gap-2">
                        {a.token_expires_at && (
                          <span className="text-xs text-gray-500">
                            token → {new Date(a.token_expires_at).toLocaleDateString()}
                          </span>
                        )}
                        <Badge
                          text={a.status}
                          tone={
                            ACCOUNT_BADGE[a.status] ??
                            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          {/* TikTok audit */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              TikTok Direct Post audit
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge
                  text={auditStatus.replaceAll("_", " ")}
                  tone={
                    AUDIT_BADGE[auditStatus] ??
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }
                />
                {audit?.reference != null && (
                  <span className="text-gray-500">ref {String(audit.reference)}</span>
                )}
              </div>
              {audit?.detail != null && (
                <p className="text-gray-500 dark:text-gray-400">{String(audit.detail)}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Until approved, TikTok publishing falls back to MEDIA_UPLOAD (inbox draft).
              </p>
            </div>
          </section>

          {/* Publish queue */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Publish queue
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {(queue.pending ?? 0) + (queue.processing ?? 0)}
                </div>
                <div className="text-xs text-gray-500">pending</div>
              </div>
              <div>
                <div
                  className={`text-2xl font-bold tabular-nums ${(queue.failed ?? 0) > 0 ? "text-red-600" : ""}`}
                >
                  {queue.failed ?? 0}
                </div>
                <div className="text-xs text-gray-500">failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 tabular-nums">
                  {queue.completed ?? 0}
                </div>
                <div className="text-xs text-gray-500">completed</div>
              </div>
            </div>
          </section>

          {/* Media + browser */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Media pipeline &amp; browser
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>ComfyUI queue</span>
                <span>
                  {data?.media?.comfyui_queue?.running ?? 0} running ·{" "}
                  {data?.media?.comfyui_queue?.pending ?? 0} pending
                </span>
              </div>
              <div className="flex justify-between">
                <span>AI-generated assets</span>
                <span>{data?.media?.ai_generated_assets ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Browser orchestrator</span>
                <span className="flex items-center gap-2">
                  {data?.browser_orchestrator?.message ?? "—"}
                  {data?.browser_orchestrator?.lock_held && (
                    <button
                      onClick={() => void runAction({ action: "release-browser-lock" })}
                      disabled={busy !== null}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-gray-600"
                    >
                      {busy === "release-browser-lock" ? "Releasing…" : "Release"}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

type SaOpsActionButton = { action: "session-heal" } | { action: "release-browser-lock" };
