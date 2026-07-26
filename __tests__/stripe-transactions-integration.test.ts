import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";
const TABLE = process.env.STRIPE_TRANSACTIONS_TABLE ?? "cloudless-test-StripeTransactions";

async function dynamoUp(): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}/_localstack/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function setEnv() {
  vi.stubEnv("DYNAMODB_ENDPOINT", ENDPOINT);
  vi.stubEnv("STRIPE_TRANSACTIONS_TABLE", TABLE);
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "test");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test");
}

function makeEvent(id: string, type = "checkout.session.completed"): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2024-11-20.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
    data: {
      object: {
        id: "cs_" + id,
        object: "checkout.session",
        amount_total: 9900,
        currency: "eur",
        customer: "cus_" + id,
        customer_email: "buyer@cloudless.test",
        mode: "payment",
        payment_status: "paid",
      },
    },
  } as unknown as Stripe.Event;
}

let skipAll = false;
beforeAll(async () => {
  skipAll = !(await dynamoUp());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("stripe-transactions integration", () => {
  it("persistStripeEvent stores new event", async ({ skip }) => {
    if (skipAll) return skip();
    setEnv();
    vi.resetModules();
    const { persistStripeEvent } = await import("@/lib/stripe-transactions");
    const id = "evt_new_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const r = await persistStripeEvent(makeEvent(id));
    expect(r.duplicate).toBe(false);
  });

  it("persistStripeEvent returns duplicate on re-write", async ({ skip }) => {
    if (skipAll) return skip();
    setEnv();
    vi.resetModules();
    const { persistStripeEvent } = await import("@/lib/stripe-transactions");
    const id = "evt_dup_" + Date.now();
    const ev = makeEvent(id);
    const a = await persistStripeEvent(ev);
    const b = await persistStripeEvent(ev);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });
});
