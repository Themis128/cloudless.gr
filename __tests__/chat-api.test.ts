import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

// vi.hoisted values must use `function` (not arrow) so they can be called
// with `new` — the Bedrock SDK uses `new BedrockRuntimeClient()` and
// `new ConverseCommand()` at runtime, and arrow functions can't be constructors.
const { mockSend, MockConverseCommand, mockRunTool } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockRunTool = vi.fn();

  function MockConverseCommandImpl(this: unknown, input: object) {
    void input; // args tracked via MockConverseCommand.mock.calls
  }
  const MockConverseCommand = vi.fn(MockConverseCommandImpl);

  return { mockSend, MockConverseCommand, mockRunTool };
});

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  // Must be a regular function so `new BedrockRuntimeClient()` succeeds.
  function BedrockRuntimeClientImpl(this: Record<string, unknown>) {
    this.send = mockSend;
  }
  return {
    BedrockRuntimeClient: vi.fn(BedrockRuntimeClientImpl),
    ConverseCommand: MockConverseCommand,
  };
});

vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [
    { name: "lookup_product", description: "", input_schema: {} },
    { name: "check_calendar_availability", description: "", input_schema: {} },
    { name: "book_slot", description: "", input_schema: {} },
  ],
  runTool: (...args: unknown[]) => mockRunTool(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bedrockTextResponse(text: string) {
  return {
    stopReason: "end_turn",
    output: {
      message: { role: "assistant", content: [{ text }] },
    },
  };
}

function bedrockToolResponse(toolUseId: string, name: string, input: object) {
  return {
    stopReason: "tool_use",
    output: {
      message: {
        role: "assistant",
        content: [{ toolUse: { toolUseId, name, input } }],
      },
    },
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function readSseText(res: Response): Promise<string> {
  const text = await res.text();
  const decoded: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as { text?: string };
      if (parsed.text) decoded.push(parsed.text);
    } catch {
      /* ignore */
    }
  }
  return decoded.join("");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // /api/chat gained an in-handler rate limit (10/min/IP) backed by a
    // module-level store. getClientIp returns a fixed IP in tests, so without
    // resetting, requests accumulate across tests and later ones get 429.
    resetRateLimitStore();
  });

  it("returns 400 when messages array is missing", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is empty", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is not an array", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: "hello" }));
    expect(res.status).toBe(400);
  });

  it("streams plain text when the model returns text directly (no tools)", async () => {
    mockSend.mockResolvedValueOnce(bedrockTextResponse("Hello there!"));
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await readSseText(res)).toBe("Hello there!");
  });

  it("declares all three tools when calling Bedrock", async () => {
    mockSend.mockResolvedValueOnce(bedrockTextResponse("ok"));
    const { POST } = await import("@/app/api/chat/route");
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    const cmdInput = MockConverseCommand.mock.calls[0][0] as {
      toolConfig: { tools: { toolSpec: { name: string } }[] };
    };
    expect(cmdInput.toolConfig.tools).toHaveLength(3);
    expect(cmdInput.toolConfig.tools.map((t) => t.toolSpec.name)).toEqual([
      "lookup_product",
      "check_calendar_availability",
      "book_slot",
    ]);
  });

  it("caps history to last 10 turns", async () => {
    mockSend.mockResolvedValueOnce(bedrockTextResponse("ok"));
    const { POST } = await import("@/app/api/chat/route");
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    await POST(makeRequest({ messages }));
    const cmdInput = MockConverseCommand.mock.calls[0][0] as {
      messages: unknown[];
    };
    expect(cmdInput.messages).toHaveLength(10);
  });

  it("returns 503 when Bedrock access is denied", async () => {
    const err = Object.assign(new Error("Access denied"), {
      name: "AccessDeniedException",
    });
    mockSend.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/contact page/i);
  });

  it("returns 502 when Bedrock throttles", async () => {
    const err = Object.assign(new Error("Throttled"), {
      name: "ThrottlingException",
    });
    mockSend.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Bedrock returns a transient service error", async () => {
    const err = Object.assign(new Error("Service unavailable"), {
      name: "ServiceUnavailableException",
    });
    mockSend.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(502);
  });

  it("dispatches tool_use blocks, feeds results back, then streams the final text", async () => {
    mockSend.mockResolvedValueOnce(
      bedrockToolResponse("tu-1", "lookup_product", { query: "serverless" })
    );
    mockRunTool.mockResolvedValueOnce("Found 1 match: Serverless Starter (€2400).");
    mockSend.mockResolvedValueOnce(bedrockTextResponse("Serverless Starter is €2400."));

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "Got a serverless package?" }],
      })
    );

    expect(res.status).toBe(200);
    expect(mockRunTool).toHaveBeenCalledWith("lookup_product", {
      query: "serverless",
    });
    expect(await readSseText(res)).toBe("Serverless Starter is €2400.");

    // Second ConverseCommand should include original user msg + assistant
    // tool_use turn + user tool_result turn.
    const secondCmdInput = MockConverseCommand.mock.calls[1][0] as {
      messages: {
        role: string;
        content: { toolResult?: { toolUseId: string } }[];
      }[];
    };
    expect(secondCmdInput.messages).toHaveLength(3);
    expect(secondCmdInput.messages[1].role).toBe("assistant");
    expect(secondCmdInput.messages[2].role).toBe("user");
    expect(secondCmdInput.messages[2].content[0].toolResult?.toolUseId).toBe("tu-1");
  });

  it("falls back to a contact-page nudge if the loop exceeds the iteration cap", async () => {
    for (let i = 0; i < 5; i++) {
      mockSend.mockResolvedValueOnce(
        bedrockToolResponse(`tu-${i}`, "lookup_product", { query: "loop" })
      );
    }
    mockRunTool.mockResolvedValue("no match");

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "stuck" }] }));
    expect(res.status).toBe(200);
    const text = await readSseText(res);
    expect(text.toLowerCase()).toContain("contact page");
    expect(mockSend).toHaveBeenCalledTimes(4);
  });
});
