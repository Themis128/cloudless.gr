"use client";

import { useEffect, useRef } from "react";

/**
 * Run `fn` once on mount, then every `intervalMs` milliseconds — but ONLY
 * while the tab is visible (`document.visibilityState === "visible"`).
 *
 * Why this exists: open admin tabs left in the background were the largest
 * source of Cloudflare Worker / API request volume. Pages that previously
 * "paused on visibility change" only refetched on return — the underlying
 * setInterval kept ticking, so the savings were nil. This hook gates the
 * interval itself.
 *
 * On returning to the tab we fire `fn()` once immediately so the user sees
 * fresh data without waiting up to `intervalMs`.
 *
 * `fn` should be stable (wrap in `useCallback`). The hook stores the most
 * recent reference internally so a stale closure can never fire.
 */
export function useVisiblePoll(fn: () => void | Promise<void>, intervalMs: number): void {
  const fnRef = useRef(fn);

  // react-hooks/refs: never write to a ref during render. Update the latest
  // `fn` reference in an effect so the polling timer always sees the freshest
  // closure without violating React's invariant.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const invoke = () => {
      if (cancelled) return;
      const r = fnRef.current();
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => {});
      }
    };

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(invoke, intervalMs);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        invoke();
        start();
      } else {
        stop();
      }
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      invoke();
      start();
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", onVisibility);
    }

    return () => {
      cancelled = true;
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", onVisibility);
      }
    };
  }, [intervalMs]);
}
