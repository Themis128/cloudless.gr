import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const constructEventMock = vi.fn();
const getStripeMock = vi.fn();
const sendOrderConfirmationMock = vi.fn();
const sendPaymentFailureNoticeMock = vi.fn();
const notifyTeamMock = vi.fn();
const getConfigMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: getStripeMock,
}));

vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: sendOrderConfirmationMock,
  sendPaymentFailureNotice: sendPaymentFailureNoticeMock,
  notifyTeam: notifyTeamMock,
}));

// Mock ssm-config so tests control the webhook secret independently of .env.local
vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
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

  it("handles checkout.session.completed and sends emails", async () => {
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
    expect(sendOrderConfirmationMock).toHaveBeenCalledWith(
      "buyer@cloudless.gr",
      "cs_test_1",
      129900,
      "eur",
    );
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
  });

  it("sends order confirmation for subscription with immediate payment", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "checkout.session.completed",
      id: "evt_sub_paid",
      data: {
        object: {
          id: "cs_sub_1",
          customer_email: "sub@cloudless.gr",
          amount_total: 4900,
          currency: "eur",
          payment_status: "paid",
          mode: "subscription",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));

    expect(response.status).toBe(200);
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("sends confirmation for subscription trial (mode=subscription, no_payment_required)", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "checkout.session.completed",
      id: "evt_trial_1",
      data: {
        object: {
          id: "cs_trial_1",
          customer_email: "trial@cloudless.gr",
          amount_total: 0,
          currency: "eur",
          payment_status: "no_payment_required",
          mode: "subscription",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));

    expect(response.status).toBe(200);
    // mode === "subscription" → email is sent regardless of payment_status
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT send order confirmation for one-time payment with unpaid status", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "checkout.session.completed",
      id: "evt_unpaid_1",
      data: {
        object: {
          id: "cs_unpaid_1",
          customer_email: "buyer@cloudless.gr",
          amount_total: 5000,
          currency: "eur",
          payment_status: "unpaid",
          mode: "payment",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(makeRequest("{}", "sig_1"));

    expect(response.status).toBe(200);
    expect(sendOrderConfirmationMock).not.toHaveBeenCalled();
  });

  it("handles invoice.payment_failed and sends customer/team notifications", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "invoice.payment_failed",
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

  it("returns 500 when downstream webhook handler throws", async () => {
    constructEventMock.mockReturnValueOnce({
      type: "customer.subscription.created",
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
  });
});
