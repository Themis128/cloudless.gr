import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEmailsSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockEmailsSend };
  },
}));

import { isResendConfigured, sendEmailResend } from "@/lib/email-resend";

const opts = {
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
};

beforeEach(() => {
  mockEmailsSend.mockClear();
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("isResendConfigured", () => {
  it("returns false when RESEND_API_KEY is missing", () => {
    expect(isResendConfigured()).toBe(false);
  });

  it("returns true when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(isResendConfigured()).toBe(true);
  });
});

describe("sendEmailResend", () => {
  it("throws when RESEND_API_KEY is not set", async () => {
    await expect(sendEmailResend(opts)).rejects.toThrow(/RESEND_API_KEY/);
  });

  it("calls client.emails.send with correct payload", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendEmailResend(opts);

    expect(mockEmailsSend).toHaveBeenCalledOnce();
    const call = mockEmailsSend.mock.lastCall?.[0] as Record<string, unknown>;
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("Hello");
  });

  it("throws when Resend returns an error object", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockEmailsSend.mockResolvedValue({ data: null, error: { message: "Invalid from address" } });

    await expect(sendEmailResend(opts)).rejects.toThrow("Invalid from address");
  });

  it("includes List-Unsubscribe header when listUnsubscribeUrl is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendEmailResend({ ...opts, listUnsubscribeUrl: "https://cloudless.gr/unsub" });
    const call = mockEmailsSend.mock.lastCall?.[0] as Record<string, unknown>;
    expect((call.headers as Record<string, string>)["List-Unsubscribe"]).toContain("cloudless.gr");
  });

  it("includes replyTo when provided", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendEmailResend({ ...opts, replyTo: ["reply@cloudless.gr"] });
    const call = mockEmailsSend.mock.lastCall?.[0] as Record<string, unknown>;
    expect(call.replyTo).toEqual(["reply@cloudless.gr"]);
  });

  it("uses fromLabel in sender address", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await sendEmailResend({ ...opts, fromLabel: "Cloudless Team" });
    const call = mockEmailsSend.mock.lastCall?.[0] as Record<string, unknown>;
    expect(call.from as string).toContain("Cloudless Team");
  });
});
