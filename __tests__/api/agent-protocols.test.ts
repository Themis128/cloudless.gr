/**
 * /api/mcp (MCP Streamable HTTP) and /api/a2a (A2A JSON-RPC) protocol
 * endpoints. Lib seams (@/lib/cal-com, @/lib/workers-ai-chat) are mocked —
 * they are the true external boundaries (Cal.com API, Workers AI).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAvailableSlots = vi.fn();
const mockBookConsultation = vi.fn();
vi.mock("@/lib/cal-com", () => ({
  getAvailableSlots: (...args: unknown[]) => mockGetAvailableSlots(...args),
  bookConsultation: (...args: unknown[]) => mockBookConsultation(...args),
}));

const mockChatLoop = vi.fn();
vi.mock("@/lib/workers-ai-chat", () => ({
  runWorkersAiChatLoop: (...args: unknown[]) => mockChatLoop(...args),
}));

const mockSlackBookingNotify = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/slack-notify", () => ({
  slackBookingNotify: (...args: unknown[]) => mockSlackBookingNotify(...args),
}));

const mockRecordNotification = vi.fn();
vi.mock("@/lib/admin-notifications", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recordNotification: (...args: unknown[]) => mockRecordNotification(...args),
}));

const mockInvalidateConsultationCache = vi.fn();
vi.mock("@/lib/content-calendar", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  invalidateConsultationCache: (...args: unknown[]) => mockInvalidateConsultationCache(...args),
}));

import { POST as mcpPost, GET as mcpGet } from "@/app/api/mcp/route";
import { POST as a2aPost } from "@/app/api/a2a/route";
import { resetRateLimitStore } from "@/lib/rate-limit";

function req(url: string, body: unknown) {
  return new NextRequest(new Request(url, { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  mockGetAvailableSlots.mockReset();
  mockBookConsultation.mockReset();
  mockChatLoop.mockReset();
  mockSlackBookingNotify.mockClear();
  mockRecordNotification.mockClear();
  mockInvalidateConsultationCache.mockClear();
  resetRateLimitStore();
});

describe("POST /api/mcp (JSON-RPC)", () => {
  it("initialize handshake returns protocol version + tools capability", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 1, method: "initialize" })
    );
    const body = await res.json();
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("cloudless-gr");
  });

  it("tools/list exposes the three real tools", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" })
    );
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(["check_availability", "book_consultation", "ask_cloudless_assistant"]);
  });

  it("tools/call check_availability returns live slots", async () => {
    mockGetAvailableSlots.mockResolvedValue([
      { start: "2026-10-26T09:00:00Z", end: "2026-10-26T09:30:00Z" },
    ]);
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "check_availability", arguments: { days_ahead: 3 } },
      })
    );
    const body = await res.json();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.slots).toHaveLength(1);
    expect(mockGetAvailableSlots).toHaveBeenCalledWith(3);
  });

  it("tools/call book_consultation rejects bad email without calling Cal.com", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "book_consultation",
          arguments: {
            name: "J",
            email: "nope",
            start: "2026-10-26T09:00:00Z",
            end: "2026-10-26T09:30:00Z",
          },
        },
      })
    );
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(mockBookConsultation).not.toHaveBeenCalled();
  });

  it("tools/call ask_cloudless_assistant forwards to the chat loop", async () => {
    mockChatLoop.mockResolvedValue("A serverless starter runs from EUR 2,400.");
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "ask_cloudless_assistant", arguments: { message: "pricing?" } },
      })
    );
    const body = await res.json();
    expect(body.result.content[0].text).toContain("serverless");
    expect(mockChatLoop).toHaveBeenCalledWith(
      expect.any(String),
      [{ role: "user", content: "pricing?" }],
      {
        allowBooking: false,
      }
    );
  });

  it("unknown method → -32601; notification (no id) → 202; bad json → -32700", async () => {
    const unk = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 9, method: "resources/list" })
    );
    expect((await unk.json()).error.code).toBe(-32601);

    const note = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", method: "notifications/initialized" })
    );
    expect(note.status).toBe(202);

    const bad = await mcpPost(
      new NextRequest(
        new Request("https://cloudless.gr/api/mcp", { method: "POST", body: "not-json" })
      )
    );
    expect((await bad.json()).error.code).toBe(-32700);
  });

  it("GET → 405 with Allow: POST (stateless transport, no SSE stream)", async () => {
    const res = await mcpGet();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("ping returns an empty result", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 6, method: "ping" })
    );
    const body = await res.json();
    expect(body.result).toEqual({});
    expect(body.id).toBe(6);
  });

  it("null body → -32600; non-2.0 jsonrpc → -32600", async () => {
    const nullBody = await mcpPost(
      new NextRequest(
        new Request("https://cloudless.gr/api/mcp", { method: "POST", body: "null" })
      )
    );
    expect((await nullBody.json()).error.code).toBe(-32600);

    const wrongVersion = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "1.0", id: 7, method: "ping" })
    );
    expect((await wrongVersion.json()).error.code).toBe(-32600);
  });

  it("tools/call unknown tool name → isError payload", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "does_not_exist", arguments: {} },
      })
    );
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Unknown tool");
  });

  it("tools/call ask_cloudless_assistant rejects an empty message", async () => {
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "ask_cloudless_assistant", arguments: { message: "   " } },
      })
    );
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe("Empty message.");
    expect(mockChatLoop).not.toHaveBeenCalled();
  });

  it("provider failure surfaces a generic error, not internals", async () => {
    mockChatLoop.mockRejectedValue(new Error("upstream 502: secret details"));
    const res = await mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "ask_cloudless_assistant", arguments: { message: "hi" } },
      })
    );
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe(
      "The service is temporarily unavailable. Please try again later."
    );
    expect(body.result.content[0].text).not.toContain("secret details");
  });

  const book = (args: Record<string, unknown>, id = 20) =>
    mcpPost(
      req("https://cloudless.gr/api/mcp", {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "book_consultation", arguments: args },
      })
    );

  it("tools/call book_consultation rejects past/invalid slot times", async () => {
    const res = await book({
      name: "Jane Doe",
      email: "jane@example.com",
      start: "2020-01-01T09:00:00Z",
      end: "2020-01-01T09:30:00Z",
    });
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe("Invalid or past slot times.");
    expect(mockBookConsultation).not.toHaveBeenCalled();
  });

  it("tools/call book_consultation reports a failed booking", async () => {
    mockBookConsultation.mockResolvedValue(null);
    const res = await book({
      name: "Jane Doe",
      email: "jane@example.com",
      start: "2099-01-01T09:00:00Z",
      end: "2099-01-01T09:30:00Z",
    });
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toBe("Failed to create booking.");
  });

  it("tools/call book_consultation success fires notification + cache invalidation", async () => {
    mockBookConsultation.mockResolvedValue({ id: 42 });
    const res = await book({
      name: "Jane Doe",
      email: "jane@example.com",
      start: "2099-01-01T09:00:00Z",
      end: "2099-01-01T09:30:00Z",
      notes: "interested in k3s",
    });
    const body = await res.json();
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.success).toBe(true);
    expect(payload.booking.id).toBe(42);
    expect(mockInvalidateConsultationCache).toHaveBeenCalled();
    expect(mockSlackBookingNotify).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com" })
    );
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ category: "booking", type: "success" })
    );
  });

  it("tools/call book_consultation is rate-limited after 5 attempts", async () => {
    const args = { name: "", email: "", start: "", end: "" };
    let last: { result?: { isError?: boolean; content: { text: string }[] } } = {};
    for (let i = 0; i < 6; i++) {
      last = await (await book(args, 30 + i)).json();
    }
    expect(last.result?.isError).toBe(true);
    expect(last.result?.content[0].text).toBe("Rate limit exceeded. Try later.");
  });

  it("POST itself is rate-limited after 30 requests per minute", async () => {
    let last = await mcpPost(
      req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 40, method: "ping" })
    );
    for (let i = 1; i < 31; i++) {
      last = await mcpPost(
        req("https://cloudless.gr/api/mcp", { jsonrpc: "2.0", id: 40 + i, method: "ping" })
      );
    }
    expect(last.status).toBe(429);
  });
});

describe("POST /api/a2a (JSON-RPC)", () => {
  it("message/send returns an agent Message", async () => {
    mockChatLoop.mockResolvedValue("We offer cloud audits.");
    const res = await a2aPost(
      req("https://cloudless.gr/api/a2a", {
        jsonrpc: "2.0",
        id: 1,
        method: "message/send",
        params: {
          message: { role: "user", parts: [{ kind: "text", text: "what do you do?" }] },
          contextId: "ctx-1",
        },
      })
    );
    const body = await res.json();
    expect(body.result.kind).toBe("message");
    expect(body.result.role).toBe("agent");
    expect(body.result.parts[0].text).toContain("cloud audits");
    expect(body.result.contextId).toBe("ctx-1");
  });

  it("message/send without text part → -32602", async () => {
    const res = await a2aPost(
      req("https://cloudless.gr/api/a2a", {
        jsonrpc: "2.0",
        id: 2,
        method: "message/send",
        params: { message: { parts: [] } },
      })
    );
    expect((await res.json()).error.code).toBe(-32602);
  });

  it("tasks/get → -32601 (no task persistence)", async () => {
    const res = await a2aPost(
      req("https://cloudless.gr/api/a2a", {
        jsonrpc: "2.0",
        id: 3,
        method: "tasks/get",
        params: {},
      })
    );
    expect((await res.json()).error.code).toBe(-32601);
  });

  it("invalid JSON → -32700; null body → -32600; missing method → -32600", async () => {
    const bad = await a2aPost(
      new NextRequest(
        new Request("https://cloudless.gr/api/a2a", { method: "POST", body: "not-json" })
      )
    );
    expect((await bad.json()).error.code).toBe(-32700);

    const nullBody = await a2aPost(
      new NextRequest(
        new Request("https://cloudless.gr/api/a2a", { method: "POST", body: "null" })
      )
    );
    expect((await nullBody.json()).error.code).toBe(-32600);

    const noMethod = await a2aPost(
      req("https://cloudless.gr/api/a2a", { jsonrpc: "2.0", id: 4 })
    );
    expect((await noMethod.json()).error.code).toBe(-32600);
  });

  it("agent failure → -32000 instead of leaking internals", async () => {
    mockChatLoop.mockRejectedValue(new Error("provider 500"));
    const res = await a2aPost(
      req("https://cloudless.gr/api/a2a", {
        jsonrpc: "2.0",
        id: 5,
        method: "message/send",
        params: { message: { parts: [{ kind: "text", text: "hello" }] } },
      })
    );
    expect((await res.json()).error.code).toBe(-32000);
  });
});
