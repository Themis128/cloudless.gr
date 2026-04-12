"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <section className="bg-void flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-neon-magenta glow-magenta animate-neon-pulse font-mono text-5xl font-bold">
          ERROR
        </p>
        <h1 className="font-heading mt-4 text-2xl font-bold text-white">
          Something went wrong
        </h1>
        <p className="mt-3 font-mono text-sm text-slate-400">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-8 inline-block min-h-[44px] rounded-lg border px-8 py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
        >
          Try Again
        </button>
      </div>
    </section>
  );
}
