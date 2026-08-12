// @vitest-environment node
/**
 * Tests the full /api/contact pipeline with campaign tier context
 * (the payload shape produced by the inline TierTable form).
 * Verifies Slack, EspoCRM, and AppFlowy forms all receive the tier data.
 * Outbound email is intentionally skipped under NODE_ENV=test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Contact route uses `@/lib/email` (and skips send when NODE_ENV=test).
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendContactAcknowledgment: vi.fn().mockResolvedValue(undefined),
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

// Contact route persists via AppFlowy forms (Notion path retired).
const mockSaveSubmission = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/appflowy-forms", () => ({
  saveSubmission: (...args: unknown[]) => mockSaveSubmission(...args),
}));

// Mock other side-effects as no-ops
vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/appflowy-analytics", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/meta-capi", () => ({
  sendLeadEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activecampaign", () => ({
  enrollLeadInAutomation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/ssm-config-d1", () => ({
  getConfig: vi.fn().mockResolvedValue({ SES_TO_EMAIL: "team@cloudless.gr" }),
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
    mockSendEmail.mockResolvedValue(undefined);
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

  it("skips outbound email under NODE_ENV=test (Vitest)", async () => {
    const request = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CAMPAIGN_PAYLOAD),
    });

    await POST(request);

    // Same guard as contact-api.test.ts — avoids hitting real email providers in CI.
    expect(mockSendEmail).not.toHaveBeenCalled();
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

  it("saves submission to AppFlowy with campaign context", async () => {
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