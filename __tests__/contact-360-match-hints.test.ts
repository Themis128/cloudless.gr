import { describe, expect, it } from "vitest";
import { buildContact360MatchHints } from "@/lib/contact-360-match-hints";
import { parseAppFlowyDocCategory } from "@/lib/appflowy-docs";

describe("buildContact360MatchHints", () => {
  it("skips joins when email is missing", () => {
    const hints = buildContact360MatchHints({
      email: "",
      hasD1User: false,
      stripeConfigured: true,
      hasStripeCustomer: false,
      eventCount: 0,
      hasRfm: false,
      hasFirstTouch: false,
      goldMatchCount: 0,
    });
    expect(hints.hasEmail).toBe(false);
    expect(hints.d1User).toBe("skipped");
    expect(hints.summary).toMatch(/no primary email/i);
  });

  it("reports no_utm_events when there is no first touch", () => {
    const hints = buildContact360MatchHints({
      email: "a@b.com",
      hasD1User: true,
      stripeConfigured: true,
      hasStripeCustomer: true,
      eventCount: 2,
      hasRfm: true,
      hasFirstTouch: false,
      goldMatchCount: 0,
    });
    expect(hints.attribution).toBe("no_utm_events");
    expect(hints.summary).toMatch(/no UTM events/i);
  });
});

describe("parseAppFlowyDocCategory", () => {
  it("parses bracket and slash categories", () => {
    expect(parseAppFlowyDocCategory("[Docs][Contracts] MSA")).toEqual({
      category: "Contracts",
      title: "MSA",
    });
    expect(parseAppFlowyDocCategory("[Docs] Contracts / NDA")).toEqual({
      category: "Contracts",
      title: "NDA",
    });
    expect(parseAppFlowyDocCategory("[Docs] Getting started")).toEqual({
      category: "General",
      title: "Getting started",
    });
  });
});
