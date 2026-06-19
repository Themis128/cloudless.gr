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

import { getCampaign } from "@/data/campaigns";
import type {
  AdConversionEvent,
  CampaignPlatformConfig,
  NotifyChannelConfig,
} from "./types";
import type { AdPlatformAdapter } from "./adapters/ad-platform";
import type { NotificationChannel } from "./channels/notification";
import { linkedinAdapter } from "./adapters/linkedin";
import { slackChannel } from "./channels/slack";
import { renderConversionBlocks } from "./digest";

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
  const blocks = renderConversionBlocks(event);
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
