/**
 * Admin funnel audit — Tolstova & Silakova quantitative funnel computed
 * live on cloudless.gr, mirroring cu130-slim
 * `social-automation/backend/scripts/funnel_audit.py`.
 *
 * Stage map (paper stages → live surfaces):
 *   audience     → SocialAuto /analytics/followers (latest per account)
 *   engaged      → SocialAuto /analytics/overview total_engagement (PROXY)
 *   lead         → EspoCRM Lead rows
 *   nurtured     → leads past New/Dead + campaign sends note
 *   opportunity  → EspoCRM Opportunity, active stages only
 *   won          → Opportunity closed-won
 *
 * Paper rules implemented: weakest stage→stage transition is named, and
 * the auction warning fires when reach grew over 30d while lead
 * conversion vs audience is <0.5%.
 *
 * Sources degrade independently: EspoCRM (omv k3s) stays up even when
 * the Windows SocialAuto stack is asleep, and vice versa.
 */

import { getFunnelStageData, isEspoCRMConfigured } from "@/lib/espocrm";
import { isSocialAutoConfigured, saFetch } from "@/lib/socialauto";

export interface FunnelStage {
  stage: string;
  count: number | null;
  proxy?: boolean;
  note?: string;
  conv_pct?: number | null;
}

export interface FunnelAuditReport {
  generated_at: string;
  sources: { espocrm: boolean; socialauto: boolean };
  stages: FunnelStage[];
  weakest_transition: string | null;
  auction_warning: boolean;
  lead_sources: Record<string, number>;
  socialauto_funnel: {
    lead_tiers: Record<string, number>;
    conversions: { campaign: string; count: number; value: number }[];
    total_conversions: number;
    total_value: number;
  } | null;
}

interface SaFollowerSeries {
  platform?: string;
  account?: string;
  current?: number;
  series?: { date: string; followers: number }[];
}

interface SaOverview {
  total_followers?: number;
  total_engagement?: number;
  connected_accounts?: number;
}

interface SaFunnelState {
  leads?: Record<string, number>;
  conversions?: { campaign: string; count: number; value: number }[];
  total_conversions?: number;
  total_value?: number;
}

const WON_STAGES = new Set(["closed won", "won"]);
const CLOSED_STAGES = new Set(["closed won", "closed lost", "won", "lost"]);
const DEAD_LEAD_STATUSES = new Set(["new", "dead"]);

