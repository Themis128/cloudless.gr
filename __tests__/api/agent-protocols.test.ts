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

vi.mock("@/lib/slack-notify", () => ({ slackBookingNotify: vi.fn() }));

import { POST as mcpPost, GET as mcpGet } from "@/app/api/mcp/route";
import { POST as a2aPost } from "@/app/api/a2a/route";

function req(url: string, body: unknown) {
  return new NextRequest(new Request(url, { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  mockGetAvailableSlots.mockReset();
  mockBookConsultation.mockReset();
  mockChatLoop.mockReset();
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
});
