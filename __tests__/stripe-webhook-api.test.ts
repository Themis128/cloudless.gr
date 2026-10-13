import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const constructEventMock = vi.fn();
const getStripeMock = vi.fn();
const sendOrderConfirmationMock = vi.fn();
const sendPaymentFailureNoticeMock = vi.fn();
const notifyTeamMock = vi.fn();
const getConfigMock = vi.fn();
const persistStripeEventMock = vi.fn();
const markStripeEventProcessedMock = vi.fn();
const markStripeEventFailedMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: getStripeMock,
}));

vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: sendOrderConfirmationMock,
  sendPaymentFailureNotice: sendPaymentFailureNoticeMock,
  notifyTeam: notifyTeamMock,
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
}));

vi.mock("@/lib/stripe-transactions", () => ({
  persistStripeEvent: persistStripeEventMock,
  markStripeEventProcessed: markStripeEventProcessedMock,
  markStripeEventFailed: markStripeEventFailedMock,
}));

vi.mock("@/lib/meta-capi", () => ({
  sendPurchaseEvent: vi.fn(async () => ({ ok: true, eventsReceived: 1 })),
}));

vi.mock("@/lib/espocrm", () => ({
  upsertContact: vi.fn(async () => "contact_1"),
  createDeal: vi.fn(async () => "deal_1"),
  associateDealWithContact: vi.fn(async () => true),
}));

vi.mock("@/lib/slack-notify", () => ({
  slackOrderNotify: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: vi.fn(),
}));

function makeRequest(body: string, signature?: string) {
  return new NextRequest("http://localhost:4000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body,
  });
}

const DEFAULT_CONFIG = { STRIPE_WEBHOOK_SECRET: "test_webhook_secret" };

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getConfigMock.mockResolvedValue(DEFAULT_CONFIG);
    getStripeMock.mockResolvedValue({
      webhooks: {
        constructEvent: constructEventMock,
      },
    });
    persistStripeEventMock.mockResolvedValue({ duplicate: false });
    markStripeEventProcessedMock.mockResolvedValue(undefined);
    markStripeEventFailedMock.mockResolvedValue(undefined);
    sendOrderConfirmationMock.mockResolvedValue(undefined);
    sendPaymentFailureNoticeMock.mockResolvedValue(undefined);
    notifyTeamMock.mockResolvedValue(undefined);
  });

  it("returns 400 when stripe signature header is missing", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("stripe-signature");
  });

  it("returns 401 when webhook secret is not configured", async () => {
    getConfigMock.mockResolvedValueOnce({ STRIPE_WEBHOOK_SECRET: "" });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Webhook not configured");
  });

  it("returns 400 for invalid signature", async () => {
    constructEventMock.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid signature");
  });

  it("writes event to analytics ledger and marks processed on success", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "checkout.session.completed",
      id: "evt_test_1",
      data: {
        object: {
          id: "cs_test_1",
          customer_email: "buyer@cloudless.gr",
          amount_total: 129900,
          currency: "eur",
          payment_status: "paid",
          mode: "payment",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(persistStripeEventMock).toHaveBeenCalledTimes(1);
    expect(markStripeEventProcessedMock).toHaveBeenCalledWith("evt_test_1");
    expect(sendOrderConfirmationMock).toHaveBeenCalledWith(
      "buyer@cloudless.gr",
      "cs_test_1",
      129900,
      "eur"
    );
  });

  it("ignores duplicate webhook events from db dedupe", async () => {
    const eventPayload = {
      type: "checkout.session.completed",
      id: "evt_duplicate_1",
      data: {
        object: {
          id: "cs_dup_1",
          customer_email: "buyer@cloudless.gr",
          amount_total: 129900,
          currency: "eur",
          payment_status: "paid",
          mode: "payment",
        },
      },
    };

    constructEventMock.mockReturnValueOnce(eventPayload);
    persistStripeEventMock.mockResolvedValueOnce({ duplicate: true });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.duplicate).toBe(true);
    expect(sendOrderConfirmationMock).not.toHaveBeenCalled();
    expect(markStripeEventProcessedMock).not.toHaveBeenCalled();
  });

  it("returns 500 when transaction persistence fails", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "checkout.session.completed",
      id: "evt_persist_fail",
      data: { object: { id: "cs_1" } },
    });
    persistStripeEventMock.mockRejectedValueOnce(new Error("ddb unavailable"));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Transaction persistence failed");
  });

  it("marks event failed when downstream handler throws", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "customer.subscription.created",
      id: "evt_handler_fail",
      data: {
        object: {
          id: "sub_1",
          status: "active",
        },
      },
    });
    notifyTeamMock.mockRejectedValueOnce(new Error("mail down"));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Webhook handler failed");
    expect(markStripeEventFailedMock).toHaveBeenCalledWith("evt_handler_fail", "mail down");
  });

  it("handles invoice.payment_failed and sends customer/team notifications", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "invoice.payment_failed",
      id: "evt_invoice_failed",
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_123",
          customer_email: "buyer@cloudless.gr",
          amount_due: 4900,
          currency: "eur",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(sendPaymentFailureNoticeMock).toHaveBeenCalledWith("buyer@cloudless.gr", "in_test_1");
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
  });
});

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
  withScope: vi.fn((cb: (s: { setTag: (k: string, v: string) => void }) => void) =>
    cb({ setTag: vi.fn() })
  ),
}));

