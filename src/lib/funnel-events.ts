/**
 * Funnel event taxonomy — pure constants shared by server D1 writers
 * (search-funnel.ts) and client-safe pivot/UI code (funnel-ab-compare.ts).
 * Keep this module dependency-free: it is bundled into Client Components.
 */

export const FUNNEL_EVENT_TYPES = [
  "search_query",
  "search_result",
  "search_click",
  "search_buy",
  "rec_impression",
  "rec_click",
] as const;

export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export function isFunnelEventType(value: string): value is FunnelEventType {
  return (FUNNEL_EVENT_TYPES as readonly string[]).includes(value);
}
