"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard] Unhandled error:", error);
  }, [error]);

  return (
    <section className="bg-void flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-neon-magenta font-mono text-5xl font-bold">ERROR</p>
        <h1 className="font-heading mt-4 text-2xl font-bold text-white">
          Dashboard error
        </h1>
        <p className="mt-3 font-mono text-sm text-slate-400">
          Something went wrong loading your dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 min-h-[44px] rounded-lg border px-6 py-3 font-mono text-sm font-semibold transition-all"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="min-h-[44px] rounded-lg border border-slate-700 px-6 py-3 font-mono text-sm text-slate-400 transition-all hover:border-slate-600 hover:text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