async function saGet<T>(path: string): Promise<T | null> {
  try {
    const res = await saFetch(path, { timeoutMs: 20_000 });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Sum of latest followers across accounts, plus the same sum ~30d ago.
 *  Mirrors funnel_audit._social_reach: per-account series, point nearest
 *  to the 30-day-ago target date (fallback: earliest point in window). */
function reachFromSeries(series: SaFollowerSeries[], daysAgo: number): number {
  const target = new Date(Date.now() - daysAgo * 86_400_000)
    .toISOString()
    .slice(0, 10);
  let total = 0;
  for (const s of series) {
    const pts = s.series ?? [];
    if (pts.length === 0) {
      total += s.current ?? 0;
      continue;
    }
    let best = pts[0];
    let bestDist = Infinity;
    for (const p of pts) {
      const dist = Math.abs(
        new Date(`${p.date}T00:00:00Z`).getTime() -
          new Date(`${target}T00:00:00Z`).getTime(),
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    total += daysAgo === 0 ? (s.current ?? best.followers) : best.followers;
  }
  return total;
}

export async function buildFunnelAudit(): Promise<FunnelAuditReport> {
  const [espoConfigured, saConfigured, stageData] = await Promise.all([
    isEspoCRMConfigured(),
    isSocialAutoConfigured(),
    getFunnelStageData(),
  ]);

  const [followersSeries, overview, funnelState] = saConfigured
    ? await Promise.all([
        saGet<SaFollowerSeries[]>("/analytics/followers?days=60"),
        saGet<SaOverview>("/analytics/overview?days=30"),
        saGet<SaFunnelState>("/funnel/state"),
      ])
    : [null, null, null];

  const sources = {
    espocrm: espoConfigured && stageData.leads !== null,
    socialauto: saConfigured && overview !== null,
  };

  // ── SocialAuto-side stages ──────────────────────────────────────────
  const reach = followersSeries ? reachFromSeries(followersSeries, 0) : null;
  const reach30dAgo = followersSeries
    ? reachFromSeries(followersSeries, 30)
    : null;
  const engaged = overview?.total_engagement ?? null;

  // ── EspoCRM-side stages (funnel_audit.py semantics) ─────────────────
  const leads = stageData.leads;
  const opps = stageData.opportunities;
  const leadsTotal = leads?.length ?? null;
  const dead =
    leads?.filter((l) => (l.status ?? "").toLowerCase() === "dead").length ?? 0;
  const nurtured =
    leads?.filter((l) => {
      const s = (l.status ?? "").toLowerCase();
      return s !== "" && !DEAD_LEAD_STATUSES.has(s);
    }).length ?? null;
  const activeOpps =
    opps?.filter((o) => !CLOSED_STAGES.has((o.stage ?? "").toLowerCase()))
      .length ?? null;
  const won =
    opps?.filter((o) => WON_STAGES.has((o.stage ?? "").toLowerCase())).length ??
    null;

  const leadSources: Record<string, number> = {};
  for (const l of leads ?? []) {
    const src = l.source || "(none)";
    leadSources[src] = (leadSources[src] ?? 0) + 1;
  }

  const stages: FunnelStage[] = [
    {
      stage: "audience",
      count: reach,
      note:
        reach !== null && reach30dAgo !== null
          ? `followers, latest per account (${reach30dAgo.toLocaleString()} ~30d ago)`
          : "followers, latest per account",
    },
    {
      stage: "engaged",
      count: engaged,
      proxy: true,
      note: "engagement actions 30d — activity proxy, not engaged people",
    },
    {
      stage: "lead",
      count: leadsTotal,
      note: `EspoCRM leads (${dead} dead)`,
    },
    { stage: "nurtured", count: nurtured, note: "leads past 'New'/'Dead'" },
    {
      stage: "opportunity",
      count: activeOpps,
      note: "EspoCRM opportunities, active only",
    },
    { stage: "won", count: won, note: "opportunities closed-won" },
  ];

  // stage→stage conversion; proxy stages display conv but are never the
  // diagnosed weak link (same rule as funnel_audit.py)
  let prev: FunnelStage | null = null;
  for (const s of stages) {
    s.conv_pct =
      prev && prev.count && s.count !== null
        ? Math.round((10000 * s.count) / prev.count) / 100
        : null;
    prev = s;
  }
  let weakest: FunnelStage | null = null;
  for (let i = 1; i < stages.length; i++) {
    const s = stages[i];
    if (s.conv_pct === null || s.conv_pct === undefined) continue;
    if (s.proxy || stages[i - 1].proxy) continue;
    if (s.count === null) continue;
    if (!weakest || (s.conv_pct ?? 999) < (weakest.conv_pct ?? 999))
      weakest = s;
  }
  const weakestTransition = weakest
    ? `${stages[stages.indexOf(weakest) - 1].stage}→${weakest.stage} (${weakest.conv_pct}%)`
    : null;

  const reachGrowing =
    reach !== null &&
    reach30dAgo !== null &&
    reach30dAgo > 0 &&
    reach > reach30dAgo;
  const leadConvVsAudience = reach ? ((leadsTotal ?? 0) / reach) * 100 : 0;

  return {
    generated_at: new Date().toISOString(),
    sources,
    stages,
    weakest_transition: weakestTransition,
    auction_warning: Boolean(reachGrowing && leadConvVsAudience < 0.5),
    lead_sources: leadSources,
    socialauto_funnel: funnelState
      ? {
          lead_tiers: funnelState.leads ?? {},
          conversions: funnelState.conversions ?? [],
          total_conversions: funnelState.total_conversions ?? 0,
          total_value: funnelState.total_value ?? 0,
        }
      : null,
  };
}
