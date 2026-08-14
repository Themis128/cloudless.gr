import type { LeadNlpEntities } from "./types";

const BUDGET_RE =
  /(?:€|\$|eur|usd|budget|προϋπολογισμ)[^\d]{0,12}(\d[\d.,]*\s*[kκ]?)/i;
const TIMELINE_RE =
  /\b(asap|urgent|this\s+week|next\s+month|q[1-4]|by\s+\w+|άμεσα|επείγον|μέσα\s+στον?\s+\w+)\b/i;
const PRODUCT_RE =
  /\b(cloud\s*architecture|ai\s*growth|shop[\s-]?online|esp32|k3s|next\.?js|workers|d1|rag)\b/i;

/** Regex entity extraction — LLM may fill gaps later. */
export function extractLeadEntities(message: string): LeadNlpEntities {
  const entities: LeadNlpEntities = {};
  const budget = message.match(BUDGET_RE);
  if (budget?.[1]) entities.budget = budget[1].trim();
  const timeline = message.match(TIMELINE_RE);
  if (timeline?.[1]) entities.timeline = timeline[1].trim();
  const product = message.match(PRODUCT_RE);
  if (product?.[1]) entities.product = product[1].trim();
  return entities;
}
