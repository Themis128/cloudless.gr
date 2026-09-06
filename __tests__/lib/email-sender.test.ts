import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ SES_FROM_EMAIL: "noreply@cloudless.gr" }),
}));

vi.mock("@/lib/ses-suppression-d1", () => ({
  isSuppressed: vi.fn().mockReturnValue(false),
}));

import { setEmailBinding, sendEmail } from "@/lib/email-sender";

beforeEach(() => {
  // Clear module-level binding between tests
  setEmailBinding(null as unknown as Parameters<typeof setEmailBinding>[0]);
  vi.clearAllMocks();
});

function makePayload(overrides = {}) {
  return {
    to: "user@example.com",
    subject: "Test",
    html: "<p>Hi</p>",
    text: "Hi",
    ...overrides,
  };
}

describe("setEmailBinding / sendEmail", () => {
  it("calls binding.send when binding is set", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    setEmailBinding({ send });

    await sendEmail(makePayload());

    expect(send).toHaveBeenCalledOnce();
    const msg = send.mock.lastCall?.[0] as Record<string, unknown>;
    expect(msg.to).toBe("user@example.com");
    expect(msg.subject).toBe("Test");
  });

  it("includes replyTo when provided", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    setEmailBinding({ send });

    await sendEmail(makePayload({ replyTo: ["reply@example.com"] }));

    const msg = send.mock.lastCall?.[0] as Record<string, unknown>;
    expect((msg.replyTo as { email: string }).email).toBe("reply@example.com");
  });

  it("includes List-Unsubscribe header when listUnsubscribeUrl is set", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    setEmailBinding({ send });

    await sendEmail(makePayload({ listUnsubscribeUrl: "https://cloudless.gr/unsub" }));

    const msg = send.mock.lastCall?.[0] as Record<string, { "List-Unsubscribe"?: string }>;
    expect((msg.headers as { "List-Unsubscribe": string })["List-Unsubscribe"]).toContain(
      "cloudless.gr/unsub"
    );
  });

  it("skips send (no-op) when no binding is configured", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendEmail(makePayload());
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No email binding available"),
    );
    warnSpy.mockRestore();
  });

  it("uses fromLabel in from address when provided", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    setEmailBinding({ send });

    await sendEmail(makePayload({ fromLabel: "Cloudless Team" }));

    const msg = send.mock.lastCall?.[0] as Record<string, unknown>;
    expect((msg.from as { name: string }).name).toBe("Cloudless Team");
  });
});

