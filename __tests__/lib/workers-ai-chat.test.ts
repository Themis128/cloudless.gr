import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: vi.fn().mockReturnValue(""),
  callWorkersAiChat: vi.fn().mockResolvedValue("Hello! How can I help?"),
  parseWorkersAiToolCall: vi.fn().mockReturnValue(null),
  isWorkersAiConfigured: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/nvidia-proxy-client", () => ({
  isNvidiaProxyConfigured: vi.fn().mockReturnValue(false),
  callNvidiaProxyChat: vi.fn(),
}));
vi.mock("@/lib/ollama-client", () => ({
  isOllamaConfigured: vi.fn().mockReturnValue(false),
  callOllamaChat: vi.fn(),
}));
vi.mock("@/lib/google-calendar", () => ({
  getAvailableSlots: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/booking-slots", () => ({
  DEFAULT_DAYS_AHEAD: 7,
}));
vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [],
  runTool: vi.fn().mockResolvedValue(""),
}));

import { runWorkersAiChatLoop } from "@/lib/workers-ai-chat";

describe("runWorkersAiChatLoop", () => {
  it("returns a string reply from Workers AI", async () => {
    const result = await runWorkersAiChatLoop("You are a helpful assistant.", [
      { role: "user", content: "Hello" },
    ]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
