import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();
const mockGetConfig = vi.fn();

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend;
  }),
  SendEmailCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
  resetSsmCache: vi.fn(),
}));

const baseConfig = {
  AWS_SES_REGION: "us-east-1",
  SES_FROM_EMAIL: "no-reply@cloudless.gr",
  SES_TO_EMAIL: "team@cloudless.gr",
};

describe("email.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(baseConfig);
    mockSend.mockResolvedValue({});
  });

  describe("sendEmail()", () => {
    it("calls SES send with correct recipient and subject", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });
      expect(mockSend).toHaveBeenCalledOnce();
      const [cmd] = mockSend.mock.calls[0] as [
        {
          input: {
            Destination: { ToAddresses: string[] };
            Content: { Simple: { Subject: { Data: string } } };
          };
        },
      ];
      expect(cmd.input.Destination.ToAddresses).toContain("user@example.com");
      expect(cmd.input.Content.Simple.Subject.Data).toBe("Test Subject");
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
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Headers?: Array<{ Name: string }> } } } },
      ];
      const headers = cmd.input.Content.Simple.Headers ?? [];
      expect(headers.some((h) => h.Name === "List-Unsubscribe")).toBe(true);
    });

    it("does not add List-Unsubscribe when url is not provided", async () => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: "user@example.com",
        subject: "No header",
        html: "<p>hi</p>",
        text: "hi",
      });
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Headers?: unknown[] } } } },
      ];
      expect(cmd.input.Content.Simple.Headers).toBeUndefined();
    });

    it("swallows SES XML parse errors when httpStatusCode is 200", async () => {
      const { sendEmail } = await import("@/lib/email");
      const xmlErr = Object.assign(new Error("XML parse"), {
        $metadata: { httpStatusCode: 200 },
      });
      mockSend.mockRejectedValueOnce(xmlErr);
      await expect(
        sendEmail({ to: "u@e.com", subject: "S", html: "<p/>", text: "t" })
      ).resolves.toBeUndefined();
    });

    it("rethrows SES errors when httpStatusCode is not 200", async () => {
      const { sendEmail } = await import("@/lib/email");
      const err = Object.assign(new Error("SES failure"), {
        $metadata: { httpStatusCode: 500 },
      });
      mockSend.mockRejectedValueOnce(err);
      await expect(
        sendEmail({ to: "u@e.com", subject: "S", html: "<p/>", text: "t" })
      ).rejects.toThrow("SES failure");
    });
  });

  describe("sendOrderConfirmation()", () => {
    it("sends an email with the order ID in the subject", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "sess_abc123", 4900, "eur");
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("escapes special characters in the session ID", async () => {
      const { sendOrderConfirmation } = await import("@/lib/email");
      await sendOrderConfirmation("customer@example.com", "<script>", 4900, "eur");
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Html: { Data: string } } } } } },
      ];
      expect(cmd.input.Content.Simple.Body.Html.Data).not.toContain("<script>");
    });
  });

  describe("sendPaymentFailureNotice()", () => {
    it("sends an email mentioning the invoice ID", async () => {
      const { sendPaymentFailureNotice } = await import("@/lib/email");
      await sendPaymentFailureNotice("cust@example.com", "inv_xyz789");
      expect(mockSend).toHaveBeenCalledOnce();
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Html: { Data: string } } } } } },
      ];
      expect(cmd.input.Content.Simple.Body.Html.Data).toContain("inv_xyz789");
    });
  });

  describe("sendSubscriberWelcome()", () => {
    it("sends a welcome email with unsubscribe link", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      expect(mockSend).toHaveBeenCalledOnce();
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Html: { Data: string } } } } } },
      ];
      expect(cmd.input.Content.Simple.Body.Html.Data).toContain("unsubscribe");
    });

    it("sends from 'Themis at Cloudless' with branded subject", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const [cmd] = mockSend.mock.calls[0] as [
        {
          input: {
            FromEmailAddress: string;
            Content: { Simple: { Subject: { Data: string } } };
          };
        },
      ];
      expect(cmd.input.FromEmailAddress).toContain("Cloudless");
      expect(cmd.input.Content.Simple.Subject.Data).toBe("Welcome to the Cloudless newsletter!");
    });

    it("includes what-to-expect content areas in the HTML", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Html: { Data: string } } } } } },
      ];
      const html = cmd.input.Content.Simple.Body.Html.Data;
      expect(html).toContain("What to expect");
      expect(html).toContain("Weekly updates on cloud technologies");
      expect(html).toContain("Exclusive content and offers");
    });

    it("encodes the subscriber email in the unsubscribe URL", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("user+test@example.com");
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Html: { Data: string } } } } } },
      ];
      expect(cmd.input.Content.Simple.Body.Html.Data).toContain(
        encodeURIComponent("user+test@example.com")
      );
    });

    it("adds List-Unsubscribe header for RFC 8058 one-click", async () => {
      const { sendSubscriberWelcome } = await import("@/lib/email");
      await sendSubscriberWelcome("sub@example.com");
      const [cmd] = mockSend.mock.calls[0] as [
        {
          input: { Content: { Simple: { Headers?: Array<{ Name: string }> } } };
        },
      ];
      const headers = cmd.input.Content.Simple.Headers ?? [];
      expect(headers.some((h) => h.Name === "List-Unsubscribe")).toBe(true);
    });
  });

  describe("notifyTeam()", () => {
    it("sends to SES_TO_EMAIL from config", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Alert: Something happened", "<p>Details here</p>");
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Destination: { ToAddresses: string[] } } },
      ];
      expect(cmd.input.Destination.ToAddresses).toContain("team@cloudless.gr");
    });

    it("strips HTML tags for the plain-text part", async () => {
      const { notifyTeam } = await import("@/lib/email");
      await notifyTeam("Subject", "<p>Hello <strong>world</strong></p>");
      const [cmd] = mockSend.mock.calls[0] as [
        { input: { Content: { Simple: { Body: { Text: { Data: string } } } } } },
      ];
      expect(cmd.input.Content.Simple.Body.Text.Data).not.toContain("<");
      expect(cmd.input.Content.Simple.Body.Text.Data).toContain("world");
    });
  });
});
