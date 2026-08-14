/** Closed intent taxonomy for contact-form NLP (en + el). */
export const LEAD_INTENTS = [
  "quote_request",
  "booking",
  "support",
  "partnership",
  "spam_or_noise",
  "general_inquiry",
] as const;

export type LeadIntent = (typeof LEAD_INTENTS)[number];

export type LeadNlpLocale = "en" | "el";

export interface LeadNlpEntities {
  budget?: string;
  timeline?: string;
  product?: string;
}

export interface LeadNlpResult {
  intent: LeadIntent;
  locale: LeadNlpLocale;
  entities: LeadNlpEntities;
  /** 0–1 confidence in the winning intent. */
  confidence: number;
  /** Human-readable signals for Slack / CRM notes. */
  reasons: string[];
  /** How the result was produced. */
  source: "local" | "workers-ai" | "fallback";
}

export interface AnalyzeLeadInput {
  message: string;
  service?: string;
  /** Page locale hint from the form route (en | el | …). */
  pageLocale?: string;
}
