import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";
import type { AuthDatabase } from "@/lib/auth-d1";

function makeEvent(id: string): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2024-11-20.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        amount_total: 4900,
        currency: "eur",
        customer: "cus_1",
        customer_email: "a@b.c",
        mode: "payment",
        payment_status: "paid",
        status: "complete",
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

function createMemoryAuthDb(): AuthDatabase & { rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    prepare(query: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return stmt;
        },
        async run() {
          if (query.includes("INSERT INTO stripe_transaction")) {
            const eventId = String(binds[0]);
            if (rows.has(eventId)) {
              throw new Error(
                "D1_ERROR: UNIQUE constraint failed: stripe_transaction.event_id"
              );
            }
            rows.set(eventId, {
              event_id: eventId,
              event_type: binds[1],
              processing_status: binds[7],
              received_at: binds[8],
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (query.includes("UPDATE stripe_transaction")) {
            const eventId = String(binds.at(-1));
            const existing = rows.get(eventId);
            if (existing) {
              existing.processing_status = binds[0];
              existing.processed_at = binds[1];
              if (binds.length >= 4) existing.processing_error = binds[2];
              else existing.processing_error = null;
            }
            return { success: true, meta: { changes: existing ? 1 : 0 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { results: [], success: true };
        },
        async first() {
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("stripe transaction tags", () => {
  const previousStage = process.env.NEXT_PUBLIC_STAGE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STAGE = "production";
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  afterEach(() => {
    if (typeof previousStage === "string") process.env.NEXT_PUBLIC_STAGE = previousStage;
    else delete process.env.NEXT_PUBLIC_STAGE;
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    vi.resetModules();
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

describe("stripe transactions D1 idempotency", () => {
  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    vi.resetModules();
  });

  it("persists via D1 and reports duplicates on UNIQUE", async () => {
    const db = createMemoryAuthDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { persistStripeEvent } = await import("@/lib/stripe-transactions");
    const event = makeEvent("evt_d1_1");
    expect(await persistStripeEvent(event)).toEqual({ duplicate: false });
    expect(await persistStripeEvent(event)).toEqual({ duplicate: true });
    expect(db.rows.get("evt_d1_1")?.processing_status).toBe("received");
  });

  it("marks processed and failed on D1 rows", async () => {
    const db = createMemoryAuthDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const mod = await import("@/lib/stripe-transactions");
    await mod.persistStripeEvent(makeEvent("evt_d1_2"));
    await mod.markStripeEventProcessed("evt_d1_2");
    expect(db.rows.get("evt_d1_2")?.processing_status).toBe("processed");
    await mod.markStripeEventFailed("evt_d1_2", "boom");
    expect(db.rows.get("evt_d1_2")?.processing_status).toBe("handler_failed");
    expect(db.rows.get("evt_d1_2")?.processing_error).toBe("boom");
  });
});
