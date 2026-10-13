// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetGoldSection = vi.fn();
const mockGetInsight = vi.fn();
const mockGetInsightsIndex = vi.fn();
const mockListInsightDomains = vi.fn();
const mockGetSeoFromLake = vi.fn();
const mockRetrieveAdminRagContext = vi.fn();
const mockNotifyTeam = vi.fn();

vi.mock("@/lib/datalake-serve", () => ({
  getGoldSection: (...a: unknown[]) => mockGetGoldSection(...a),
  getInsight: (...a: unknown[]) => mockGetInsight(...a),
  getInsightsIndex: (...a: unknown[]) => mockGetInsightsIndex(...a),
  listInsightDomains: (...a: unknown[]) => mockListInsightDomains(...a),
  getSeoFromLake: (...a: unknown[]) => mockGetSeoFromLake(...a),
}));

vi.mock("@/lib/admin-rag", () => ({
  retrieveAdminRagContext: (...a: unknown[]) => mockRetrieveAdminRagContext(...a),
}));

vi.mock("@/lib/email", () => ({
  notifyTeam: (...a: unknown[]) => mockNotifyTeam(...a),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: vi.fn().mockReturnValue(null) }));

import { runAssistantTool } from "@/lib/admin-assistant-tools";

beforeEach(() => {
  vi.clearAllMocks();
  mockRetrieveAdminRagContext.mockResolvedValue("");
  mockGetSeoFromLake.mockResolvedValue({
    snapshot: { clicks: 10, impressions: 100, ctr: 0.1, position: 5, days: 28 },
    keywords: [
      { query: "cloud consulting", clicks: 5, impressions: 60, ctr: 0.08, position: 4 },
      { query: "aws migration", clicks: 3, impressions: 40, ctr: 0.07, position: 6 },
    ],
    fetchedAt: "2026-10-01T00:00:00Z",
    source: "datalake-gold",
  });
  mockListInsightDomains.mockResolvedValue({
    domains: [{ domain: "seo" }, { domain: "ads" }],
  });
});

describe("runAssistantTool", () => {
  it("search_lake_docs formats RAG blocks when the index hits", async () => {
    mockRetrieveAdminRagContext.mockResolvedValue("Doc A\nline2\n\nDoc B");
    const out = await runAssistantTool("search_lake_docs", { query: "seo", limit: 5 });
    expect(out).toContain("• Doc A — line2");
    expect(out).toContain("• Doc B");
  });

  it("search_notion falls back to lake keywords matching the query", async () => {
    const out = await runAssistantTool("search_notion", { query: "cloud" });
    expect(out).toContain('keyword "cloud consulting"');
    expect(out).not.toContain("aws migration");
  });

  it("search_notion lists insight domains when nothing matches", async () => {
    const out = await runAssistantTool("search_notion", { query: "zzzz" });
    expect(out).toContain("No lake docs found");
    expect(out).toContain("seo, ads");
  });

  it("get_datalake_section reports missing, error, and populated states", async () => {
    mockGetGoldSection.mockResolvedValueOnce(null);
    expect(await runAssistantTool("get_datalake_section", { section: "x" })).toContain(
      'Section "x" not found'
    );

    mockGetGoldSection.mockResolvedValueOnce({ section: "x", error: "boom" });
    expect(await runAssistantTool("get_datalake_section", { section: "x" })).toContain(
      'Section "x" error: boom'
    );

    mockGetGoldSection.mockResolvedValueOnce({
      section: "top_keywords",
      rowCount: 2,
      rows: [{ query: "a" }, { query: "b" }],
    });
    const out = await runAssistantTool("get_datalake_section", { section: "top_keywords" });
    expect(JSON.parse(out)).toMatchObject({ section: "top_keywords", rowCount: 2 });
  });

  it("get_lake_insight reports missing domains and serializes hits", async () => {
    mockGetInsight.mockResolvedValueOnce(null);
    mockGetInsightsIndex.mockResolvedValue({ domains: ["seo"] });
    const missing = await runAssistantTool("get_lake_insight", { domain: "ads" });
    expect(missing).toContain('Insight "ads" missing');
    expect(missing).toContain('"seo"');

    mockGetInsight.mockResolvedValueOnce({
      domain: "seo",
      summary: "Organic clicks up",
      bullets: ["b1"],
      generated_at: "2026-10-01T00:00:00Z",
    });
    const hit = await runAssistantTool("get_lake_insight", { domain: "seo" });
    expect(JSON.parse(hit)).toMatchObject({ domain: "seo", summary: "Organic clicks up" });
  });

  it("get_recent_orders renders stripe_revenue gold rows", async () => {
    mockGetGoldSection.mockResolvedValueOnce({
      section: "stripe_revenue",
      rows: [{ day: "2026-10-01", revenue: 1200.5, count: 4 }],
    });
    const out = await runAssistantTool("get_recent_orders", { limit: 3 });
    expect(out).toContain("2026-10-01 — EUR 1200.50 — events 4");

    mockGetGoldSection.mockResolvedValueOnce(null);
    expect(await runAssistantTool("get_recent_orders", {})).toContain("No recent orders");
  });

  it("draft_email returns the draft, and sends via notifyTeam when send=true", async () => {
    const draft = await runAssistantTool("draft_email", {
      subject: "Hi",
      body: "Body",
      send: false,
    });
    expect(draft).toContain("Draft ready");
    expect(mockNotifyTeam).not.toHaveBeenCalled();

    const sent = await runAssistantTool("draft_email", {
      subject: "Hi",
      body: "Body",
      send: true,
    });
    expect(sent).toContain('Email sent to team: "Hi"');
    expect(mockNotifyTeam).toHaveBeenCalledWith("Hi", "Body");
  });

  it("returns Unknown tool for unhandled names", async () => {
    expect(await runAssistantTool("nope", {})).toBe("Unknown tool: nope");
  });
});
