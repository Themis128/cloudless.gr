import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the email-sender module which is what email.ts uses
const mockSendEmailUnified = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/email-sender", () => ({
  sendEmail: mockSendEmailUnified,
  setEmailBinding: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    AWS_SES_REGION: "us-east-1",
    SES_FROM_EMAIL: "no-reply@cloudless.gr",
    SES_TO_EMAIL: "team@cloudless.gr",
  }),
  resetSsmCache: vi.fn(),
}));

describe("email.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEmail()", () => {
    it("calls sendEmailUnified with correct recipient and subject", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [
        {
          to: string;
          subject: string;
          html: string;
          text: string;
        },
      ];
      expect(call[0].to).toBe("user@example.com");
      expect(call[0].subject).toBe("Test Subject");
    });

    it("adds List-Unsubscribe header when listUnsubscribeUrl is provided", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Newsletter",
        html: "<p>hi</p>",
        text: "hi",
        listUnsubscribeUrl: "https://cloudless.gr/api/unsubscribe?email=user@example.com",
      });
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ listUnsubscribeUrl: string }];
      expect(call[0].listUnsubscribeUrl).toBe(
        "https://cloudless.gr/api/unsubscribe?email=user@example.com"
      );
    });

    it("does not add List-Unsubscribe when url is not provided", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "No header",
        html: "<p>hi</p>",
        text: "hi",
      });
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ listUnsubscribeUrl?: string }];
      expect(call[0].listUnsubscribeUrl).toBeUndefined();
    });
  });

  describe("sendOrderConfirmation()", () => {
    it("sends an email with the order ID in the body", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "sess_abc123", 4900, "eur");
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).toContain("sess_abc123");
    });

    it("escapes special characters in the session ID", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "<script>", 4900, "eur");
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).not.toContain("<script>");
    });
  });

  describe("sendPaymentFailureNotice()", () => {
    it("sends an email mentioning the invoice ID", async () => {
      const { sendPaymentFailureNotice } = await import("@/lib/email");
      await sendPaymentFailureNotice("cust@example.com", "inv_xyz789");
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).toContain("inv_xyz789");
    });
  });

  describe("sendSubscriberWelcome()", () => {
    it("sends a welcome email with unsubscribe link", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).toContain("unsubscribe");
    });

    it("sends from Themis at Cloudless with branded subject", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const call = mockSendEmailUnified.mock.calls[0] as [{ subject: string; fromLabel: string }];
      expect(call[0].subject).toContain("Welcome");
      expect(call[0].subject).toContain("Monday");
      expect(call[0].fromLabel).toBe("Themis at Cloudless");
    });

    it("includes what-to-expect content areas in the HTML", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).toContain("Cloud and Serverless");
      expect(call[0].html).toContain("Analytics and AI Marketing");
      expect(call[0].html).toContain("Company Updates and Offers");
    });

    it("encodes the subscriber email in the unsubscribe URL", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("user+test@example.com");
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string }];
      expect(call[0].html).toContain(encodeURIComponent("user+test@example.com"));
    });

    it("adds List-Unsubscribe header for RFC 8058 one-click", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const call = mockSendEmailUnified.mock.calls[0] as [{ listUnsubscribeUrl: string }];
      expect(call[0].listUnsubscribeUrl).toContain("unsubscribe");
    });
  });

  describe("notifyTeam()", () => {
    it("sends to SES_TO_EMAIL from config", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Alert: Something happened", "<p>Details here</p>");
      expect(mockSendEmailUnified).toHaveBeenCalledOnce();
      const call = mockSendEmailUnified.mock.calls[0] as [{ to: string }];
      expect(call[0].to).toBe("team@cloudless.gr");
    });

    it("strips HTML tags for the plain-text part", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Subject", "<p>Hello <strong>world</strong></p>");
      const call = mockSendEmailUnified.mock.calls[0] as [{ html: string; text: string }];
      expect(call[0].text).not.toContain("<");
      expect(call[0].text).toContain("world");
    });
  });
});