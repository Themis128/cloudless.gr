/**
 * Pivot D1 funnel summary rows into an A/B variant comparison matrix.
 * Pure — no D1. Distinct from /admin/ab-tests flag toggles.
 */

import { FUNNEL_EVENT_TYPES } from "@/lib/search-funnel";

export interface FunnelSummaryLike {
  event_type: string;
  count: number;
  ab_variant: string | null;
}

export const FUNNEL_VARIANT_NONE = "(none)";

/** Ordered conversion edges used for side-by-side rates. */
export const FUNNEL_COMPARE_EDGES: ReadonlyArray<{ from: string; to: string; label: string }> = [
  { from: "search_query", to: "search_result", label: "Query → result" },
  { from: "search_result", to: "search_click", label: "Result → click" },
  { from: "search_click", to: "search_buy", label: "Click → buy" },
  { from: "rec_impression", to: "rec_click", label: "Rec impression → click" },
];

export function variantLabel(ab_variant: string | null | undefined): string {
  const trimmed = typeof ab_variant === "string" ? ab_variant.trim() : "";
  return trimmed.length > 0 ? trimmed : FUNNEL_VARIANT_NONE;
}

export interface FunnelAbCompare {
  variants: string[];
  eventTypes: string[];
  /** counts[event_type][variantLabel] */
  counts: Record<string, Record<string, number>>;
  rates: Array<{
    from: string;
    to: string;
    label: string;
    byVariant: Record<string, number | null>;
  }>;
}

function sortVariants(labels: Iterable<string>): string[] {
  return [...labels].sort((a, b) => {
    if (a === FUNNEL_VARIANT_NONE) return 1;
    if (b === FUNNEL_VARIANT_NONE) return -1;
    return a.localeCompare(b);
  });
}

function sortEventTypes(types: Iterable<string>): string[] {
  const known = new Set<string>(FUNNEL_EVENT_TYPES);
  const list = [...types];
  const ordered = FUNNEL_EVENT_TYPES.filter((t) => list.includes(t));
  const extra = list.filter((t) => !known.has(t)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...extra];
}

/**
 * Build a pivot + conversion-rate comparison from getFunnelSummary rows.
 */
export function buildFunnelAbCompare(rows: ReadonlyArray<FunnelSummaryLike>): FunnelAbCompare {
  const variantSet = new Set<string>();
  const eventSet = new Set<string>();
  const counts: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const v = variantLabel(row.ab_variant);
    const event = row.event_type;
    const n = Number.isFinite(row.count) ? Math.max(0, Math.floor(row.count)) : 0;
    variantSet.add(v);
    eventSet.add(event);
    if (!counts[event]) counts[event] = {};
    counts[event][v] = (counts[event][v] ?? 0) + n;
  }

  const variants = sortVariants(variantSet);
  const eventTypes = sortEventTypes(eventSet);

  const rates = FUNNEL_COMPARE_EDGES.filter(
    (edge) => eventSet.has(edge.from) || eventSet.has(edge.to)
  ).map((edge) => {
    const byVariant: Record<string, number | null> = {};
    for (const v of variants) {
      const denom = counts[edge.from]?.[v] ?? 0;
      const numer = counts[edge.to]?.[v] ?? 0;
      byVariant[v] = denom > 0 ? numer / denom : null;
    }
    return { ...edge, byVariant };
  });

  return { variants, eventTypes, counts, rates };
}

export function formatFunnelRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}
