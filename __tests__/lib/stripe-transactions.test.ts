import { describe, it, expect } from "vitest";
import { getStripeEventTags } from "@/lib/stripe-transactions";

describe("getStripeEventTags", () => {
  it("categorises checkout events", () => {
    const tags = getStripeEventTags("checkout.session.completed");
    expect(tags.tagCategory).toBe("checkout");
    expect(typeof tags.tagSource).toBe("string");
    expect(typeof tags.tagStage).toBe("string");
  });

  it("categorises invoice events", () => {
    expect(getStripeEventTags("invoice.paid").tagCategory).toBe("invoice");
  });

  it("categorises subscription events", () => {
    expect(getStripeEventTags("customer.subscription.created").tagCategory).toBe("subscription");
  });

  it("falls back to other for unknown events", () => {
    expect(getStripeEventTags("unknown.event").tagCategory).toBe("other");
  });
});
