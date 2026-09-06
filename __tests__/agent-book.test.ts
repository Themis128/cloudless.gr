import { describe, it, expect, vi, beforeEach } from "vitest";

const { isConfiguredAsyncMock } = vi.hoisted(() => ({
  isConfiguredAsyncMock: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: (...keys: string[]) => isConfiguredAsyncMock(...keys),
}));

vi.mock("@/lib/cal-com", () => ({
  getAvailableSlots: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: () => "tools",
  callWorkersAiChat: vi.fn(),
  parseWorkersAiToolCall: vi.fn(),
}));

import { isAgentBookConfigured } from "@/lib/agent-book";

describe("agent-book.isAgentBookConfigured", () => {
  beforeEach(() => {
    isConfiguredAsyncMock.mockReset();
  });

  it("returns true when the required Cal.com key is configured", async () => {
    isConfiguredAsyncMock.mockResolvedValueOnce(true);
    await expect(isAgentBookConfigured()).resolves.toBe(true);
    expect(isConfiguredAsyncMock).toHaveBeenCalledWith("CAL_API_KEY");
  });

  it("returns false when integration keys are missing", async () => {
    isConfiguredAsyncMock.mockResolvedValueOnce(false);
    await expect(isAgentBookConfigured()).resolves.toBe(false);
  });
});
