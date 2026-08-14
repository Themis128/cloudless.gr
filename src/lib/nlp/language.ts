import type { LeadIntent, LeadNlpLocale } from "./types";

const GREEK_LETTER_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

const EL_STOPWORDS = [
  "και",
  "για",
  "την",
  "του",
  "της",
  "είναι",
  "θέλω",
  "παρακαλώ",
  "προσφορά",
  "τιμή",
  "ραντεβού",
];

const EN_STOPWORDS = ["the", "and", "for", "please", "want", "need", "quote", "pricing"];

/** Fast en/el detect — Greek script wins; otherwise stopword vote. */
export function detectLeadLocale(message: string, pageLocale?: string): LeadNlpLocale {
  const text = message.trim();
  if (!text) {
    return pageLocale === "el" ? "el" : "en";
  }
  const greekChars = (text.match(GREEK_LETTER_RE) ?? []).length;
  if (greekChars >= 3 || greekChars / Math.max(text.length, 1) > 0.15) {
    return "el";
  }
  const lower = text.toLowerCase();
  let elHits = 0;
  let enHits = 0;
  for (const w of EL_STOPWORDS) {
    if (lower.includes(w)) elHits += 1;
  }
  for (const w of EN_STOPWORDS) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) enHits += 1;
  }
  if (elHits > enHits) return "el";
  if (enHits > elHits) return "en";
  return pageLocale === "el" ? "el" : "en";
}

type IntentPattern = { intent: LeadIntent; patterns: RegExp[]; weight: number };

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "spam_or_noise",
    weight: 1,
    patterns: [
      /\b(viagra|casino|crypto\s*pump|seo\s*backlinks?\s*cheap)\b/i,
      /(.)\1{8,}/,
      /^[^a-zα-ωάέήίόύώΑ-Ω]{0,5}$/i,
    ],
  },
  {
    intent: "booking",
    weight: 0.95,
    patterns: [
      /\b(book|schedule|call|meeting|audit|demo|appointment)\b/i,
      /(ραντεβού|κλήση|συνάντηση|ντεμό)/i,
    ],
  },
  {
    intent: "quote_request",
    weight: 0.95,
    patterns: [
      /\b(quote|proposal|estimate|pricing|price|cost|budget)\b/i,
      /(προσφορά|τιμή|κόστος|προϋπολογισμ|εκτίμηση)/i,
    ],
  },
  {
    intent: "partnership",
    weight: 0.9,
    patterns: [
      /\b(partner|reseller|affiliate|agency\s*partner|white[\s-]?label)\b/i,
      /(συνεργασ|μεταπωλητ|affiliate)/i,
    ],
  },
  {
    intent: "support",
    weight: 0.9,
    patterns: [
      /\b(support|bug|broken|outage|login\s*issue|not\s*working|help\s*with\s*my)\b/i,
      /(υποστήριξη|πρόβλημα|δεν\s*δουλεύει|βοήθεια)/i,
    ],
  },
];

export function classifyIntentLocal(
  message: string,
  service?: string
): { intent: LeadIntent; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  const text = message.trim();
  if (text.length < 8 && !service) {
    return { intent: "spam_or_noise", confidence: 0.7, reasons: ["very short message"] };
  }

  let best: { intent: LeadIntent; confidence: number } | null = null;
  for (const row of INTENT_PATTERNS) {
    for (const pattern of row.patterns) {
      if (pattern.test(text)) {
        const confidence = row.weight;
        if (!best || confidence > best.confidence) {
          best = { intent: row.intent, confidence };
          reasons.push(`matched ${row.intent}`);
        }
        break;
      }
    }
  }

  if (best) return { intent: best.intent, confidence: best.confidence, reasons };

  if (service && /bundle|growth|cloud|ai/i.test(service)) {
    return {
      intent: "quote_request",
      confidence: 0.55,
      reasons: [`service field suggests quote: ${service}`],
    };
  }

  return {
    intent: "general_inquiry",
    confidence: 0.45,
    reasons: ["no strong intent pattern"],
  };
}
