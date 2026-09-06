import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/espocrm", () => ({
  isEspoCRMConfigured: vi.fn().mockResolvedValue(false),
  getPipelineStats: vi.fn(),
  listNewsletterSubscribers: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue(null),
}));

import {
  fetchSeoMetrics,
  fetchPipelineMetrics,
  fetchEmailMetrics,
  fetchStripeMetrics,
} from "@/lib/voice-brief-sources";

describe("fetchSeoMetrics", () => {
  it("returns null when GSC is not configured", async () => {
    expect(await fetchSeoMetrics()).toBeNull();
  });
});

describe("fetchPipelineMetrics", () => {
  it("returns null when EspoCRM is not configured", async () => {
    expect(await fetchPipelineMetrics()).toBeNull();
  });
});

describe("fetchEmailMetrics", () => {
  it("returns null when EspoCRM is not configured", async () => {
    expect(await fetchEmailMetrics()).toBeNull();
  });
});

describe("fetchStripeMetrics", () => {
  it("returns null when Stripe is not configured", async () => {
    expect(await fetchStripeMetrics()).toBeNull();
  });
});
