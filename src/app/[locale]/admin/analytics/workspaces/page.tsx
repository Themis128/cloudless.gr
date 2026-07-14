"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";

interface WorkspaceAnalytics {
  workspaceId: string | null;
  workspace: { id: string; name: string; slug: string } | null;
  portals: {
    total: number;
    active: number;
    expiringSoon: number;
    averageHealth: number;
    expired: number;
  };
  deliverables: {
    total: number;
    inReview: number;
    approved: number;
    changesRequested: number;
    draft: number;
  };
  revenue: {
    openCount: number;
    paidCount: number;
    voidCount: number;
    openAmountCents: number;
    paidAmountCents: number;
    currency: string;
  };
  calendar: {
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    cancelled: number;
    nextScheduledAt: string | null;
  };
}

interface Response {
  workspaces: WorkspaceAnalytics[];
  orgWide: WorkspaceAnalytics;
}

function formatAmount(cents: number, currency: string): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

export default function WorkspaceAnalyticsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/analytics/workspaces");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as any as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    if (!data) return null;
    let portals = 0;
    let deliverables = 0;
    let paidCents = 0;
    let openCents = 0;
    let currency = "EUR";
    let calendarTotal = 0;
    for (const w of [...data.workspaces, data.orgWide]) {
      portals += w.portals.total;
      deliverables += w.deliverables.total;
      paidCents += w.revenue.paidAmountCents;
      openCents += w.revenue.openAmountCents;
      calendarTotal += w.calendar.total;
      if (w.revenue.currency && w.revenue.currency !== "EUR" && currency === "EUR") {
        currency = w.revenue.currency;
      }
    }
    return { portals, deliverables, paidCents, openCents, currency, calendarTotal };
  }, [data]);

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">CROSS-STORE ANALYTICS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Workspaces analytics</h1>
        <p className="font-body mt-1 text-slate-400">
          Per-workspace summary joining workspaces, client portals, and Notion calendar — read off a
          single API call (
          <code className="bg-void rounded px-1.5 py-0.5 font-mono text-xs text-slate-300">
            GET /api/admin/analytics/workspaces
          </code>
          ).
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-xs text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {["s1", "s2", "s3"].map((k) => (
            <div
              key={k}
              className="bg-void-light/30 h-32 animate-pulse rounded-xl border border-slate-800"
            />
          ))}
        </div>
      )}

      {!loading && data && totals && (
        <>
          {/* Top-line totals */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total portals" value={String(totals.portals)} />
            <Kpi label="Deliverables" value={String(totals.deliverables)} />
            <Kpi label="Calendar items" value={String(totals.calendarTotal)} />
            <Kpi
              label="Paid revenue (all-time)"
              value={formatAmount(totals.paidCents, totals.currency)}
              subtle={`${formatAmount(totals.openCents, totals.currency)} open`}
            />
          </div>

          <div className="space-y-3">
            {data.workspaces.length === 0 && (
              <div className="bg-void-light/30 rounded-xl border border-slate-800 px-6 py-12 text-center">
                <p className="font-heading text-sm text-slate-400">
                  No workspaces yet — create one on{" "}
                  <Link href="/admin/workspaces" className="text-neon-cyan underline">
                    /admin/workspaces
                  </Link>
                  .
                </p>
              </div>
            )}
            {data.workspaces.map((w) => (
              <WorkspaceCard key={w.workspaceId ?? "n/a"} a={w} />
            ))}

            {data.orgWide && data.orgWide.portals.total + data.orgWide.calendar.total > 0 && (
              <div>
                <h2 className="font-heading mt-8 mb-2 font-mono text-xs tracking-wider text-slate-500 uppercase">
                  Org-wide (no workspaceId)
                </h2>
                <WorkspaceCard a={data.orgWide} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  subtle,
}: Readonly<{ label: string; value: string; subtle?: string }>) {
  return (
    <div className="bg-void-light/30 rounded-xl border border-slate-800 p-4">
      <p className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="font-heading mt-1 text-2xl font-bold text-white">{value}</p>
      {subtle && <p className="font-mono text-[10px] text-slate-600">{subtle}</p>}
    </div>
  );
}

function WorkspaceCard({ a }: Readonly<{ a: WorkspaceAnalytics }>) {
  const title = a.workspace?.name ?? "Org-wide";
  const slug = a.workspace?.slug;
  const nextScheduled = a.calendar.nextScheduledAt
    ? new Date(a.calendar.nextScheduledAt).toLocaleString("en-IE")
    : "—";
  return (
    <div className="bg-void-light/30 rounded-xl border border-slate-800 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-heading text-lg font-semibold text-white">{title}</h3>
          {slug && (
            <p className="font-mono text-[10px] text-slate-600">
              slug: <span className="text-slate-400">{slug}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge label={`${a.portals.total} portals`} tint="cyan" />
          <Badge label={`${a.deliverables.total} deliverables`} tint="violet" />
          <Badge label={`${a.calendar.total} calendar`} tint="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat
          group="Portals"
          rows={[
            ["Active", a.portals.active],
            ["Expiring ≤14d", a.portals.expiringSoon],
            ["Expired", a.portals.expired],
            ["Avg health", a.portals.averageHealth],
          ]}
        />
        <Stat
          group="Deliverables"
          rows={[
            ["In review", a.deliverables.inReview],
            ["Approved", a.deliverables.approved],
            ["Changes requested", a.deliverables.changesRequested],
            ["Draft", a.deliverables.draft],
          ]}
        />
        <Stat
          group="Revenue"
          rows={[
            ["Paid", formatAmount(a.revenue.paidAmountCents, a.revenue.currency)],
            ["Open", formatAmount(a.revenue.openAmountCents, a.revenue.currency)],
            ["Paid count", a.revenue.paidCount],
            ["Void count", a.revenue.voidCount],
          ]}
        />
        <Stat
          group="Calendar"
          rows={[
            ["Draft", a.calendar.draft],
            ["Scheduled", a.calendar.scheduled],
            ["Published", a.calendar.published],
            ["Next at", nextScheduled],
          ]}
        />
      </div>
    </div>
  );
}

function Badge({ label, tint }: Readonly<{ label: string; tint: "cyan" | "violet" | "emerald" }>) {
  const colors: Record<typeof tint, string> = {
    cyan: "border-cyan-900/40 bg-cyan-950/30 text-cyan-300",
    violet: "border-violet-900/40 bg-violet-950/30 text-violet-300",
    emerald: "border-emerald-900/40 bg-emerald-950/30 text-emerald-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${colors[tint]}`}>
      {label}
    </span>
  );
}

function Stat({
  group,
  rows,
}: Readonly<{ group: string; rows: ReadonlyArray<readonly [string, string | number]> }>) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <p className="mb-2 font-mono text-[10px] tracking-wider text-slate-500 uppercase">{group}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 font-mono text-xs">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
