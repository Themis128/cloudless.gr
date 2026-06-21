import { describe, it, expect, vi, beforeEach } from "vitest";

const { isConfiguredAsyncMock } = vi.hoisted(() => ({
  isConfiguredAsyncMock: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...keys: string[]) => isConfiguredAsyncMock(...keys),
}));

vi.mock("@/lib/google-calendar", () => ({
  getAvailableSlots: vi.fn(),
}));

vi.mock("@/lib/bedrock-shared", () => ({
  BEDROCK_MODEL_ID: "model",
  buildBedrockToolConfig: vi.fn(),
  getBedrockClient: vi.fn(),
}));

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  ConverseCommand: vi.fn(),
}));

import { isAgentBookConfigured } from "@/lib/agent-book";

describe("agent-book.isAgentBookConfigured", () => {
  beforeEach(() => {
    isConfiguredAsyncMock.mockReset();
  });

  it("returns true when the required Google Calendar keys are configured", async () => {
    isConfiguredAsyncMock.mockResolvedValueOnce(true);
    await expect(isAgentBookConfigured()).resolves.toBe(true);
    expect(isConfiguredAsyncMock).toHaveBeenCalledWith("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY");
  });

  it("returns false when integration keys are missing", async () => {
    isConfiguredAsyncMock.mockResolvedValueOnce(false);
    await expect(isAgentBookConfigured()).resolves.toBe(false);
  });
});
