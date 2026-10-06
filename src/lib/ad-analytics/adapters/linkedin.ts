/**
 * LinkedIn concrete adapter for the reusable ad-analytics module.
 *
 * Implements `AdPlatformAdapter`. Wraps the existing low-level client at
 * `src/lib/campaigns/linkedin.ts` (which other admin pages still use) without
 * touching it, so this Phase 1 PR is non-breaking.
 *
 * Operating principles enforced here:
 *  - `LinkedIn-Version: 202605` (the legacy `campaigns/linkedin.ts` client
 *    now pins `202608` — versions expire ~12 months after release). The
 *    version is a hard-coded constant so a future bump
 *    is one line.
 *  - `pushConversion()` returns `{ accepted, status }` instead of throwing on
 *    403, so the runtime can degrade cleanly when the operator hasn't yet
 *    created a `CONVERSIONS_API`-typed conversion in Campaign Manager.
 *  - `pullMetrics()` uses the same Rest.li `List(urn%3Ali%3A…)` +
 *    `dateRange=(start:(…),end:(…))` shape as `scripts/etl/linkedin-ads-to-r2.mjs`
 *    (bracket form `campaigns[0]=` returns empty / non-OK under Rest.li 2.0).
 *
 * Reference: skills/ad-analytics/SKILL.md operating principle #2
 * (the Gilgamesh source-bound CAPI gotcha) + #3 (the version pin).
 */

import { getConfig } from "@/lib/ssm-config";
import type { AdPlatformAdapter, UserMatch } from "./ad-platform";
import type { AdMetrics, DemographicBreakdown, DemographicPivot } from "../types";
import { resolvePivotLabel } from "../lookups";

const LINKEDIN_API_ROOT = "https://api.linkedin.com/rest";
const LINKEDIN_API_VERSION = "202605";
const LINKEDIN_VERSION_HEADER = "LinkedIn-Version";
const RESTLI_PROTOCOL_HEADER = "X-Restli-Protocol-Version";
const RESTLI_PROTOCOL_VERSION = "2.0.0";

interface ResolvedConfig {
  token: string;
  /** Required for any `/adAnalytics` poll — Phase 2. */
  defaultAccountId?: string;
}

async function resolveConfig(): Promise<ResolvedConfig | null> {
  try {
    const cfg = await getConfig();
    // CAPI gets its own env var (`LINKEDIN_CAPI_ACCESS_TOKEN`) so the
    // operator can rotate the CAPI-scoped token without touching the
    // marketing-API token in SSM. Falls back to the shared
    // `LINKEDIN_ACCESS_TOKEN` (already in AppConfig) when the dedicated
    // CAPI var isn't set — the legacy route did the same thing.
    const token =
      process.env.LINKEDIN_CAPI_ACCESS_TOKEN ||
      cfg.LINKEDIN_CAPI_ACCESS_TOKEN ||
      cfg.LINKEDIN_ACCESS_TOKEN ||
      "";
    if (!token) return null;
    return {
      token,
      defaultAccountId: cfg.LINKEDIN_AD_ACCOUNT_ID || undefined,
    };
  } catch {
    return null;
  }
}

