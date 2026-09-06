import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ STRIPE_SECRET_KEY: "" });

import { getStripe, listStripeProducts, listRecentCheckoutSessions } from "@/lib/stripe";

describe("stripe (not configured)", () => {
  it("getStripe returns null when STRIPE_SECRET_KEY is not set", async () => {
    const result = await getStripe();
    expect(result).toBeNull();
  });

  it("listStripeProducts returns null when Stripe is not configured", async () => {
    const result = await listStripeProducts();
    expect(result).toBeNull();
  });

  it("listRecentCheckoutSessions returns empty orders when Stripe is not configured", async () => {
    const result = await listRecentCheckoutSessions();
    expect(Array.isArray(result.orders ?? result)).toBe(true);
  });
});
