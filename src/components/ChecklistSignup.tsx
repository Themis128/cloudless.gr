"use client";

import { useState, useCallback, type FormEvent } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

const MAGNET_SLUG = "automation-checklist";

/** Optional email capture for the 12-Automation Checklist on /links. The PDF
 *  stays a direct download — this subscribes the reader so monthly checklist
 *  updates land in their inbox, and records a `Lead Magnet` lead in EspoCRM
 *  (segment: "Checklist downloaders"). */
export default function ChecklistSignup() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const onTurnstile = useCallback((token: string | null) => setTurnstileToken(token), []);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          turnstileToken: turnstileToken ?? undefined,
          magnet: MAGNET_SLUG,
        }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-neon-green font-mono text-xs">
        You&apos;re on the list — the updated checklist lands in your inbox monthly.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
        Want the monthly updated version? Leave your email — we&apos;ll send each refresh.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email for checklist updates"
            required
            className="bg-void focus:border-neon-cyan/50 min-h-10 min-w-0 flex-1 rounded-lg border border-slate-700 px-3 py-1.5 font-mono text-xs text-white transition-colors placeholder:text-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-10 shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? "Sending…" : "Send it"}
          </button>
        </div>
        <TurnstileWidget onToken={onTurnstile} />
      </form>
      {status === "error" && (
        <p className="mt-1 font-mono text-xs text-red-400">Something went wrong — try again.</p>
      )}
    </div>
  );
}
