"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";

interface Deal {
  id: string;
  properties: {
    dealname: string;
    amount: string;
    dealstage: string;
    closedate: string;
    createdate: string;
  };
}

interface Pipeline {
  id: string;
  label: string;
  stages: { id: string; label: string; displayOrder: number }[];
}

const STAGE_COLORS: Record<string, string> = {
  appointmentscheduled: "border-neon-cyan/30 bg-neon-cyan/5",
  qualifiedtobuy: "border-blue-500/30 bg-blue-500/5",
  presentationscheduled: "border-purple-500/30 bg-purple-500/5",
  decisionmakerboughtin: "border-yellow-500/30 bg-yellow-500/5",
  contractsent: "border-orange-500/30 bg-orange-500/5",
  closedwon: "border-neon-green/30 bg-neon-green/5",
  closedlost: "border-red-500/30 bg-red-500/5",
};

const STAGE_LABEL_COLORS: Record<string, string> = {
  closedwon: "text-neon-green",
  closedlost: "text-red-400",
};

export default function PipelinePage() {
  const [dealsByStage, setDealsByStage] = useState<Record<string, Deal[]>>({});
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState<{
    totalDeals: number;
    totalValue: number;
    byStage: Record<string, { count: number; value: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingDeal, setMovingDeal] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [boardRes, statsRes] = await Promise.all([
        fetchWithAuth("/api/admin/pipeline/board"),
        fetchWithAuth("/api/admin/pipeline/stats"),
      ]);
      if (!boardRes.ok) throw new Error("Failed to load board");
      if (!statsRes.ok) throw new Error("Failed to load stats");
      const boardData = await boardRes.json();
      const statsData = await statsRes.json();
      setDealsByStage(boardData.dealsByStage ?? {});
      setPipelines(boardData.pipelines ?? []);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }

  async function moveDeal(dealId: string, stageId: string) {
    setMovingDeal(dealId);
    try {
      const res = await fetchWithAuth(
        `/api/admin/pipeline/deals/${dealId}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId }),
        },
      );
      if (!res.ok) throw new Error("Move failed");
      await load();
    } catch {
      // silent — board will refresh anyway
    } finally {
      setMovingDeal(null);
    }
  }

  const allStages =
    pipelines[0]?.stages?.sort((a, b) => a.displayOrder - b.displayOrder) ?? [];

  const stageIds =
    allStages.length > 0
      ? allStages.map((s) => s.id)
      : Object.keys(dealsByStage);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">PIPELINE</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          Lead Pipeline
        </h1>
        <p className="font-body mt-1 text-slate-400">
          HubSpot deal pipeline kanban board.
        </p>
      </div>

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
            <p className="font-mono text-xs text-slate-500">Total Deals</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white">
              {stats.totalDeals}
            </p>
          </div>
          <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
            <p className="font-mono text-xs text-slate-500">Pipeline Value</p>
            <p className="text-neon-green mt-1 font-mono text-2xl font-bold">
              {stats.totalValue > 0
                ? `€${stats.totalValue.toLocaleString("el-GR", { maximumFractionDigits: 0 })}`
                : "—"}
            </p>
          </div>
          <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
            <p className="font-mono text-xs text-slate-500">Won</p>
            <p className="text-neon-green mt-1 font-mono text-2xl font-bold">
              {stats.byStage["closedwon"]?.count ?? 0}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <div className="border-neon-cyan h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="font-mono text-sm">Loading pipeline...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto pb-4">
          <div
            className="flex gap-4"
            style={{ minWidth: `${stageIds.length * 280}px` }}
          >
            {stageIds.map((stageId) => {
              const stageLabel =
                allStages.find((s) => s.id === stageId)?.label ?? stageId;
              const deals = (dealsByStage[stageId] ?? []) as Deal[];
              const colStyle =
                STAGE_COLORS[stageId] ?? "border-slate-700/30 bg-slate-800/10";
              const labelStyle =
                STAGE_LABEL_COLORS[stageId] ?? "text-slate-300";

              return (
                <div
                  key={stageId}
                  className={`flex w-64 shrink-0 flex-col rounded-xl border p-3 ${colStyle}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-semibold ${labelStyle}`}
                    >
                      {stageLabel}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      {deals.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {deals.length === 0 && (
                      <p className="py-4 text-center font-mono text-[10px] text-slate-700">
                        No deals
                      </p>
                    )}
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        stages={allStages}
                        onMove={moveDeal}
                        moving={movingDeal === deal.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DealCard({
  deal,
  stages,
  onMove,
  moving,
}: {
  deal: Deal;
  stages: { id: string; label: string }[];
  onMove: (dealId: string, stageId: string) => void;
  moving: boolean;
}) {
  const amount = parseFloat(deal.properties.amount || "0");

  return (
    <div className="bg-void-light/80 group rounded-lg border border-slate-700/50 p-3 transition-all hover:border-slate-600">
      <p className="font-mono text-xs font-semibold text-white">
        {deal.properties.dealname || "Untitled Deal"}
      </p>
      {amount > 0 && (
        <p className="text-neon-green mt-1 font-mono text-xs">
          €{amount.toLocaleString("el-GR", { maximumFractionDigits: 0 })}
        </p>
      )}
      {deal.properties.closedate && (
        <p className="mt-1 font-mono text-[10px] text-slate-600">
          Close:{" "}
          {new Date(deal.properties.closedate).toLocaleDateString("en-IE", {
            day: "numeric",
            month: "short",
          })}
        </p>
      )}
      {stages.length > 1 && (
        <div className="mt-2 hidden group-hover:block">
          <select
            disabled={moving}
            defaultValue={deal.properties.dealstage}
            onChange={(e) => onMove(deal.id, e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-300 focus:outline-none"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
