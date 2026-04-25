import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();
const mockGetConfig = vi.fn();

vi.mock("@aws-sdk/client-sesv2", () => ({
  // Must be a proper function (not arrow) so it can be called with `new`
  SESv2Client: vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend;
  }),
  PutSuppressedDestinationCommand: vi.fn(function (
    this: { input: unknown },
    input: unknown,
  ) {
    this.input = input;
  }),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
  resetSsmCache: vi.fn(),
}));

describe("ses-suppression.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({ AWS_SES_REGION: "us-east-1" });
  });

  it("returns true and calls SES when suppression succeeds", async () => {
    mockSend.mockResolvedValueOnce({});
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    const result = await addToSuppressionList("unsubscribed@example.com");
    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("passes the correct email address to PutSuppressedDestinationCommand", async () => {
    const { PutSuppressedDestinationCommand } = await import("@aws-sdk/client-sesv2");
    mockSend.mockResolvedValueOnce({});
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    await addToSuppressionList("user@test.com");
    expect(PutSuppressedDestinationCommand).toHaveBeenCalledWith(
      expect.objectContaining({ EmailAddress: "user@test.com", Reason: "COMPLAINT" }),
    );
  });

  it("returns false when SES throws an error", async () => {
    mockSend.mockRejectedValueOnce(new Error("SES error"));
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    const result = await addToSuppressionList("fail@example.com");
    expect(result).toBe(false);
  });

  it("uses the configured AWS region from getConfig", async () => {
    const { SESv2Client } = await import("@aws-sdk/client-sesv2");
    mockGetConfig.mockResolvedValue({ AWS_SES_REGION: "eu-west-1" });
    mockSend.mockResolvedValueOnce({});
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    await addToSuppressionList("test@example.com");
    expect(SESv2Client).toHaveBeenCalledWith({ region: "eu-west-1" });
  });
});
