import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  isSuppressed: vi.fn(),
  isCloudflareEmailConfigured: vi.fn(),
  sendEmailCloudflare: vi.fn(),
  isResendConfigured: vi.fn(),
  sendEmailResend: vi.fn(),
  getConfig: vi.fn(),
  slackRegistrationNotify: vi.fn(),
}));

vi.mock("@/lib/ses-suppression-d1", () => ({ isSuppressed: m.isSuppressed }));
vi.mock("@/lib/email-cloudflare", () => ({
  isCloudflareEmailConfigured: m.isCloudflareEmailConfigured,
  sendEmailCloudflare: m.sendEmailCloudflare,
}));
vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: m.isResendConfigured,
  sendEmailResend: m.sendEmailResend,
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/lib/slack-notify", () => ({ slackRegistrationNotify: m.slackRegistrationNotify }));

import {
  sendEmail,
  sendSubscriberWelcome,
  sendOrderConfirmation,
  sendPaymentFailureNotice,
  notifyTeam,
  sendActivationEmail,
  sendPasswordResetEmail,
  slackRegistrationNotify,
  sendContactAcknowledgment,
  sendBookingConfirmation,
  sendUnsubscribeConfirmation,
  SENDERS,
} from "@/lib/email";

beforeEach(() => {
  vi.clearAllMocks();
  m.isSuppressed.mockResolvedValue(false);
  m.isCloudflareEmailConfigured.mockReturnValue(true);
  m.isResendConfigured.mockReturnValue(false);
  m.sendEmailCloudflare.mockResolvedValue(undefined);
  m.sendEmailResend.mockResolvedValue(undefined);
  m.getConfig.mockResolvedValue({ SES_TO_EMAIL: "team@cloudless.gr" });
});

describe("sendEmail provider chain", () => {
  it("skips suppressed addresses", async () => {
    m.isSuppressed.mockResolvedValue(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendEmail({ to: "x@y.z", subject: "s", html: "h", text: "t" });
    expect(m.sendEmailCloudflare).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[email] Skipping suppressed address");
    warn.mockRestore();
  });

  it("prefers Cloudflare, falls back to Resend, throws when neither", async () => {
    await sendEmail({ to: "x@y.z", subject: "s", html: "h", text: "t", replyTo: "r@z" });
    expect(m.sendEmailCloudflare).toHaveBeenCalledWith(
      expect.objectContaining({ to: "x@y.z", replyTo: ["r@z"] })
    );

    m.isCloudflareEmailConfigured.mockReturnValue(false);
    m.isResendConfigured.mockReturnValue(true);
    await sendEmail({ to: "x@y.z", subject: "s", html: "h", text: "t" });
    expect(m.sendEmailResend).toHaveBeenCalled();

    m.isResendConfigured.mockReturnValue(false);
    await expect(
      sendEmail({ to: "x@y.z", subject: "s", html: "h", text: "t" })
    ).rejects.toThrow("Email is not configured");
  });
});

// The Workers branch needs `typeof process === "undefined"` — re-import the
// module with process removed (mirrors the real Workers runtime).
async function inWorkersEnv<T>(fn: (mod: typeof import("@/lib/email")) => Promise<T>): Promise<T> {
  const realProcess = globalThis.process;
  const g = globalThis as Record<string, unknown>;
  g.caches = {};
  // @ts-expect-error — simulate the Workers runtime
  delete globalThis.process;
  vi.resetModules();
  try {
    return await fn(await import("@/lib/email"));
  } finally {
    globalThis.process = realProcess;
    delete g.caches;
    delete g.__ENV__;
    vi.resetModules();
  }
}

describe("sendEmail on Workers", () => {
  it("sends via EMAIL_BINDING with List-Unsubscribe header", async () => {
    const send = vi.fn(async () => {});
    await inWorkersEnv(async ({ sendEmail }) => {
      (globalThis as Record<string, unknown>).__ENV__ = { EMAIL_BINDING: { send } };
      await sendEmail({
        to: "w@x.co",
        subject: "s",
        html: "h",
        text: "t",
        fromLabel: "Orders",
        listUnsubscribeUrl: "https://x/u",
      });
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "w@x.co",
        from: "Orders <noreply@cloudless.gr>",
        headers: { "List-Unsubscribe": "<https://x/u>" },
      })
    );
  });

  it("returns 503 when no binding is present", async () => {
    await inWorkersEnv(async ({ sendEmail }) => {
      const res = await sendEmail({ to: "w@x.co", subject: "s", html: "h", text: "t" });
      expect(res?.status).toBe(503);
      expect(await res?.json()).toEqual({ error: "Email service not configured" });
    });
  });

  it("wraps binding send failures", async () => {
    await inWorkersEnv(async ({ sendEmail }) => {
      (globalThis as Record<string, unknown>).__ENV__ = {
        EMAIL_BINDING: { send: vi.fn(async () => { throw new Error("bind down"); }) },
      };
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        sendEmail({ to: "w@x.co", subject: "s", html: "h", text: "t" })
      ).rejects.toThrow("Email send failed: bind down");
      err.mockRestore();
    });
  });
});

