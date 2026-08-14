/**
 * Lead scoring — deterministic rules engine for inbound leads.
 *
 * Produces a 0–100 score plus a band (hot/warm/cold) and the list of rules
 * that fired, so the score is always explainable in Slack alerts and CRM
 * notes. Pure function — no I/O — so it is fully unit-testable.
 *
 * Scoring model (max 100):
 *   Service interest   up to 30  (bundle > specific service > undecided)
 *   Company provided   up to 15
 *   Message quality    up to 25  (length + project signals)
 *   Attribution        up to 20  (paid/campaign traffic > organic > direct)
 *   Business email     up to 10  (non-free-mail domain)
 *   NLP signals        up to 15  (intent / entities; optional)
 */

import type { LeadAttribution } from "@/lib/lead-attribution";
import type { LeadIntent, LeadNlpResult } from "@/lib/nlp/types";

export type LeadBand = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  email: string;
  service?: string;
  company?: string;
  message: string;
  attribution?: LeadAttribution | null;
  /** Optional NLP enrichment from analyzeLeadMessage. */
  nlp?: Pick<LeadNlpResult, "intent" | "locale" | "entities" | "confidence"> | null;
}

export interface LeadScore {
  score: number;
  band: LeadBand;
  reasons: string[];
}

export const HOT_THRESHOLD = 65;
export const WARM_THRESHOLD = 35;

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.gr",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "live.com",
  "msn.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
]);

/** Form values indicating a concrete service choice (mirrors the contact form). */
const BUNDLE_SERVICE = "Full-Stack Growth Engine (Bundle)";
const UNDECIDED_SERVICE = "Not sure yet — let's discuss";

const PROJECT_SIGNAL_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(budget|invest|spend)\b/i, "mentions budget"],
  [
    /\b(timeline|deadline|by (january|february|march|april|may|june|july|august|september|october|november|december)|asap|urgent)\b/i,
    "mentions timeline",
  ],
  [/\b(migrate|migration|launch|rebuild|redesign|scale|grow)\b/i, "concrete project verb"],
  [/\b(quote|proposal|estimate|pricing|price)\b/i, "asks for proposal/pricing"],
];

const INTENT_POINTS: Partial<Record<LeadIntent, number>> = {
  quote_request: 12,
  booking: 12,
  partnership: 8,
  support: 4,
  general_inquiry: 2,
};

function scoreService(service: string | undefined, reasons: string[]): number {
  if (!service) return 0;
  if (service === BUNDLE_SERVICE) {
    reasons.push("interested in full bundle (+30)");
    return 30;
  }
  if (service === UNDECIDED_SERVICE) {
    reasons.push("service undecided (+5)");
    return 5;
  }
  reasons.push(`specific service interest: ${service} (+20)`);
  return 20;
}

function scoreCompany(company: string | undefined, reasons: string[]): number {
  if (!company?.trim()) return 0;
  reasons.push("company provided (+15)");
  return 15;
}

function scoreMessage(message: string, reasons: string[]): number {
  let pts = 0;
  const length = message.trim().length;
  if (length >= 200) {
    pts += 10;
    reasons.push("detailed message (+10)");
  } else if (length >= 60) {
    pts += 5;
    reasons.push("substantive message (+5)");
  }
  for (const [pattern, label] of PROJECT_SIGNAL_PATTERNS) {
    if (pattern.test(message)) {
      pts += 5;
      reasons.push(`${label} (+5)`);
    }
  }
  return Math.min(pts, 25);
}

function scoreAttribution(
  attribution: LeadAttribution | null | undefined,
  reasons: string[]
): number {
  if (!attribution) return 0;
  let pts = 0;
  const medium = attribution.utmMedium?.toLowerCase() ?? "";
  if (["cpc", "ppc", "paid", "paid_social", "paidsocial"].includes(medium)) {
    pts += 10;
    reasons.push("arrived via paid campaign (+10)");
  }
  if (attribution.utmCampaign) {
    pts += 5;
    reasons.push(`campaign: ${attribution.utmCampaign} (+5)`);
  }
  if (attribution.referrer && pts === 0) {
    pts += 5;
    reasons.push("arrived via external referrer (+5)");
  }
  return Math.min(pts, 20);
}

function scoreEmailDomain(email: string, reasons: string[]): number {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return 0;
  if (FREE_MAIL_DOMAINS.has(domain)) return 0;
  reasons.push(`business email domain: ${domain} (+10)`);
  return 10;
}

function scoreNlp(
  nlp: LeadScoreInput["nlp"],
  reasons: string[]
): { points: number; forceCold: boolean } {
  if (!nlp) return { points: 0, forceCold: false };
  if (nlp.intent === "spam_or_noise") {
    reasons.push("nlp intent:spam_or_noise (force cold)");
    return { points: 0, forceCold: true };
  }
  let pts = INTENT_POINTS[nlp.intent] ?? 0;
  if (pts > 0) reasons.push(`nlp intent:${nlp.intent} (+${pts})`);
  if (nlp.entities?.budget) {
    pts += 2;
    reasons.push("nlp entity:budget (+2)");
  }
  if (nlp.entities?.timeline) {
    pts += 1;
    reasons.push("nlp entity:timeline (+1)");
  }
  return { points: Math.min(pts, 15), forceCold: false };
}

export function bandForScore(score: number): LeadBand {
  if (score >= HOT_THRESHOLD) return "hot";
  if (score >= WARM_THRESHOLD) return "warm";
  return "cold";
}

export function scoreLead(input: LeadScoreInput): LeadScore {
  const reasons: string[] = [];
  const nlpResult = scoreNlp(input.nlp, reasons);
  if (nlpResult.forceCold) {
    return { score: Math.min(WARM_THRESHOLD - 1, 20), band: "cold", reasons };
  }

  const total =
    scoreService(input.service, reasons) +
    scoreCompany(input.company, reasons) +
    scoreMessage(input.message, reasons) +
    scoreAttribution(input.attribution, reasons) +
    scoreEmailDomain(input.email, reasons) +
    nlpResult.points;

  const score = Math.max(0, Math.min(100, total));
  return { score, band: bandForScore(score), reasons };
}

/** Emoji used in Slack alerts per band. */
export function bandEmoji(band: LeadBand): string {
  if (band === "hot") return "🔥";
  if (band === "warm") return "🌤️";
  return "❄️";
}
