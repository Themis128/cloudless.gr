/**
 * Orchestrator for the reusable ad-analytics module.
 *
 * Phase 1 surface:
 *  - `dispatchConversion(event)` — called from `/api/campaigns/conversion`
 *    (or, in a future PR, `/api/ad-analytics/conversion`). Looks up the
 *    matching campaign in `src/data/campaigns.ts`, fans the event out to:
 *      • Every configured ad platform's `pushConversion()` (CAPI mirror)
 *        — but ONLY when that platform's `capiConversionId` is set, so the
 *        runtime degrades cleanly while the operator wires up Campaign
 *        Manager.
 *      • Every `notifyChannels[].level === "event"` notification target,
 *        rendered as Block Kit / `NotificationBlock`.
 *
 * The orchestrator never imports a concrete adapter or channel directly.
 * Adding a new ad platform = implement `AdPlatformAdapter`, register in
 * `ADAPTERS`. Adding a new notification surface = implement
 * `NotificationChannel`, register in `CHANNELS`.
 *
 * See `skills/ad-analytics/SKILL.md` for the operating playbook and the
 * Notion architecture page for the design rationale.
 */

import { getCampaign, campaigns as allCampaigns } from "@/data/campaigns";
import type {
  AdConversionEvent,
  AdMetrics,
  CampaignPlatformConfig,
  DemographicPivot,
  NotifyChannelConfig,
} from "./types";
import type { AdPlatformAdapter } from "./adapters/ad-platform";
import type { NotificationChannel } from "./channels/notification";
import { linkedinAdapter } from "./adapters/linkedin";
import { slackChannel } from "./channels/slack";
import { renderConversionBlocks, renderDigest, renderAnomalyBlocks } from "./digest";
import { bookmarkKeyOf, getBookmarkStore } from "./bookmarks";
import { evaluateAnomalies, findingDedupKey, type AnomalyFinding } from "./anomaly";

/**
 * Registry of concrete adapters. Keep this map literal — `as const` enforces
 * compile-time exhaustiveness when `AdPlatformId` grows.
 */
const ADAPTERS: Partial<Record<AdPlatformAdapter["id"], AdPlatformAdapter>> = {
  linkedin: linkedinAdapter,
};

const CHANNELS: Partial<Record<NotificationChannel["id"], NotificationChannel>> = {
  slack: slackChannel,
};

/** Test hook — swap the registries. */
export function _setRegistries(opts: {
  adapters?: Partial<Record<AdPlatformAdapter["id"], AdPlatformAdapter>>;
  channels?: Partial<Record<NotificationChannel["id"], NotificationChannel>>;
}): () => void {
  const prevAdapters = { ...ADAPTERS };
  const prevChannels = { ...CHANNELS };
  if (opts.adapters) {
    for (const k of Object.keys(ADAPTERS) as AdPlatformAdapter["id"][]) delete ADAPTERS[k];
    Object.assign(ADAPTERS, opts.adapters);
  }
  if (opts.channels) {
    for (const k of Object.keys(CHANNELS) as NotificationChannel["id"][]) delete CHANNELS[k];
    Object.assign(CHANNELS, opts.channels);
  }
  return () => {
    for (const k of Object.keys(ADAPTERS) as AdPlatformAdapter["id"][]) delete ADAPTERS[k];
    Object.assign(ADAPTERS, prevAdapters);
    for (const k of Object.keys(CHANNELS) as NotificationChannel["id"][]) delete CHANNELS[k];
    Object.assign(CHANNELS, prevChannels);
  };
}

export interface DispatchOutcome {
  /** Per-platform CAPI push results. Empty when no `capiConversionId` set. */
  capi: Array<{ platform: string; accepted: boolean; status: number; message?: string }>;
  /** Per-channel notification fan-out results. */
  notifications: Array<{ channel: string; target: string; messageId?: string; ok: boolean }>;
  /** True when the runtime had nothing to do — useful for the route's 204 path. */
  noop: boolean;
}

/**
 * Resolve the per-platform configs that should receive a server-side
 * conversion push. Two filtering rules:
 *   1. The platform must have a registered adapter (`ADAPTERS[platform]`).
 *   2. The platform must have a non-null `capiConversionId`. A null value
 *      means "the operator hasn't yet created a `CONVERSIONS_API`-typed
 *      conversion in Campaign Manager" — skipping it is the correct degrade.
 */
