/**
 * Tests for src/lib/agentic-commerce.ts — ACP/UCP wire mapping over the real
 * catalog and Stripe Checkout Sessions. Only the Stripe boundary is stubbed
 * (listStripeProducts → null forces the default catalog; getStripe is not
 * reached by the pure mapping functions).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const listStripeProducts = vi.fn();
vi.mock("@/lib/stripe", () => ({
  listStripeProducts: (...args: unknown[]) => listStripeProducts(...args),
  getStripe: vi.fn(async () => null),
}));

import type Stripe from "stripe";
import {
  ACP_VERSION,
  UCP_VERSION,
  UnknownItemError,
  acpSessionFromStripe,
  resolveLineItems,
  searchCatalog,
  ucpCheckoutFromStripe,
  ucpProduct,
} from "@/lib/agentic-commerce";
import { defaultProducts } from "@/lib/store-products";

function stripeSession(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    status: "open",
    payment_status: "unpaid",
    currency: "eur",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
    created: 1_760_000_000,
    expires_at: 1_760_086_400,
    metadata: {},
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

describe("agentic-commerce", () => {
  beforeEach(() => {
    vi.resetModules();
    listStripeProducts.mockReset();
    listStripeProducts.mockResolvedValue(null);
  });

  it("resolveLineItems maps catalog ids and clamps quantity", async () => {
    const items = await resolveLineItems([
      { id: "dig-cloud-playbook", quantity: 3 },
      { id: "phy-tshirt" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].product.name).toBe("Cloud Migration Playbook");
    expect(items[0].quantity).toBe(3);
    expect(items[1].quantity).toBe(1);
  });

  it("resolveLineItems rejects unknown ids", async () => {
    await expect(
      resolveLineItems([{ id: "nope-404", quantity: 1 }]),
    ).rejects.toBeInstanceOf(UnknownItemError);
  });

  it("searchCatalog matches free text and category filter", async () => {
    expect((await searchCatalog("")).length).toBe(defaultProducts.length);
    const found = await searchCatalog("serverless");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => /serverless/i.test(p.name + p.description))).toBe(
      true,
    );
    const physical = await searchCatalog("", "physical");
    expect(physical.every((p) => p.category === "physical")).toBe(true);
  });

  it("acpSessionFromStripe emits a spec-shaped session with continue_url", async () => {
    const resolved = await resolveLineItems([
      { id: "srv-cloud", quantity: 1 },
    ]);
    const body = acpSessionFromStripe(stripeSession(), resolved) as Record<
      string,
      unknown
    >;
    expect(body.id).toBe("cs_test_123");
    expect(body.status).toBe("ready_for_payment");
    expect(body.currency).toBe("eur");
    expect(body.continue_url).toContain("checkout.stripe.com");
    expect((body.protocol as { version: string }).version).toBe(ACP_VERSION);
    const lineItems = body.line_items as Array<Record<string, unknown>>;
    expect(lineItems[0].product_id).toBe("srv-cloud");
    const totals = body.totals as Array<{ type: string; amount: number }>;
    expect(totals.find((t) => t.type === "total")?.amount).toBe(200000);
  });

  it("acpSessionFromStripe marks paid sessions completed with an order", async () => {
    const resolved = await resolveLineItems([
      { id: "srv-cloud", quantity: 1 },
    ]);
    const body = acpSessionFromStripe(
      stripeSession({ status: "complete", payment_status: "paid" }),
      resolved,
    ) as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(body.order).toBeTruthy();
  });

  it("acpSessionFromStripe maps expired sessions", async () => {
    const resolved = await resolveLineItems([
      { id: "srv-cloud", quantity: 1 },
    ]);
    const body = acpSessionFromStripe(
      stripeSession({ status: "expired" }),
      resolved,
    ) as Record<string, unknown>;
    expect(body.status).toBe("expired");
  });

  it("ucpProduct emits a spec-shaped product", () => {
    const p = ucpProduct(defaultProducts[0]);
    expect(p.id).toBe("srv-cloud");
    expect(p.title).toBe("Cloud Architecture Audit");
    expect(p.price_range.min.amount).toBe(200000);
    expect(p.price_range.min.currency).toBe("EUR");
    expect(p.variants[0].availability.available).toBe(true);
    expect(p.media[0].url).toContain("cloudless.gr");
  });

  it("ucpCheckoutFromStripe maps statuses and envelope", async () => {
    const resolved = await resolveLineItems([
      { id: "dig-cloud-playbook", quantity: 2 },
    ]);
    const open = ucpCheckoutFromStripe(stripeSession(), resolved);
    expect(open.ucp.version).toBe(UCP_VERSION);
    expect(open.status).toBe("ready_for_complete");
    expect(open.line_items[0].totals[0].amount).toBe(9800);
    expect(
      (open.totals as Array<{ type: string; amount: number }>).find(
        (t) => t.type === "total",
      )?.amount,
    ).toBe(9800);
    expect(open.continue_url).toContain("checkout.stripe.com");

    const paid = ucpCheckoutFromStripe(
      stripeSession({ status: "complete", payment_status: "paid" }),
      resolved,
    );
    expect(paid.status).toBe("completed");

    const dead = ucpCheckoutFromStripe(
      stripeSession({ status: "expired" }),
      resolved,
    );
    expect(dead.status).toBe("canceled");
  });
});
