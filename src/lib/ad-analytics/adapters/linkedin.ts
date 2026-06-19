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
import type { AdMetrics } from "../types";

const LINKEDIN_API_ROOT = "https://api.linkedin.com/rest";
const LINKEDIN_API_VERSION = "202605";

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
      process.env.LINKEDIN_CAPI_ACCESS_TOKEN || cfg.LINKEDIN_ACCESS_TOKEN || "";
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
   * Phase 2 will fill this in with `/rest/adAnalytics?q=analytics&pivot=…`
   * partitioned per (campaign × time-window) — see Singer.io tap-linkedin-ads
   * referenced in the architecture doc. Phase 1 returns an empty snapshot so
   * the orchestrator can still wire up the registry without runtime errors.
   */
  async pullMetrics(): Promise<AdMetrics[]> {
    return [];
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

    const payload = {
      conversion: `urn:lla:llaPartnerConversion:${conversionId}`,
      conversionHappenedAt: happenedAt.getTime(),
      eventId,
      user: {
        // LinkedIn's `userIds` array is the canonical CAPI match key shape
        // (SHA256_EMAIL, SHA256_PHONE, LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID).
        // Phase 1 only forwards what the thanks-page POST already carries —
        // empty by default; the Phase 2 admin tooling can enrich.
        userIds: buildUserIds(user),
        userInfo: undefined,
      },
      conversionValue: undefined,
      requestMetadata: {
        userAgent: user?.userAgent,
        pageUrl,
      },
    };

    try {
      const res = await fetch(`${LINKEDIN_API_ROOT}/conversionEvents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.token}`,
          "LinkedIn-Version": LINKEDIN_API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
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
