"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * Defer hydration of a below-the-fold or decorative subtree until the browser
 * is idle. Used to pull heavy client components (terminal sims, animated stat
 * counters, FAQ accordions) out of the LCP critical path.
 *
 * Mechanics:
 *   1. SSR + first paint: renders the `fallback` (or a neutral skeleton box).
 *   2. After hydration, schedules `setReady(true)` via `requestIdleCallback`
 *      (or a 0-delay setTimeout fallback for Safari < 18.4).
 *   3. On next render, swaps to `children`.
 *
 * The fallback is a thin div so layout shift stays minimal. If a specific
 * call site has known dimensions, pass an explicit `fallback` matching the
 * eventual children's bounding box to avoid a CLS bump.
 *
 * Targeted by Lighthouse Win #4 in `docs/lighthouse-optimization-plan.md`:
 * deferring TerminalBlock + StatCounter on `/services` past LCP.
 */
export default function DeferredRender({
  children,
  fallback,
  /**
   * Wait this many ms past idle before swapping. Defaults to 0 — render
   * immediately when idle fires. Bump to small values (e.g. 200) only if a
   * particular call site benchmarks slower with eager idle-mount.
   */
  idleDelayMs = 0,
}: Readonly<{
  children: ReactNode;
  fallback?: ReactNode;
  idleDelayMs?: number;
}>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fire = () => {
      if (cancelled) return;
      if (idleDelayMs > 0) {
        const t = setTimeout(() => !cancelled && setReady(true), idleDelayMs);
        return () => clearTimeout(t);
      }
      setReady(true);
    };

    // Prefer requestIdleCallback when available so we don't compete with
    // post-hydration work that the user actually sees. Safari < 18.4 lacks
    // it; for those we fall back to setTimeout(..., 0) which lands at the
    // end of the current task queue — still after the critical render.
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(fire, { timeout: 2_000 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const t = setTimeout(fire, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [idleDelayMs]);

  if (ready) return <>{children}</>;
  // Neutral skeleton: low-contrast block, no animation (so it doesn't compete
  // for paint time with the real LCP element).
  return (
    fallback ?? (
      <div
        aria-hidden="true"
        className="bg-void-light/30 h-24 w-full rounded"
        data-deferred="pending"
      />
    )
  );
}
