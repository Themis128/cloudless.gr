/**
 * Shared LinkedIn API constants + helpers.
 *
 * `LinkedIn-Version` pins live here so the lead-sync, ads, and ad-analytics
 * surfaces bump in one place. Versions expire ~12 months after release —
 * keep them current (see skills/ad-analytics operating principle #3).
 *
 * The lead-sync surface deliberately pins an older version than ads:
 * `/leadFormResponses` + `/leadForms` are validated against 202605 in
 * `src/lib/linkedin-leadgen.ts` and `scripts/register-linkedin-leadgen-webhook.mjs`.
 */

/** Lead Gen Forms / Lead Sync webhook fetches. */
export const LINKEDIN_LEADGEN_API_VERSION = "202605";

/** Campaign Manager ads surface (`src/lib/campaigns/linkedin.ts`). */
export const LINKEDIN_ADS_API_VERSION = "202608";

/** Ad Analytics / CAPI surface (`src/lib/ad-analytics/adapters/linkedin.ts`).
 *  Pinned older than ADS on purpose — see the adapter header comment. */
export const LINKEDIN_AD_ANALYTICS_API_VERSION = "202605";

/**
 * Normalize an ad-account identifier to the bare numeric id LinkedIn paths
 * expect (`/adAccounts/{id}/…`). Accepts a bare id or a full
 * `urn:li:sponsoredAccount:<id>` — anything else is stripped to path-safe
 * characters so a malformed config fails loudly upstream, not in the URL.
 */
export function normalizeLinkedInAdAccountId(id: string): string {
  const trimmed = id.trim();
  const urnId = trimmed.match(/(?:sponsoredAccount:|%3A)(\d+)$/i)?.[1];
  // Strip anything that isn't path-safe — the result lands in a URL segment.
  return (urnId ?? trimmed).replace(/[^\w-]/g, "");
}
