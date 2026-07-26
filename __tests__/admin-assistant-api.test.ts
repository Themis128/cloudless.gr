import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock admin auth
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(),
}));

// Mock Anthropic lib
vi.mock("@/lib/anthropic", () => ({
  isAnthropicConfigured: vi.fn(),
  getAnthropicApiKey: vi.fn(),
}));

// Mock tool implementations (keeps tests fast and network-free)
vi.mock("@/lib/admin-assistant-tools", () => ({
  ASSISTANT_TOOLS: [
    {
      name: "search_notion",
      description: "search",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ],
  runAssistantTool: vi.fn(),
}));

import { POST } from "@/app/api/admin/ai/assistant/route";
import { requireAdmin } from "@/lib/api-auth";
import { isAnthropicConfigured, getAnthropicApiKey } from "@/lib/anthropic";
import { runAssistantTool } from "@/lib/admin-assistant-tools";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/ai/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/ai/assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: true,
      user: { email: "admin@test.com" },
    } as never);
    vi.mocked(isAnthropicConfigured).mockResolvedValue(true);
    vi.mocked(getAnthropicApiKey).mockResolvedValue("sk-ant-test");
  });

  it("returns 401 when not admin", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as never);
    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when Anthropic not configured", async () => {
    vi.mocked(isAnthropicConfigured).mockResolvedValue(false);
    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(503);
  });

  it("returns 400 when messages missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is empty array", async () => {
    const res = await POST(makeReq({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns direct text response on end_turn", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Hello admin!" }],
      }),
    });

    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe("Hello admin!");
    expect(data.toolsUsed).toEqual([]);
  });

  it("runs tool and returns final response", async () => {
    vi.mocked(runAssistantTool).mockResolvedValue("• Page A (notion.so/a)");

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stop_reason: "tool_use",
          content: [
            { type: "tool_use", id: "tu_1", name: "search_notion", input: { query: "projects" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Found: Page A" }],
        }),
      });

    const res = await POST(makeReq({ messages: [{ role: "user", content: "find projects" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe("Found: Page A");
    expect(data.toolsUsed).toContain("search_notion");
  });

  it("returns 502 on Anthropic API error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "error" });
    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(502);
  });
});
