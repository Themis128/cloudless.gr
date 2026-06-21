import { describe, expect, it } from "vitest";
import {
  scoreLead,
  bandForScore,
  bandEmoji,
  HOT_THRESHOLD,
  WARM_THRESHOLD,
} from "@/lib/lead-scoring";

describe("scoreLead", () => {
  it("scores a minimal cold lead as cold", () => {
    const result = scoreLead({
      email: "someone@gmail.com",
      message: "hi",
    });
    expect(result.score).toBeLessThan(WARM_THRESHOLD);
    expect(result.band).toBe("cold");
    expect(result.reasons).toEqual([]);
  });

  it("gives the bundle service the maximum service points", () => {
    const bundle = scoreLead({
      email: "a@gmail.com",
      service: "Full-Stack Growth Engine (Bundle)",
      message: "hi",
    });
    const specific = scoreLead({
      email: "a@gmail.com",
      service: "Serverless Development",
      message: "hi",
    });
    const undecided = scoreLead({
      email: "a@gmail.com",
      service: "Not sure yet — let's discuss",
      message: "hi",
    });
    expect(bundle.score).toBe(30);
    expect(specific.score).toBe(20);
    expect(undecided.score).toBe(5);
  });

  it("adds points for a provided company", () => {
    const withCompany = scoreLead({
      email: "a@gmail.com",
      company: "Acme GmbH",
      message: "hi",
    });
    expect(withCompany.score).toBe(15);
    expect(withCompany.reasons).toContain("company provided (+15)");
  });

  it("ignores whitespace-only company values", () => {
    const result = scoreLead({ email: "a@gmail.com", company: "   ", message: "hi" });
    expect(result.score).toBe(0);
  });

  it("scores message length and project signals, capped at 25", () => {
    const longMessage =
      "We need to migrate our platform to AWS before the deadline in March. " +
      "Our budget is around 50k and we would like a proposal with pricing. " +
      "The current system cannot scale and we want to launch the rebuild quickly. " +
      "Please include a timeline estimate as well.";
    const result = scoreLead({ email: "a@gmail.com", message: longMessage });
    // 10 (length) + 4 signals × 5 = 30 → capped at 25
    expect(result.score).toBe(25);
    expect(result.reasons).toContain("detailed message (+10)");
  });

  it("scores paid-campaign attribution higher than plain referrer", () => {
    const paid = scoreLead({
      email: "a@gmail.com",
      message: "hi",
      attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: "spring" },
    });
    const referred = scoreLead({
      email: "a@gmail.com",
      message: "hi",
      attribution: { referrer: "https://news.ycombinator.com/item" },
    });
    expect(paid.score).toBe(15); // 10 paid + 5 campaign
    expect(referred.score).toBe(5);
  });

  it("adds points for business email domains only", () => {
    const business = scoreLead({ email: "ceo@acme-corp.io", message: "hi" });
    const free = scoreLead({ email: "ceo@outlook.com", message: "hi" });
    expect(business.score).toBe(10);
    expect(free.score).toBe(0);
  });

  it("classifies a fully-qualified lead as hot", () => {
    const result = scoreLead({
      email: "cto@bigcorp.com",
      service: "Full-Stack Growth Engine (Bundle)",
      company: "BigCorp",
      message:
        "We want a proposal for migrating and rebuilding our e-shop with a clear timeline. " +
        "Budget approved. The project must launch before December and scale to 100k users.",
      attribution: { utmSource: "linkedin", utmMedium: "paid", utmCampaign: "q3-launch" },
    });
    expect(result.score).toBeGreaterThanOrEqual(HOT_THRESHOLD);
    expect(result.band).toBe("hot");
  });

  it("never exceeds 100", () => {
    const result = scoreLead({
      email: "cto@bigcorp.com",
      service: "Full-Stack Growth Engine (Bundle)",
      company: "BigCorp",
      message: "budget timeline migrate quote ".repeat(20),
      attribution: { utmSource: "x", utmMedium: "cpc", utmCampaign: "max" },
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles emails without a domain part", () => {
    const result = scoreLead({ email: "not-an-email", message: "hi" });
    expect(result.score).toBe(0);
  });
});

describe("bandForScore", () => {
  it("maps thresholds to bands", () => {
    expect(bandForScore(HOT_THRESHOLD)).toBe("hot");
    expect(bandForScore(HOT_THRESHOLD - 1)).toBe("warm");
    expect(bandForScore(WARM_THRESHOLD)).toBe("warm");
    expect(bandForScore(WARM_THRESHOLD - 1)).toBe("cold");
    expect(bandForScore(0)).toBe("cold");
    expect(bandForScore(100)).toBe("hot");
  });
});

describe("bandEmoji", () => {
  it("returns a distinct emoji per band", () => {
    const emojis = new Set([bandEmoji("hot"), bandEmoji("warm"), bandEmoji("cold")]);
    expect(emojis.size).toBe(3);
  });
});
