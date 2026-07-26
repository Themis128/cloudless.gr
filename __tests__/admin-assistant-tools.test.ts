import { describe, it, expect, beforeEach, vi } from "vitest";

const { searchPagesMock, listRecentCheckoutSessionsMock, notifyTeamMock } = vi.hoisted(() => ({
  searchPagesMock: vi.fn(),
  listRecentCheckoutSessionsMock: vi.fn(),
  notifyTeamMock: vi.fn(),
}));

vi.mock("@/lib/notion-search", () => ({
  searchPages: (...args: unknown[]) => searchPagesMock(...args),
}));

vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...args: unknown[]) => listRecentCheckoutSessionsMock(...args),
}));

vi.mock("@/lib/email", () => ({
  notifyTeam: (...args: unknown[]) => notifyTeamMock(...args),
}));

import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/admin-assistant-tools";

describe("admin-assistant-tools", () => {
  beforeEach(() => {
    searchPagesMock.mockReset();
    listRecentCheckoutSessionsMock.mockReset();
    notifyTeamMock.mockReset();
  });

  describe("ASSISTANT_TOOLS registry", () => {
    it("exposes the 3 expected tools by name", () => {
      const names = ASSISTANT_TOOLS.map((t) => t.name);
      expect(names).toEqual(["search_notion", "get_recent_orders", "draft_email"]);
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

  describe("runAssistantTool — search_notion", () => {
    it("formats results as markdown bullets", async () => {
      searchPagesMock.mockResolvedValueOnce({
        results: [
          {
            title: "Q4 OKRs",
            url: "https://notion.so/q4",
            type: "page",
            lastEditedTime: "2026-01-15T10:00:00Z",
          },
          {
            title: "",
            url: "https://notion.so/untitled",
            type: "database",
            lastEditedTime: "2026-01-20T10:00:00Z",
          },
        ],
      });
      const out = await runAssistantTool("search_notion", { query: "Q4" });
      expect(out).toContain("[Q4 OKRs](https://notion.so/q4)");
      expect(out).toContain("(untitled)");
      expect(out).toContain("page");
      expect(out).toContain("database");
    });

    it("returns a friendly message when no results", async () => {
      searchPagesMock.mockResolvedValueOnce({ results: [] });
      const out = await runAssistantTool("search_notion", { query: "nothing" });
      expect(out).toMatch(/no notion pages found/i);
    });

    it("clamps limit at 20", async () => {
      searchPagesMock.mockResolvedValueOnce({ results: [] });
      await runAssistantTool("search_notion", { query: "x", limit: 100 });
      expect(searchPagesMock).toHaveBeenCalledWith("x", { limit: 20 });
    });

    it("defaults limit to 8 when omitted", async () => {
      searchPagesMock.mockResolvedValueOnce({ results: [] });
      await runAssistantTool("search_notion", { query: "x" });
      expect(searchPagesMock).toHaveBeenCalledWith("x", { limit: 8 });
    });

    it("returns the error message instead of throwing", async () => {
      searchPagesMock.mockRejectedValueOnce(new Error("Notion 401"));
      const out = await runAssistantTool("search_notion", { query: "x" });
      expect(out).toMatch(/search_notion error.*Notion 401/);
    });
  });

  describe("runAssistantTool — get_recent_orders", () => {
    it("formats orders as bullet lines with amount/status/date", async () => {
      listRecentCheckoutSessionsMock.mockResolvedValueOnce({
        orders: [
          {
            email: "alice@example.com",
            amount: 12500,
            currency: "EUR",
            paymentStatus: "paid",
            created: 1_700_000_000,
          },
        ],
      });
      const out = await runAssistantTool("get_recent_orders", {});
      expect(out).toContain("alice@example.com");
      expect(out).toContain("EUR 125.00");
      expect(out).toContain("paid");
    });

    it("falls back to 'unknown' when no email", async () => {
      listRecentCheckoutSessionsMock.mockResolvedValueOnce({
        orders: [
          {
            email: null,
            amount: 100,
            currency: "EUR",
            paymentStatus: "open",
            created: 1_700_000_000,
          },
        ],
      });
      const out = await runAssistantTool("get_recent_orders", {});
      expect(out).toContain("unknown");
    });

    it("returns a friendly message when no orders", async () => {
      listRecentCheckoutSessionsMock.mockResolvedValueOnce({ orders: [] });
      const out = await runAssistantTool("get_recent_orders", {});
      expect(out).toMatch(/no recent orders/i);
    });

    it("clamps limit at 20 and defaults to 5", async () => {
      listRecentCheckoutSessionsMock.mockResolvedValueOnce({ orders: [] });
      await runAssistantTool("get_recent_orders", { limit: 999 });
      expect(listRecentCheckoutSessionsMock).toHaveBeenCalledWith(20);

      listRecentCheckoutSessionsMock.mockResolvedValueOnce({ orders: [] });
      await runAssistantTool("get_recent_orders", {});
      expect(listRecentCheckoutSessionsMock).toHaveBeenLastCalledWith(5);
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
