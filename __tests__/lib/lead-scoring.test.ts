import { describe, it, expect } from "vitest";
import {
  scoreLead,
  bandForScore,
  bandEmoji,
  HOT_THRESHOLD,
  WARM_THRESHOLD,
} from "@/lib/lead-scoring";
import type { LeadScoreInput } from "@/lib/lead-scoring";

const BASE: LeadScoreInput = {
  email: "user@example.com",
  message: "Hi",
};

describe("bandForScore", () => {
  it("returns 'hot' at or above HOT_THRESHOLD", () => {
    expect(bandForScore(HOT_THRESHOLD)).toBe("hot");
    expect(bandForScore(100)).toBe("hot");
  });

  it("returns 'warm' between WARM_THRESHOLD and HOT_THRESHOLD", () => {
    expect(bandForScore(WARM_THRESHOLD)).toBe("warm");
    expect(bandForScore(HOT_THRESHOLD - 1)).toBe("warm");
  });

  it("returns 'cold' below WARM_THRESHOLD", () => {
    expect(bandForScore(WARM_THRESHOLD - 1)).toBe("cold");
    expect(bandForScore(0)).toBe("cold");
  });
});

describe("bandEmoji", () => {
  it("returns fire for hot", () => {
    expect(bandEmoji("hot")).toBe("🔥");
  });

  it("returns cloud/sun for warm", () => {
    expect(bandEmoji("warm")).toBe("🌤️");
  });

  it("returns snowflake for cold", () => {
    expect(bandEmoji("cold")).toBe("❄️");
  });
});

describe("scoreLead", () => {
  it("returns a score between 0 and 100", () => {
    const result = scoreLead(BASE);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("adds +30 for bundle service", () => {
    const result = scoreLead({
      ...BASE,
      service: "Full-Stack Growth Engine (Bundle)",
    });
    expect(result.reasons.some((r) => r.includes("bundle"))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("adds +20 for a specific service", () => {
    const result = scoreLead({ ...BASE, service: "Cloud Architecture & Migration" });
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it("adds +5 for undecided service", () => {
    const result = scoreLead({ ...BASE, service: "Not sure yet — let's discuss" });
    expect(result.reasons.some((r) => r.includes("undecided"))).toBe(true);
  });

  it("adds +15 for company", () => {
    const result = scoreLead({ ...BASE, company: "Acme Corp" });
    expect(result.reasons.some((r) => r.includes("company"))).toBe(true);
  });

  it("does not add for empty company", () => {
    const noCompany = scoreLead(BASE);
    const withCompany = scoreLead({ ...BASE, company: "Acme" });
    expect(withCompany.score - noCompany.score).toBe(15);
  });

  it("adds +10 for business email domain", () => {
    const gmail = scoreLead({ ...BASE, email: "user@gmail.com" });
    const biz = scoreLead({ ...BASE, email: "user@mycorp.com" });
    expect(biz.score - gmail.score).toBe(10);
  });

  it("adds +10 for detailed message (200+ chars)", () => {
    const longMsg = "a".repeat(200);
    const result = scoreLead({ ...BASE, message: longMsg });
    expect(result.reasons.some((r) => r.includes("detailed"))).toBe(true);
  });

  it("adds +5 for substantive message (60-199 chars)", () => {
    const result = scoreLead({ ...BASE, message: "a".repeat(60) });
    expect(result.reasons.some((r) => r.includes("substantive"))).toBe(true);
  });

  it("adds points for project signal keywords", () => {
    const result = scoreLead({ ...BASE, message: "We need to migrate our system urgently with a tight budget" });
    expect(result.score).toBeGreaterThan(scoreLead(BASE).score);
  });

  it("caps message score at 25", () => {
    const msg = "budget timeline migrate quote " + "details ".repeat(50);
    const result = scoreLead({ ...BASE, message: msg, email: "u@gmail.com" });
    const msgPenalty = result.reasons
      .filter((r) => r.match(/\(\+\d+\)/) && (r.includes("message") || r.includes("budget") || r.includes("timeline") || r.includes("migrate") || r.includes("proposal")))
      .reduce((sum, r) => {
        const m = r.match(/\(\+(\d+)\)/);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);
    expect(msgPenalty).toBeLessThanOrEqual(25);
  });

  it("adds +10 for paid attribution", () => {
    const result = scoreLead({
      ...BASE,
      attribution: { utmMedium: "cpc", utmSource: "google", utmCampaign: null, referrer: null },
    });
    expect(result.reasons.some((r) => r.includes("paid"))).toBe(true);
  });

  it("returns cold when nlp detects spam", () => {
    const result = scoreLead({
      ...BASE,
      nlp: { intent: "spam_or_noise", locale: "en", entities: {}, confidence: 0.9 },
    });
    expect(result.band).toBe("cold");
    expect(result.reasons.some((r) => r.includes("spam"))).toBe(true);
  });

  it("adds nlp points for quote_request intent", () => {
    const noNlp = scoreLead(BASE);
    const withNlp = scoreLead({
      ...BASE,
      nlp: { intent: "quote_request", locale: "en", entities: {}, confidence: 0.9 },
    });
    expect(withNlp.score).toBeGreaterThan(noNlp.score);
  });

  it("includes budget and timeline entity bonuses", () => {
    const result = scoreLead({
      ...BASE,
      nlp: { intent: "general_inquiry", locale: "en", entities: { budget: "€5k", timeline: "Q1" }, confidence: 0.8 },
    });
    expect(result.reasons.some((r) => r.includes("budget"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("timeline"))).toBe(true);
  });
});
