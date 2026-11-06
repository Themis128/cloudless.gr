import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const constructEventMock = vi.fn();
const getStripeMock = vi.fn();
const getConfigMock = vi.fn();
const persistStripeEventMock = vi.fn();
const markStripeEventProcessedMock = vi.fn();
const markStripeEventFailedMock = vi.fn();
const sendCartAbandonedNoticeMock = vi.fn();
const createLeadMock = vi.fn();
const recordNotificationMock = vi.fn();
const trackAnalyticsEventMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: getStripeMock,
}));

vi.mock("@/lib/email", () => ({
  sendOrderConfirmation: vi.fn(async () => undefined),
  sendPaymentFailureNotice: vi.fn(async () => undefined),
  sendCartAbandonedNotice: sendCartAbandonedNoticeMock,
  notifyTeam: vi.fn(async () => undefined),
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
  createLead: createLeadMock,
}));

vi.mock("@/lib/slack-notify", () => ({
  slackOrderNotify: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: recordNotificationMock,
}));

vi.mock("@/lib/analytics", () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

function makeRequest() {
  return new NextRequest("http://localhost:4000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_1",
    },
    body: "{}",
  });
}

function expiredEvent(session: Record<string, unknown>) {
  return {
    id: "evt_expired_1",
    type: "checkout.session.expired",
    data: { object: session },
  };
}

const SESSION = {
  id: "cs_test_1",
  customer_email: "buyer@acme.example",
  amount_total: 80000,
  currency: "eur",
  metadata: { campaign: "spring", tier: "pro" },
  customer_details: { name: "Jane Doe Smith" },
};

describe("POST /api/webhooks/stripe — checkout.session.expired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({ STRIPE_WEBHOOK_SECRET: "whsec" });
    getStripeMock.mockResolvedValue({
      webhooks: { constructEvent: constructEventMock },
    });
    constructEventMock.mockReturnValue(expiredEvent(SESSION));
    persistStripeEventMock.mockResolvedValue({ duplicate: false });
    markStripeEventProcessedMock.mockResolvedValue(undefined);
    markStripeEventFailedMock.mockResolvedValue(undefined);
    sendCartAbandonedNoticeMock.mockResolvedValue(undefined);
    createLeadMock.mockResolvedValue("lead_1");
    trackAnalyticsEventMock.mockResolvedValue(undefined);
  });

  it("sends recovery email, creates lead, notifies, tracks analytics", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(sendCartAbandonedNoticeMock).toHaveBeenCalledWith(
      "buyer@acme.example",
      800,
      "EUR",
      "spring",
      "pro"
    );
    expect(createLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: "buyer@acme.example",
        firstName: "Jane",
        lastName: "Doe Smith",
        orderId: "cs_test_1",
      })
    );
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Abandoned checkout: €800.00" })
    );
    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "cart_abandoned" })
    );
  });

  it("skips store cart lane for agency_proposal sessions", async () => {
    constructEventMock.mockReturnValue(
      expiredEvent({ ...SESSION, metadata: { source: "agency_proposal", proposal_id: "p-1" } })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(sendCartAbandonedNoticeMock).not.toHaveBeenCalled();
    expect(createLeadMock).not.toHaveBeenCalled();
    expect(recordNotificationMock).not.toHaveBeenCalled();
  });

  it("skips agentic-commerce sessions (cancelled ACP/UCP checkouts)", async () => {
    constructEventMock.mockReturnValue(
      expiredEvent({
        ...SESSION,
        metadata: { protocol: "agentic-commerce" },
      })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(sendCartAbandonedNoticeMock).not.toHaveBeenCalled();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("skips recovery when a newer session already completed", async () => {
    getStripeMock.mockResolvedValue({
      webhooks: { constructEvent: constructEventMock },
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({
            data: [{ id: "cs_newer", created: 9999999999 }],
          }),
        },
      },
    });
    constructEventMock.mockReturnValue(
      expiredEvent({ ...SESSION, customer: "cus_1", created: 1000 })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(sendCartAbandonedNoticeMock).not.toHaveBeenCalled();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("repurchase guard resolves customer by email when session.customer is null", async () => {
    const customersList = vi.fn().mockResolvedValue({ data: [{ id: "cus_by_email" }] });
    const sessionsList = vi.fn().mockResolvedValue({
      data: [{ id: "cs_newer", created: 9999999999 }],
    });
    getStripeMock.mockResolvedValue({
      webhooks: { constructEvent: constructEventMock },
      customers: { list: customersList },
      checkout: { sessions: { list: sessionsList } },
    });
    constructEventMock.mockReturnValue(
      expiredEvent({ ...SESSION, customer: null, created: 1000 })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(customersList).toHaveBeenCalledWith({ email: "buyer@acme.example", limit: 1 });
    expect(sessionsList).toHaveBeenCalledWith({
      customer: "cus_by_email",
      status: "complete",
      limit: 10,
    });
    expect(sendCartAbandonedNoticeMock).not.toHaveBeenCalled();
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("repurchase guard proceeds when no newer completed session exists", async () => {
    getStripeMock.mockResolvedValue({
      webhooks: { constructEvent: constructEventMock },
      customers: { list: vi.fn().mockResolvedValue({ data: [{ id: "cus_1" }] }) },
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({ data: [{ id: "cs_old", created: 500 }] }),
        },
      },
    });
    constructEventMock.mockReturnValue(
      expiredEvent({ ...SESSION, customer: null, created: 1000 })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(sendCartAbandonedNoticeMock).toHaveBeenCalled();
  });

  it("anonymous session still records notification + analytics", async () => {
    constructEventMock.mockReturnValue(
      expiredEvent({ id: "cs_anon", amount_total: null, currency: null, metadata: {} })
    );
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(sendCartAbandonedNoticeMock).not.toHaveBeenCalled();
    expect(createLeadMock).not.toHaveBeenCalled();
    expect(recordNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("anonymous") })
    );
  });

  it("email failure does not block lead creation", async () => {
    sendCartAbandonedNoticeMock.mockRejectedValue(new Error("ses down"));
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(createLeadMock).toHaveBeenCalled();
  });

  it("lead failure does not fail the webhook", async () => {
    createLeadMock.mockRejectedValue(new Error("espo down"));
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(markStripeEventProcessedMock).toHaveBeenCalledWith("evt_expired_1");
  });
});
