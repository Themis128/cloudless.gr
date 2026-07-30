import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendEmailCloudflare = vi.fn();
const mockSendEmailResend = vi.fn();

vi.mock("@/lib/email-cloudflare", () => ({
  isCloudflareEmailConfigured: vi.fn(() => true),
  sendEmailCloudflare: (...args: unknown[]) => mockSendEmailCloudflare(...args),
}));

vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: vi.fn(() => false),
  sendEmailResend: (...args: unknown[]) => mockSendEmailResend(...args),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    SES_TO_EMAIL: "team@cloudless.gr",
  }),
  resetSsmCache: vi.fn(),
}));

describe("email.ts", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendEmailCloudflare.mockResolvedValue(undefined);
    mockSendEmailResend.mockResolvedValue(undefined);
    const { isCloudflareEmailConfigured } = await import("@/lib/email-cloudflare");
    const { isResendConfigured } = await import("@/lib/email-resend");
    vi.mocked(isCloudflareEmailConfigured).mockReturnValue(true);
    vi.mocked(isResendConfigured).mockReturnValue(false);
  });

  describe("sendEmail()", () => {
    it("calls Cloudflare Email with correct recipient and subject", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });
      expect(mockSendEmailCloudflare).toHaveBeenCalledOnce();
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Test Subject",
        })
      );
    });

    it("passes listUnsubscribeUrl when provided", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Newsletter",
        html: "<p>hi</p>",
        text: "hi",
        listUnsubscribeUrl: "https://cloudless.gr/api/unsubscribe?email=user@example.com",
      });
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          listUnsubscribeUrl: "https://cloudless.gr/api/unsubscribe?email=user@example.com",
        })
      );
    });

    it("falls back to Resend when Cloudflare Email is not configured", async () => {
      const { isCloudflareEmailConfigured } = await import("@/lib/email-cloudflare");
      const { isResendConfigured } = await import("@/lib/email-resend");
      vi.mocked(isCloudflareEmailConfigured).mockReturnValue(false);
      vi.mocked(isResendConfigured).mockReturnValue(true);
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Fallback",
        html: "<p>hi</p>",
        text: "hi",
      });
      expect(mockSendEmailCloudflare).not.toHaveBeenCalled();
      expect(mockSendEmailResend).toHaveBeenCalledOnce();
    });

    it("throws when neither Cloudflare Email nor Resend is configured", async () => {
      const { isCloudflareEmailConfigured } = await import("@/lib/email-cloudflare");
      const { isResendConfigured } = await import("@/lib/email-resend");
      vi.mocked(isCloudflareEmailConfigured).mockReturnValue(false);
      vi.mocked(isResendConfigured).mockReturnValue(false);
      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({ to: "u@e.com", subject: "S", html: "<p/>", text: "t" })
      ).rejects.toThrow("Email is not configured");
    });

    it("rethrows Cloudflare Email errors", async () => {
      mockSendEmailCloudflare.mockRejectedValueOnce(new Error("CF email failure"));
      const { sendEmail } = await import("@/lib/email");
      await expect(
        sendEmail({ to: "u@e.com", subject: "S", html: "<p/>", text: "t" })
      ).rejects.toThrow("CF email failure");
    });
  });

  describe("sendOrderConfirmation()", () => {
    it("sends an email with the order ID in the subject", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "sess_abc123", 4900, "eur");
      expect(mockSendEmailCloudflare).toHaveBeenCalledOnce();
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("sess_abc123"),
        })
      );
    });

    it("escapes special characters in the session ID", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "<script>", 4900, "eur");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining("<script>"),
        })
      );
    });
  });

  describe("sendPaymentFailureNotice()", () => {
    it("sends an email mentioning the invoice ID", async () => {
      const { sendPaymentFailureNotice } = await import("@/lib/email");
      await sendPaymentFailureNotice("cust@example.com", "inv_xyz789");
      expect(mockSendEmailCloudflare).toHaveBeenCalledOnce();
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("inv_xyz789"),
        })
      );
    });
  });

  describe("sendSubscriberWelcome()", () => {
    it("sends a welcome email with unsubscribe link", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      expect(mockSendEmailCloudflare).toHaveBeenCalledOnce();
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("unsubscribe"),
        })
      );
    });

    it("sends from 'Themis at Cloudless' with branded subject", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          fromLabel: "Themis at Cloudless",
          subject: "Welcome to the Cloudless newsletter!",
        })
      );
    });

    it("includes what-to-expect content areas in the HTML", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const call = mockSendEmailCloudflare.mock.calls[0]?.[0] as { html: string };
      expect(call.html).toContain("What to expect");
      expect(call.html).toContain("Weekly updates on cloud technologies");
      expect(call.html).toContain("Exclusive content and offers");
    });

    it("encodes the subscriber email in the unsubscribe URL", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("user+test@example.com");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          listUnsubscribeUrl: expect.stringContaining(encodeURIComponent("user+test@example.com")),
        })
      );
    });

    it("passes listUnsubscribeUrl for RFC 8058 one-click", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          listUnsubscribeUrl: expect.stringContaining("unsubscribe"),
        })
      );
    });
  });

  describe("notifyTeam()", () => {
    it("sends to SES_TO_EMAIL from config", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Alert: Something happened", "<p>Details here</p>");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "team@cloudless.gr",
        })
      );
    });

    it("strips HTML tags for the plain-text part", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Subject", "<p>Hello <strong>world</strong></p>");
      expect(mockSendEmailCloudflare).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("world"),
        })
      );
      const call = mockSendEmailCloudflare.mock.calls[0]?.[0] as { text: string };
      expect(call.text).not.toContain("<");
    });
  });
});
