"use client";

import { useEffect, useRef } from "react";
import { CountUp } from "countup.js";

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
}: StatCounterProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const { end, suffix, decimalPlaces } = parseStatValue(value);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const cu = new CountUp(el, end, {
            duration: 2,
            suffix,
            decimalPlaces,
            useEasing: true,
          });
          if (!cu.error) cu.start();
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 },
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
