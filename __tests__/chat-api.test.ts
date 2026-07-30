import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

const { callWorkersAiChatMock, parseWorkersAiToolCallMock, mockRunTool } = vi.hoisted(() => ({
  callWorkersAiChatMock: vi.fn(),
  parseWorkersAiToolCallMock: vi.fn(),
  mockRunTool: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: (
    tools: ReadonlyArray<{ name: string; description: string; input_schema: unknown }>
  ) =>
    tools.map((t) => `- ${t.name}: ${t.description}`).join("\n"),
  callWorkersAiChat: (...args: unknown[]) => callWorkersAiChatMock(...args),
  parseWorkersAiToolCall: (...args: unknown[]) => parseWorkersAiToolCallMock(...args),
}));

vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [
    { name: "lookup_product", description: "", input_schema: {} },
    { name: "check_calendar_availability", description: "", input_schema: {} },
    { name: "book_slot", description: "", input_schema: {} },
  ],
  runTool: (...args: unknown[]) => mockRunTool(...args),
}));

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

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    callWorkersAiChatMock.mockResolvedValueOnce("Hello there!");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await readSseText(res)).toBe("Hello there!");
  });

  it("includes the three chat tools in the Workers AI system prompt", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("ok");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const { POST } = await import("@/app/api/chat/route");
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    const messages = callWorkersAiChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    expect(system).toContain("lookup_product");
    expect(system).toContain("check_calendar_availability");
    expect(system).toContain("book_slot");
  });

  it("caps history to last 10 turns", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("ok");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const { POST } = await import("@/app/api/chat/route");
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    await POST(makeRequest({ messages }));
    const aiMessages = callWorkersAiChatMock.mock.calls[0][0] as Array<{ role: string }>;
    // system + last 10 turns
    expect(aiMessages.filter((m) => m.role !== "system")).toHaveLength(10);
  });

  it("returns 503 when Workers AI access is denied", async () => {
    const err = Object.assign(new Error("Access denied"), {
      name: "UnauthorizedException",
    });
    callWorkersAiChatMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/contact page/i);
  });

  it("returns 502 when Workers AI throttles", async () => {
    const err = Object.assign(new Error("Throttled"), {
      name: "ThrottlingException",
    });
    callWorkersAiChatMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Workers AI returns a transient service error", async () => {
    const err = Object.assign(new Error("Service unavailable"), {
      name: "AiError",
    });
    callWorkersAiChatMock.mockRejectedValueOnce(err);
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(502);
  });

  it("dispatches tool calls, feeds results back, then streams the final text", async () => {
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"lookup_product","args":{"query":"serverless"}}')
      .mockResolvedValueOnce("Serverless Starter is €2400.");
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "lookup_product", args: { query: "serverless" } })
      .mockReturnValueOnce(null);
    mockRunTool.mockResolvedValueOnce("Found 1 match: Serverless Starter (€2400).");

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

    const secondMessages = callWorkersAiChatMock.mock.calls[1][0] as Array<{
      role: string;
      content: string;
    }>;
    expect(secondMessages.some((m) => m.role === "assistant")).toBe(true);
    expect(
      secondMessages.some(
        (m) => m.role === "user" && m.content.includes("TOOL_RESULT for lookup_product")
      )
    ).toBe(true);
  });

  it("falls back to a contact-page nudge if the loop exceeds the iteration cap", async () => {
    callWorkersAiChatMock.mockResolvedValue(
      '{"tool":"lookup_product","args":{"query":"loop"}}'
    );
    parseWorkersAiToolCallMock.mockReturnValue({
      name: "lookup_product",
      args: { query: "loop" },
    });
    mockRunTool.mockResolvedValue("no match");

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "stuck" }] }));
    expect(res.status).toBe(200);
    const text = await readSseText(res);
    expect(text.toLowerCase()).toContain("contact page");
    expect(callWorkersAiChatMock).toHaveBeenCalledTimes(4);
  });
});
