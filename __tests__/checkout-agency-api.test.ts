import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getStripeMock = vi.fn();
const getConfigMock = vi.fn();
const rateLimitMock = vi.fn();
const sessionsCreateMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: getStripeMock,
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  getClientIp: () => "1.2.3.4",
}));

import { POST } from "@/app/api/checkout/agency/route";

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://cloudless.gr/api/checkout/agency", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

const AUTH = { "x-socialauto-webhook-secret": "s3cret" };

describe("POST /api/checkout/agency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockReturnValue({ ok: true });
    getConfigMock.mockResolvedValue({ SOCIALAUTO_LEADS_WEBHOOK_SECRET: "s3cret" });
    getStripeMock.mockResolvedValue({ checkout: { sessions: { create: sessionsCreateMock } } });
    sessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.com/pay/x", id: "cs_1" });
  });

  it("503 when the shared secret is not configured", async () => {
    getConfigMock.mockResolvedValue({});
    const r = await POST(req({}, AUTH));
    expect(r.status).toBe(503);
  });

  it("401 without or with the wrong secret", async () => {
    expect((await POST(req({}))).status).toBe(401);
    const r = await POST(req({}, { "x-socialauto-webhook-secret": "nope" }));
    expect(r.status).toBe(401);
  });

  it("401 also covers Bearer auth", async () => {
    const r = await POST(req({}, { authorization: "Bearer wrong" }));
    expect(r.status).toBe(401);
    const ok = await POST(req({ amount_eur: 10 }, { authorization: "Bearer s3cret" }));
    expect(ok.status).toBe(200);
  });

  it("429s when rate-limited", async () => {
    rateLimitMock.mockReturnValue({ ok: false, response: new Response("rl", { status: 429 }) });
    const r = await POST(req({}, AUTH));
    expect(r.status).toBe(429);
  });

  it("503 when Stripe is not configured", async () => {
    getStripeMock.mockResolvedValue(null);
    const r = await POST(req({}, AUTH));
    expect(r.status).toBe(503);
  });

  it("400 on invalid JSON and non-object bodies", async () => {
    expect((await POST(req("not json{{{", AUTH))).status).toBe(400);
    expect((await POST(req("42", AUTH))).status).toBe(400);
    expect((await POST(req("[1,2]", AUTH))).status).toBe(400);
  });

  it("400 on missing/out-of-range amount_eur", async () => {
    expect((await POST(req({}, AUTH))).status).toBe(400);
    expect((await POST(req({ amount_eur: 0 }, AUTH))).status).toBe(400);
    expect((await POST(req({ amount_eur: 200_000 }, AUTH))).status).toBe(400);
    expect((await POST(req({ amount_eur: "abc" }, AUTH))).status).toBe(400);
  });

  it("400 on malformed client_email", async () => {
    const r = await POST(req({ amount_eur: 10, client_email: "not-an-email" }, AUTH));
    expect(r.status).toBe(400);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("200 — mints a Stripe session for a valid request", async () => {
    const r = await POST(
      req(
        {
          amount_eur: 800,
          description: "14-day engagement",
          client_email: "buyer@acme.example",
          client_name: "Acme",
          proposal_id: "p-42",
        },
        AUTH
      )
    );
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.url).toBe("https://checkout.stripe.com/pay/x");
    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.mode).toBe("payment");
    expect(call.line_items[0].price_data.unit_amount).toBe(80_000);
    expect(call.customer_email).toBe("buyer@acme.example");
    expect(call.metadata.source).toBe("agency_proposal");
    expect(call.client_reference_id).toBe("p-42");
  });

  it("200 — works without optional fields", async () => {
    const r = await POST(req({ amount_eur: 100 }, AUTH));
    expect(r.status).toBe(200);
    const call = sessionsCreateMock.mock.calls[0][0];
    expect(call.customer_email).toBeUndefined();
    expect(call.client_reference_id).toBeUndefined();
  });
});
