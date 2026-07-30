import { describe, it, expect, beforeEach, vi } from "vitest";

const { callWorkersAiChatMock, parseWorkersAiToolCallMock } = vi.hoisted(() => ({
  callWorkersAiChatMock: vi.fn(),
  parseWorkersAiToolCallMock: vi.fn(),
}));

const {
  fetchSeoMetricsMock,
  fetchPipelineMetricsMock,
  fetchEmailMetricsMock,
  fetchStripeMetricsMock,
} = vi.hoisted(() => ({
  fetchSeoMetricsMock: vi.fn(),
  fetchPipelineMetricsMock: vi.fn(),
  fetchEmailMetricsMock: vi.fn(),
  fetchStripeMetricsMock: vi.fn(),
}));

vi.mock("@/lib/workers-ai-client", () => ({
  buildWorkersAiToolProtocol: () => "tools",
  callWorkersAiChat: (...args: unknown[]) => callWorkersAiChatMock(...args),
  parseWorkersAiToolCall: (...args: unknown[]) => parseWorkersAiToolCallMock(...args),
}));

vi.mock("@/lib/voice-brief-sources", () => ({
  fetchSeoMetrics: (...a: unknown[]) => fetchSeoMetricsMock(...a),
  fetchPipelineMetrics: (...a: unknown[]) => fetchPipelineMetricsMock(...a),
  fetchEmailMetrics: (...a: unknown[]) => fetchEmailMetricsMock(...a),
  fetchStripeMetrics: (...a: unknown[]) => fetchStripeMetricsMock(...a),
}));

import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";

describe("agent-voice-brief.runVoiceBriefAgent", () => {
  beforeEach(() => {
    callWorkersAiChatMock.mockReset();
    parseWorkersAiToolCallMock.mockReset();
    fetchSeoMetricsMock.mockReset();
    fetchPipelineMetricsMock.mockReset();
    fetchEmailMetricsMock.mockReset();
    fetchStripeMetricsMock.mockReset();
  });

  it("returns the narrative when the agent emits emit_brief on the first turn", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Quiet week so far."}}');
    parseWorkersAiToolCallMock.mockReturnValueOnce({
      name: "emit_brief",
      args: { narrative: "Quiet week so far." },
    });
    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Quiet week so far.");
    expect(r.sources).toEqual([]);
  });

  it("falls back to a stock string when emit_brief has empty narrative", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"   "}}');
    parseWorkersAiToolCallMock.mockReturnValueOnce({
      name: "emit_brief",
      args: { narrative: "   " },
    });
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/no brief produced/i);
  });

  it("calls a data tool, then emits the brief on the next turn", async () => {
    fetchStripeMetricsMock.mockResolvedValueOnce({ orders: 7, revenueEuros: 1234 });
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"get_stripe_revenue","args":{}}')
      .mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Steady week."}}');
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "get_stripe_revenue", args: {} })
      .mockReturnValueOnce({ name: "emit_brief", args: { narrative: "Steady week." } });

    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Steady week.");
    const stripe = r.sources.find((s) => s.name === "get_stripe_revenue");
    expect(stripe?.status).toBe("ok");
    expect(stripe?.detail).toMatch(/7 paid orders.*1234/);
  });

  it("classifies an empty source (null fetch) as skipped", async () => {
    fetchSeoMetricsMock.mockResolvedValueOnce(null);
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"get_seo_metrics","args":{}}')
      .mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Brief."}}');
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "get_seo_metrics", args: {} })
      .mockReturnValueOnce({ name: "emit_brief", args: { narrative: "Brief." } });

    const r = await runVoiceBriefAgent();
    const seo = r.sources.find((s) => s.name === "get_seo_metrics");
    expect(seo?.status).toBe("skipped");
    expect(seo?.detail).toMatch(/no data/i);
  });

  it("classifies a tool that throws past its retries as failed", async () => {
    fetchPipelineMetricsMock.mockRejectedValue(new Error("EspoCRM 500"));
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"get_pipeline_stats","args":{}}')
      .mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Brief."}}');
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "get_pipeline_stats", args: {} })
      .mockReturnValueOnce({ name: "emit_brief", args: { narrative: "Brief." } });

    const r = await runVoiceBriefAgent();
    const pipe = r.sources.find((s) => s.name === "get_pipeline_stats");
    expect(pipe?.status).toBe("failed");
    expect(pipe?.detail).toMatch(/failed after retries/i);
    expect(fetchPipelineMetricsMock).toHaveBeenCalledTimes(3);
  });

  it("returns the joined text when the agent stops without emit_brief", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("Stopped early.");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Stopped early.");
  });

  it("returns a friendly fallback when the agent stops with no text and no tools", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce("");
    parseWorkersAiToolCallMock.mockReturnValueOnce(null);
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/agent produced no narrative/i);
  });

  it("returns the iteration-budget fallback when the agent never emits", async () => {
    fetchSeoMetricsMock.mockResolvedValue({ clicks: 100, impressions: 1000, ctr: 10 });
    callWorkersAiChatMock.mockResolvedValue('{"tool":"get_seo_metrics","args":{}}');
    parseWorkersAiToolCallMock.mockReturnValue({ name: "get_seo_metrics", args: {} });
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/exceeded its iteration budget/i);
  });

  it("handles an unknown tool name as a recorded outcome", async () => {
    callWorkersAiChatMock
      .mockResolvedValueOnce('{"tool":"get_telemetry","args":{}}')
      .mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Brief."}}');
    parseWorkersAiToolCallMock
      .mockReturnValueOnce({ name: "get_telemetry", args: {} })
      .mockReturnValueOnce({ name: "emit_brief", args: { narrative: "Brief." } });
    const r = await runVoiceBriefAgent();
    const unknown = r.sources.find((s) => s.name === "get_telemetry");
    expect(unknown).toBeDefined();
    expect(unknown?.detail).toMatch(/Unknown tool/);
  });

  it("uses the provided dateLabel verbatim in the initial user message", async () => {
    callWorkersAiChatMock.mockResolvedValueOnce('{"tool":"emit_brief","args":{"narrative":"Brief."}}');
    parseWorkersAiToolCallMock.mockReturnValueOnce({
      name: "emit_brief",
      args: { narrative: "Brief." },
    });
    await runVoiceBriefAgent({ dateLabel: "2026-W24" });
    const firstCall = callWorkersAiChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    const userMsg = firstCall.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("2026-W24");
  });

  it("propagates Workers AI infrastructure errors to the caller", async () => {
    callWorkersAiChatMock.mockRejectedValueOnce(new Error("ThrottlingException"));
    await expect(runVoiceBriefAgent()).rejects.toThrow(/ThrottlingException/);
  });
});