export const linkedinAdapter: AdPlatformAdapter = {
  id: "linkedin",

  async isConfigured(): Promise<boolean> {
    return (await resolveConfig()) !== null;
  },

  /**
   * Pull headline metrics + optional demographic pivots from
   * `/rest/adAnalytics?q=analytics`. Partitioned per `campaignId` because
   * LinkedIn AdAnalytics has no pagination (Singer.io tap pattern).
   *
   * One headline request + one request per pivot. Privacy-suppressed
   * pivots return an empty `demographics` entry — that's expected on
   * low-volume campaigns until ~100 clicks accumulate.
   */
  async pullMetrics({
    accountId,
    campaignIds,
    since,
    until,
    pivots = [],
  }: {
    accountId: string;
    campaignIds: string[];
    since: Date;
    until: Date;
    pivots?: DemographicPivot[];
  }): Promise<AdMetrics[]> {
    const cfg = await resolveConfig();
    if (!cfg) return [];
    if (campaignIds.length === 0) return [];

    const windowStart = since.toISOString();
    const windowEnd = until.toISOString();
    const dateRangeParam = formatDateRange(since, until);

    const results: AdMetrics[] = [];
    for (const campaignId of campaignIds) {
      // 1. Headline metrics (impressions / clicks / cost / conversions).
      // A failed fetch degrades to zeros here — pullMetrics feeds anomaly
      // detection and digests, which prefer a zeroed row to a dropped one.
      const headline = (await fetchHeadlineMetrics(
        cfg.token,
        accountId,
        campaignId,
        dateRangeParam
      )) ?? {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spendEur: 0,
      };
      const base: AdMetrics = {
        platform: "linkedin",
        campaignId,
        windowStart,
        windowEnd,
        impressions: headline.impressions,
        clicks: headline.clicks,
        conversions: headline.conversions,
        spendEur: headline.spendEur,
        ctr:
          headline.clicks && headline.impressions
            ? headline.clicks / headline.impressions
            : undefined,
        cpcEur: headline.clicks ? headline.spendEur / headline.clicks : undefined,
        cpaEur: headline.conversions ? headline.spendEur / headline.conversions : undefined,
      };

      // 2. Demographic enrichment, one fetch per pivot. Errors degrade
      //    silently — the headline still renders.
      if (pivots.length > 0) {
        const demographics: Partial<Record<DemographicPivot, DemographicBreakdown>> = {};
        await Promise.all(
          pivots.map(async (pivot) => {
            const breakdown = await fetchPivotBreakdown(
              cfg.token,
              accountId,
              campaignId,
              dateRangeParam,
              pivot
            );
            if (breakdown.length > 0) {
              demographics[pivot] = breakdown;
            }
          })
        );
        if (Object.keys(demographics).length > 0) {
          base.demographics = demographics;
        }
      }

      // 3. Creative leaderboard (pivot=CREATIVE) — which variant pulls the
      //    clicks. Same silent-degrade contract as the pivots.
      const leaderboard = await fetchCreativeLeaderboard(cfg.token, campaignId, dateRangeParam);
      if (leaderboard.length > 0) {
        base.creativeLeaderboard = leaderboard;
      }

      results.push(base);
    }
    return results;
  },

  /**
   * Account-wide lifetime spend for promo-credit pacing. Enumerates every
   * campaign in the ad account (a paused/completed sibling still drained
   * the shared credit) and sums `costInLocalCurrency` over the caller's
   * `since` window — the same `pacing.adsStartAt` window the digest divides
   * by when computing pace, so numerator and denominator stay paired.
   * `null` on any API failure (never throws) so the runtime falls back to
   * the configured-campaign sum.
   */
  async pullAccountSpendEur({
    accountId,
    since,
    until,
  }: {
    accountId: string;
    since: string;
    until: Date;
  }): Promise<number | null> {
    const cfg = await resolveConfig();
    if (!cfg) return null;

    const acct = String(accountId).replace(/[^\w-]/g, "");
    let elements: Array<{ id?: number | string }> = [];
    try {
      const list = await fetch(
        `${LINKEDIN_API_ROOT}/adAccounts/${acct}/adCampaigns` +
          "?q=search&search=(status:(values:List(ACTIVE,PAUSED,DRAFT,COMPLETED,CANCELED)))&count=500",
        {
          headers: {
            Authorization: `Bearer ${cfg.token}`,
            [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
            [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
          },
        }
      );
      if (!list.ok) {
        console.warn(`[ad-analytics/linkedin] adCampaigns list ${list.status} acct=${acct}`);
        return null;
      }
      elements =
        ((await list.json()) as { elements?: Array<{ id?: number | string }> }).elements ?? [];
    } catch (err) {
      // A network/JSON error here must not throw past the fallback — the
      // runtime's outer catch would skip pacing entirely instead of
      // degrading to the configured-campaign sum.
      console.warn(
        `[ad-analytics/linkedin] adCampaigns list failed acct=${acct}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
    if (elements.length === 0) return 0;

    const dateRangeParam = formatDateRange(new Date(since), until);

    let total = 0;
    for (const el of elements) {
      if (el.id === undefined || el.id === null) continue;
      const h = await fetchHeadlineMetrics(cfg.token, accountId, String(el.id), dateRangeParam);
      // A failed per-campaign read must not masquerade as €0 — returning the
      // partial/zero sum would let the digest claim "credit intact" on data
      // we never got. Bubble up so the runtime falls back.
      if (!h) return null;
      total += h.spendEur;
    }
    return Math.round(total * 100) / 100;
  },

  async pushConversion({
    accountId: _accountId,
    conversionId,
    eventId,
    happenedAt,
    user,
    pageUrl: _pageUrl,
  }: {
    accountId: string;
    conversionId: number;
    eventId: string;
    happenedAt: Date;
    user?: UserMatch;
    pageUrl?: string;
  }): Promise<{ accepted: boolean; status: number; message?: string }> {
    const cfg = await resolveConfig();
    if (!cfg) {
      // Treat "no token" the same as the existing /api/campaigns/conversion
      // route does: 204-equivalent, the browser Insight Tag already counted
      // the conversion.
      return { accepted: false, status: 204, message: "LinkedIn CAPI not configured" };
    }

    const userIds = buildUserIds(user);
    const payload: Record<string, unknown> = {
      conversion: `urn:lla:llaPartnerConversion:${conversionId}`,
      conversionHappenedAt: happenedAt.getTime(),
      eventId,
      user: { userIds, userInfo: { firstName: "", lastName: "" } },
    };

    try {
      const res = await fetch(`${LINKEDIN_API_ROOT}/conversionEvents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.token}`,
          [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
          [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return { accepted: true, status: res.status };
      }

      // Pull the upstream message, but cap + sanitize so it can't leak the
      // CAPI access token through logs/responses.
      const rawText = await res.text().catch(() => "");
      const msg = rawText
        .slice(0, 200)
        .replace(/[\x00-\x1f\x7f]/g, " ")
        .trim();

      // 403 is the load-bearing one: the conversion ID is browser-only
      // (`EVENT_SPECIFIC_TAG`). The operator needs to create a
      // `CONVERSIONS_API`-typed conversion in Campaign Manager UI and set
      // `capiConversionId` in `src/data/campaigns.ts`. Log it once so the
      // signal is preserved but don't escalate.
      if (res.status === 403) {
        console.warn(
          `[ad-analytics/linkedin] CAPI 403 for conversion ${conversionId} — source-bound; need CONVERSIONS_API-typed conversion`
        );
      } else {
        console.error(`[ad-analytics/linkedin] CAPI error ${res.status}: ${msg}`);
      }

      return { accepted: false, status: res.status, message: msg };
    } catch (err) {
      const message = ((err as Error)?.message ?? "unknown error")
        .slice(0, 200)
        .replace(/[\x00-\x1f\x7f]/g, " ");
      console.error(`[ad-analytics/linkedin] CAPI fetch failed: ${message}`);
      return { accepted: false, status: 0, message };
    }
  },
};

/**
 * Convert the runtime's `UserMatch` shape into LinkedIn's `userIds` array.
 * Empty array is valid — LinkedIn accepts unmatched events and uses
 * `eventId` for dedupe against the browser Insight Tag hit.
 */
function buildUserIds(user?: UserMatch): Array<{ idType: string; idValue: string }> {
  if (!user) return [];
  const ids: Array<{ idType: string; idValue: string }> = [];
  if (user.emailSha256) ids.push({ idType: "SHA256_EMAIL", idValue: user.emailSha256 });
  if (user.phoneSha256) ids.push({ idType: "SHA256_PHONE", idValue: user.phoneSha256 });
  if (user.liFatId)
    ids.push({ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: user.liFatId });
  if (user.ipAddress) ids.push({ idType: "PLAINTEXT_IP_ADDRESS", idValue: user.ipAddress });
  return ids;
}

// ---------------------------------------------------------------------------
// LinkedIn AdAnalytics helpers (Phase 2)
// ---------------------------------------------------------------------------

interface HeadlineMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spendEur: number;
}

/** Rest.li dateRange tuple — must match `scripts/etl/linkedin-ads-to-r2.mjs`. */
function formatDateRange(since: Date, until: Date): string {
  const s = ymd(since);
  const u = ymd(until);
  return `dateRange=(start:(year:${s.year},month:${s.month},day:${s.day}),end:(year:${u.year},month:${u.month},day:${u.day}))`;
}

function ymd(d: Date): { day: number; month: number; year: number } {
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

/** Rest.li List() of a sponsoredCampaign URN (colons percent-encoded). */
function campaignListParam(campaignId: string): string {
  const id = String(campaignId).replace(/[^\w-]/g, "");
  return `campaigns=List(urn%3Ali%3AsponsoredCampaign%3A${id})`;
}

function buildAdAnalyticsPath(opts: {
  pivot: string;
  dateRangeParam: string;
  campaignId: string;
  fields: string;
  timeGranularity: "ALL" | "DAILY";
}): string {
  return (
    `/adAnalytics?q=analytics&pivot=${opts.pivot}` +
    `&timeGranularity=${opts.timeGranularity}` +
    `&${campaignListParam(opts.campaignId)}` +
    `&${opts.dateRangeParam}` +
    `&fields=${opts.fields}`
  );
}

async function fetchHeadlineMetrics(
  token: string,
  _accountId: string,
  campaignId: string,
  dateRangeParam: string
): Promise<HeadlineMetrics | null> {
  const empty: HeadlineMetrics = { impressions: 0, clicks: 0, conversions: 0, spendEur: 0 };
  try {
    const path = buildAdAnalyticsPath({
      pivot: "CAMPAIGN",
      dateRangeParam,
      campaignId,
      timeGranularity: "ALL",
      fields: "impressions,clicks,costInLocalCurrency,externalWebsiteConversions",
    });
    const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
        [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
      },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.warn(
        `[ad-analytics/linkedin] adAnalytics ${res.status} campaign=${campaignId}: ${body}`
      );
      return null;
    }
    const data = (await res.json()) as {
      elements?: Array<{
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: string | number;
        externalWebsiteConversions?: number;
      }>;
    };
    const els = data.elements ?? [];
    return els.reduce<HeadlineMetrics>(
      (acc, el) => ({
        impressions: acc.impressions + (el.impressions ?? 0),
        clicks: acc.clicks + (el.clicks ?? 0),
        conversions: acc.conversions + (el.externalWebsiteConversions ?? 0),
        spendEur: acc.spendEur + Number(el.costInLocalCurrency ?? 0),
      }),
      empty
    );
  } catch (err) {
    console.warn(
      `[ad-analytics/linkedin] adAnalytics fetch failed campaign=${campaignId}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function fetchPivotBreakdown(
  token: string,
  _accountId: string,
  campaignId: string,
  dateRangeParam: string,
  pivot: DemographicPivot
): Promise<DemographicBreakdown> {
  try {
    const path = buildAdAnalyticsPath({
      pivot,
      dateRangeParam,
      campaignId,
      timeGranularity: "ALL",
      fields: "clicks,pivotValues",
    });
    const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
        [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
      },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.warn(
        `[ad-analytics/linkedin] pivot ${pivot} ${res.status} campaign=${campaignId}: ${body}`
      );
      return [];
    }
    const data = (await res.json()) as {
      elements?: Array<{ clicks?: number; pivotValues?: string[] }>;
    };
    const rows = (data.elements ?? [])
      .map((row) => ({
        // `pivotValues` is an array of URNs (one per pivot dimension). The
        // static lookup table in `../lookups.ts` resolves industries,
        // seniorities, and company sizes to human labels. Unknown ids fall
        // back to `Industry #6` shape so the digest still shows actionable
        // signal even when LinkedIn returns an id outside our table.
        label: resolvePivotLabel(pivot, row.pivotValues?.[0] ?? "unknown"),
        clicks: row.clicks ?? 0,
      }))
      .filter((r) => r.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks);
    return rows.slice(0, 6); // top-6 buckets keeps the digest readable
  } catch {
    return [];
  }
}

/**
 * pivot=CREATIVE — per-creative impressions/clicks for the window, ranked
 * by clicks. Names resolved via `GET /rest/creatives?ids=List(...)`. Both
 * steps degrade silently: a failed name lookup still shows `Creative <id>`.
 */
async function fetchCreativeLeaderboard(
  token: string,
  campaignId: string,
  dateRangeParam: string
): Promise<NonNullable<AdMetrics["creativeLeaderboard"]>> {
  try {
    const path = buildAdAnalyticsPath({
      pivot: "CREATIVE",
      dateRangeParam,
      campaignId,
      timeGranularity: "ALL",
      fields: "impressions,clicks,pivotValues",
    });
    const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
        [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
      },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.warn(
        `[ad-analytics/linkedin] pivot CREATIVE ${res.status} campaign=${campaignId}: ${body}`
      );
      return [];
    }
    const data = (await res.json()) as {
      elements?: Array<{
        impressions?: number;
        clicks?: number;
        pivotValues?: string[];
      }>;
    };
    const els = data.elements ?? [];
    if (els.length === 0) return [];

    const names = await fetchCreativeNames(
      token,
      els.flatMap((el) => el.pivotValues ?? [])
    );

    return els
      .map((el) => {
        const urn = el.pivotValues?.[0] ?? "";
        const id = urn.includes(":") ? urn.slice(urn.lastIndexOf(":") + 1) : urn;
        const impressions = el.impressions ?? 0;
        const clicks = el.clicks ?? 0;
        return {
          creativeId: id,
          label: names.get(urn) ?? `Creative ${id}`,
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : undefined,
        };
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
  } catch (err) {
    console.warn(
      `[ad-analytics/linkedin] creative leaderboard failed campaign=${campaignId}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/** Batch-resolve `urn:li:sponsoredCreative:<id>` → advertiser-set `name`. */
async function fetchCreativeNames(token: string, urns: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (urns.length === 0) return names;
  try {
    const res = await fetch(
      `${LINKEDIN_API_ROOT}/creatives?ids=List(${urns
        .map((u) => encodeURIComponent(u))
        .join(",")})`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
          [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
        },
      }
    );
    if (!res.ok) return names;
    const data = (await res.json()) as {
      results?: Record<string, { name?: string }>;
      elements?: Array<{ id?: string; name?: string }>;
    };
    // BATCH_GET returns `results` keyed by URN; FINDER-style returns
    // `elements` — support both shapes.
    if (data.results) {
      for (const [urn, creative] of Object.entries(data.results)) {
        if (creative?.name) names.set(urn, creative.name);
      }
    }
    for (const el of data.elements ?? []) {
      if (el?.id && el?.name) names.set(el.id, el.name);
    }
  } catch {
    // name resolution is cosmetic — fall back to `Creative <id>`
  }
  return names;
}
