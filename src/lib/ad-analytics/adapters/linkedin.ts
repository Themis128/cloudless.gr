/**
 * LinkedIn concrete adapter for the reusable ad-analytics module.
 *
 * Implements `AdPlatformAdapter`. Wraps the existing low-level client at
 * `src/lib/campaigns/linkedin.ts` (which other admin pages still use) without
 * touching it, so this Phase 1 PR is non-breaking.
 *
 * Operating principles enforced here:
 *  - `LinkedIn-Version: 202605` (the legacy client pins `202401` which is
 *    16 months stale). The version is a hard-coded constant so a future bump
 *    is one line.
 *  - `pushConversion()` returns `{ accepted, status }` instead of throwing on
 *    403, so the runtime can degrade cleanly when the operator hasn't yet
 *    created a `CONVERSIONS_API`-typed conversion in Campaign Manager.
 *  - `pullMetrics()` is a Phase-2 stub. Phase 1 only exercises the conversion
 *    path; the digest poll lands in a later PR.
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
      const headline = await fetchHeadlineMetrics(cfg.token, accountId, campaignId, dateRangeParam);
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

      results.push(base);
    }
    return results;
  },

  async pushConversion({
    accountId: _accountId,
    conversionId,
    eventId,
    happenedAt,
    user,
    pageUrl,
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

/** LinkedIn wants the date-range params spread across `start.day/month/year`
 *  and `end.day/month/year` — encode here once so both fetch paths reuse it. */
function formatDateRange(since: Date, until: Date): string {
  const s = ymd(since);
  const u = ymd(until);
  return (
    `dateRange.start.day=${s.day}` +
    `&dateRange.start.month=${s.month}` +
    `&dateRange.start.year=${s.year}` +
    `&dateRange.end.day=${u.day}` +
    `&dateRange.end.month=${u.month}` +
    `&dateRange.end.year=${u.year}`
  );
}

function ymd(d: Date): { day: number; month: number; year: number } {
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

async function fetchHeadlineMetrics(
  token: string,
  accountId: string,
  campaignId: string,
  dateRangeParam: string
): Promise<HeadlineMetrics> {
  const empty: HeadlineMetrics = { impressions: 0, clicks: 0, conversions: 0, spendEur: 0 };
  try {
    const path =
      `/adAnalytics?q=analytics&pivot=CAMPAIGN&${dateRangeParam}` +
      `&campaigns[0]=urn:li:sponsoredCampaign:${encodeURIComponent(campaignId)}` +
      `&accounts[0]=urn:li:sponsoredAccount:${encodeURIComponent(accountId)}` +
      `&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions`;
    const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
        [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
      },
    });
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      elements?: Array<{
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: string | number;
        externalWebsiteConversions?: number;
      }>;
    };
    const el = data.elements?.[0] ?? {};
    return {
      impressions: el.impressions ?? 0,
      clicks: el.clicks ?? 0,
      conversions: el.externalWebsiteConversions ?? 0,
      spendEur: Number(el.costInLocalCurrency ?? 0),
    };
  } catch {
    return empty;
  }
}

async function fetchPivotBreakdown(
  token: string,
  accountId: string,
  campaignId: string,
  dateRangeParam: string,
  pivot: DemographicPivot
): Promise<DemographicBreakdown> {
  try {
    const path =
      `/adAnalytics?q=analytics&pivot=${pivot}&${dateRangeParam}` +
      `&campaigns[0]=urn:li:sponsoredCampaign:${encodeURIComponent(campaignId)}` +
      `&accounts[0]=urn:li:sponsoredAccount:${encodeURIComponent(accountId)}` +
      `&fields=clicks,pivotValues`;
    const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        [LINKEDIN_VERSION_HEADER]: LINKEDIN_API_VERSION,
        [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
      },
    });
    if (!res.ok) return [];
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
