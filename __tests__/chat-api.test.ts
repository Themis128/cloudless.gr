import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockFetch, mockRunTool } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
  mockRunTool: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/chat-tools", () => ({
  CHAT_TOOLS: [
    { name: "lookup_product", description: "", input_schema: {} },
    { name: "check_calendar_availability", description: "", input_schema: {} },
  ],
  runTool: (...args: unknown[]) => mockRunTool(...args),
}));
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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
  // The route emits `data: {"text":"..."}\n\n` chunks then `data: [DONE]\n\n`.
  // Concatenate the text fields for a quick assertion target.
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
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.ANTHROPIC_CHAT_MODEL = "claude-3-5-haiku-latest";
    mockGetConfig.mockImplementation(() =>
      Promise.resolve({
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
        ANTHROPIC_CHAT_MODEL: process.env.ANTHROPIC_CHAT_MODEL ?? "",
      }),
    );
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
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hello there!" }],
      }),
    );
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await readSseText(res)).toBe("Hello there!");
  });

  it("declares both tools when calling Anthropic", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      }),
    );
    const { POST } = await import("@/app/api/chat/route");
    await POST(makeRequest({ messages: [{ role: "user", content: "Hi" }] }));
    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.tools).toHaveLength(2);
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual([
      "lookup_product",
      "check_calendar_availability",
    ]);
  });

  it("caps history to last 10 turns", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "ok" }],
      }),
    );
    const { POST } = await import("@/app/api/chat/route");
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    await POST(makeRequest({ messages }));
    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.messages).toHaveLength(10);
  });

  it("returns 503 when Anthropic API key is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 502 when Anthropic returns a non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("rate limited", { status: 429 }),
    );
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(res.status).toBe(502);
  });

  it("dispatches tool_use blocks, feeds results back, then streams the final text", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "tu-1",
            name: "lookup_product",
            input: { query: "serverless" },
          },
        ],
      }),
    );
    mockRunTool.mockResolvedValueOnce(
      "Found 1 match: Serverless Starter (€2400).",
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Serverless Starter is €2400." }],
      }),
    );

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({
        messages: [{ role: "user", content: "Got a serverless package?" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(mockRunTool).toHaveBeenCalledWith("lookup_product", {
      query: "serverless",
    });
    expect(await readSseText(res)).toBe("Serverless Starter is €2400.");

    const secondBody = JSON.parse(
      (mockFetch.mock.calls[1][1] as RequestInit).body as string,
    );
    expect(secondBody.messages).toHaveLength(3);
    expect(secondBody.messages[1].role).toBe("assistant");
    expect(secondBody.messages[2].role).toBe("user");
    expect(secondBody.messages[2].content[0].type).toBe("tool_result");
    expect(secondBody.messages[2].content[0].tool_use_id).toBe("tu-1");
  });

  it("falls back to a contact-page nudge if the loop exceeds the iteration cap", async () => {
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: `tu-${i}`,
              name: "lookup_product",
              input: { query: "loop" },
            },
          ],
        }),
      );
    }
    mockRunTool.mockResolvedValue("no match");

    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "stuck" }] }),
    );
    expect(res.status).toBe(200);
    const text = await readSseText(res);
    expect(text.toLowerCase()).toContain("contact page");
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
