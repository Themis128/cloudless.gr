"use client";

import { useState } from "react";

export default function AdminNotificationsPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [history, setHistory] = useState<
    { time: string; message: string; ok: boolean }[]
  >([]);

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      const data = await res.json();
      const ok = res.ok;
      setResult({
        ok,
        text: ok
          ? "Notification sent to Slack!"
          : (data.error ?? "Failed to send"),
      });
      setHistory((prev) => [
        {
          time: new Date().toLocaleTimeString("en-IE"),
          message: message.trim(),
          ok,
        },
        ...prev,
      ]);
      if (ok) setMessage("");
    } catch {
      setResult({ ok: false, text: "Network error" });
    } finally {
      setSending(false);
    }
  }

  const presets = [
    {
      label: "Deploy complete",
      text: "✅ Deployment to production completed successfully.",
    },
    {
      label: "Maintenance start",
      text: "🔧 Scheduled maintenance starting now. ETA: 30 minutes.",
    },
    {
      label: "Issue resolved",
      text: "✅ The reported issue has been resolved. All systems operational.",
    },
    {
      label: "New feature",
      text: "🚀 New feature deployed: check the admin dashboard for details.",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">
            NOTIFICATIONS
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Slack Notifications
        </h1>
        <p className="font-body mt-1 text-slate-400">
          Send test messages and announcements to your team Slack channel.
        </p>
      </div>

      {/* Quick presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setMessage(p.text)}
            className="min-h-[36px] rounded-lg border border-slate-800 px-3 py-1.5 font-mono text-xs text-slate-400 transition-all hover:border-slate-700 hover:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Send form */}
      <form onSubmit={sendTest} className="mb-8">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <label className="mb-2 block font-mono text-xs text-slate-500">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type a Slack message..."
            className="bg-void focus:border-neon-magenta/50 mb-4 w-full resize-none rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:outline-none"
          />

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="bg-neon-magenta/10 border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/20 disabled:border-slate-700 disabled:text-slate-600 min-h-11 rounded-lg border px-6 py-2.5 font-mono text-sm font-semibold transition-all disabled:cursor-not-allowed hover:shadow-[0_0_25px_rgba(255,0,255,0.2)]"
            >
              {sending ? "Sending…" : "Send to Slack"}
            </button>

            {result && (
              <span
                className={`font-mono text-xs ${result.ok ? "text-neon-green" : "text-red-400"}`}
              >
                {result.ok ? "✓" : "✗"} {result.text}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Send history */}
      {history.length > 0 && (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
          <h3 className="font-heading mb-3 text-sm font-semibold text-white">
            Session History
          </h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div
                key={i}
                className="bg-void flex items-start gap-3 rounded-lg border border-slate-800/50 px-4 py-3"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.ok ? "bg-neon-green" : "bg-red-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-slate-300">
                    {h.message}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-slate-600">
                  {h.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
