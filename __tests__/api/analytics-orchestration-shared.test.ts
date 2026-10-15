import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  isAdminAiConfiguredAsync: vi.fn(),
  preprocess: vi.fn(),
  runOrch: vi.fn(),
  parseBody: vi.fn(),
  getInsight: vi.fn(),
  getLake: vi.fn(),
  getBucket: vi.fn(),
  insightKey: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/admin-ai", () => ({ isAdminAiConfiguredAsync: m.isAdminAiConfiguredAsync }));
vi.mock("@/lib/analytics-agent-orchestrator", () => ({
  preprocessStripeAnalyticsSnapshot: m.preprocess,
  runAnalyticsAgentOrchestration: m.runOrch,
}));
vi.mock("@/lib/analytics-orchestration-input", () => ({
  parseAnalyticsOrchestrationRequestBody: m.parseBody,
}));
vi.mock("@/lib/datalake-serve", () => ({
  getInsight: m.getInsight,
  getStripeSnapshotFromLake: m.getLake,
}));
vi.mock("@/lib/r2-client", () => ({ getDataLakeBucketFromEnv: m.getBucket }));
vi.mock("@/lib/datalake-insights", () => ({ insightObjectKey: m.insightKey }));

import { prepareOrchestration } from "@/app/api/admin/ai/analytics-orchestration/_shared";
import { NextRequest } from "next/server";

const lakeSnap = {
  windowDays: 30,
  generatedAt: "2026-10-01T00:00:00Z",
  totals: { events: 12, revenueMinor: 5000 },
  byCategory: {},
  byStatus: {},
  byCurrency: {},
  dailyTrend: [],
  error: undefined as string | undefined,
};

function req(body?: unknown, url = "https://x.test/api") {
  return new NextRequest(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockResolvedValue({ ok: true });
  m.getLake.mockResolvedValue(lakeSnap);
  m.preprocess.mockReturnValue({ pre: "processed" });
  m.parseBody.mockImplementation((body: Record<string, unknown>) => ({
    windowDays: 30,
    connectors: ["quicksight", "powerbi"],
    goals: Array.isArray(body?.goals) ? (body.goals as string[]) : [],
    reportTitle: "Stripe Analytics Report",
  }));
  m.isAdminAiConfiguredAsync.mockResolvedValue(false);
  m.getInsight.mockResolvedValue(null);
  m.insightKey.mockReturnValue("insights/orchestration.json");
});

describe("prepareOrchestration", () => {
  it("returns the auth response when requireAdmin fails", async () => {
    const authRes = new Response("denied", { status: 401 });
    m.requireAdmin.mockResolvedValueOnce({ ok: false, response: authRes });
    const out = await prepareOrchestration(req(), "fail");
    expect(out).toEqual({ ok: false, response: authRes });
  });

  it("serves the cached lake insight without a live LLM call", async () => {
    m.getInsight.mockResolvedValueOnce({
      summary: "Revenue is up",
      bullets: ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9"],
    });
    const out = await prepareOrchestration(req({}), "fail");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.source).toBe("datalake-gold");
    expect(out.data.orchestration.workflow).toHaveLength(3);
    expect(out.data.orchestration.report.keyInsights).toHaveLength(8); // sliced
    expect(out.data.orchestration.report.nextMoves).toHaveLength(5);
    expect(m.runOrch).not.toHaveBeenCalled();
  });

  it("flags sparse gold as a risk in the cached path", async () => {
    m.getLake.mockResolvedValueOnce({ ...lakeSnap, totals: { events: 0, revenueMinor: 0 } });
    m.getInsight.mockResolvedValueOnce({ summary: "s", bullets: ["b"] });
    const out = await prepareOrchestration(req({}), "fail");
    expect(out.ok && out.data.orchestration.report.risks[0]).toContain("Sparse");
  });

  it("falls back to ETL guidance when no cache and AI not configured", async () => {
    m.getInsight.mockResolvedValueOnce(null);
    const out = await prepareOrchestration(req({}), "fail");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.source).toBe("datalake-gold");
    expect(out.data.orchestration.report.executiveSummary).toContain("ETL");
  });

  it("live_llm path runs the orchestrator and caches the insight to R2", async () => {
    m.isAdminAiConfiguredAsync.mockResolvedValue(true);
    m.getInsight
      .mockResolvedValueOnce({ summary: "rev insight" }) // revenue
      .mockResolvedValueOnce({ summary: "exec insight" }); // executive
    const put = vi.fn().mockResolvedValue(undefined);
    m.getBucket.mockReturnValue({ put });
    m.runOrch.mockResolvedValueOnce({
      report: { executiveSummary: "exec", keyInsights: ["k1"] },
      workflow: [],
    });
    const out = await prepareOrchestration(req({ live_llm: "1", goals: ["g1"] }), "fail");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.source).toBe("live_llm");
    const orchArgs = m.runOrch.mock.calls[0][0];
    expect(orchArgs.goals).toEqual(["g1", "Lake revenue insight: rev insight", "Lake executive insight: exec insight"]);
    expect(put).toHaveBeenCalledWith(
      "insights/orchestration.json",
      expect.stringContaining('"exec"'),
      { httpMetadata: { contentType: "application/json" } }
    );
  });

  it("no live_llm param + no cache + AI configured flips to the live path", async () => {
    m.getInsight.mockResolvedValue(null); // no cached insight
    m.isAdminAiConfiguredAsync.mockResolvedValue(true);
    m.runOrch.mockResolvedValueOnce({
      report: { executiveSummary: "live" },
      workflow: [],
    });
    const out = await prepareOrchestration(req({}), "fail");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data.source).toBe("live_llm");
    expect(m.runOrch).toHaveBeenCalled();
  });

  it("503s on live_llm when AI is not configured", async () => {
    m.isAdminAiConfiguredAsync.mockResolvedValue(false);
    const out = await prepareOrchestration(req({ live_llm: true }), "fail");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.response.status).toBe(503);
    const body = await out.response.json();
    expect(body.error).toContain("Admin AI not configured");
  });

  it("500s when the orchestrator throws; R2 put failure only warns", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.isAdminAiConfiguredAsync.mockResolvedValue(true);
    m.getInsight.mockResolvedValue(null);
    m.runOrch.mockRejectedValueOnce(new Error("llm boom"));
    const out = await prepareOrchestration(req({ live_llm: true }), "orchestration failed");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.response.status).toBe(500);
    err.mockRestore();

    // bucket.put throws → warn, still ok:true
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.runOrch.mockResolvedValueOnce({ report: { executiveSummary: "e", keyInsights: [] }, workflow: [] });
    m.getBucket.mockReturnValue({ put: vi.fn().mockRejectedValue(new Error("r2 down")) });
    const out2 = await prepareOrchestration(req({ live_llm: true }), "fail");
    expect(out2.ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("failed to cache insight"), "r2 down");
    warn.mockRestore();
  });

  it("live_llm search param + parse defaults on unparseable body", async () => {
    const r = new NextRequest("https://x.test/api?live_llm=1", { method: "POST", body: "not json{{" });
    m.isAdminAiConfiguredAsync.mockResolvedValue(true);
    m.getInsight.mockResolvedValue(null);
    m.getBucket.mockReturnValue(undefined);
    m.runOrch.mockResolvedValueOnce({ report: { executiveSummary: "e", keyInsights: [] }, workflow: [] });
    const out = await prepareOrchestration(r, "fail");
    expect(out.ok).toBe(true);
    // parseBody never called for broken body — defaults used
    expect(m.parseBody).not.toHaveBeenCalled();
  });
});
