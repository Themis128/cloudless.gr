import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-ai", () => ({
  isAdminAiConfiguredAsync: vi.fn(),
  generateAdminAiText: vi.fn(),
  adminAiNotConfiguredResponse: () =>
    Response.json({ error: "Admin AI not configured." }, { status: 503 }),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: vi.fn(),
  callWorkersAiChat: vi.fn(),
  parseWorkersAiToolCall: vi.fn(),
  buildWorkersAiToolProtocol: vi.fn(() => "tools protocol"),
}));

vi.mock("@/lib/admin-rag", () => ({
  retrieveAdminRagContext: vi.fn().mockResolvedValue(""),
}));

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
import { isAdminAiConfiguredAsync, generateAdminAiText } from "@/lib/admin-ai";
import {
  isWorkersAiConfigured,
  callWorkersAiChat,
  parseWorkersAiToolCall,
} from "@/lib/workers-ai-client";
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
    vi.mocked(isAdminAiConfiguredAsync).mockResolvedValue(true);
    vi.mocked(isWorkersAiConfigured).mockReturnValue(true);
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

  it("returns 503 when Admin AI not configured", async () => {
    vi.mocked(isAdminAiConfiguredAsync).mockResolvedValue(false);
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

  it("returns direct text response when no tool call", async () => {
    vi.mocked(callWorkersAiChat).mockResolvedValue("Hello admin!");
    vi.mocked(parseWorkersAiToolCall).mockReturnValue(null);

    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe("Hello admin!");
    expect(data.toolsUsed).toEqual([]);
    expect(data.provider).toBe("workers-ai");
  });

  it("runs tool and returns final response", async () => {
    vi.mocked(runAssistantTool).mockResolvedValue("• Page A (notion.so/a)");
    vi.mocked(callWorkersAiChat)
      .mockResolvedValueOnce('{"tool":"search_notion","args":{"query":"projects"}}')
      .mockResolvedValueOnce("Found: Page A");
    vi.mocked(parseWorkersAiToolCall)
      .mockReturnValueOnce({ name: "search_notion", args: { query: "projects" } })
      .mockReturnValueOnce(null);

    const res = await POST(makeReq({ messages: [{ role: "user", content: "find projects" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe("Found: Page A");
    expect(data.toolsUsed).toContain("search_notion");
  });

  it("falls back to generateAdminAiText when Workers AI fails", async () => {
    vi.mocked(callWorkersAiChat).mockRejectedValue(new Error("workers down"));
    vi.mocked(generateAdminAiText).mockResolvedValue({
      text: "Fallback answer",
      provider: "gemini",
    });

    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBe("Fallback answer");
    expect(data.provider).toBe("gemini");
  });

  it("returns 502 when all providers fail", async () => {
    vi.mocked(callWorkersAiChat).mockRejectedValue(new Error("workers down"));
    vi.mocked(generateAdminAiText).mockRejectedValue(new Error("gemini down"));
    const res = await POST(makeReq({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(502);
  });
});
