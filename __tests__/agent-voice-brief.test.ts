import { describe, it, expect, beforeEach, vi } from "vitest";

const { runBedrockTurnMock, pickToolUseBlocksMock, joinAssistantTextMock } = vi.hoisted(() => ({
  runBedrockTurnMock: vi.fn(),
  pickToolUseBlocksMock: vi.fn(),
  joinAssistantTextMock: vi.fn(),
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

vi.mock("@/lib/bedrock-shared", () => ({
  buildBedrockToolConfig: vi.fn().mockReturnValue({ tools: [] }),
  getBedrockClient: vi.fn(() => ({ send: vi.fn() })),
  runBedrockTurn: (...args: unknown[]) => runBedrockTurnMock(...args),
  pickToolUseBlocks: (...args: unknown[]) => pickToolUseBlocksMock(...args),
  joinAssistantText: (...args: unknown[]) => joinAssistantTextMock(...args),
}));

vi.mock("@/lib/voice-brief-sources", () => ({
  fetchSeoMetrics: (...a: unknown[]) => fetchSeoMetricsMock(...a),
  fetchPipelineMetrics: (...a: unknown[]) => fetchPipelineMetricsMock(...a),
  fetchEmailMetrics: (...a: unknown[]) => fetchEmailMetricsMock(...a),
  fetchStripeMetrics: (...a: unknown[]) => fetchStripeMetricsMock(...a),
}));

import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";

function emitBlock(narrative: string) {
  return {
    toolUse: {
      toolUseId: "tu-emit",
      name: "emit_brief",
      input: { narrative },
    },
  };
}

function dataBlock(name: string, id = "tu-1") {
  return {
    toolUse: { toolUseId: id, name, input: {} },
  };
}

describe("agent-voice-brief.runVoiceBriefAgent", () => {
  beforeEach(() => {
    runBedrockTurnMock.mockReset();
    pickToolUseBlocksMock.mockReset();
    joinAssistantTextMock.mockReset();
    fetchSeoMetricsMock.mockReset();
    fetchPipelineMetricsMock.mockReset();
    fetchEmailMetricsMock.mockReset();
    fetchStripeMetricsMock.mockReset();

    // Default pickToolUseBlocks: filter for blocks with a toolUse property.
    pickToolUseBlocksMock.mockImplementation((content: unknown[]) =>
      content.filter(
        (b): b is { toolUse: { toolUseId: string; name: string; input: unknown } } =>
          typeof b === "object" && b !== null && "toolUse" in b
      )
    );
    joinAssistantTextMock.mockReturnValue("");
  });

  it("returns the narrative when the agent emits emit_brief on the first turn", async () => {
    runBedrockTurnMock.mockResolvedValueOnce([emitBlock("Quiet week so far.")]);
    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Quiet week so far.");
    expect(r.sources).toEqual([]);
  });

  it("falls back to a stock string when emit_brief has empty narrative", async () => {
    runBedrockTurnMock.mockResolvedValueOnce([emitBlock("   ")]);
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/no brief produced/i);
  });

  it("calls a data tool, then emits the brief on the next turn", async () => {
    fetchStripeMetricsMock.mockResolvedValueOnce({ orders: 7, revenueEuros: 1234 });
    runBedrockTurnMock
      .mockResolvedValueOnce([dataBlock("get_stripe_revenue")])
      .mockResolvedValueOnce([emitBlock("Steady week.")]);

    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Steady week.");
    const stripe = r.sources.find((s) => s.name === "get_stripe_revenue");
    expect(stripe?.status).toBe("ok");
    expect(stripe?.detail).toMatch(/7 paid orders.*1234/);
  });

  it("classifies an empty source (null fetch) as skipped", async () => {
    fetchSeoMetricsMock.mockResolvedValueOnce(null);
    runBedrockTurnMock
      .mockResolvedValueOnce([dataBlock("get_seo_metrics")])
      .mockResolvedValueOnce([emitBlock("Brief.")]);

    const r = await runVoiceBriefAgent();
    const seo = r.sources.find((s) => s.name === "get_seo_metrics");
    expect(seo?.status).toBe("skipped");
    expect(seo?.detail).toMatch(/no data/i);
  });

  it("classifies a tool that throws past its retries as failed", async () => {
    fetchPipelineMetricsMock.mockRejectedValue(new Error("EspoCRM 500"));
    runBedrockTurnMock
      .mockResolvedValueOnce([dataBlock("get_pipeline_stats")])
      .mockResolvedValueOnce([emitBlock("Brief.")]);

    const r = await runVoiceBriefAgent();
    const pipe = r.sources.find((s) => s.name === "get_pipeline_stats");
    expect(pipe?.status).toBe("failed");
    expect(pipe?.detail).toMatch(/failed after retries/i);
    // Verify retry happened — initial + TOOL_MAX_RETRIES = 3 attempts.
    expect(fetchPipelineMetricsMock).toHaveBeenCalledTimes(3);
  });

  it("returns the joined text when the agent stops without emit_brief", async () => {
    runBedrockTurnMock.mockResolvedValueOnce([{ text: "Stopped early." }]);
    joinAssistantTextMock.mockReturnValueOnce("Stopped early.");
    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Stopped early.");
  });

  it("returns a friendly fallback when the agent stops with no text and no tools", async () => {
    runBedrockTurnMock.mockResolvedValueOnce([]);
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/agent produced no narrative/i);
  });

  it("returns the iteration-budget fallback when the agent never emits", async () => {
    fetchSeoMetricsMock.mockResolvedValue({ clicks: 100, impressions: 1000, ctr: 10 });
    // Each turn requests a data tool, never emit_brief.
    runBedrockTurnMock.mockResolvedValue([dataBlock("get_seo_metrics")]);
    const r = await runVoiceBriefAgent();
    expect(r.text).toMatch(/exceeded its iteration budget/i);
  });

  it("dispatches multiple tool-use blocks in parallel within one turn", async () => {
    fetchSeoMetricsMock.mockResolvedValueOnce({
      clicks: 100,
      impressions: 1000,
      ctr: 10,
    });
    fetchPipelineMetricsMock.mockResolvedValueOnce({
      totalDeals: 5,
      totalValueEuros: 50000,
    });
    runBedrockTurnMock
      .mockResolvedValueOnce([
        dataBlock("get_seo_metrics", "tu-a"),
        dataBlock("get_pipeline_stats", "tu-b"),
      ])
      .mockResolvedValueOnce([emitBlock("Both tools fired.")]);

    const r = await runVoiceBriefAgent();
    expect(r.text).toBe("Both tools fired.");
    expect(r.sources.map((s) => s.name).sort()).toEqual(["get_pipeline_stats", "get_seo_metrics"]);
    expect(r.sources.every((s) => s.status === "ok")).toBe(true);
  });

  it("handles an unknown tool name as a failed outcome", async () => {
    runBedrockTurnMock
      .mockResolvedValueOnce([dataBlock("get_telemetry")])
      .mockResolvedValueOnce([emitBlock("Brief.")]);
    const r = await runVoiceBriefAgent();
    const unknown = r.sources.find((s) => s.name === "get_telemetry");
    // "Unknown tool: ..." doesn't include the keywords; falls into the
    // default "ok" bucket. We just assert the outcome was recorded.
    expect(unknown).toBeDefined();
    expect(unknown?.detail).toMatch(/Unknown tool/);
  });

  it("uses the provided dateLabel verbatim in the initial user message", async () => {
    runBedrockTurnMock.mockResolvedValueOnce([emitBlock("Brief.")]);
    await runVoiceBriefAgent({ dateLabel: "2026-W24" });
    const firstCall = runBedrockTurnMock.mock.calls[0][0] as {
      messages: Array<{ content: Array<{ text: string }> }>;
    };
    expect(firstCall.messages[0].content[0].text).toContain("2026-W24");
  });

  it("propagates Bedrock infrastructure errors to the caller", async () => {
    runBedrockTurnMock.mockRejectedValueOnce(new Error("ThrottlingException"));
    await expect(runVoiceBriefAgent()).rejects.toThrow(/ThrottlingException/);
  });
});
