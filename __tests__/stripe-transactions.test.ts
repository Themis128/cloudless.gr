import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("stripe transaction tags", () => {
  const previousStage = process.env.NEXT_PUBLIC_STAGE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STAGE = "production";
  });

  afterEach(() => {
    if (typeof previousStage === "string") process.env.NEXT_PUBLIC_STAGE = previousStage;
    else delete process.env.NEXT_PUBLIC_STAGE;
  });

  it("maps checkout events to checkout tag", async () => {
    const { getStripeEventTags } = await import("@/lib/stripe-transactions");
    const tags = getStripeEventTags("checkout.session.completed");
    expect(tags.tagSource).toBe("cloudless.gr");
    expect(tags.tagStage).toBe("production");
    expect(tags.tagCategory).toBe("checkout");
  });

  it("maps subscription events to subscription tag", async () => {
    const { getStripeEventTags } = await import("@/lib/stripe-transactions");
    const tags = getStripeEventTags("customer.subscription.updated");
    expect(tags.tagCategory).toBe("subscription");
  });

  it("maps invoice events to invoice tag", async () => {
    const { getStripeEventTags } = await import("@/lib/stripe-transactions");
    const tags = getStripeEventTags("invoice.payment_failed");
    expect(tags.tagCategory).toBe("invoice");
  });

  it("maps unknown events to other tag", async () => {
    const { getStripeEventTags } = await import("@/lib/stripe-transactions");
    const tags = getStripeEventTags("charge.dispute.created");
    expect(tags.tagCategory).toBe("other");
  });

  it("rejects non-https custom dynamodb endpoints", async () => {
    process.env.DYNAMODB_ENDPOINT = "http://internal-dynamo:8000";
    const { resolveDynamoEndpoint } = await import("@/lib/stripe-transactions");
    expect(() => resolveDynamoEndpoint()).toThrow("must use HTTPS");
    delete process.env.DYNAMODB_ENDPOINT;
  });

  it("allows https dynamodb endpoints", async () => {
    process.env.DYNAMODB_ENDPOINT = "https://dynamodb.us-east-1.amazonaws.com";
    const { resolveDynamoEndpoint } = await import("@/lib/stripe-transactions");
    expect(resolveDynamoEndpoint()).toBe("https://dynamodb.us-east-1.amazonaws.com");
    delete process.env.DYNAMODB_ENDPOINT;
  });
});
