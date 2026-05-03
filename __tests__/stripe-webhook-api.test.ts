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

  it("returns 500 when webhook secret is not configured", async () => {
    getConfigMock.mockResolvedValueOnce({ STRIPE_WEBHOOK_SECRET: "" });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));
    const data = await response.json();

    expect(response.status).toBe(500);
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
      "eur",
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
    expect(markStripeEventFailedMock).toHaveBeenCalledWith(
      "evt_handler_fail",
      "mail down",
    );
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
    expect(sendPaymentFailureNoticeMock).toHaveBeenCalledWith(
      "buyer@cloudless.gr",
      "in_test_1",
    );
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
  });
});
