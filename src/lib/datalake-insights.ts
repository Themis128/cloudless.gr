/**
 * Gold LLM insights — contract shared by ETL materialize + serving APIs.
 *
 * Objects live at:
 *   lake/snapshots/insights/{domain}.json
 *   lake/snapshots/insights/insights-index.json
 *   lake/snapshots/insights/orchestration.json
 */

export const INSIGHT_DOMAINS = [
  "seo",
  "revenue",
  "crm_funnel",
  "ads",
  "ops_errors",
  "executive",
  "orchestration",
] as const;

export type InsightDomain = (typeof INSIGHT_DOMAINS)[number];

export const INSIGHTS_PREFIX = "lake/snapshots/insights";
export const INSIGHTS_INDEX_KEY = `${INSIGHTS_PREFIX}/insights-index.json`;

export function insightObjectKey(domain: InsightDomain | string): string {
  return `${INSIGHTS_PREFIX}/${domain}.json`;
}

export interface DatalakeInsight {
  domain: InsightDomain | string;
  generated_at: string;
  model?: string;
  provider?: "workers-ai" | "gemini" | "none";
  inputs_ref?: {
    gold_generated_at?: string | null;
    sections?: string[];
  };
  summary: string;
  bullets: string[];
  metrics_cited: Array<{ key: string; value: string | number | null }>;
  confidence?: "high" | "medium" | "low";
  freshness?: string | null;
  error?: string;
}

export interface DatalakeInsightsIndex {
  generated_at: string;
  domains: Array<{
    domain: string;
    generated_at: string | null;
    has_error: boolean;
    summary_preview?: string;
  }>;
}

export function isInsightDomain(value: string): value is InsightDomain {
  return (INSIGHT_DOMAINS as readonly string[]).includes(value);
}

/** Map insight domain → gold section names used as metric packs. */
export const INSIGHT_SECTION_MAP: Record<string, string[]> = {
  seo: ["top_keywords", "freshness"],
  revenue: ["stripe_revenue", "acquisition_funnel", "attribution"],
  crm_funnel: ["espocrm_funnel"],
  ads: ["linkedin_ads"],
  ops_errors: ["top_errors"],
  executive: [
    "stripe_revenue",
    "top_keywords",
    "espocrm_funnel",
    "linkedin_ads",
    "top_errors",
    "acquisition_funnel",
    "attribution",
  ],
  orchestration: ["stripe_revenue", "acquisition_funnel", "attribution"],
};
