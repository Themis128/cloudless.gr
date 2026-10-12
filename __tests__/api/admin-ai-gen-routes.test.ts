/**
 * Tests for /api/admin/ai/{assistant,copy,audience,campaign,report-insights}.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const adminAi = vi.hoisted(() => ({
  adminAiNotConfiguredResponse: vi.fn(
    () => NextResponse.json({ error: "Admin AI not configured." }, { status: 503 })
  ),
  generateAdminAiText: vi.fn(),
  isAdminAiConfiguredAsync: vi.fn(),
}));
vi.mock("@/lib/admin-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-ai")>();
  return {
    ...actual,
    adminAiNotConfiguredResponse: adminAi.adminAiNotConfiguredResponse,
    generateAdminAiText: adminAi.generateAdminAiText,
    isAdminAiConfiguredAsync: adminAi.isAdminAiConfiguredAsync,
  };
});

const tools = vi.hoisted(() => ({
  ASSISTANT_TOOLS: [{ name: "search_notion" }],
  runAssistantTool: vi.fn(),
}));
vi.mock("@/lib/admin-assistant-tools", () => ({
  ASSISTANT_TOOLS: tools.ASSISTANT_TOOLS,
  runAssistantTool: tools.runAssistantTool,
}));

const workersAi = vi.hoisted(() => ({
  buildWorkersAiToolProtocol: vi.fn(() => "TOOLS-PROTOCOL"),
  callWorkersAiChat: vi.fn(),
  parseWorkersAiToolCall: vi.fn(),
  isWorkersAiConfigured: vi.fn(),
}));
vi.mock("@/lib/workers-ai-client", () => workersAi);

const nvidia = vi.hoisted(() => ({
  isNvidiaProxyConfigured: vi.fn(),
  callNvidiaProxyChat: vi.fn(),
}));
vi.mock("@/lib/nvidia-proxy-client", () => nvidia);

const ollama = vi.hoisted(() => ({
  isOllamaConfigured: vi.fn(),
  callOllamaChat: vi.fn(),
}));
vi.mock("@/lib/ollama-client", () => ollama);

const rag = vi.hoisted(() => ({ retrieveAdminRagContext: vi.fn() }));
vi.mock("@/lib/admin-rag", () => ({
  retrieveAdminRagContext: rag.retrieveAdminRagContext,
}));

import { POST as assistantPost } from "@/app/api/admin/ai/assistant/route";
import { POST as copyPost } from "@/app/api/admin/ai/copy/route";
import { POST as audiencePost } from "@/app/api/admin/ai/audience/route";
import { POST as campaignPost } from "@/app/api/admin/ai/campaign/route";
import { POST as insightsPost } from "@/app/api/admin/ai/report-insights/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const AI = "http://localhost/api/admin/ai";

describe("POST /api/admin/ai/assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    adminAi.isAdminAiConfiguredAsync.mockResolvedValue(true);
    adminAi.generateAdminAiText.mockResolvedValue({
      text: "gemini answer",
      provider: "gemini",
    });
    rag.retrieveAdminRagContext.mockResolvedValue("rag ctx");
    nvidia.isNvidiaProxyConfigured.mockReturnValue(false);
    workersAi.isWorkersAiConfigured.mockReturnValue(false);
    ollama.isOllamaConfigured.mockReturnValue(false);
    tools.runAssistantTool.mockResolvedValue("tool result");
  });

  const msgs = { messages: [{ role: "user", content: "hi" }] };

  it("401s non-admin; validates messages array before config gate", async () => {
    apiAuth.ok = false;
    expect((await assistantPost(post(`${AI}/assistant`, msgs))).status).toBe(
      401
    );
    apiAuth.ok = true;

    expect((await assistantPost(post(`${AI}/assistant`, "{bad"))).status).toBe(
      400
    );
    expect((await assistantPost(post(`${AI}/assistant`, {}))).status).toBe(400);
    expect(
      (await assistantPost(post(`${AI}/assistant`, { messages: [] }))).status
    ).toBe(400);

    adminAi.isAdminAiConfiguredAsync.mockResolvedValue(false);
    expect(
      (await assistantPost(post(`${AI}/assistant`, msgs))).status
    ).toBe(503);
  });

  it("falls back to Gemini when no tool backend is configured", async () => {
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j.provider).toBe("gemini");
    expect(j.response).toBe("gemini answer");
    expect(rag.retrieveAdminRagContext).toHaveBeenCalledWith("hi");
  });

  it("runs the Workers-AI tool loop and returns a direct reply", async () => {
    workersAi.isWorkersAiConfigured.mockReturnValue(true);
    workersAi.callWorkersAiChat.mockResolvedValue("final answer");
    workersAi.parseWorkersAiToolCall.mockReturnValue(null);
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j).toMatchObject({ response: "final answer", provider: "workers-ai" });
  });

  it("executes tool calls across iterations then answers", async () => {
    workersAi.isWorkersAiConfigured.mockReturnValue(true);
    workersAi.callWorkersAiChat
      .mockResolvedValueOnce("call tool")
      .mockResolvedValueOnce("done");
    workersAi.parseWorkersAiToolCall
      .mockReturnValueOnce({ name: "search_notion", args: { q: "x" } })
      .mockReturnValueOnce(null);
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j.toolsUsed).toEqual(["search_notion"]);
    expect(j.response).toBe("done");
    expect(tools.runAssistantTool).toHaveBeenCalledWith("search_notion", {
      q: "x",
    });
  });

  it("hits the iteration limit and reports it", async () => {
    workersAi.isWorkersAiConfigured.mockReturnValue(true);
    workersAi.callWorkersAiChat.mockResolvedValue("call tool");
    workersAi.parseWorkersAiToolCall.mockReturnValue({
      name: "search_notion",
      args: {},
    });
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j.response).toContain("tool-use limit");
    expect(workersAi.callWorkersAiChat).toHaveBeenCalledTimes(4);
  });

  it("falls back to Gemini when the tool loop throws; 502s on total failure", async () => {
    nvidia.isNvidiaProxyConfigured.mockReturnValue(true);
    nvidia.callNvidiaProxyChat.mockRejectedValue(new Error("nv down"));
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j.provider).toBe("gemini");

    adminAi.generateAdminAiText.mockRejectedValue(new Error("all down"));
    expect(
      (await assistantPost(post(`${AI}/assistant`, msgs))).status
    ).toBe(502);
  });

  it("uses ollama when it's the only backend; tolerates rag failure", async () => {
    ollama.isOllamaConfigured.mockReturnValue(true);
    ollama.callOllamaChat.mockResolvedValue("ollama says");
    workersAi.parseWorkersAiToolCall.mockReturnValue(null);
    rag.retrieveAdminRagContext.mockRejectedValue(new Error("rag down"));
    const j = await (
      await assistantPost(post(`${AI}/assistant`, msgs))
    ).json();
    expect(j.provider).toBe("ollama");
    expect(ollama.callOllamaChat).toHaveBeenCalled();
  });
});

describe("copy / audience / campaign / report-insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    adminAi.isAdminAiConfiguredAsync.mockResolvedValue(true);
    adminAi.generateAdminAiText.mockResolvedValue({
      text: '{"v":1}',
      provider: "gemini",
    });
  });

  it("copy: validates service, parses fenced JSON, 503/500 paths", async () => {
    expect((await copyPost(post(`${AI}/copy`, {}))).status).toBe(400);
    expect((await copyPost(post(`${AI}/copy`, "{bad"))).status).toBe(400);

    adminAi.isAdminAiConfiguredAsync.mockResolvedValue(false);
    expect(
      (await copyPost(post(`${AI}/copy`, { service: "x" }))).status
    ).toBe(503);
    adminAi.isAdminAiConfiguredAsync.mockResolvedValue(true);

    const j = await (
      await copyPost(
        post(`${AI}/copy`, { service: "Cloud", platform: "LinkedIn" })
      )
    ).json();
    expect(j.variants).toEqual({ v: 1 });
    expect(j.provider).toBe("gemini");

    // non-JSON text → { raw }
    adminAi.generateAdminAiText.mockResolvedValue({
      text: "not json at all",
      provider: "gemini",
    });
    const j2 = await (
      await copyPost(post(`${AI}/copy`, { service: "x" }))
    ).json();
    expect(j2.variants).toEqual({ raw: "not json at all" });

    // generation failure — AdminAiNotConfigured name → 503, else 500
    const e1 = new Error("cfg");
    e1.name = "AdminAiNotConfigured";
    adminAi.generateAdminAiText.mockRejectedValue(e1);
    expect(
      (await copyPost(post(`${AI}/copy`, { service: "x" }))).status
    ).toBe(503);
    adminAi.generateAdminAiText.mockRejectedValue(new Error("boom"));
    expect(
      (await copyPost(post(`${AI}/copy`, { service: "x" }))).status
    ).toBe(500);
  });

  it("audience: validates description, returns parsed targeting", async () => {
    expect((await audiencePost(post(`${AI}/audience`, {}))).status).toBe(400);
    const j = await (
      await audiencePost(
        post(`${AI}/audience`, {
          description: "SaaS founders",
          platforms: ["Meta"],
        })
      )
    ).json();
    expect(j.targeting).toEqual({ v: 1 });
    adminAi.generateAdminAiText.mockRejectedValue(new Error("boom"));
    expect(
      (
        await audiencePost(post(`${AI}/audience`, { description: "d" }))
      ).status
    ).toBe(500);
  });

  it("campaign: validates brief, returns strategy", async () => {
    expect((await campaignPost(post(`${AI}/campaign`, {}))).status).toBe(400);
    const j = await (
      await campaignPost(post(`${AI}/campaign`, { brief: "launch" }))
    ).json();
    expect(j.strategy).toEqual({ v: 1 });
  });

  it("report-insights: validates metrics object, returns insights text", async () => {
    expect(
      (await insightsPost(post(`${AI}/report-insights`, {}))).status
    ).toBe(400);
    expect(
      (
        await insightsPost(
          post(`${AI}/report-insights`, { metrics: "nope" })
        )
      ).status
    ).toBe(400);

    adminAi.generateAdminAiText.mockResolvedValue({
      text: "insightful words",
      provider: "gemini",
    });
    const j = await (
      await insightsPost(
        post(`${AI}/report-insights`, { metrics: { clicks: 5 } })
      )
    ).json();
    expect(j.insights).toBe("insightful words");

    const e1 = new Error("cfg");
    e1.name = "AdminAiNotConfigured";
    adminAi.generateAdminAiText.mockRejectedValue(e1);
    expect(
      (
        await insightsPost(
          post(`${AI}/report-insights`, { metrics: { clicks: 5 } })
        )
      ).status
    ).toBe(503);
  });
});
