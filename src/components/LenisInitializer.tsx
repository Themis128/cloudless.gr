"use client";

import { useEffect } from "react";

export default function LenisInitializer() {
  useEffect(() => {
    // Respect reduced-motion: skip smooth scroll (and its continuous
    // requestAnimationFrame loop) entirely. This is the correct a11y behavior
    // and also removes the ongoing main-thread work during Lighthouse audits,
    // which run with prefers-reduced-motion.
    if (
      typeof globalThis.matchMedia !== "function" ||
      globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let rafId = 0;
    let destroy: (() => void) | undefined;
    let cancelled = false;

    // Load Lenis (~100KB) lazily so it is not bundled into the eagerly-loaded
    // client chunk. The page is fully usable with native scrolling before this
    // resolves.
    import("lenis")
      .then(({ default: Lenis }) => {
        if (cancelled) return;
        const lenis = new Lenis({
          duration: 1.2,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
        });

        function raf(time: number) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        destroy = () => {
          cancelAnimationFrame(rafId);
          lenis.destroy();
        };
      })
      .catch(() => {
        /* native scrolling is the fallback */
      });

    return () => {
      cancelled = true;
      if (destroy) destroy();
    };
  }, []);

  return null;
}
