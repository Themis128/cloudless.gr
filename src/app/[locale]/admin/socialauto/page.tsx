"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface GateItem {
  id: string;
  platform: string;
  target_author: string;
  action: string;
  score: number;
  comment_draft: string | null;
  status: string;
}

const PLATFORM_BADGE: Record<string, string> = {
  linkedin: "bg-blue-500/20 text-blue-300",
  threads: "bg-slate-500/20 text-slate-200",
  twitter: "bg-sky-500/20 text-sky-300",
  instagram: "bg-pink-500/20 text-pink-300",
};

export default function SocialAutoGatePage() {
  const [items, setItems] = useState<GateItem[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const draftRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/socialauto-gates", { cache: "no-store" });
    const d = (await r.json()) as { items?: GateItem[]; error?: string };
    if (!r.ok) { setErr(d.error || "load failed"); return; }
    setItems(d.items || []);
    setErr(null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (item: GateItem, op: "approve" | "reject", idx: number) => {
    setBusy(item.id + op);
    const draft = op === "approve" ? draftRefs.current[idx]?.value : undefined;
    const r = await fetch("/api/admin/socialauto-gates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, op, comment_draft: draft }),
    });
    setBusy(null);
    if (!r.ok) { setErr(`${op} failed`); return; }
    setItems(prev => prev.filter(x => x.id !== item.id));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!items.length) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "TEXTAREA" || t.tagName === "INPUT";
      if (e.key === "ArrowDown" && !typing) { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
      if (e.key === "ArrowUp" && !typing) { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      if (e.key === " " && !typing) { e.preventDefault(); act(items[sel], "approve", sel); }
      if (e.key === "Backspace" && !typing) { e.preventDefault(); act(items[sel], "reject", sel); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [items, sel, act]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Human Gate — Engagement Queue</h1>
        <button onClick={load} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-neon-cyan/50">
          Refresh
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        ↑↓ navigate · <kbd className="rounded bg-slate-800 px-1">Space</kbd> approve · <kbd className="rounded bg-slate-800 px-1">Backspace</kbd> reject
      </p>
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
      {!items.length && <div className="rounded-xl border border-slate-800 bg-void-light/50 p-8 text-center text-slate-400">Queue empty — all engagement drafts cleared.</div>}
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it.id}
            className={`rounded-xl border p-4 transition-colors ${i === sel ? "border-neon-cyan/60 bg-void-light/80" : "border-slate-800 bg-void-light/50"}`}
            onClick={() => setSel(i)}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${PLATFORM_BADGE[it.platform] || "bg-slate-600/20 text-slate-300"}`}>{it.platform}</span>
              <span className="text-sm text-slate-300">@{it.target_author}</span>
              <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">{it.action}</span>
              <span className="ml-auto text-xs text-slate-500">score {it.score.toFixed(1)}</span>
            </div>
            {it.comment_draft !== undefined && (
              <textarea
                ref={el => { draftRefs.current[i] = el; }}
                defaultValue={it.comment_draft || ""}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-void/60 p-2 text-sm text-slate-200 focus:border-neon-cyan/50 focus:outline-none"
              />
            )}
            <div className="mt-3 flex gap-2">
              <button disabled={busy === it.id + "approve"} onClick={() => act(it, "approve", i)}
                className="rounded-lg bg-neon-cyan/20 px-4 py-1.5 text-sm font-medium text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-40">
                {busy === it.id + "approve" ? "…" : "Approve"}
              </button>
              <button disabled={busy === it.id + "reject"} onClick={() => act(it, "reject", i)}
                className="rounded-lg bg-red-500/15 px-4 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/25 disabled:opacity-40">
                {busy === it.id + "reject" ? "…" : "Reject"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
