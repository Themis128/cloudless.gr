"use client";

import { useState } from "react";

/**
 * Booking form for /audit — the three discovery fields from the Cloudless
 * Agent Manifest (CALENDAR_INTEGRATION_ROUTING). Answers land on the lead's
 * CRM record so the audit call starts pre-briefed.
 */
export default function AuditForm({ labels }: { labels: Record<string, string> }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        goal: fd.get("goal"),
        pain: fd.get("pain"),
        timeline: fd.get("timeline"),
      }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="border-neon-green/30 bg-neon-green/5 rounded-xl border p-6 text-center">
        <p className="text-neon-green font-mono text-sm font-semibold">{labels.done}</p>
      </div>
    );
  }

  const inputCls =
    "bg-void/60 w-full rounded-lg border border-slate-800 px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:border-neon-cyan/50 focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="name" placeholder={labels.name} className={inputCls} />
        <input name="email" type="email" required placeholder={labels.email} className={inputCls} />
      </div>
      <textarea
        name="goal"
        required
        rows={2}
        placeholder={labels.goal}
        className={inputCls}
      />
      <input name="pain" required placeholder={labels.pain} className={inputCls} />
      <input name="timeline" required placeholder={labels.timeline} className={inputCls} />
      <button
        type="submit"
        disabled={status === "sending"}
        className="border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 w-full rounded-lg border px-6 py-3 font-mono text-sm font-semibold transition-all duration-300 disabled:opacity-50"
      >
        {status === "sending" ? labels.sending : labels.submit}
      </button>
      {status === "error" && (
        <p className="text-center font-mono text-xs text-red-400">{labels.error}</p>
      )}
    </form>
  );
}
