// @vitest-environment node
/**
 * Tests the full /api/contact pipeline with campaign tier context
 * (the payload shape produced by the inline TierTable form).
 * Verifies Cloudflare Email, Slack, EspoCRM, and Notion all receive the tier data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock Cloudflare Email Service REST delivery path
const mockSendEmailCloudflare = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email-cloudflare", () => ({
  isCloudflareEmailConfigured: vi.fn(() => true),
  sendEmailCloudflare: (...args: unknown[]) => mockSendEmailCloudflare(...args),
}));
vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: vi.fn(() => false),
  sendEmailResend: vi.fn(),
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
    mockSendEmailCloudflare.mockResolvedValue(undefined);
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

  it("sends Cloudflare email with campaign/tier context in subject and body", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);

    expect(mockSendEmailCloudflare).toHaveBeenCalled();
    const emailInput = mockSendEmailCloudflare.mock.calls[0][0];
    const subject = emailInput.subject;
    expect(subject).toContain("shop-online — E-shop Launch");
    expect(subject).toContain("Γιώργος");
    expect(emailInput.body).toContain("E-shop Launch");
    expect(emailInput.body).toContain("€1.800");
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
        amount: "1800",
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
        tier: "E-shop Launch",
        price: "€1.800",
      })
    );
  });
});