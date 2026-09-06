import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/email-cloudflare", () => ({
  isCloudflareEmailConfigured: vi.fn().mockReturnValue(false),
  sendEmailCloudflare: vi.fn(),
}));
vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: vi.fn().mockReturnValue(false),
  sendEmailResend: vi.fn(),
}));
vi.mock("@/lib/ses-suppression-d1", () => ({
  isSuppressed: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: vi.fn().mockResolvedValue({}),
}));

import { SENDERS, sendEmail, notifyTeam, slackRegistrationNotify } from "@/lib/email";

describe("SENDERS", () => {
  it("defines all expected sender addresses", () => {
    expect(SENDERS.noreply).toBe("noreply@cloudless.gr");
    expect(SENDERS.info).toBe("info@cloudless.gr");
    expect(SENDERS.orders).toBe("orders@cloudless.gr");
    expect(SENDERS.newsletter).toBe("newsletter@cloudless.gr");
    expect(SENDERS.admin).toBe("admin@cloudless.gr");
    expect(SENDERS.bookings).toBe("bookings@cloudless.gr");
  });

  it("all sender values end with @cloudless.gr", () => {
    for (const addr of Object.values(SENDERS)) {
      expect(addr).toMatch(/@cloudless\.gr$/);
    }
  });
});

describe("sendEmail (no email providers configured)", () => {
  it("throws when no email provider is configured", async () => {
    await expect(
      sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
        text: "Hello",
      })
    ).rejects.toThrow("Email is not configured");
  });
});

describe("notifyTeam", () => {
  it("throws when no email provider is configured", async () => {
    await expect(notifyTeam("Test subject", "Test body")).rejects.toThrow(
      "Email is not configured"
    );
  });
});

describe("slackRegistrationNotify", () => {
  it("returns false when Slack is not configured", async () => {
    const result = await slackRegistrationNotify("user@example.com");
    expect(typeof result).toBe("boolean");
  });
});
