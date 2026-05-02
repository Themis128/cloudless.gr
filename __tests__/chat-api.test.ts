import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const EVENT_MESSAGE_STOP = "message_stop";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    mockGetConfig.mockImplementation(() =>
      Promise.resolve({ ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "" }),
    );
  });

  it("returns 400 when messages array is missing", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
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

  it("returns 200 streaming response for valid messages", async () => {
    mockFetch.mockResolvedValueOnce(
      makeStreamResponse([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        `data: {"type":"${EVENT_MESSAGE_STOP}"}\n\n`,
      ])
    );
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "Hi there" }],
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("calls Anthropic API with correct model", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      `data: {"type":"${EVENT_MESSAGE_STOP}"}\n\n`,
    ]));
    const { POST } = await import("@/app/api/chat/route");
    await POST(makeRequest({
      messages: [{ role: "user", content: "Test" }],
    }));
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.model).toBe("claude-haiku-4-5-20251001");
    expect(callBody.stream).toBe(true);
  });

  it("caps messages to last 10 turns", async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([
      `data: {"type":"${EVENT_MESSAGE_STOP}"}\n\n`,
    ]));
    const { POST } = await import("@/app/api/chat/route");
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));
    await POST(makeRequest({ messages }));
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.messages.length).toBeLessThanOrEqual(10);
  });

  it("returns 503 when Anthropic API key is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "Hello" }],
    }));
    expect(res.status).toBe(503);
  });
});