describe("sender helpers", () => {
  it("sendSubscriberWelcome uses the newsletter sender + unsubscribe link", async () => {
    await sendSubscriberWelcome("sub@x.co");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.from).toBe(SENDERS.newsletter);
    expect(payload.listUnsubscribeUrl).toContain("unsubscribe?email=sub%40x.co");
    expect(payload.html).toContain("Welcome to Cloudless");
  });

  it("sendOrderConfirmation strips markup chars from the session id", async () => {
    await sendOrderConfirmation("buyer@x.co", "cs_<script>'&", 42.5);
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.from).toBe(SENDERS.orders);
    expect(payload.subject).toBe("Order Confirmation #cs_script");
    expect(payload.text).toContain("$42.50");
  });

  it("sendPaymentFailureNotice embeds the invoice id", async () => {
    await sendPaymentFailureNotice("b@x.co", "in_123");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.subject).toBe("Payment Failed");
    expect(payload.text).toContain("in_123");
  });

  it("notifyTeam targets SES_TO_EMAIL with the [Team] prefix", async () => {
    await notifyTeam("Deploy done", "<p>All <b>green</b></p>");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.to).toBe("team@cloudless.gr");
    expect(payload.subject).toBe("[Team] Deploy done");
    expect(payload.text).not.toContain("<p>");
  });

  it("sendActivationEmail builds link + optional OTP block", async () => {
    await sendActivationEmail("n@x.co", "tok&", "123456", "Jane");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.from).toBe(SENDERS.noreply);
    expect(payload.html).toContain("token=tok%26");
    expect(payload.html).toContain("123456");
    expect(payload.text).toContain("OPTION 2");

    await sendActivationEmail("n@x.co", "tok");
    const payload2 = m.sendEmailCloudflare.mock.calls[1][0];
    expect(payload2.html).toContain("Hi there");
    expect(payload2.text).not.toContain("OPTION 2");
  });

  it("sendPasswordResetEmail escapes the reset url", async () => {
    await sendPasswordResetEmail("p@x.co", "https://x/reset?t=a<b");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.subject).toBe("Password Reset Request");
    expect(payload.html).not.toContain("t=a<b");
  });

  it("slackRegistrationNotify delegates to slack-notify", async () => {
    m.slackRegistrationNotify.mockResolvedValue(true);
    expect(await slackRegistrationNotify("r@x.co")).toBe(true);
    expect(m.slackRegistrationNotify).toHaveBeenCalledWith("r@x.co");
  });

  it("sendContactAcknowledgment includes the service line only when provided", async () => {
    await sendContactAcknowledgment({ name: "A", email: "a@x.co", service: "Audit" });
    expect(m.sendEmailCloudflare.mock.calls[0][0].html).toContain("Audit");
    await sendContactAcknowledgment({ name: "B", email: "b@x.co" });
    expect(m.sendEmailCloudflare.mock.calls[1][0].html).not.toContain("interest in");
  });

  it("sendBookingConfirmation renders meet link + notes variants", async () => {
    await sendBookingConfirmation({
      name: "A",
      email: "a@x.co",
      slotLabel: "Mon 10:00",
      meetLink: "https://meet.google.com/z",
      notes: "n",
    });
    const p1 = m.sendEmailCloudflare.mock.calls[0][0];
    expect(p1.from).toBe(SENDERS.bookings);
    expect(p1.html).toContain("meet.google.com/z");
    expect(p1.html).toContain("Notes: n");
    await sendBookingConfirmation({ name: "B", email: "b@x.co", slotLabel: "Tue" });
    expect(m.sendEmailCloudflare.mock.calls[1][0].html).not.toContain("Meet");
  });

  it("sendUnsubscribeConfirmation uses the newsletter sender", async () => {
    await sendUnsubscribeConfirmation("u@x.co");
    const payload = m.sendEmailCloudflare.mock.calls[0][0];
    expect(payload.from).toBe(SENDERS.newsletter);
    expect(payload.subject).toContain("unsubscribed");
  });
});