function platformsToPush(platforms: CampaignPlatformConfig[] | undefined): Array<{
  config: CampaignPlatformConfig;
  adapter: AdPlatformAdapter;
}> {
  if (!platforms) return [];
  const out: Array<{ config: CampaignPlatformConfig; adapter: AdPlatformAdapter }> = [];
  for (const p of platforms) {
    if (p.capiConversionId == null) continue;
    const adapter = ADAPTERS[p.platform];
    if (!adapter) continue;
    out.push({ config: p, adapter });
  }
  return out;
}

function channelsForLevel(
  channels: NotifyChannelConfig[] | undefined,
  level: NotifyChannelConfig["level"]
): Array<{ config: NotifyChannelConfig; channel: NotificationChannel }> {
  if (!channels) return [];
  const out: Array<{ config: NotifyChannelConfig; channel: NotificationChannel }> = [];
  for (const c of channels) {
    if (c.level !== level) continue;
    const ch = CHANNELS[c.channel];
    if (!ch) continue;
    out.push({ config: c, channel: ch });
  }
  return out;
}

/**
 * The single Phase 1 entry point. Always resolves; never throws. Callers
 * (`/api/campaigns/conversion`) can return 200 unconditionally and rely on
 * the outcome object for observability.
 */
export async function dispatchConversion(event: AdConversionEvent): Promise<DispatchOutcome> {
  const campaign = getCampaign(event.campaign);
  if (!campaign) {
    return { capi: [], notifications: [], noop: true };
  }

  const eventId = event.orderId ?? `conv-${event.campaign}-${Date.now()}`;
  const happenedAt = new Date();

  // ---- CAPI fan-out --------------------------------------------------------
  const capiTargets = platformsToPush(campaign.adPlatforms);
  const capiResults = await Promise.all(
    capiTargets.map(async ({ config, adapter }) => {
      const res = await adapter.pushConversion({
        accountId: config.accountId,
        // platformsToPush() guarantees capiConversionId is non-null here.
        conversionId: config.capiConversionId as number,
        eventId,
        happenedAt,
        user: {
          userAgent: event.userAgent,
          ipAddress: event.ipAddress,
          emailSha256: event.customer?.email
            ? await sha256(event.customer.email.toLowerCase().trim())
            : undefined,
          liFatId: event.liFatId ?? undefined,
        },
        pageUrl: event.url,
      });
      return {
        platform: config.platform,
        accepted: res.accepted,
        status: res.status,
        message: res.message,
      };
    })
  );

  // ---- Notification fan-out ------------------------------------------------
  const eventChannels = channelsForLevel(campaign.notifyChannels, "event");
  const blocks = renderConversionBlocks(event, capiResults);
  const notificationResults = await Promise.all(
    eventChannels.map(async ({ config, channel }) => {
      try {
        const { messageId } = await channel.sendBlock({
          target: config.target,
          blocks,
        });
        const ok = !messageId.endsWith(":not-sent");
        return { channel: config.channel, target: config.target, messageId, ok };
      } catch (err) {
        console.error(
          `[ad-analytics/runtime] notification failed (${config.channel} → ${config.target}):`,
          err
        );
        return { channel: config.channel, target: config.target, ok: false };
      }
    })
  );

  return {
    capi: capiResults,
    notifications: notificationResults,
    noop: capiResults.length === 0 && notificationResults.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — scheduled digest poll
// ---------------------------------------------------------------------------

/** Default rolling window for the 15-min poll. LinkedIn's reporting pipeline
 *  lag means anything tighter than 15 min is wasteful; we still query the
 *  rolling 1h to smooth out late-arriving impressions. */
const DEFAULT_DIGEST_WINDOW_MS = 60 * 60 * 1000;

/** Demographic pivots we ask LinkedIn for on every poll. Architecture §9. */
const DEFAULT_DIGEST_PIVOTS: DemographicPivot[] = [
  "MEMBER_INDUSTRY",
  "MEMBER_SENIORITY",
  "MEMBER_JOB_TITLE",
  "MEMBER_COMPANY_SIZE",
];

export interface PollOutcome {
  /** One result per (campaign × platform). */
  digests: Array<{
    campaign: string;
    platform: string;
    campaignIds: string[];
    metrics: AdMetrics[];
    posted: Array<{ channel: string; target: string; ok: boolean }>;
    skipped?: string;
  }>;
  /** True if there was nothing to poll (no campaigns with digest channels). */
  noop: boolean;
}

/**
 * Iterate every live campaign × every configured ad platform, pull fresh
 * metrics, diff against the bookmark, post a digest to every notify channel
 * with `level: "digest"`, then update the bookmark.
 *
 * Failures degrade per-campaign — one broken adapter doesn't take down the
 * others. The caller (cron route) just returns 200 with the outcome blob.
 */
export async function runScheduledPoll(opts?: {
  now?: Date;
  windowMs?: number;
  pivots?: DemographicPivot[];
}): Promise<PollOutcome> {
  const now = opts?.now ?? new Date();
  const windowMs = opts?.windowMs ?? DEFAULT_DIGEST_WINDOW_MS;
  const pivots = opts?.pivots ?? DEFAULT_DIGEST_PIVOTS;
  const since = new Date(now.getTime() - windowMs);

  const store = getBookmarkStore();
  const digests: PollOutcome["digests"] = [];

  for (const campaign of allCampaigns) {
    if (campaign.status !== "live") continue;
    const digestChannels = channelsForLevel(campaign.notifyChannels, "digest");
    if (digestChannels.length === 0) continue;
    if (!campaign.adPlatforms || campaign.adPlatforms.length === 0) continue;

    for (const platformConfig of campaign.adPlatforms) {
      const adapter = ADAPTERS[platformConfig.platform];
      if (!adapter) {
        digests.push({
          campaign: campaign.slug,
          platform: platformConfig.platform,
          campaignIds: platformConfig.campaignIds,
          metrics: [],
          posted: [],
          skipped: `no adapter registered for ${platformConfig.platform}`,
        });
        continue;
      }

      let metrics: AdMetrics[];
      try {
        metrics = await adapter.pullMetrics({
          accountId: platformConfig.accountId,
          campaignIds: platformConfig.campaignIds,
          since,
          until: now,
          pivots,
        });
      } catch (err) {
        console.error(
          `[ad-analytics/runtime] pullMetrics failed for ${campaign.slug}/${platformConfig.platform}:`,
          err
        );
        digests.push({
          campaign: campaign.slug,
          platform: platformConfig.platform,
          campaignIds: platformConfig.campaignIds,
          metrics: [],
          posted: [],
          skipped: "pullMetrics threw",
        });
        continue;
      }

      const posted: Array<{ channel: string; target: string; ok: boolean }> = [];
      const anomalyChannels = channelsForLevel(campaign.notifyChannels, "anomaly");
      const windowHours = Math.max(1, Math.round(windowMs / 3_600_000));
      for (const current of metrics) {
        const key = bookmarkKeyOf({
          campaign: campaign.slug,
          platform: platformConfig.platform,
          metric: "headline",
          window: `${Math.round(windowMs / 60000)}m`,
        });
        const bookmark = await store.getBookmark(key);
        const blocks = renderDigest({
          campaignSlug: campaign.slug,
          current,
          previous: (bookmark?.snapshot as any) ?? null,
          windowLabel: `rolling ${Math.round(windowMs / 60000)} min`,
        });
        for (const { config, channel } of digestChannels) {
          try {
            const { messageId } = await channel.sendBlock({
              target: config.target,
              blocks,
            });
            posted.push({
              channel: config.channel,
              target: config.target,
              ok: !messageId.endsWith(":not-sent"),
            });
          } catch (err) {
            console.error(`[ad-analytics/runtime] digest notification failed:`, err);
            posted.push({ channel: config.channel, target: config.target, ok: false });
          }
        }

        // ---- Anomaly evaluation + DM fan-out ------------------------------
        // Runs on every digest tick so the operator sees an alert within the
        // same 15-min window the digest reports it in. De-dup keys live in
        // the bookmark store under their own keys so the SAME anomaly in the
        // next tick doesn't spam.
        if (anomalyChannels.length > 0) {
          const findings = evaluateAnomalies({
            current,
            previous: (bookmark?.snapshot as any) ?? null,
            rules: campaign.anomalyRules,
            windowHours,
          });
          const unsent = await filterAlreadySent(store, findings, {
            campaignSlug: campaign.slug,
            platform: platformConfig.platform,
            windowEnd: current.windowEnd,
          });
          if (unsent.length > 0) {
            const anomalyBlocks = renderAnomalyBlocks({
              campaignSlug: campaign.slug,
              platform: platformConfig.platform,
              findings: unsent,
            });
            for (const { config, channel } of anomalyChannels) {
              try {
                const { messageId } = await channel.sendBlock({
                  target: config.target,
                  blocks: anomalyBlocks,
                });
                const ok = !messageId.endsWith(":not-sent");
                posted.push({
                  channel: config.channel,
                  target: config.target,
                  ok,
                });
                if (ok) {
                  await markFindingsSent(store, unsent, {
                    campaignSlug: campaign.slug,
                    platform: platformConfig.platform,
                    windowEnd: current.windowEnd,
                    snapshot: current,
                  });
                }
              } catch (err) {
                console.error(`[ad-analytics/runtime] anomaly notification failed:`, err);
                posted.push({ channel: config.channel, target: config.target, ok: false });
              }
            }
          }
        }

        // Only advance the bookmark when at least one digest/anomaly channel
        // accepted the post — otherwise a Slack outage would silently drop a
        // window.
        if (posted.some((p) => p.ok)) {
          await store.putBookmark(key, current as any);
        }
      }

      digests.push({
        campaign: campaign.slug,
        platform: platformConfig.platform,
        campaignIds: platformConfig.campaignIds,
        metrics,
        posted,
      });
    }
  }

  return { digests, noop: digests.length === 0 };
}

/**
 * Drop findings that already fired and were DM'd in this dedup window (a
 * day, currently). The bookmark store doubles as a de-dup ledger here so we
 * don't need a second AWS resource — the same `pk` schema works.
 */
async function filterAlreadySent(
  store: ReturnType<typeof getBookmarkStore>,
  findings: AnomalyFinding[],
  ctx: { campaignSlug: string; platform: string; windowEnd: string }
): Promise<AnomalyFinding[]> {
  const out: AnomalyFinding[] = [];
  for (const f of findings) {
    const key = findingDedupKey({
      campaignSlug: ctx.campaignSlug,
      platform: ctx.platform,
      rule: f.rule,
      windowEnd: ctx.windowEnd,
    });
    const existing = await store.getBookmark(key);
    if (!existing) out.push(f);
  }
  return out;
}

async function markFindingsSent(
  store: ReturnType<typeof getBookmarkStore>,
  findings: AnomalyFinding[],
  ctx: {
    campaignSlug: string;
    platform: string;
    windowEnd: string;
    snapshot: AdMetrics;
  }
): Promise<void> {
  for (const f of findings) {
    const key = findingDedupKey({
      campaignSlug: ctx.campaignSlug,
      platform: ctx.platform,
      rule: f.rule,
      windowEnd: ctx.windowEnd,
    });
    await store.putBookmark(key, ctx.snapshot as any);
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — on-demand snapshot for the /cloudless-analytics ads <slug>
// slash command. Same metric path as the scheduled poll but does NOT post to
// any channel and does NOT touch the bookmark — purely read-only.
// ---------------------------------------------------------------------------

export interface AdHocSnapshot {
  campaign: string;
  metrics: AdMetrics[];
}

export async function runAdHocSnapshot(opts: {
  campaignSlug: string;
  now?: Date;
  windowMs?: number;
  pivots?: DemographicPivot[];
}): Promise<AdHocSnapshot | null> {
  const campaign = getCampaign(opts.campaignSlug);
  if (!campaign || !campaign.adPlatforms || campaign.adPlatforms.length === 0) {
    return null;
  }
  const now = opts.now ?? new Date();
  const windowMs = opts.windowMs ?? DEFAULT_DIGEST_WINDOW_MS;
  const pivots = opts.pivots ?? DEFAULT_DIGEST_PIVOTS;
  const since = new Date(now.getTime() - windowMs);

  const all: AdMetrics[] = [];
  for (const platformConfig of campaign.adPlatforms) {
    const adapter = ADAPTERS[platformConfig.platform];
    if (!adapter) continue;
    try {
      const rows = await adapter.pullMetrics({
        accountId: platformConfig.accountId,
        campaignIds: platformConfig.campaignIds,
        since,
        until: now,
        pivots,
      });
      all.push(...rows);
    } catch (err) {
      console.error(
        `[ad-analytics/runtime] ad-hoc snapshot pullMetrics failed for ${campaign.slug}/${platformConfig.platform}:`,
        err
      );
    }
  }
  return { campaign: campaign.slug, metrics: all };
}

async function sha256(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}
