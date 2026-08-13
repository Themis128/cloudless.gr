import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  retrieveAdminRagContextMock,
  getSeoFromLakeMock,
  getGoldSectionMock,
  getInsightMock,
  listInsightDomainsMock,
  notifyTeamMock,
} = vi.hoisted(() => ({
  retrieveAdminRagContextMock: vi.fn(),
  getSeoFromLakeMock: vi.fn(),
  getGoldSectionMock: vi.fn(),
  getInsightMock: vi.fn(),
  listInsightDomainsMock: vi.fn(),
  notifyTeamMock: vi.fn(),
}));

vi.mock("@/lib/admin-rag", () => ({
  retrieveAdminRagContext: (...args: unknown[]) => retrieveAdminRagContextMock(...args),
}));

vi.mock("@/lib/datalake-serve", () => ({
  getSeoFromLake: (...args: unknown[]) => getSeoFromLakeMock(...args),
  getGoldSection: (...args: unknown[]) => getGoldSectionMock(...args),
  getInsight: (...args: unknown[]) => getInsightMock(...args),
  getInsightsIndex: vi.fn(async () => ({ generated_at: "", domains: [] })),
  listInsightDomains: (...args: unknown[]) => listInsightDomainsMock(...args),
}));

vi.mock("@/lib/email", () => ({
  notifyTeam: (...args: unknown[]) => notifyTeamMock(...args),
}));

import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/admin-assistant-tools";

describe("admin-assistant-tools", () => {
  beforeEach(() => {
    retrieveAdminRagContextMock.mockReset();
    getSeoFromLakeMock.mockReset();
    getGoldSectionMock.mockReset();
    getInsightMock.mockReset();
    listInsightDomainsMock.mockReset();
    notifyTeamMock.mockReset();
    listInsightDomainsMock.mockResolvedValue({ generated_at: "", domains: [] });
    getSeoFromLakeMock.mockResolvedValue({ keywords: [], snapshot: {}, fetchedAt: "", source: "datalake-gold" });
  });

  describe("ASSISTANT_TOOLS registry", () => {
    it("exposes lake-backed tools by name", () => {
      const names = ASSISTANT_TOOLS.map((t) => t.name);
      expect(names).toEqual([
        "search_notion",
        "get_datalake_section",
        "get_lake_insight",
        "get_recent_orders",
        "draft_email",
      ]);
    });

    it("every tool has Anthropic-shaped input_schema", () => {
      for (const tool of ASSISTANT_TOOLS) {
        expect(tool.input_schema.type).toBe("object");
        expect(typeof tool.input_schema.properties).toBe("object");
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it("search_notion requires 'query'", () => {
      const t = ASSISTANT_TOOLS.find((t) => t.name === "search_notion")!;
      expect(t.input_schema.required).toContain("query");
    });

    it("draft_email requires subject + body", () => {
      const t = ASSISTANT_TOOLS.find((t) => t.name === "draft_email")!;
      expect(t.input_schema.required).toEqual(expect.arrayContaining(["subject", "body"]));
    });
  });

  describe("runAssistantTool — search_notion (lake RAG)", () => {
    it("formats RAG context as bullets", async () => {
      retrieveAdminRagContextMock.mockResolvedValueOnce(
        "[1] (appflowy) Q4 OKRs\nGoals text\n\n[2] (appflowy) Untitled\nMore"
      );
      const out = await runAssistantTool("search_notion", { query: "Q4" });
      expect(out).toContain("Q4 OKRs");
      expect(out).toContain("Untitled");
    });

    it("returns a friendly message when no results", async () => {
      retrieveAdminRagContextMock.mockResolvedValueOnce("");
      getSeoFromLakeMock.mockResolvedValueOnce({ keywords: [], fetchedAt: "", source: "datalake-gold", snapshot: {} });
      const out = await runAssistantTool("search_notion", { query: "nothing" });
      expect(out).toMatch(/no lake docs found/i);
    });

    it("falls back to gold keywords", async () => {
      retrieveAdminRagContextMock.mockResolvedValueOnce("");
      getSeoFromLakeMock.mockResolvedValueOnce({
        keywords: [{ query: "cloud hosting", clicks: 10, impressions: 100, ctr: 0.1, position: 3 }],
        fetchedAt: "",
        source: "datalake-gold",
        snapshot: {},
      });
      const out = await runAssistantTool("search_notion", { query: "cloud" });
      expect(out).toContain("cloud hosting");
    });

    it("returns the error message instead of throwing", async () => {
      retrieveAdminRagContextMock.mockRejectedValueOnce(new Error("Vectorize 401"));
      const out = await runAssistantTool("search_notion", { query: "x" });
      expect(out).toMatch(/search_notion error.*Vectorize 401/);
    });
  });

  describe("runAssistantTool — get_recent_orders (gold)", () => {
    it("formats gold revenue rows", async () => {
      getGoldSectionMock.mockResolvedValueOnce({
        section: "stripe_revenue",
        rows: [{ day: "2026-08-01", revenue: 125, count: 2 }],
        rowCount: 1,
      });
      const out = await runAssistantTool("get_recent_orders", {});
      expect(out).toContain("2026-08-01");
      expect(out).toContain("EUR 125.00");
    });

    it("returns a friendly message when gold missing", async () => {
      getGoldSectionMock.mockResolvedValueOnce({
        section: "stripe_revenue",
        error: "not available",
      });
      const out = await runAssistantTool("get_recent_orders", {});
      expect(out).toMatch(/no recent orders/i);
    });
  });

  describe("runAssistantTool — draft_email", () => {
    it("returns a preview when send=false (default)", async () => {
      const out = await runAssistantTool("draft_email", {
        subject: "Hello",
        body: "Body text",
      });
      expect(out).toContain("not sent yet");
      expect(out).toContain("Subject: Hello");
      expect(out).toContain("Body text");
      expect(notifyTeamMock).not.toHaveBeenCalled();
    });

    it("sends the email when send=true", async () => {
      notifyTeamMock.mockResolvedValueOnce(undefined);
      const out = await runAssistantTool("draft_email", {
        subject: "Important",
        body: "Body",
        send: true,
      });
      expect(notifyTeamMock).toHaveBeenCalledWith("Important", "Body");
      expect(out).toMatch(/email sent to team.*Important/i);
    });

    it("returns the error message when notifyTeam throws", async () => {
      notifyTeamMock.mockRejectedValueOnce(new Error("SES rate limit"));
      const out = await runAssistantTool("draft_email", {
        subject: "x",
        body: "y",
        send: true,
      });
      expect(out).toMatch(/draft_email error.*SES rate limit/);
    });
  });

  describe("runAssistantTool — unknown tool", () => {
    it("returns 'Unknown tool: <name>' rather than throwing", async () => {
      const out = await runAssistantTool("delete_everything", {});
      expect(out).toBe("Unknown tool: delete_everything");
    });
  });
});
