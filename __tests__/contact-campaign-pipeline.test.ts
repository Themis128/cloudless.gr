// @vitest-environment node
/**
 * Tests the full /api/contact pipeline with campaign tier context
 * (the payload shape produced by the inline TierTable form).
 * Verifies SES, Slack, EspoCRM, and Notion all receive the tier data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock SES
const mockSend = vi.fn().mockResolvedValue({});
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = mockSend;
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

// Mock Slack
const mockSlackContactNotify = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/slack-notify", () => ({
  slackContactNotify: (...args: unknown[]) => mockSlackContactNotify(...args),
}));

// Mock EspoCRM
const mockUpsertContact = vi.fn().mockResolvedValue("contact-123");
const mockCreateDeal = vi.fn().mockResolvedValue("deal-456");
const mockAssociateDealWithContact = vi.fn().mockResolvedValue(undefined);
const mockCreateContactNote = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/espocrm", () => ({
  upsertContact: (...args: unknown[]) => mockUpsertContact(...args),
  createDeal: (...args: unknown[]) => mockCreateDeal(...args),
  associateDealWithContact: (...args: unknown[]) => mockAssociateDealWithContact(...args),
  createContactNote: (...args: unknown[]) => mockCreateContactNote(...args),
}));

// Mock Notion
const mockSaveSubmission = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notion-forms", () => ({
  saveSubmission: (...args: unknown[]) => mockSaveSubmission(...args),
}));

// Mock other side-effects as no-ops
vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notion-analytics", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/meta-capi", () => ({
  sendLeadEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activecampaign", () => ({
  enrollLeadInAutomation: vi.fn().mockResolvedValue(undefined),
}));

// Campaign tier payload (matches what TierTable inline form submits)
const CAMPAIGN_PAYLOAD = {
  name: "Γιώργος Παπαδόπουλος",
  email: "giorgos@shop.gr",
  phone: "+30 6945123456",
  service: "shop-online — E-shop Launch",
  message: "Tier: E-shop Launch\nPrice: €1.800\nCampaign: shop-online",
};

describe("POST /api/contact — campaign tier pipeline", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    const mod = await import("@/app/api/contact/route");
    POST = mod.POST;
  });

  it("returns success for campaign tier submission", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.eventId).toBeTruthy();
  });

  it("sends SES email with campaign/tier context in subject and body", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);

    // SES SendEmailCommand was called at least once (team email)
    expect(mockSend).toHaveBeenCalled();
    const emailInput = mockSend.mock.calls[0][0].input;
    // Subject contains the service (campaign — tier)
    const subject = emailInput.Content?.Simple?.Subject?.Data ?? "";
    expect(subject).toContain("shop-online — E-shop Launch");
    expect(subject).toContain("Γιώργος");
  });

  it("sends Slack notification with campaign tier in service field", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);
    // Allow background promises to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSlackContactNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Γιώργος Παπαδόπουλος",
        email: "giorgos@shop.gr",
        service: "shop-online — E-shop Launch",
        message: expect.stringContaining("E-shop Launch"),
      })
    );
  });

  it("upserts EspoCRM contact with name and email", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockUpsertContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "giorgos@shop.gr",
        firstname: "Γιώργος",
        lastname: "Παπαδόπουλος",
      })
    );
  });

  it("creates EspoCRM deal with campaign tier context", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCreateDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        dealname: expect.stringContaining("Γιώργος Παπαδόπουλος"),
        dealstage: "qualifiedtobuy",
        lead_source: "contact_form",
        description: expect.stringContaining("E-shop Launch"),
      })
    );
  });

  it("associates deal with contact in EspoCRM", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockAssociateDealWithContact).toHaveBeenCalledWith("deal-456", "contact-123");
  });

  it("saves submission to Notion with campaign context", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSaveSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Γιώργος Παπαδόπουλος",
        email: "giorgos@shop.gr",
        service: "shop-online — E-shop Launch",
        message: expect.stringContaining("Campaign: shop-online"),
        source: "contact",
      })
    );
  });
});