import { sendPurchaseEvent } from "@/lib/meta-capi";
import { associateDealWithContact } from "@/lib/espocrm";

describe("stripe webhook — tail branches", () => {
  const evt = (type: string, object: unknown, id = "evt_tail") => ({
    type,
    id,
    data: { object },
  });

  it("checkout.session.completed with campaign+tier metadata", async () => {
    constructEventMock.mockReturnValueOnce(
      evt("checkout.session.completed", {
        id: "cs_1",
        payment_status: "paid",
        mode: "payment",
        customer_email: "b@x.dev",
        amount_total: 9900,
        currency: "eur",
        metadata: { campaign: "shop-online", tier: "launch", utm_source: "li" },
      })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
    expect(notifyTeamMock).toHaveBeenCalled();
  });

  it("espo deal failure is swallowed", async () => {
    vi.mocked(associateDealWithContact).mockRejectedValueOnce(new Error("espo down"));
    constructEventMock.mockReturnValueOnce(
      evt("checkout.session.completed", {
        id: "cs_2",
        payment_status: "paid",
        mode: "payment",
        customer_email: "b@x.dev",
        amount_total: 100,
        currency: "eur",
        metadata: {},
      })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("Meta CAPI failure is swallowed", async () => {
    vi.mocked(sendPurchaseEvent).mockRejectedValueOnce(new Error("capi down"));
    constructEventMock.mockReturnValueOnce(
      evt("checkout.session.completed", {
        id: "cs_3",
        payment_status: "paid",
        mode: "payment",
        customer_email: "b@x.dev",
        amount_total: 100,
        currency: "eur",
        metadata: {},
      })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it("subscription deleted/created/updated notify team", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    for (const type of [
      "customer.subscription.deleted",
      "customer.subscription.created",
      "customer.subscription.updated",
    ] as const) {
      constructEventMock.mockReturnValueOnce(
        evt(type, { id: `sub_${type}`, status: "active" }, `evt_${type}`)
      );
      const res = await POST(makeRequest("{}", "sig"));
      expect(res.status).toBe(200);
    }
    expect(notifyTeamMock).toHaveBeenCalledWith(
      expect.stringContaining("Cancelled"),
      expect.any(String)
    );
  });

  it("invoice.payment_succeeded logs and returns 200", async () => {
    constructEventMock.mockReturnValueOnce(
      evt("invoice.payment_succeeded", { id: "in_1", amount_paid: 5000 })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
  });

  it("invoice.payment_failed with object customer id", async () => {
    constructEventMock.mockReturnValueOnce(
      evt("invoice.payment_failed", {
        id: "in_2",
        customer: { id: "cus_obj" },
        customer_email: "b@x.dev",
        amount_due: 100,
        currency: "eur",
      })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
  });

  it("unhandled event types just warn", async () => {
    constructEventMock.mockReturnValueOnce(evt("charge.dispute.created", { id: "dp_1" }));
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
  });

  it("swallows markStripeEventFailed + markStripeEventProcessed errors", async () => {
    markStripeEventProcessedMock.mockRejectedValueOnce(new Error("mark down"));
    constructEventMock.mockReturnValueOnce(
      evt("invoice.payment_succeeded", { id: "in_9", amount_paid: 1 })
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(200);
    spy.mockRestore();

    notifyTeamMock.mockRejectedValueOnce(new Error("mail down"));
    markStripeEventFailedMock.mockRejectedValueOnce(new Error("mark fail"));
    constructEventMock.mockReturnValueOnce(
      evt("customer.subscription.deleted", { id: "sub_x", status: "canceled" }, "evt_sub_fail")
    );
    const res2 = await POST(makeRequest("{}", "sig"));
    expect(res2.status).toBe(500);
  });

  it("reports to Sentry on handler error when DSN set + flushes on success", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn";
    notifyTeamMock.mockRejectedValueOnce(new Error("mail down"));
    constructEventMock.mockReturnValueOnce(
      evt("customer.subscription.deleted", { id: "sub_y", status: "canceled" }, "evt_sentry")
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest("{}", "sig"));
    expect(res.status).toBe(500);
    const sentry = await import("@sentry/nextjs");
    expect(vi.mocked(sentry.captureException)).toHaveBeenCalled();

    constructEventMock.mockReturnValueOnce(
      evt("invoice.payment_succeeded", { id: "in_10", amount_paid: 1 }, "evt_flush")
    );
    const res2 = await POST(makeRequest("{}", "sig"));
    expect(res2.status).toBe(200);
    expect(vi.mocked(sentry.flush)).toHaveBeenCalledWith(2000);
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });
});
