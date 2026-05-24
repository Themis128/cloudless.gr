"use client";

export default function MetricCard({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
