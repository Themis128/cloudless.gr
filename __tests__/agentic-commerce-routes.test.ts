/**
 * Route-level tests for the ACP + UCP agentic-commerce endpoints.
 * Stripe SDK is the only stubbed boundary (lib seam) — routes exercise the
 * real mapping code and the default catalog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const sessions = {
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
};
const getStripe = vi.fn(async () => ({ checkout: { sessions } }));
const listStripeProducts = vi.fn(async () => null);

vi.mock("@/lib/stripe", () => ({
  getStripe: (...args: unknown[]) => getStripe(...args),
  listStripeProducts: (...args: unknown[]) => listStripeProducts(...args),
}));

import { POST as acpCreate } from "@/app/api/acp/checkout_sessions/route";
import { GET as acpGet } from "@/app/api/acp/checkout_sessions/[id]/route";
import { POST as acpCancel } from "@/app/api/acp/checkout_sessions/[id]/cancel/route";
import { POST as acpComplete } from "@/app/api/acp/checkout_sessions/[id]/complete/route";
import { GET as acpDiscovery } from "@/app/api/.well-known/acp.json/route";
import { GET as botAuthJwks } from "@/app/api/.well-known/http-message-signatures-directory/route";
import { GET as ucpProfile } from "@/app/api/.well-known/ucp/route";
import { POST as ucpSearch } from "@/app/api/ucp/catalog/search/route";
import { POST as ucpLookup } from "@/app/api/ucp/catalog/lookup/route";
import { POST as ucpGetProduct } from "@/app/api/ucp/catalog/product/route";
import { POST as ucpCreate } from "@/app/api/ucp/checkout-sessions/route";
import { GET as ucpGet } from "@/app/api/ucp/checkout-sessions/[id]/route";
import { POST as ucpCancel } from "@/app/api/ucp/checkout-sessions/[id]/cancel/route";
import { POST as ucpComplete } from "@/app/api/ucp/checkout-sessions/[id]/complete/route";

const OPEN_SESSION = {
  id: "cs_test_1",
  status: "open",
  payment_status: "unpaid",
  currency: "eur",
  url: "https://checkout.stripe.com/pay/cs_test_1",
  created: 1_760_000_000,
  expires_at: 1_760_086_400,
  metadata: { acp_items: '[{"id":"srv-cloud","quantity":1}]' },
};

function req(url: string, body?: unknown) {
  return new NextRequest(`https://cloudless.gr${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getStripe.mockResolvedValue({ checkout: { sessions } } as never);
});

describe("ACP discovery + checkout_sessions", () => {
  it("serves the acp.json discovery document", async () => {
    const res = await acpDiscovery();
    const doc = await res.json();
    expect(res.status).toBe(200);
    expect(doc.protocol.name).toBe("acp");
    expect(doc.api_base_url).toBe("https://cloudless.gr/api/acp");
    expect(doc.capabilities.services).toContain("checkout");
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
  });

  it("creates a session backed by a real Stripe checkout", async () => {
    sessions.create.mockResolvedValue(OPEN_SESSION);
    const res = await acpCreate(
      req("/api/acp/checkout_sessions", {
        line_items: [{ id: "srv-cloud", quantity: 2 }],
        currency: "eur",
        buyer: { email: "a@b.c" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("cs_test_1");
    expect(body.status).toBe("ready_for_payment");
    expect(body.continue_url).toContain("checkout.stripe.com");
    expect(sessions.create).toHaveBeenCalledOnce();
    const [args] = sessions.create.mock.calls[0];
    expect(args.customer_email).toBe("a@b.c");
    expect(args.line_items).toHaveLength(1);
  });

  it("accepts the items fallback spelling and echoes idempotency key", async () => {
    sessions.create.mockResolvedValue(OPEN_SESSION);
    const r = req("/api/acp/checkout_sessions", {
      items: [{ id: "srv-cloud" }],
    });
    r.headers.set("Idempotency-Key", "idem-12345678");
    const res = await acpCreate(r);
    expect(res.status).toBe(201);
    expect(res.headers.get("Idempotency-Key")).toBe("idem-12345678");
  });

  it("rejects malformed bodies, empty items, bad currency, unknown items", async () => {
    expect(
      (
        await acpCreate(
          new NextRequest("https://cloudless.gr/api/acp/checkout_sessions", {
            method: "POST",
            body: "not json{",
          })
        )
      ).status
    ).toBe(400);
    expect((await acpCreate(req("/api/acp/checkout_sessions", {}))).status).toBe(400);
    expect(
      (
        await acpCreate(
          req("/api/acp/checkout_sessions", {
            line_items: [{ id: "srv-cloud" }],
            currency: "usd",
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await acpCreate(
          req("/api/acp/checkout_sessions", {
            line_items: [{ id: "nope" }],
          })
        )
      ).status
    ).toBe(400);
  });

  it("returns 500 when the Stripe create call fails", async () => {
    sessions.create.mockRejectedValue(new Error("stripe down"));
    const res = await acpCreate(
      req("/api/acp/checkout_sessions", {
        line_items: [{ id: "srv-cloud" }],
      })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).type).toBe("processing_error");
  });

  it("returns 503 when Stripe is not configured", async () => {
    getStripe.mockResolvedValue(null as never);
    const res = await acpCreate(
      req("/api/acp/checkout_sessions", {
        line_items: [{ id: "srv-cloud" }],
      })
    );
    expect(res.status).toBe(503);
    const get = await acpGet(req("/x"), params("cs_x"));
    expect(get.status).toBe(503);
  });

  it("retrieves a session and maps Stripe status", async () => {
    sessions.retrieve.mockResolvedValue(OPEN_SESSION);
    const res = await acpGet(req("/x"), params("cs_test_1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready_for_payment");
    expect(body.line_items[0].product_id).toBe("srv-cloud");

    sessions.retrieve.mockRejectedValue(new Error("no such"));
    expect((await acpGet(req("/x"), params("cs_missing"))).status).toBe(404);
  });

  it("cancels by expiring the Stripe session and reports canceled", async () => {
    sessions.expire.mockResolvedValue({ ...OPEN_SESSION, status: "expired" });
    const res = await acpCancel(req("/x"), params("cs_test_1"));
    const body = await res.json();
    expect(body.status).toBe("canceled");

    sessions.expire.mockRejectedValue(new Error("done"));
    expect((await acpCancel(req("/x"), params("cs_x"))).status).toBe(400);
  });

  it("complete returns the order when paid, explains hosted flow otherwise", async () => {
    sessions.retrieve.mockResolvedValue({
      ...OPEN_SESSION,
      status: "complete",
      payment_status: "paid",
    });
    const done = await acpComplete(req("/x"), params("cs_test_1"));
    const body = await done.json();
    expect(body.status).toBe("completed");
    expect(body.order.id).toBe("cs_test_1");

    sessions.retrieve.mockResolvedValue(OPEN_SESSION);
    const hosted = await acpComplete(req("/x"), params("cs_test_1"));
    expect(hosted.status).toBe(400);
    expect((await hosted.json()).code).toBe("hosted_payment_required");

    sessions.retrieve.mockResolvedValue({ ...OPEN_SESSION, status: "expired" });
    expect((await acpComplete(req("/x"), params("cs_test_1"))).status).toBe(400);

    sessions.retrieve.mockRejectedValue(new Error("gone"));
    expect((await acpComplete(req("/x"), params("cs_x"))).status).toBe(404);
  });
});

describe("UCP profile + catalog + checkout", () => {
  it("serves the ucp business profile", async () => {
    const res = await ucpProfile();
    const doc = await res.json();
    expect(doc.ucp.services["dev.ucp.shopping"][0].endpoint).toBe("https://cloudless.gr/api/ucp");
    expect(doc.ucp.capabilities["dev.ucp.shopping.checkout"]).toBeTruthy();
  });

  it("catalog search returns products with ucp envelope", async () => {
    const res = await ucpSearch(req("/api/ucp/catalog/search", { query: "serverless" }));
    const body = await res.json();
    expect(body.ucp.version).toBe("2026-04-08");
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products[0].price_range.min.currency).toBe("EUR");
  });

  it("catalog search tolerates an empty body", async () => {
    const res = await ucpSearch(
      new NextRequest("https://cloudless.gr/api/ucp/catalog/search", {
        method: "POST",
        body: "{{{",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);
  });

  it("catalog lookup resolves ids and reports misses", async () => {
    const res = await ucpLookup(req("/api/ucp/catalog/lookup", { ids: ["srv-cloud", "nope"] }));
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.messages[0].content).toContain("nope");

    expect((await ucpLookup(req("/api/ucp/catalog/lookup", { ids: [] }))).status).toBe(400);
    expect(
      (
        await ucpLookup(
          new NextRequest("https://cloudless.gr/api/ucp/catalog/lookup", {
            method: "POST",
            body: "x{",
          })
        )
      ).status
    ).toBe(400);
  });

  it("catalog product returns one product or 404", async () => {
    const ok = await ucpGetProduct(req("/api/ucp/catalog/product", { id: "dig-cloud-playbook" }));
    expect((await ok.json()).product.title).toBe("Cloud Migration Playbook");
    expect((await ucpGetProduct(req("/api/ucp/catalog/product", { id: "nope" }))).status).toBe(404);
    expect(
      (
        await ucpGetProduct(
          new NextRequest("https://cloudless.gr/api/ucp/catalog/product", {
            method: "POST",
            body: "x{",
          })
        )
      ).status
    ).toBe(400);
  });

  it("creates a UCP checkout session from line_items", async () => {
    sessions.create.mockResolvedValue(OPEN_SESSION);
    const res = await ucpCreate(
      req("/api/ucp/checkout-sessions", {
        line_items: [{ item: { id: "srv-cloud" }, quantity: 1 }],
        buyer: { email: "a@b.c" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("ready_for_complete");
    expect(body.ucp.payment_handlers).toBeDefined();
  });

  it("rejects UCP creates with bad json or no items", async () => {
    expect(
      (
        await ucpCreate(
          new NextRequest("https://cloudless.gr/api/ucp/checkout-sessions", {
            method: "POST",
            body: "x{",
          })
        )
      ).status
    ).toBe(400);
    expect((await ucpCreate(req("/api/ucp/checkout-sessions", { line_items: [] }))).status).toBe(
      400
    );
    expect(
      (
        await ucpCreate(
          req("/api/ucp/checkout-sessions", {
            line_items: [{ item: { id: "nope" } }],
          })
        )
      ).status
    ).toBe(400);

    sessions.create.mockRejectedValue(new Error("stripe down"));
    expect(
      (
        await ucpCreate(
          req("/api/ucp/checkout-sessions", {
            line_items: [{ item: { id: "srv-cloud" } }],
          })
        )
      ).status
    ).toBe(500);

    getStripe.mockResolvedValue(null as never);
    expect(
      (
        await ucpCreate(
          req("/api/ucp/checkout-sessions", {
            line_items: [{ item: { id: "srv-cloud" } }],
          })
        )
      ).status
    ).toBe(503);
  });

  it("gets, cancels and completes UCP sessions", async () => {
    sessions.retrieve.mockResolvedValue(OPEN_SESSION);
    expect((await ucpGet(req("/x"), params("cs_test_1"))).status).toBe(200);
    sessions.retrieve.mockRejectedValue(new Error("no"));
    expect((await ucpGet(req("/x"), params("cs_x"))).status).toBe(404);

    sessions.expire.mockResolvedValue({ ...OPEN_SESSION, status: "expired" });
    expect((await ucpCancel(req("/x"), params("cs_test_1"))).status).toBe(200);
    sessions.expire.mockRejectedValue(new Error("no"));
    expect((await ucpCancel(req("/x"), params("cs_x"))).status).toBe(400);

    sessions.retrieve.mockResolvedValue({
      ...OPEN_SESSION,
      status: "complete",
      payment_status: "paid",
    });
    expect((await ucpComplete(req("/x"), params("cs_test_1"))).status).toBe(200);
    sessions.retrieve.mockResolvedValue(OPEN_SESSION);
    expect((await ucpComplete(req("/x"), params("cs_test_1"))).status).toBe(400);
    sessions.retrieve.mockResolvedValue({ ...OPEN_SESSION, status: "expired" });
    expect((await ucpComplete(req("/x"), params("cs_test_1"))).status).toBe(400);
    sessions.retrieve.mockRejectedValue(new Error("no"));
    expect((await ucpComplete(req("/x"), params("cs_x"))).status).toBe(404);

    getStripe.mockResolvedValue(null as never);
    expect((await ucpGet(req("/x"), params("cs_x"))).status).toBe(503);
    expect((await ucpCancel(req("/x"), params("cs_x"))).status).toBe(503);
    expect((await ucpComplete(req("/x"), params("cs_x"))).status).toBe(503);
  });
});

describe("Web Bot Auth JWKS", () => {
  it("serves the Ed25519 verification key", async () => {
    const res = await botAuthJwks();
    const doc = await res.json();
    expect(res.status).toBe(200);
    expect(doc.keys).toHaveLength(1);
    expect(doc.keys[0].kty).toBe("OKP");
    expect(doc.keys[0].crv).toBe("Ed25519");
    expect(doc.keys[0].kid).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
  });
});
