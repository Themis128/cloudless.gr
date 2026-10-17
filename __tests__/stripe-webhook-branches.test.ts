/**
 * Branch batch for api/webhooks/stripe/route.ts — sparse Stripe payloads and
 * the integration-misconfiguration paths.
 *
 * Stripe omits most optional session/invoice fields (no customer_details on
 * guest checkouts, null amount_total on $0 sessions, no metadata when the
 * click carried no UTM). The webhook must still notify the team with sane
 * fallbacks, only email the customer once payment is collected, and map a
 * missing integration to 503 at every stage instead of a generic 500/400.
 *
 * Fakes only at lib boundaries (Stripe SDK, email, D1 ledger, CRM, Slack,
 * Meta CAPI, analytics); the route's own mapping runs for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

const m = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  getStripe: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  sendPaymentFailureNotice: vi.fn(),
  notifyTeam: vi.fn(),
  getConfig: vi.fn(),
  persist: vi.fn(),
  markProcessed: vi.fn(),
  markFailed: vi.fn(),
  sendPurchaseEvent: vi.fn(),
  upsertContact: vi.fn(),
  createDeal: vi.fn(),
  associate: vi.fn(),
  slackOrderNotify: vi.fn(),
  recordNotification: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ getStripe: m.getStripe }));
vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: m.sendOrderConfirmation,
  sendPaymentFailureNotice: m.sendPaymentFailureNotice,
  notifyTeam: m.notifyTeam,
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig, resetSsmCache: vi.fn() }));
vi.mock("@/lib/stripe-transactions", () => ({
  persistStripeEvent: m.persist,
  markStripeEventProcessed: m.markProcessed,
  markStripeEventFailed: m.markFailed,
}));
vi.mock("@/lib/meta-capi", () => ({ sendPurchaseEvent: m.sendPurchaseEvent }));
vi.mock("@/lib/espocrm", () => ({
  upsertContact: m.upsertContact,
  createDeal: m.createDeal,
  associateDealWithContact: m.associate,
}));
vi.mock("@/lib/slack-notify", () => ({ slackOrderNotify: m.slackOrderNotify }));
vi.mock("@/lib/admin-notifications", () => ({ recordNotification: m.recordNotification }));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: m.track }));

import { POST } from "@/app/api/webhooks/stripe/route";

const req = () =>
  new NextRequest("http://localhost:4000/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "sig_1" },
    body: "{}",
  });

function deliver(type: string, object: Record<string, unknown>, id = "evt_1") {
  m.constructEvent.mockReturnValueOnce({ id, type, data: { object } });
  return POST(req());
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const teamHtml = () => m.notifyTeam.mock.calls[0][1] as string;

beforeEach(() => {
  vi.clearAllMocks();
  m.getConfig.mockResolvedValue({ STRIPE_WEBHOOK_SECRET: "whsec_test" });
  m.getStripe.mockResolvedValue({ webhooks: { constructEvent: m.constructEvent } });
  m.persist.mockResolvedValue({ duplicate: false });
  m.markProcessed.mockResolvedValue(undefined);
  m.markFailed.mockResolvedValue(undefined);
  m.sendOrderConfirmation.mockResolvedValue(undefined);
  m.sendPaymentFailureNotice.mockResolvedValue(undefined);
  m.notifyTeam.mockResolvedValue(undefined);
  m.sendPurchaseEvent.mockResolvedValue({ ok: true });
  m.upsertContact.mockResolvedValue("contact_1");
  m.createDeal.mockResolvedValue("deal_1");
  m.associate.mockResolvedValue(true);
  m.slackOrderNotify.mockResolvedValue(undefined);
  m.track.mockResolvedValue(undefined);
});

describe("checkout.session.completed — sparse sessions", () => {
  it("guest $0 session without email/details/metadata: no customer mail, no CRM, no CAPI", async () => {
    const res = await deliver("checkout.session.completed", {
      id: "cs_bare",
      payment_status: "unpaid",
      mode: "payment",
      amount_total: null,
      currency: null,
      customer_email: null,
      customer_details: null,
      metadata: null,
    });
    await flush();

    expect(res.status).toBe(200);
    expect(m.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(m.upsertContact).not.toHaveBeenCalled();
    expect(m.sendPurchaseEvent).not.toHaveBeenCalled();

    const html = teamHtml();
    expect(html).toContain("<strong>Email:</strong> N/A");
    expect(html).toContain("<strong>Amount:</strong> 0.00 EUR");
    expect(html).not.toContain("Name:");
    expect(html).not.toContain("Phone:");
    expect(html).not.toContain("Campaign:");
    expect(html).not.toContain("Attribution:");

    expect(m.slackOrderNotify).toHaveBeenCalledWith({
      sessionId: "cs_bare",
      email: "N/A",
      name: undefined,
      phone: undefined,
      amount: "€0.00 EUR",
      campaign: undefined,
      tier: undefined,
      attribution: undefined,
    });
    expect(m.recordNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New order: €0.00",
        message: "anonymous completed checkout (cs_bare)",
        actor: undefined,
        metadata: expect.objectContaining({ currency: "EUR", paymentStatus: "unpaid" }),
      })
    );
    expect(m.track).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined, amount: 0, currency: "EUR", source: undefined })
    );
    expect(m.markProcessed).toHaveBeenCalledWith("evt_1");
  });

  it("subscription checkout counts as collected even when payment_status is not 'paid'", async () => {
    await deliver("checkout.session.completed", {
      id: "cs_sub",
      payment_status: "no_payment_required",
      mode: "subscription",
      amount_total: 1500,
      currency: "usd",
      customer_email: "sub@x.io",
      customer_details: { name: "Madonna", phone: null },
      metadata: { campaign: "boost" },
    });
    await flush();

    expect(m.sendOrderConfirmation).toHaveBeenCalledWith("sub@x.io", "cs_sub", 1500, "usd");
    // Single-word name → firstName only, no lastName
    expect(m.sendPurchaseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "purchase_cs_sub",
        firstName: "Madonna",
        lastName: undefined,
        phone: undefined,
        value: 15,
        currency: "USD",
        customData: { content_name: "boost", order_id: "cs_sub" },
      })
    );
    // Campaign without tier → no " · tier" suffix
    expect(teamHtml()).toContain("<strong>Campaign:</strong> boost</p>");
  });

  it("paid session falls back to tier, then 'checkout', for the CAPI content name", async () => {
    await deliver("checkout.session.completed", {
      id: "cs_tier",
      payment_status: "paid",
      mode: "payment",
      amount_total: 900,
      currency: "eur",
      customer_email: null,
      customer_details: { name: "  Ada   Lovelace  King ", phone: "+30 210" },
      metadata: { tier: "pro" },
    });
    await deliver(
      "checkout.session.completed",
      { id: "cs_none", payment_status: "paid", mode: "payment", metadata: {} },
      "evt_2"
    );
    await flush();

    expect(m.sendPurchaseEvent.mock.calls[0][0]).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace King",
      phone: "+30 210",
      customData: { content_name: "pro" },
    });
    expect(m.sendPurchaseEvent.mock.calls[1][0]).toMatchObject({
      firstName: undefined,
      value: 0,
      customData: { content_name: "checkout" },
    });
    // Paid but no email → nobody to confirm to
    expect(m.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it("escapes customer-controlled fields and ignores empty UTM values", async () => {
    await deliver("checkout.session.completed", {
      id: "cs_xss",
      payment_status: "paid",
      mode: "payment",
      amount_total: 100,
      currency: "eur",
      customer_email: "a@b.c",
      customer_details: { name: "<b>Eve</b>", phone: "<img>" },
      metadata: { utm_source: "", utm_medium: "cpc", campaign: "", tier: "" },
    });
    await flush();

    const html = teamHtml();
    expect(html).toContain("<strong>Name:</strong> &lt;b&gt;Eve&lt;/b&gt;");
    expect(html).toContain("<strong>Phone:</strong> &lt;img&gt;");
    expect(html).toContain("<strong>Attribution:</strong> utm_medium=cpc</p>");
    expect(html).not.toContain("utm_source=");
    expect(html).not.toContain("Campaign:");
  });

  it("CRM deal: name split, description without attribution, no association when ids are missing", async () => {
    m.createDeal.mockResolvedValue(null);
    await deliver("checkout.session.completed", {
      id: "cs_crm",
      payment_status: "paid",
      mode: "payment",
      amount_total: null,
      currency: null,
      customer_email: "crm@x.io",
      customer_details: null,
      metadata: null,
    });
    await flush();
    await flush();

    expect(m.upsertContact).toHaveBeenCalledWith({
      email: "crm@x.io",
      firstname: "",
      lastname: "",
      lead_source: "stripe_checkout",
    });
    expect(m.createDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 0,
        currency: "EUR",
        description: "Stripe checkout session cs_crm",
      })
    );
    expect(m.associate).not.toHaveBeenCalled();
  });

  it("swallows Slack and analytics rejections and still returns 200", async () => {
    m.slackOrderNotify.mockRejectedValue(new Error("slack down"));
    m.track.mockRejectedValue(new Error("lake down"));
    const res = await deliver("checkout.session.completed", {
      id: "cs_fail",
      payment_status: "unpaid",
      mode: "payment",
    });
    await flush();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });
});

describe("invoice.payment_failed — sparse invoices", () => {
  it("no customer, email, id, amount or currency → 'unknown' / 0.00 EUR, no customer mail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await deliver("invoice.payment_failed", {
      id: null,
      customer: null,
      customer_email: null,
      amount_due: null,
      currency: null,
    });
    expect(res.status).toBe(200);
    expect(m.sendPaymentFailureNotice).not.toHaveBeenCalled();
    const html = teamHtml();
    expect(html).toContain("<strong>Invoice:</strong> unknown");
    expect(html).toContain("<strong>Customer:</strong> unknown");
    expect(html).toContain("<strong>Amount:</strong> 0.00 EUR");
    vi.restoreAllMocks();
  });

  it("string customer id is shown when there is no email; mails 'unknown' invoice id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await deliver("invoice.payment_failed", {
      id: null,
      customer: "cus_123",
      customer_email: null,
      amount_due: 2500,
      currency: "usd",
    });
    expect(teamHtml()).toContain("<strong>Customer:</strong> cus_123");
    expect(teamHtml()).toContain("<strong>Amount:</strong> 25.00 USD");

    m.notifyTeam.mockClear();
    await deliver(
      "invoice.payment_failed",
      { id: null, customer: "cus_123", customer_email: "c@x.io" },
      "evt_2"
    );
    expect(m.sendPaymentFailureNotice).toHaveBeenCalledWith("c@x.io", "unknown");
    vi.restoreAllMocks();
  });
});

describe("integration misconfiguration → 503 at every stage", () => {
  const notConfigured = () => new IntegrationNotConfiguredError(["STRIPE_SECRET_KEY"]);

  it("503 when getStripe() returns null", async () => {
    m.getStripe.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Stripe not configured" });
  });

  it("503 when the Stripe client throws IntegrationNotConfiguredError", async () => {
    m.getStripe.mockRejectedValue(notConfigured());
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ reason: "integration_not_configured" });
  });

  it("400 'Invalid signature' when constructEvent throws a non-Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.constructEvent.mockImplementationOnce(() => {
      throw "bad sig";
    });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(console.error).toHaveBeenCalledWith(
      "Webhook signature verification failed: Unknown error"
    );
    vi.restoreAllMocks();
  });

  it("503 when the D1 ledger is not configured (event not processed)", async () => {
    m.persist.mockRejectedValue(notConfigured());
    const res = await deliver("invoice.payment_succeeded", { id: "in_1", amount_paid: 1 });
    expect(res.status).toBe(503);
    expect(m.markProcessed).not.toHaveBeenCalled();
  });

  it("503 when a handler hits a missing integration, without marking the event failed", async () => {
    m.notifyTeam.mockRejectedValue(notConfigured());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await deliver("customer.subscription.deleted", { id: "sub_1", status: "canceled" });
    expect(res.status).toBe(503);
    expect(m.markFailed).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("marks the event failed with a generic message when a handler throws a non-Error", async () => {
    m.notifyTeam.mockRejectedValue("smtp string error");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await deliver("customer.subscription.created", { id: "sub_2", status: "active" });
    expect(res.status).toBe(500);
    expect(m.markFailed).toHaveBeenCalledWith("evt_1", "Unknown handler error");
    vi.restoreAllMocks();
  });
});
