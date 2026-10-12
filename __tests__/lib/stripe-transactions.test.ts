import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getStripeEventTags,
  persistStripeEvent,
  markStripeEventProcessed,
  markStripeEventFailed,
} from "@/lib/stripe-transactions";

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

describe("persistStripeEvent tails", () => {
  interface BoundRun {
    bindArgs: unknown[];
    run: () => Promise<unknown>;
  }
  const runs: BoundRun[] = [];
  const db = {
    prepare: vi.fn(() => {
      const stmt: BoundRun = { bindArgs: [], run: async () => ({ success: true }) };
      const bound = {
        bind: (...args: unknown[]) => {
          stmt.bindArgs = args;
          return stmt;
        },
      };
      runs.push(stmt);
      return bound;
    }),
  };

  const baseEvent = (overrides: Record<string, unknown> = {}) =>
    ({
      id: "evt_1",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      data: {
        object: {
          id: "cs_test_1",
          customer: "cus_1",
          customer_email: "buyer@example.com",
          amount_total: 4900,
          currency: "eur",
          mode: "payment",
          payment_status: "paid",
          ...overrides,
        },
      },
    }) as unknown as Parameters<typeof persistStripeEvent>[0];

  afterEach(() => {
    runs.length = 0;
    db.prepare.mockClear();
    const g = globalThis as Record<string, unknown>;
    delete g.__AUTH_DB__;
    delete g.__DATALAKE_BUCKET__;
  });

  it("persists a Stripe event into stripe_transaction", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    const result = await persistStripeEvent(baseEvent());
    expect(result).toEqual({ duplicate: false });
    expect(runs[0].bindArgs[0]).toBe("evt_1");
    expect(runs[0].bindArgs[1]).toBe("checkout.session.completed");
    expect(runs[0].bindArgs[6]).toBe("cus_1");
    expect(runs[0].bindArgs[9]).toBe(4900);
  });

  it("reports duplicate:true on a UNIQUE constraint violation", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    db.prepare.mockImplementationOnce(() => ({
      bind: () => ({ run: async () => Promise.reject(new Error("UNIQUE constraint failed")) }),
    }));
    const result = await persistStripeEvent(baseEvent());
    expect(result).toEqual({ duplicate: true });
  });

  it("rethrows non-constraint database errors", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    db.prepare.mockImplementationOnce(() => ({
      bind: () => ({ run: async () => Promise.reject(new Error("disk I/O error")) }),
    }));
    await expect(persistStripeEvent(baseEvent())).rejects.toThrow("disk I/O error");
  });

  it("stores \"{}\" when the event payload is not serializable", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    const circular: Record<string, unknown> = { id: "cs_test_c" };
    circular.self = circular;
    await persistStripeEvent({
      id: "evt_c",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      data: { object: circular },
    } as unknown as Parameters<typeof persistStripeEvent>[0]);
    expect(runs[0].bindArgs[11]).toBe("{}");
  });

  it("sinks the event to the data lake bucket when DATALAKE_BUCKET is bound", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    const put = vi.fn(async () => undefined);
    (globalThis as Record<string, unknown>).__DATALAKE_BUCKET__ = { put };
    await persistStripeEvent(baseEvent());
    await new Promise((r) => setTimeout(r, 0));
    expect(put).toHaveBeenCalledOnce();
    const [key, record, meta] = put.mock.calls[0] as [string, string, { httpMetadata: { contentType: string } }];
    expect(key).toMatch(/^events\/year=2023\/month=11\/day=14\/stripe_evt_1\.ndjson$/);
    const parsed = JSON.parse(record);
    expect(parsed.event).toBe("checkout.session.completed");
    expect(parsed.user_id).toBe("cus_1");
    expect(parsed.email).toBe("buyer@example.com");
    expect(parsed.amount).toBe(4900);
    expect(parsed.source).toBe("stripe_webhook");
    expect(meta.httpMetadata.contentType).toBe("application/x-ndjson");
  });

  it("markStripeEventProcessed clears the error column", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    await markStripeEventProcessed("evt_1");
    expect(runs[0].bindArgs).toEqual(["processed", expect.any(Number), "evt_1"]);
  });

  it("markStripeEventFailed records a truncated error message", async () => {
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    const longError = "x".repeat(1500);
    await markStripeEventFailed("evt_1", longError);
    expect(runs[0].bindArgs[0]).toBe("handler_failed");
    expect((runs[0].bindArgs[2] as string).length).toBe(1000);
  });
});
