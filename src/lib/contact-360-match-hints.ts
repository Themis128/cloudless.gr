/**
 * Build operator-facing match diagnostics for Contact 360.
 * Pure — no I/O. Used to decide CDP is unnecessary when email join works.
 */

export type MatchHintState = "hit" | "miss" | "skipped" | "unconfigured" | "no_utm_events";

export interface Contact360MatchHints {
  hasEmail: boolean;
  d1User: MatchHintState;
  stripeCustomer: MatchHintState;
  d1Events: MatchHintState;
  rfmScores: MatchHintState;
  attribution: MatchHintState;
  summary: string;
}

export function buildContact360MatchHints(input: {
  email: string;
  hasD1User: boolean;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  eventCount: number;
  hasRfm: boolean;
  hasFirstTouch: boolean;
  goldMatchCount: number;
}): Contact360MatchHints {
  const hasEmail = Boolean(input.email.trim());
  if (!hasEmail) {
    return {
      hasEmail: false,
      d1User: "skipped",
      stripeCustomer: "skipped",
      d1Events: "skipped",
      rfmScores: "skipped",
      attribution: "skipped",
      summary: "Espo contact has no primary email — Stripe, D1, and gold joins were skipped.",
    };
  }

  const d1User: MatchHintState = input.hasD1User ? "hit" : "miss";
  const stripeCustomer: MatchHintState = !input.stripeConfigured
    ? "unconfigured"
    : input.hasStripeCustomer
      ? "hit"
      : "miss";
  const d1Events: MatchHintState = input.eventCount > 0 ? "hit" : "miss";
  const rfmScores: MatchHintState = input.hasRfm ? "hit" : "miss";
  const attribution: MatchHintState = input.hasFirstTouch
    ? input.goldMatchCount > 0
      ? "hit"
      : "miss"
    : "no_utm_events";

  const parts: string[] = [];
  if (d1User === "miss") parts.push("no D1 user");
  if (stripeCustomer === "miss") parts.push("no Stripe customer");
  if (d1Events === "miss") parts.push("no D1 events");
  if (rfmScores === "miss") parts.push("no RFM/churn row");
  if (attribution === "no_utm_events") {
    parts.push("no UTM events (gold not consulted by email alone)");
  } else if (attribution === "miss") {
    parts.push("UTM events present but no gold campaign match");
  }

  return {
    hasEmail: true,
    d1User,
    stripeCustomer,
    d1Events,
    rfmScores,
    attribution,
    summary:
      parts.length === 0
        ? "Email join hit every wired source."
        : `Email join gaps: ${parts.join("; ")}.`,
  };
}
