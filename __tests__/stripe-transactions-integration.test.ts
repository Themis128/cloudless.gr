/**
 * D1-backed integration-style tests for stripe-transactions.
 * Uses an in-memory AUTH_DB stub (no LocalStack / Dynamo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { AuthDatabase } from "@/lib/auth-d1";

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
              throw new Error("UNIQUE constraint failed: stripe_transaction.event_id");
            }
            rows.set(eventId, { event_id: eventId, processing_status: binds[7] });
            return { success: true, meta: { changes: 1 } };
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

beforeEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  vi.resetModules();
});

describe("stripe-transactions integration (D1)", () => {
  it("persistStripeEvent stores new event", async () => {
    const db = createMemoryAuthDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { persistStripeEvent } = await import("@/lib/stripe-transactions");
    const id = "evt_new_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const r = await persistStripeEvent(makeEvent(id));
    expect(r.duplicate).toBe(false);
    expect(db.rows.has(id)).toBe(true);
  });

  it("persistStripeEvent returns duplicate on re-write", async () => {
    const db = createMemoryAuthDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { persistStripeEvent } = await import("@/lib/stripe-transactions");
    const id = "evt_dup_" + Date.now();
    const ev = makeEvent(id);
    const a = await persistStripeEvent(ev);
    const b = await persistStripeEvent(ev);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });
});
