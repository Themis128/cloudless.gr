import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend;
  }),
  QueryCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
  ScanCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@/lib/stripe-transactions", () => ({
  resolveDynamoEndpoint: vi.fn(() => undefined),
}));

const TABLE_NAME = "test-transactions-table";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    eventDay: { S: "2026-01-15" },
    tagCategory: { S: "checkout" },
    processingStatus: { S: "processed" },
    currency: { S: "eur" },
    amountMinor: { N: "4900" },
    ...overrides,
  };
}

describe("getStripeAnalyticsSnapshot()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_TRANSACTIONS_TABLE = TABLE_NAME;
  });

  it("throws when STRIPE_TRANSACTIONS_TABLE is not set", async () => {
    delete process.env.STRIPE_TRANSACTIONS_TABLE;
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    await expect(getStripeAnalyticsSnapshot()).rejects.toThrow(
      "STRIPE_TRANSACTIONS_TABLE is not configured"
    );
  });

  it("returns an empty snapshot when DynamoDB returns no items", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(7);
    expect(result.totals.events).toBe(0);
    expect(result.totals.revenueMinor).toBe(0);
    expect(result.windowDays).toBe(7);
    expect(result.dailyTrend).toHaveLength(7);
  });

  it("aggregates totals correctly from items", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [
      makeItem({
        eventDay: { S: today },
        amountMinor: { N: "1000" },
        processingStatus: { S: "processed" },
      }),
      makeItem({
        eventDay: { S: today },
        amountMinor: { N: "2000" },
        processingStatus: { S: "processed" },
      }),
      makeItem({
        eventDay: { S: today },
        amountMinor: { N: "500" },
        processingStatus: { S: "handler_failed" },
      }),
    ];
    // 1-day window → single DynamoDB query; no multi-day accumulation
    mockSend.mockResolvedValue({ Items: items, LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.totals.events).toBe(3);
    expect(result.totals.revenueMinor).toBe(3500);
    expect(result.totals.processed).toBe(2);
    expect(result.totals.failed).toBe(1);
  });

  it("groups events by category", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [
      makeItem({
        eventDay: { S: today },
        tagCategory: { S: "checkout" },
        amountMinor: { N: "1000" },
      }),
      makeItem({
        eventDay: { S: today },
        tagCategory: { S: "subscription" },
        amountMinor: { N: "2000" },
      }),
      makeItem({
        eventDay: { S: today },
        tagCategory: { S: "checkout" },
        amountMinor: { N: "500" },
      }),
    ];
    mockSend.mockResolvedValue({ Items: items, LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCategory.checkout.events).toBe(2);
    expect(result.byCategory.checkout.revenueMinor).toBe(1500);
    expect(result.byCategory.subscription.events).toBe(1);
    expect(result.byCategory.subscription.revenueMinor).toBe(2000);
  });

  it("groups events by status", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [
      makeItem({ eventDay: { S: today }, processingStatus: { S: "processed" } }),
      makeItem({ eventDay: { S: today }, processingStatus: { S: "processed" } }),
      makeItem({ eventDay: { S: today }, processingStatus: { S: "handler_failed" } }),
    ];
    mockSend.mockResolvedValue({ Items: items, LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byStatus.processed).toBe(2);
    expect(result.byStatus.handler_failed).toBe(1);
  });

  it("groups events by currency", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = [
      makeItem({ eventDay: { S: today }, currency: { S: "eur" }, amountMinor: { N: "1000" } }),
      makeItem({ eventDay: { S: today }, currency: { S: "usd" }, amountMinor: { N: "2000" } }),
    ];
    mockSend.mockResolvedValue({ Items: items, LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCurrency.eur).toBe(1000);
    expect(result.byCurrency.usd).toBe(2000);
  });

  it("clamps days to [1, 365]", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");

    const resultMin = await getStripeAnalyticsSnapshot(0);
    expect(resultMin.windowDays).toBe(1);
    expect(resultMin.dailyTrend).toHaveLength(1);

    const resultMax = await getStripeAnalyticsSnapshot(1000);
    expect(resultMax.windowDays).toBe(365);
    expect(resultMax.dailyTrend).toHaveLength(365);
  });

  it("falls back to scan when index is missing", async () => {
    const validationError = Object.assign(new Error("Query condition missed key schema element"), {
      name: "ValidationException",
    });
    const today = new Date().toISOString().slice(0, 10);
    mockSend
      .mockRejectedValueOnce(validationError) // query fails
      .mockResolvedValueOnce({
        // scan succeeds
        Items: [makeItem({ eventDay: { S: today }, amountMinor: { N: "9900" } })],
        LastEvaluatedKey: undefined,
      });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.totals.events).toBe(1);
    expect(result.totals.revenueMinor).toBe(9900);
  });

  it("derives day from stripeCreatedAt when eventDay is missing", async () => {
    const epoch = Math.floor(Date.now() / 1000); // use "now" so the day falls in the 1-day window
    const item = {
      stripeCreatedAt: { N: `${epoch}` },
      tagCategory: { S: "checkout" },
      processingStatus: { S: "processed" },
      currency: { S: "eur" },
      amountMinor: { N: "1000" },
    };
    // 1-day window → single query, returns 1 item
    mockSend.mockResolvedValue({ Items: [item], LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.totals.events).toBe(1);
  });

  it("handles items with unknown category defaulting to 'other'", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const item = makeItem({ eventDay: { S: today }, tagCategory: undefined });
    mockSend.mockResolvedValue({ Items: [item], LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCategory.other).toBeDefined();
    expect(result.byCategory.other.events).toBe(1);
  });

  it("includes generatedAt as an ISO timestamp string", async () => {
    mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(7);
    expect(typeof result.generatedAt).toBe("string");
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
  });
});
