import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import { getStripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

describe("getStripeAnalyticsSnapshot (no D1)", () => {
  it("throws when AUTH_DB is not configured", async () => {
    await expect(getStripeAnalyticsSnapshot()).rejects.toThrow("AUTH_DB is not configured");
  });
});
