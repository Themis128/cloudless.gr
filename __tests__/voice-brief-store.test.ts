import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
const putCalls: Record<string, unknown>[] = [];

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn().mockImplementation(function (config: unknown) {
    return { __config: config, send: mockSend };
  }),
  PutParameterCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) {
    putCalls.push(input);
    return { __cmd: "Put", input };
  }),
}));

describe("voice-brief-store", () => {
  beforeEach(() => {
    mockSend.mockReset();
    putCalls.length = 0;
  });
  afterEach(() => {
    delete process.env.AWS_REGION;
  });

  it("VOICE_BRIEF_SSM_NAME points at the production prefix", async () => {
    const mod = await import("@/lib/voice-brief-store");
    expect(mod.VOICE_BRIEF_SSM_NAME).toBe("/cloudless/production/VOICE_BRIEF_LATEST");
  });

  it("persistVoiceBrief writes JSON to SSM with Overwrite=true", async () => {
    mockSend.mockResolvedValueOnce({});
    const { persistVoiceBrief } = await import("@/lib/voice-brief-store");
    await persistVoiceBrief({
      text: "weekly highlights",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
    expect(putCalls).toHaveLength(1);
    const input = putCalls[0];
    expect(input.Name).toBe("/cloudless/production/VOICE_BRIEF_LATEST");
    expect(input.Overwrite).toBe(true);
    expect(input.Type).toBe("String");
    const payload = JSON.parse(input.Value as string) as { text: string };
    expect(payload.text).toBe("weekly highlights");
  });

  it("defaults to us-east-1 when AWS_REGION is unset", async () => {
    mockSend.mockResolvedValueOnce({});
    const { SSMClient } = await import("@aws-sdk/client-ssm");
    const { persistVoiceBrief } = await import("@/lib/voice-brief-store");
    delete process.env.AWS_REGION;
    await persistVoiceBrief({
      text: "x",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
    const ctorArgs = (SSMClient as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const lastCallConfig = ctorArgs[ctorArgs.length - 1][0] as { region: string };
    expect(lastCallConfig.region).toBe("us-east-1");
  });

  it("uses AWS_REGION env when set", async () => {
    mockSend.mockResolvedValueOnce({});
    const { SSMClient } = await import("@aws-sdk/client-ssm");
    const { persistVoiceBrief } = await import("@/lib/voice-brief-store");
    process.env.AWS_REGION = "eu-west-1";
    await persistVoiceBrief({
      text: "x",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
    const ctorArgs = (SSMClient as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const lastCallConfig = ctorArgs[ctorArgs.length - 1][0] as { region: string };
    expect(lastCallConfig.region).toBe("eu-west-1");
  });
});
