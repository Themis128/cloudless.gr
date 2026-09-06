import { describe, it, expect } from "vitest";
import { buildContact360MatchHints } from "@/lib/contact-360-match-hints";

const BASE = {
  email: "user@example.com",
  hasD1User: true,
  stripeConfigured: true,
  hasStripeCustomer: true,
  eventCount: 5,
  hasRfm: true,
  hasFirstTouch: true,
  goldMatchCount: 2,
};

describe("buildContact360MatchHints", () => {
  it("returns all-skipped when email is empty", () => {
    const result = buildContact360MatchHints({ ...BASE, email: "   " });
    expect(result.hasEmail).toBe(false);
    expect(result.d1User).toBe("skipped");
    expect(result.stripeCustomer).toBe("skipped");
    expect(result.summary).toContain("no primary email");
  });

  it("returns all hits when everything is configured and matched", () => {
    const result = buildContact360MatchHints(BASE);
    expect(result.hasEmail).toBe(true);
    expect(result.d1User).toBe("hit");
    expect(result.stripeCustomer).toBe("hit");
    expect(result.d1Events).toBe("hit");
    expect(result.rfmScores).toBe("hit");
    expect(result.attribution).toBe("hit");
    expect(result.summary).toBe("Email join hit every wired source.");
  });

  it("marks stripeCustomer as unconfigured when stripe is not configured", () => {
    const result = buildContact360MatchHints({ ...BASE, stripeConfigured: false });
    expect(result.stripeCustomer).toBe("unconfigured");
  });

  it("marks stripeCustomer as miss when configured but no customer found", () => {
    const result = buildContact360MatchHints({ ...BASE, hasStripeCustomer: false });
    expect(result.stripeCustomer).toBe("miss");
    expect(result.summary).toContain("Stripe");
  });

  it("marks d1User as miss when user not found", () => {
    const result = buildContact360MatchHints({ ...BASE, hasD1User: false });
    expect(result.d1User).toBe("miss");
    expect(result.summary).toContain("D1 user");
  });

  it("marks d1Events as miss when eventCount is 0", () => {
    const result = buildContact360MatchHints({ ...BASE, eventCount: 0 });
    expect(result.d1Events).toBe("miss");
  });

  it("marks rfmScores as miss when hasRfm is false", () => {
    const result = buildContact360MatchHints({ ...BASE, hasRfm: false });
    expect(result.rfmScores).toBe("miss");
  });

  it("marks attribution as no_utm_events when no first touch and no gold match", () => {
    const result = buildContact360MatchHints({ ...BASE, hasFirstTouch: false, goldMatchCount: 0 });
    expect(result.attribution).toBe("no_utm_events");
    expect(result.summary).toContain("no UTM events");
  });

  it("marks attribution as miss when first touch exists but no gold match", () => {
    const result = buildContact360MatchHints({ ...BASE, hasFirstTouch: true, goldMatchCount: 0 });
    expect(result.attribution).toBe("miss");
    expect(result.summary).toContain("UTM events present");
  });

  it("includes all gap descriptions in summary", () => {
    const result = buildContact360MatchHints({
      ...BASE,
      hasD1User: false,
      hasStripeCustomer: false,
      eventCount: 0,
      hasRfm: false,
      hasFirstTouch: false,
    });
    expect(result.summary).toContain("D1 user");
    expect(result.summary).toContain("Stripe customer");
    expect(result.summary).toContain("D1 events");
  });
});
