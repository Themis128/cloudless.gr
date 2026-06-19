import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockBedrockSend, runToolMock } = vi.hoisted(() => ({
  mockBedrockSend: vi.fn(),
  runToolMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  ConverseCommand: vi.fn().mockImplementation(function (input: unknown) {
    return { __cmd: "Converse", input };
  }),
}));

vi.mock("@/lib/bedrock-shared", () => ({
  BEDROCK_MODEL_ID: "anthropic.claude-haiku-4-5",
  buildBedrockToolConfig: vi.fn().mockReturnValue({ tools: [] }),
  getBedrockClient: vi.fn(() => ({ send: mockBedrockSend })),
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

import { runBedrockChatLoop } from "@/lib/bedrock-chat";

describe("bedrock-chat.runBedrockChatLoop", () => {
  beforeEach(() => {
    mockBedrockSend.mockReset();
    runToolMock.mockReset();
  });

  it("returns concatenated text when Bedrock stops without tool use", async () => {
    mockBedrockSend.mockResolvedValueOnce({
      stopReason: "end_turn",
      output: {
        message: {
          content: [{ text: "Hello, " }, { text: "world." }],
        },
      },
    });
    const r = await runBedrockChatLoop("You are helpful.", [
      { role: "user", content: "hi" },
    ]);
    expect(r).toBe("Hello, world.");
  });

  it("returns empty string when the assistant emits no content", async () => {
    mockBedrockSend.mockResolvedValueOnce({
      stopReason: "end_turn",
      output: { message: { content: [] } },
    });
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "x" }]);
    expect(r).toBe("");
  });

  it("runs a tool when Bedrock requests it and continues the loop", async () => {
    mockBedrockSend
      .mockResolvedValueOnce({
        stopReason: "tool_use",
        output: {
          message: {
            content: [
              { text: "Let me check..." },
              {
                toolUse: {
                  toolUseId: "tu-1",
                  name: "book_slot",
                  input: { days_ahead: 7 },
                },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        stopReason: "end_turn",
        output: { message: { content: [{ text: "Booked!" }] } },
      });
    runToolMock.mockResolvedValueOnce("slot reserved");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "book" }]);
    expect(r).toBe("Booked!");
    expect(runToolMock).toHaveBeenCalledWith("book_slot", { days_ahead: 7 });
  });

  it("forwards tool error-string results back to the next Bedrock turn", async () => {
    // The real runTool catches its own errors and returns a string —
    // the loop should pass that string through as a tool_result and
    // keep iterating until end_turn.
    mockBedrockSend
      .mockResolvedValueOnce({
        stopReason: "tool_use",
        output: {
          message: {
            content: [
              { toolUse: { toolUseId: "tu-2", name: "book_slot", input: {} } },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        stopReason: "end_turn",
        output: { message: { content: [{ text: "Sorry, no slots." }] } },
      });
    runToolMock.mockResolvedValueOnce("Tool book_slot failed.");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "book" }]);
    expect(r).toBe("Sorry, no slots.");
    expect(runToolMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the contact-page nudge when MAX_TOOL_ITERATIONS is hit", async () => {
    // Bedrock keeps requesting tools forever — the loop must bail out
    // with a deterministic fallback string (not "" or a thrown error).
    mockBedrockSend.mockResolvedValue({
      stopReason: "tool_use",
      output: {
        message: {
          content: [
            { text: "still working..." },
            { toolUse: { toolUseId: "tu-x", name: "book_slot", input: {} } },
          ],
        },
      },
    });
    runToolMock.mockResolvedValue("more data");
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "go" }]);
    expect(r).toMatch(/contact page/i);
  });

  it("filters non-text blocks out of the final response", async () => {
    mockBedrockSend.mockResolvedValueOnce({
      stopReason: "end_turn",
      output: {
        message: {
          content: [
            { text: "Real text." },
            { toolUse: { toolUseId: "x", name: "n", input: {} } },
            { text: 42 as unknown as string },
          ],
        },
      },
    });
    const r = await runBedrockChatLoop("s", [{ role: "user", content: "x" }]);
    expect(r).toBe("Real text.");
  });

  it("propagates Bedrock API errors to the caller", async () => {
    mockBedrockSend.mockRejectedValueOnce(new Error("ThrottlingException"));
    await expect(
      runBedrockChatLoop("s", [{ role: "user", content: "x" }]),
    ).rejects.toThrow(/ThrottlingException/);
  });
});
