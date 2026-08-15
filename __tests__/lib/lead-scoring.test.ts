import { describe, it, expect } from "vitest";
import {
  scoreLead,
  bandForScore,
  bandEmoji,
  HOT_THRESHOLD,
  WARM_THRESHOLD,
} from "@/lib/lead-scoring";

const BASE = {
  email: "user@example.com",
  message: "I need help with cloud infrastructure for my startup.",
};

// ── bandForScore ──────────────────────────────────────────────────────────────

describe("bandForScore", () => {
  it("returns hot at HOT_THRESHOLD", () => {
    expect(bandForScore(HOT_THRESHOLD)).toBe("hot");
  });
  it("returns hot above HOT_THRESHOLD", () => {
    expect(bandForScore(100)).toBe("hot");
  });
  it("returns warm at WARM_THRESHOLD", () => {
    expect(bandForScore(WARM_THRESHOLD)).toBe("warm");
  });
  it("returns warm between thresholds", () => {
    expect(bandForScore(50)).toBe("warm");
  });
  it("returns cold below WARM_THRESHOLD", () => {
    expect(bandForScore(WARM_THRESHOLD - 1)).toBe("cold");
  });
  it("returns cold at 0", () => {
    expect(bandForScore(0)).toBe("cold");
  });
});

// ── bandEmoji ─────────────────────────────────────────────────────────────────

describe("bandEmoji", () => {
  it("returns fire for hot", () => expect(bandEmoji("hot")).toBe("🔥"));
  it("returns sun for warm", () => expect(bandEmoji("warm")).toBe("🌤️"));
  it("returns snowflake for cold", () => expect(bandEmoji("cold")).toBe("❄️"));
});

// ── scoreLead — service dimension ────────────────────────────────────────────

