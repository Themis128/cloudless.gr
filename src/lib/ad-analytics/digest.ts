/**
 * Block Kit / `NotificationBlock` renderers for the ad-analytics runtime.
 *
 * Two surfaces:
 *  - `renderConversionBlocks(event)` — Phase 1 real-time conversion ping.
 *  - `renderDigest(metrics, previous, windowLabel)` — Phase 2 every-15-min
 *    summary with delta math and the ICP-signal block from architecture §9.
 */

import type {
  AdConversionEvent,
  AdMetrics,
  DemographicBreakdown,
  DemographicPivot,
} from "./types";
import type { NotificationBlock } from "./channels/notification";

const FLAG_BY_COUNTRY: Record<string, string> = {
  GR: "🇬🇷",
  CY: "🇨🇾",
  DE: "🇩🇪",
  AT: "🇦🇹",
  FR: "🇫🇷",
  IT: "🇮🇹",
  ES: "🇪🇸",
  UK: "🇬🇧",
  GB: "🇬🇧",
  US: "🇺🇸",
};

/**
 * One Block Kit message for a real-time conversion. Designed so the operator
 * can read the whole thing in one glance from a phone notification:
 *
 *   🎯 New conversion — shop-online
 *   Tier: starter · Order cs_test_... · 🇬🇷
 *   Creative: A_EN (linkedin / cpc)
 *   Page: https://cloudless.gr/en/campaigns/shop-online/thanks?...
 *   ⏰ at 02:14 Athens
 */
export function renderConversionBlocks(event: AdConversionEvent): NotificationBlock[] {
  const tier = event.tier ?? "—";
  const order = event.orderId ? truncate(event.orderId, 30) : "—";
  const flag = event.country ? FLAG_BY_COUNTRY[event.country] ?? event.country : "";
  const creative = formatCreative(event);
  const url = event.url ? truncate(event.url, 200) : "";

  const headerLine = `🎯 New conversion · ${event.campaign}`;
  const metaLine = `*Tier:* \`${tier}\`  ·  *Order:* \`${order}\`${flag ? `  ·  ${flag}` : ""}`;
  const creativeLine = creative ? `*Creative:* ${creative}` : "";
  const pageLine = url ? `*Page:* <${url}|${truncate(url, 80)}>` : "";

  return [
    { type: "header", text: headerLine },
    {
      type: "section",
      text: [metaLine, creativeLine, pageLine].filter(Boolean).join("\n"),
    },
    {
      type: "context",
      text: `cloudless.gr ad-analytics · ${new Date().toISOString()}`,
    },
  ];
}

function formatCreative(event: AdConversionEvent): string {
  const utm = event.utm ?? {};
  const parts: string[] = [];
  if (utm.content) parts.push(`*${escapeMrkdwn(utm.content)}*`);
  const channel = [utm.source, utm.medium].filter(Boolean).join(" / ");
  if (channel) parts.push(`(${escapeMrkdwn(channel)})`);
  if (utm.campaign) parts.push(`· ${escapeMrkdwn(utm.campaign)}`);
  return parts.join(" ");
}

function escapeMrkdwn(value: string): string {
  // Per Slack's documented escape rules, ONLY `& < >` must be escaped in
  // mrkdwn — `*` `_` `` ` `` only matter when they form a balanced pair
  // surrounded by whitespace, which is fine for short utm values like
  // `A_EN` (an underscore inside one token doesn't trigger italic).
  // Over-escaping `_` would mangle real UTM content values.
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

// ---------------------------------------------------------------------------
// Phase 2 — every-15-min digest with delta math + ICP signal
// ---------------------------------------------------------------------------

const PIVOT_LABEL: Record<DemographicPivot, string> = {
  MEMBER_INDUSTRY: "Industry",
  MEMBER_SENIORITY: "Seniority",
  MEMBER_JOB_TITLE: "Job title",
  MEMBER_COMPANY_SIZE: "Company size",
};

export interface RenderDigestOpts {
  campaignSlug: string;
  current: AdMetrics;
  previous?: AdMetrics | null;
  /** Human-readable window label like "last 15 min" or "rolling 1 h". */
  windowLabel?: string;
}

/**
 * Render the every-15-min Block Kit message. Numbers show absolute value
 * plus delta vs the previous snapshot, e.g. `Clicks: 2 (+1)`. When there is
 * no previous bookmark (cold start) deltas are suppressed so the operator
 * doesn't see "+everything".
 *
 * Demographic blocks are only rendered when the current snapshot carries
 * them — privacy-suppressed pivots return empty from the adapter and we
 * skip them cleanly.
 */
export function renderDigest(opts: RenderDigestOpts): NotificationBlock[] {
  const { campaignSlug, current, previous, windowLabel = "last 15 min" } = opts;

  const lines: string[] = [
    `*Impressions:* ${formatNumberWithDelta(current.impressions, previous?.impressions)}`,
    `*Clicks:* ${formatNumberWithDelta(current.clicks, previous?.clicks)}  ·  *CTR:* ${formatRatio(current.ctr)}`,
    `*Spend:* ${formatEuros(current.spendEur, previous?.spendEur)}  ·  *CPC:* ${formatEuros(current.cpcEur)}`,
    `*Conversions:* ${formatNumberWithDelta(current.conversions, previous?.conversions)}  ·  *Cost / conv:* ${formatEuros(current.cpaEur)}`,
  ];

  const icpLines = renderDemographicLines(current.demographics);
  const blocks: NotificationBlock[] = [
    { type: "header", text: `📊 ${campaignSlug} · ${windowLabel}` },
    { type: "section", text: lines.join("\n") },
  ];
  if (icpLines.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({ type: "section", text: `*ICP signal:*\n${icpLines.join("\n")}` });
  }
  blocks.push({
    type: "context",
    text: `cloudless.gr ad-analytics · ${current.windowStart} → ${current.windowEnd}`,
  });

  return blocks;
}

function renderDemographicLines(
  demographics?: Partial<Record<DemographicPivot, DemographicBreakdown>>
): string[] {
  if (!demographics) return [];
  const out: string[] = [];
  for (const pivot of Object.keys(demographics) as DemographicPivot[]) {
    const rows = demographics[pivot] ?? [];
    if (rows.length === 0) continue;
    const summary = rows
      .slice(0, 4)
      .map((r) => `${escapeMrkdwn(r.label)} ${r.clicks}`)
      .join(", ");
    out.push(`• ${PIVOT_LABEL[pivot]}: ${summary}`);
  }
  return out;
}

function formatNumberWithDelta(current: number, previous?: number): string {
  if (typeof previous !== "number") return String(current);
  const delta = current - previous;
  if (delta === 0) return `${current}`;
  const sign = delta > 0 ? "+" : "";
  return `${current} (${sign}${delta})`;
}

function formatEuros(current?: number, previous?: number): string {
  if (typeof current !== "number") return "—";
  const main = `€${current.toFixed(2)}`;
  if (typeof previous !== "number") return main;
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return main;
  const sign = delta > 0 ? "+" : "";
  return `${main} (${sign}€${delta.toFixed(2)})`;
}

function formatRatio(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}
