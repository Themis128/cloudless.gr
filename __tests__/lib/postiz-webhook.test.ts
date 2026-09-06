import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
}));

import { verifyPostizWebhookSignature } from "@/lib/postiz-webhook";

const SECRET = "test-webhook-secret-abc";

beforeEach(() => {
  mockGetConfig.mockResolvedValue({ POSTIZ_WEBHOOK_SECRET: SECRET });
});

describe("verifyPostizWebhookSignature", () => {
  it("returns false when no secret is configured", async () => {
    mockGetConfig.mockResolvedValue({ POSTIZ_WEBHOOK_SECRET: "" });
    const result = await verifyPostizWebhookSignature("body", null, null);
    expect(result).toBe(false);
  });

  it("returns false when URL secret does not match", async () => {
    const result = await verifyPostizWebhookSignature("body", null, "wrong-secret");
    expect(result).toBe(false);
  });

  it("returns true when URL secret matches exactly", async () => {
    const result = await verifyPostizWebhookSignature("body", null, SECRET);
    expect(result).toBe(true);
  });

  it("returns false when URL secret is wrong length", async () => {
    const result = await verifyPostizWebhookSignature("body", null, SECRET + "extra");
    expect(result).toBe(false);
  });

  it("returns true when HMAC signature matches", async () => {
    const body = '{"event":"post.published"}';
    const expected = createHmac("sha256", SECRET).update(body).digest("hex");
    const result = await verifyPostizWebhookSignature(body, expected, null);
    expect(result).toBe(true);
  });

  it("returns true when HMAC signature has sha256= prefix", async () => {
    const body = '{"event":"post.published"}';
    const expected = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
    const result = await verifyPostizWebhookSignature(body, expected, null);
    expect(result).toBe(true);
  });

  it("returns false when HMAC signature is wrong", async () => {
    const result = await verifyPostizWebhookSignature("body", "wrongsignature", null);
    expect(result).toBe(false);
  });

  it("returns false when neither URL secret nor signature is provided", async () => {
    const result = await verifyPostizWebhookSignature("body", null, null);
    expect(result).toBe(false);
  });
});
