import { Link } from "@/i18n/navigation";

/**
 * Shared UI kit for the /admin/campaigns/<platform> pages.
 * Extracted from the per-platform pages (google, linkedin, tiktok, x, meta)
 * which previously each carried identical copies of these helpers.
 */

export function BackLink() {
  return (
    <div className="mb-6">
      <Link
        href="/admin/campaigns"
        className="font-mono text-xs text-slate-500 hover:text-slate-300"
      >
        ← Campaigns
      </Link>
    </div>
  );
}

export function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-3">
      <p className="font-mono text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function Spinner({ color = "border-neon-cyan" }: { readonly color?: string }) {
  return (
    <div className="flex items-center gap-3 py-4 text-slate-400">
      <div className={`${color} h-4 w-4 animate-spin rounded-full border-2 border-t-transparent`} />
      <span className="font-mono text-sm">Loading...</span>
    </div>
  );
}

export function ErrorMsg({ msg }: { readonly msg: string }) {
  return (
    <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
      {msg}
    </div>
  );
}