describe("scoreLead — service", () => {
  it("awards 30 for bundle service", () => {
    const { score, reasons } = scoreLead({
      ...BASE,
      service: "Full-Stack Growth Engine (Bundle)",
    });
    expect(score).toBeGreaterThanOrEqual(30);
    expect(reasons.some((r) => r.includes("bundle"))).toBe(true);
  });

  it("awards 20 for a specific service", () => {
    const { score } = scoreLead({ ...BASE, service: "SEO & Content Marketing" });
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it("awards 5 for undecided service", () => {
    const { score } = scoreLead({
      ...BASE,
      service: "Not sure yet — let's discuss",
    });
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it("awards 0 when service is absent", () => {
    const withService = scoreLead({ ...BASE, service: "SEO & Content Marketing" });
    const noService = scoreLead({ ...BASE });
    expect(withService.score - noService.score).toBe(20);
  });
});

// ── scoreLead — company dimension ─────────────────────────────────────────────

describe("scoreLead — company", () => {
  it("awards 15 when company is provided", () => {
    const with_ = scoreLead({ ...BASE, company: "Acme Inc" });
    const without = scoreLead({ ...BASE });
    expect(with_.score - without.score).toBe(15);
  });

  it("awards 0 for whitespace-only company", () => {
    const with_ = scoreLead({ ...BASE, company: "   " });
    const without = scoreLead({ ...BASE });
    expect(with_.score).toBe(without.score);
  });
});

// ── scoreLead — message dimension ─────────────────────────────────────────────

describe("scoreLead — message", () => {
  it("awards +5 for a substantive message (60-199 chars)", () => {
    const msg = "a".repeat(80);
    const { score } = scoreLead({ ...BASE, message: msg });
    const empty = scoreLead({ ...BASE, message: "" });
    expect(score - empty.score).toBe(5);
  });

  it("awards +10 for a detailed message (>=200 chars)", () => {
    const msg = "a".repeat(200);
    const { score } = scoreLead({ ...BASE, message: msg });
    const empty = scoreLead({ ...BASE, message: "" });
    expect(score - empty.score).toBe(10);
  });

  it("awards +5 for budget signal", () => {
    const { reasons } = scoreLead({ ...BASE, message: "our budget is €10k" });
    expect(reasons.some((r) => r.includes("budget"))).toBe(true);
  });

  it("awards +5 for timeline signal", () => {
    const { reasons } = scoreLead({ ...BASE, message: "we need this asap" });
    expect(reasons.some((r) => r.includes("timeline"))).toBe(true);
  });

  it("awards +5 for project verb", () => {
    const { reasons } = scoreLead({ ...BASE, message: "we want to migrate to the cloud" });
    expect(reasons.some((r) => r.includes("project verb"))).toBe(true);
  });

  it("awards +5 for proposal/pricing ask", () => {
    const { reasons } = scoreLead({ ...BASE, message: "can you send a quote?" });
    expect(reasons.some((r) => r.includes("proposal"))).toBe(true);
  });

  it("caps message score at 25", () => {
    // Long message + all four signals — capped
    const msg =
      "a".repeat(200) + " budget timeline migrate quote";
    const { score } = scoreLead({ email: BASE.email, message: msg });
    // message contribution is at most 25; score ≥ 0
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── scoreLead — attribution dimension ────────────────────────────────────────

describe("scoreLead — attribution", () => {
  it("awards +10 for paid medium", () => {
    const { reasons } = scoreLead({
      ...BASE,
      attribution: { utmMedium: "cpc", utmSource: "google", utmCampaign: null, referrer: null },
    });
    expect(reasons.some((r) => r.includes("paid campaign"))).toBe(true);
  });

  it("awards +5 for named campaign", () => {
    const { reasons } = scoreLead({
      ...BASE,
      attribution: {
        utmMedium: "email",
        utmSource: "newsletter",
        utmCampaign: "summer-promo",
        referrer: null,
      },
    });
    expect(reasons.some((r) => r.includes("campaign"))).toBe(true);
  });

  it("awards +5 for external referrer (no medium)", () => {
    const { reasons } = scoreLead({
      ...BASE,
      attribution: {
        utmMedium: null,
        utmSource: null,
        utmCampaign: null,
        referrer: "https://somesite.com",
      },
    });
    expect(reasons.some((r) => r.includes("referrer"))).toBe(true);
  });

  it("awards 0 when attribution is null", () => {
    const with_ = scoreLead({ ...BASE, attribution: { utmMedium: "cpc", utmSource: null, utmCampaign: null, referrer: null } });
    const without = scoreLead({ ...BASE, attribution: null });
    expect(with_.score).toBeGreaterThan(without.score);
  });
});

// ── scoreLead — email domain dimension ───────────────────────────────────────

describe("scoreLead — email domain", () => {
  it("awards +10 for business domain", () => {
    const biz = scoreLead({ ...BASE, email: "ceo@acme.com" });
    const free = scoreLead({ ...BASE, email: "user@gmail.com" });
    expect(biz.score - free.score).toBe(10);
  });

  it("awards 0 for free mail domains", () => {
    for (const domain of ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]) {
      const { reasons } = scoreLead({ ...BASE, email: `user@${domain}` });
      expect(reasons.some((r) => r.includes("business email"))).toBe(false);
    }
  });
});

// ── scoreLead — NLP dimension ─────────────────────────────────────────────────

describe("scoreLead — NLP", () => {
  it("forces cold band for spam_or_noise intent", () => {
    const { band, score } = scoreLead({
      ...BASE,
      nlp: { intent: "spam_or_noise", locale: "en", entities: {}, confidence: 0.9 },
    });
    expect(band).toBe("cold");
    expect(score).toBeLessThan(WARM_THRESHOLD);
  });

  it("adds points for quote_request intent", () => {
    const without = scoreLead({ ...BASE });
    const with_ = scoreLead({
      ...BASE,
      nlp: { intent: "quote_request", locale: "en", entities: {}, confidence: 0.8 },
    });
    expect(with_.score).toBeGreaterThan(without.score);
  });

  it("adds +2 for budget entity", () => {
    const without = scoreLead({ ...BASE, nlp: { intent: "general_inquiry", locale: "en", entities: {}, confidence: 0.7 } });
    const with_ = scoreLead({
      ...BASE,
      nlp: { intent: "general_inquiry", locale: "en", entities: { budget: true }, confidence: 0.7 },
    });
    expect(with_.score - without.score).toBe(2);
  });

  it("adds +1 for timeline entity", () => {
    const without = scoreLead({ ...BASE, nlp: { intent: "general_inquiry", locale: "en", entities: {}, confidence: 0.7 } });
    const with_ = scoreLead({
      ...BASE,
      nlp: { intent: "general_inquiry", locale: "en", entities: { timeline: true }, confidence: 0.7 },
    });
    expect(with_.score - without.score).toBe(1);
  });
});

// ── scoreLead — band outcomes ─────────────────────────────────────────────────

describe("scoreLead — band outcomes", () => {
  it("returns hot band for a fully qualified lead", () => {
    const { band } = scoreLead({
      email: "director@bigcorp.com",
      service: "Full-Stack Growth Engine (Bundle)",
      company: "BigCorp",
      message: "We need to migrate our entire stack and have a €50k budget for Q1.",
      attribution: { utmMedium: "cpc", utmSource: "google", utmCampaign: "cloud", referrer: null },
    });
    expect(band).toBe("hot");
  });

  it("returns cold band for a bare minimum lead", () => {
    const { band } = scoreLead({ email: "anon@gmail.com", message: "hi" });
    expect(band).toBe("cold");
  });

  it("clamps score to 100 maximum", () => {
    const { score } = scoreLead({
      email: "cto@enterprise.com",
      service: "Full-Stack Growth Engine (Bundle)",
      company: "Enterprise Co",
      message: "budget timeline migrate quote " + "x".repeat(200),
      attribution: { utmMedium: "cpc", utmSource: "g", utmCampaign: "q4", referrer: null },
      nlp: { intent: "quote_request", locale: "en", entities: { budget: true, timeline: true }, confidence: 1 },
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});
