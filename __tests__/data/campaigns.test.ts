import { describe, it, expect } from "vitest";
import {
  campaigns,
  getCampaign,
  getLiveCampaigns,
  isCampaignLocale,
  CAMPAIGN_LOCALES,
} from "@/data/campaigns";

describe("data/campaigns", () => {
  it("ships exactly the shop-online campaign right now", () => {
    expect(campaigns.map((c) => c.slug)).toEqual(["shop-online"]);
  });

  it("getCampaign returns the campaign by slug", () => {
    expect(getCampaign("shop-online")?.slug).toBe("shop-online");
    expect(getCampaign("does-not-exist")).toBeUndefined();
  });

  it("getLiveCampaigns excludes non-live entries", () => {
    const live = getLiveCampaigns();
    expect(live.length).toBe(1);
    for (const c of live) expect(c.status).toBe("live");
  });

  it("shop-online ships three tiers with the documented IDs", () => {
    const c = getCampaign("shop-online")!;
    expect(c.tiers.map((t) => t.id)).toEqual(["starter", "eshop-launch", "full-bundle"]);
  });

  it("marks exactly one tier as featured (and it's the flagship)", () => {
    const c = getCampaign("shop-online")!;
    const featured = c.tiers.filter((t) => t.featured);
    expect(featured).toHaveLength(1);
    expect(featured[0].id).toBe("full-bundle");
  });

  it("ships EL and EN copy for every tier", () => {
    const c = getCampaign("shop-online")!;
    for (const t of c.tiers) {
      expect(t.name.el).toBeTruthy();
      expect(t.name.en).toBeTruthy();
      expect(t.highlights.el.length).toBeGreaterThan(0);
      expect(t.highlights.en.length).toBeGreaterThan(0);
      expect(t.cta.el).toBeTruthy();
      expect(t.cta.en).toBeTruthy();
    }
  });

  it("points each tier's checkoutHref at /api/checkout with campaign+tier params", () => {
    const c = getCampaign("shop-online")!;
    for (const t of c.tiers) {
      expect(t.checkoutHref).toBe(`/api/checkout?campaign=${c.slug}&tier=${t.id}`);
    }
  });

  it("is wired to the live LinkedIn conversion ID for shop-online", () => {
    // Pinned to the conversion event "Shop Online — Tier purchased" created in
    // Campaign Manager (account 512642510). Pinning the number in a test means
    // a stray edit to the data file can't silently break attribution — the
    // test fails loudly. If the conversion is recreated, update this number
    // and bump the campaign's tracking version alongside the change.
    expect(getCampaign("shop-online")?.linkedinConversionId).toBe(26846068);
  });

  it("CAMPAIGN_LOCALES is el+en for now", () => {
    expect([...CAMPAIGN_LOCALES]).toEqual(["el", "en"]);
  });

  it("isCampaignLocale narrows correctly", () => {
    expect(isCampaignLocale("el")).toBe(true);
    expect(isCampaignLocale("en")).toBe(true);
    expect(isCampaignLocale("fr")).toBe(false);
    expect(isCampaignLocale("xx")).toBe(false);
  });

  it("FAQ ships EL+EN for every entry", () => {
    const c = getCampaign("shop-online")!;
    expect(c.faq.length).toBeGreaterThanOrEqual(3);
    for (const item of c.faq) {
      expect(item.q.el.length).toBeGreaterThan(0);
      expect(item.q.en.length).toBeGreaterThan(0);
      expect(item.a.el.length).toBeGreaterThan(0);
      expect(item.a.en.length).toBeGreaterThan(0);
    }
  });
});
