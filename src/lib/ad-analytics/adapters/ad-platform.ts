/**
 * AdPlatformAdapter — the per-platform contract for pulling metrics and
 * pushing server-side conversion events.
 *
 * Adding a new ad platform (Meta, Google Ads, TikTok, X) = implementing
 * this interface and registering it in `runtime.ts`. The orchestrator never
 * imports a concrete adapter directly.
 *
 * The first concrete implementation is `./linkedin.ts` which wraps the
 * existing `src/lib/campaigns/linkedin.ts` client (with `LinkedIn-Version`
 * bumped to `202605`).
 */

import type { AdMetrics, AdPlatformId, DemographicPivot } from "../types";

/** Minimal user identifiers a CAPI push can use to match the event.
 *  LinkedIn supports hashed email, hashed phone, LiFatId, and a few others.
 *  Adapters that don't need user matching can ignore this. */
export interface UserMatch {
  emailSha256?: string;
  phoneSha256?: string;
  /** LinkedIn first-party click identifier captured from the
   *  `?li_fat_id=…` query param on the landing page. */
  liFatId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdPlatformAdapter {
  readonly id: AdPlatformId;

  /** Returns true when SSM/env credentials are present and recently valid.
   *  Mirrors the existing `isConfigured()` 503 pattern documented under
   *  📣 Campaign Management. */
  isConfigured(): Promise<boolean>;

  /**
   * Pull per-campaign metrics for the requested window. Adapters that
   * lack pagination (LinkedIn AdAnalytics) partition internally by
   * campaign × time-window so callers never have to. Implementations MUST
   * return one `AdMetrics` per `campaignIds[i]`, in the same order.
   *
   * When `pivots` is non-empty the adapter makes N+1 calls — one for
   * headline metrics plus one per pivot — and merges the breakdowns into
   * `AdMetrics.demographics`. Pivots the platform doesn't recognise are
   * silently skipped.
   */
  pullMetrics(opts: {
    accountId: string;
    campaignIds: string[];
    since: Date;
    until: Date;
    pivots?: DemographicPivot[];
  }): Promise<AdMetrics[]>;

  /**
   * Server-side conversion push (CAPI). For LinkedIn this requires that
   * the `conversionId` was created in Campaign Manager with
   * `conversionMethod = CONVERSIONS_API` — see the Gilgamesh source-bound
   * note in the skill. The adapter returns `{ accepted: false, status }`
   * on 403 instead of throwing so the runtime can degrade cleanly.
   */
  pushConversion(opts: {
    accountId: string;
    conversionId: number;
    eventId: string;
    happenedAt: Date;
    user?: UserMatch;
    pageUrl?: string;
  }): Promise<{ accepted: boolean; status: number; message?: string }>;
}
