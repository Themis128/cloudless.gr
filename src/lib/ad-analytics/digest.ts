/**
 * Block Kit / `NotificationBlock` renderers for the ad-analytics runtime.
 *
 * Phase 1 only renders a single event — the real-time conversion ping.
 * Phase 2 will add `renderDigest()` for the every-15-min summary; the file is
 * named `digest.ts` to leave room for it without churning imports later.
 */

import type { AdConversionEvent } from "./types";
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
