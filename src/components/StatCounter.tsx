"use client";

import { useEffect, useRef } from "react";

interface StatCounterProps {
  value: string;
  label: string;
  valueClassName?: string;
  showLabel?: boolean;
}

function parseStatValue(value: string): {
  end: number;
  suffix: string;
  decimalPlaces: number;
} {
  const match = value.match(/^([\d.]+)(.*)$/);
  if (!match) return { end: 0, suffix: value, decimalPlaces: 0 };
  const num = parseFloat(match[1]);
  const suffix = match[2];
  const decimalPlaces = (match[1].split(".")[1] ?? "").length;
  return { end: num, suffix, decimalPlaces };
}

export default function StatCounter({
  value,
  label,
  valueClassName = "text-neon-cyan font-mono text-3xl font-bold",
  showLabel = true,
}: Readonly<StatCounterProps>) {
  const elRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        observer.unobserve(el);

        const { end, suffix, decimalPlaces } = parseStatValue(value);
        // Load countup.js (~50KB) lazily, only when a counter actually scrolls
        // into view. The final value is already rendered as text, so the
        // visible number is correct even if this never loads — keeping it out
        // of the initial bundle cuts parse/compile time (TBT) on stat-heavy
        // pages like /services (24 counters).
        import("countup.js")
          .then(({ CountUp }) => {
            const cu = new CountUp(el, end, {
              duration: 2,
              suffix,
              decimalPlaces,
              useEasing: true,
            });
            if (!cu.error) cu.start();
          })
          .catch(() => {
            /* keep the statically rendered value on load failure */
          });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="text-center">
      <div ref={elRef} className={valueClassName} aria-label={value}>
        {value}
      </div>
      {showLabel && (
        <div className="mt-1 font-mono text-xs tracking-wider text-slate-500 uppercase">
          {label}
        </div>
      )}
    </div>
  );
}
