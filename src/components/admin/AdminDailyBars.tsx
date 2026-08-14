"use client";

/**
 * Simple daily bar strip — same pattern as /admin/cost.
 * Pass already-scaled values (e.g. euros or USD), not minor units.
 */
export function AdminDailyBars({
  title,
  unitLabel,
  points,
  formatValue,
  barClassName = "bg-neon-green/60 hover:bg-neon-green/90",
}: Readonly<{
  title: string;
  unitLabel: string;
  points: ReadonlyArray<{ day: string; value: number }>;
  formatValue: (value: number) => string;
  barClassName?: string;
}>) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="font-mono text-sm text-white">{title}</div>
        <p className="mt-2 font-mono text-xs text-slate-500">No daily series yet.</p>
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.value), 0.01);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="font-mono text-sm text-white">{title}</div>
        <div className="font-mono text-[10px] text-slate-500">{unitLabel}</div>
      </div>
      <div className="flex h-32 items-end gap-1">
        {points.map((p) => {
          const heightPct = Math.max((p.value / max) * 100, 1);
          return (
            <div
              key={p.day}
              className={`flex-1 rounded-t transition-colors ${barClassName}`}
              style={{ height: `${heightPct}%` }}
              title={`${p.day}: ${formatValue(p.value)}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
        <span>{points[0]?.day ?? ""}</span>
        <span>{points[points.length - 1]?.day ?? ""}</span>
      </div>
    </div>
  );
}
