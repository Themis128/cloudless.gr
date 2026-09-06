import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: vi.fn().mockResolvedValue(false),
  getIntegrations: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: vi.fn().mockReturnValue(false),
  callWorkersAiChat: vi.fn(),
  parseWorkersAiToolCall: vi.fn().mockReturnValue(null),
  buildWorkersAiToolProtocol: vi.fn().mockReturnValue(""),
}));
vi.mock("@/lib/google-calendar", () => ({
  getAvailableSlots: vi.fn().mockResolvedValue([]),
}));

import { isAgentBookConfigured } from "@/lib/agent-book";

describe("isAgentBookConfigured", () => {
  it("returns false when Google credentials are not configured", async () => {
    expect(await isAgentBookConfigured()).toBe(false);
  });
});
