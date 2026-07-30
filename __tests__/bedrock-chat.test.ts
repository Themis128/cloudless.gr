import { describe, it, expect, beforeEach, vi } from "vitest";

const { callWorkersAiChatMock, parseWorkersAiToolCallMock, runToolMock } = vi.hoisted(() => ({
  callWorkersAiChatMock: vi.fn(),
  parseWorkersAiToolCallMock: vi.fn(),
  runToolMock: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: () => "tools",
  callWorkersAiChat: (...args: unknown[]) => callWorkersAiChatMock(...args),
  parseWorkersAiToolCall: (...args: unknown[]) => parseWorkersAiToolCallMock(...args),
}));

vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [
    {
      name: "book_slot",
      description: "Book a 30min slot",
      input_schema: { type: "object", properties: {} },
    },
  ],
  runTool: (...args: unknown[]) => runToolMock(...args),
}));

import { runBedrockChatLoop, runWorkersAiChatLoop } from "@/lib/bedrock-chat";

describe("bedrock-chat → Workers AI re-export", () => {
  beforeEach(() => {
    callWorkersAiChatMock.mockReset();
    parseWorkersAiToolCallMock.mockReset();
    runToolMock.mockReset();
  });

  it("runBedrockChatLoop is an alias of runWorkersAiChatLoop", () => {
    expect(runBedrockChatLoop).toBe(runWorkersAiChatLoop);
  });

  it("returns plain text when the model does not request a tool", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("Hello, world.");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const r = await runBedrockChatLoop("You are helpful.", [{ role: "user", content: "hi" }]);
    expect(r).toBe("Hello, world.");
  });

  it("returns a fallback when the assistant emits no content", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "x" }]);
    expect(r).toMatch(/could not generate/i);
  });

  it("runs a tool when the model requests it and continues the loop", async () => {
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"book_slot","args":{"days_ahead":7}}')
      .mockResolvedValueOnce("Booked!");
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "book_slot", args: { days_ahead: 7 } })
      .mockReturnValueOnce(null);
    runToolMock.mockResolvedValueOnce("slot reserved");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "book" }]);
    expect(r).toBe("Booked!");
    expect(runToolMock).toHaveBeenCalledWith("book_slot", { days_ahead: 7 });
  });

  it("forwards tool error-string results back to the next turn", async () => {
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"book_slot","args":{}}')
      .mockResolvedValueOnce("Sorry, no slots.");
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "book_slot", args: {} })
      .mockReturnValueOnce(null);
    runToolMock.mockResolvedValueOnce("Tool book_slot failed.");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "book" }]);
    expect(r).toBe("Sorry, no slots.");
    expect(runToolMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the contact-page nudge when MAX_TOOL_ITERATIONS is hit", async () => {
    callWorkersAiChatMock.mockResolvedValue('{"tool":"book_slot","args":{}}');
    parseWorkersAiToolCallMock.mockReturnValue({ name: "book_slot", args: {} });
    runToolMock.mockResolvedValue("more data");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "go" }]);
    expect(r).toMatch(/contact page/i);
  });

  it("propagates Workers AI API errors to the caller", async () => {
    callWorkersAiChatMock.mockRejectedValueOnce(new Error("ThrottlingException"));
    await expect(runBedrockChatLoop("s", [{ role: "user", content: "x" }])).rejects.toThrow(
      /ThrottlingException/
    );
  });
});
