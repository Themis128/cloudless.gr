/**
 * Tails for src/lib/email-sender.ts — Workers binding paths: injected
 * __EMAIL_BINDING__, D1 suppression skip, and suppression-check failure
 * tolerance. Only the D1 suppression + SSM boundaries are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockIsSuppressed = vi.fn();
vi.mock("@/lib/ses-suppression-d1", () => ({
  isSuppressed: (...args: unknown[]) => mockIsSuppressed(...args),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ EMAIL_FROM: "hello@cloudless.gr" }),
}));

import { sendEmail } from "@/lib/email-sender";

const PAYLOAD = {
  to: "user@example.com",
  subject: "Your receipt",
  html: "<p>hi</p>",
  text: "hi",
  replyTo: ["support@cloudless.gr"],
  listUnsubscribeUrl: "https://cloudless.gr/unsubscribe",
};

function makeBinding() {
  const send = vi.fn().mockResolvedValue(undefined);
  (globalThis as Record<string, unknown>).__EMAIL_BINDING__ = { send };
  return send;
}

describe("email-sender Workers binding tails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuppressed.mockResolvedValue(false);
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__EMAIL_BINDING__;
  });

  it("sends through the auto-detected global binding with full payload", async () => {
    const send = makeBinding();
    await sendEmail(PAYLOAD);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Your receipt",
        html: "<p>hi</p>",
        text: "hi",
        replyTo: { email: "support@cloudless.gr" },
        headers: expect.objectContaining({
          "List-Unsubscribe": "<https://cloudless.gr/unsubscribe>",
        }),
      })
    );
    // from address falls back to the SSM EMAIL_FROM
    expect(send.mock.calls[0][0].from.email).toBe("hello@cloudless.gr");
  });

  it("skips the send when the recipient is on the suppression list", async () => {
    const send = makeBinding();
    mockIsSuppressed.mockResolvedValue(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendEmail(PAYLOAD);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping email to suppressed address")
    );
    warn.mockRestore();
  });

  it("still sends when the suppression check itself fails", async () => {
    const send = makeBinding();
    mockIsSuppressed.mockRejectedValue(new Error("d1 down"));
    await sendEmail(PAYLOAD);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
