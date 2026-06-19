/**
 * Shared types for the reusable ad-analytics module.
 *
 * All identifiers live here so adapter implementations, channel
 * implementations, the runtime orchestrator, the conversion route, the
 * scheduled poll, and the slash-command handler all import from one place.
 *
 * Adding a new ad platform = add to `AdPlatformId`, implement an
 * `AdPlatformAdapter`, register in `runtime.ts`.
 * Adding a new notification channel = add to `NotificationChannelId`,
 * implement a `NotificationChannel`, register in `runtime.ts`.
 *
 * See `docs/ad-analytics-architecture.md` and `skills/ad-analytics/SKILL.md`.
 */

/** Per-platform identifiers used in `src/data/campaigns.ts` and
 *  registered adapter lookups. */
export type AdPlatformId = "linkedin" | "meta" | "google-ads" | "tiktok" | "x";

/** Per-channel identifiers for outbound notifications. */
export type NotificationChannelId = "slack" | "email" | "discord";

/** What kind of notification this channel config wants to receive.
 *  - `event` — one Slack message per real-time conversion event.
 *  - `digest` — every-15-min metric digest with deltas.
 *  - `anomaly` — DM operator when an anomaly rule fires. */
export type NotificationLevel = "event" | "digest" | "anomaly";

/** One ad platform's wiring on one campaign. Two conversion IDs per
 *  Gilgamesh's source-bound finding: browser-only Insight Tag conversion +
 *  server-only CAPI conversion. Same eventId on both so LinkedIn dedupes
 *  account-scoped. */
export interface CampaignPlatformConfig {
  platform: AdPlatformId;
  /** Platform-native account identifier (LinkedIn `urn:li:sponsoredAccount:N`
   *  in short form, Meta ad-account ID, Google customer ID, etc.). */
  accountId: string;
  /** Platform-native campaign IDs to poll. */
  campaignIds: string[];
  /** Browser-fired conversion (Insight Tag / Pixel). null = browser-side
   *  not wired yet. */
  insightTagConversionId: number | null;
  /** Server-fired CAPI conversion. null = CAPI not wired yet. */
  capiConversionId: number | null;
}

/** One notification target on one campaign. */
export interface NotifyChannelConfig {
  channel: NotificationChannelId;
  /** Channel-specific target — `#ads-realtime` for Slack channels, a user
   *  ID like `U12345` for DMs, an email address for the email channel. */
  target: string;
  level: NotificationLevel;
}

/** Per-campaign tunable thresholds for anomaly DMs. All values are optional;
 *  unset = no anomaly check for that dimension. */
export interface AnomalyRules {
  /** Today's spend pace > N × yesterday's spend pace at same hour → DM. */
  spendPaceMultiplier?: number;
  /** CPC above this absolute value → DM. */
  maxCpcEur?: number;
  /** No conversions in N hours while spend > 0 → DM. */
  zeroConversionsHours?: number;
  /** CTR below this fraction (e.g. 0.005 = 0.5%) → DM. */
  minCtr?: number;
}

/**
 * A real-time conversion event arriving at `/api/ad-analytics/conversion`
 * from a browser thanks-page fire. Becomes a Slack ping per matching
 * `notifyChannels[].level === "event"`.
 */
export interface AdConversionEvent {
  campaign: string;
  tier: string | null;
  orderId: string | null;
  /** Numeric LinkedIn conversion ID (the browser one, from
   *  `CampaignPlatformConfig.insightTagConversionId`). */
  conversionId: number | null;
  /** Locale at the time of fire — useful in the Slack render. */
  locale?: string;
  /** Page URL the visitor was on. */
  url?: string;
  userAgent?: string;
  /** Cloudflare-derived country code, if available. */
  country?: string;
  /** Captured first-touch UTM if `AttributionCapture` set them. */
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

/** Snapshot of per-platform metrics for a campaign over a window. */
export interface AdMetrics {
  platform: AdPlatformId;
  campaignId: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  impressions: number;
  clicks: number;
  conversions: number;
  spendEur: number;
  /** Derived where the platform doesn't already expose them. */
  ctr?: number;
  cpcEur?: number;
  cpaEur?: number;
  /** Optional demographic breakdowns of clickers for this window — used by
   *  the digest's "ICP signal" block (Notion architecture §9). One entry
   *  per enabled pivot. Empty when the enrichment fetch returned no data
   *  (privacy threshold / suppressed / not requested). */
  demographics?: Partial<Record<DemographicPivot, DemographicBreakdown>>;
}

/** The four pivots the digest surfaces today. The string values are the
 *  same `pivot=` query-param the LinkedIn `adAnalytics` endpoint accepts, so
 *  the adapter can pass them through verbatim. */
export type DemographicPivot =
  | "MEMBER_INDUSTRY"
  | "MEMBER_SENIORITY"
  | "MEMBER_JOB_TITLE"
  | "MEMBER_COMPANY_SIZE";

/** Bucket-label → click-count map for one pivot. Label is whatever the
 *  platform returned (resolved against LinkedIn's lookups when available,
 *  raw URN otherwise). */
export type DemographicBreakdown = Array<{ label: string; clicks: number }>;

/** Delta of `current` vs the previous `bookmark` snapshot. */
export interface AdMetricsDelta {
  current: AdMetrics;
  previous: AdMetrics | null;
  delta: {
    impressions: number;
    clicks: number;
    conversions: number;
    spendEur: number;
  };
}

/** DynamoDB-backed bookmark for one (campaign, platform, metric, window)
 *  tuple. Holds the last snapshot we posted and the timestamp we posted
 *  it. Re-posting a digest is idempotent over the same window. */
export interface Bookmark {
  key: string; // ad-analytics:<campaign>:<platform>:<metric>:<window>
  lastPostedAt: string; // ISO
  snapshot: AdMetrics;
}

/** Convenience: the matching `CampaignPlatformConfig` from
 *  `src/data/campaigns.ts` for a given event/digest. */
export interface ResolvedPlatform {
  campaignSlug: string;
  config: CampaignPlatformConfig;
}
