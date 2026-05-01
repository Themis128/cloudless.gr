import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockNotionFetch, mockNotionFetchAll } = vi.hoisted(() => ({
  mockNotionFetch: vi.fn(),
  mockNotionFetchAll: vi.fn(),
}));

vi.mock("@/lib/notion", () => ({
  notionFetch: (...args: unknown[]) => mockNotionFetch(...args),
  notionFetchAll: (...args: unknown[]) => mockNotionFetchAll(...args),
}));

import { saveSubmission, listSubmissions, updateSubmissionStatus } from "@/lib/notion-forms";

const SUBMITTED_AT = "Submitted At";
const CREATED_TIME = "2026-04-01T00:00:00Z";
const SUBMITTED_AT_DATE = "2026-04-01T10:00:00Z";
const SUB_1_URL = "https://notion.so/sub-1";

describe("notion-forms.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveSubmission", () => {
    it("creates a page in the submissions database", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "new-page-id" });

      const result = await saveSubmission({
        name: "John Doe",
        email: "john@example.com",
        company: "Acme",
        service: "Cloud Consulting",
        message: "I need help with AWS.",
        source: "contact",
      });

      expect(result).toBe("new-page-id");
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.parent.database_id).toBe("submissions-db-123");
      expect(body.properties.Name.title[0].text.content).toBe("John Doe");
      expect(body.properties.Email.email).toBe("john@example.com");
      expect(body.properties.Status.select.name).toBe("New");
    });

    it("returns null when not configured", async () => {
      vi.stubEnv("NOTION_API_KEY", "");
      const result = await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: "Test message",
      });
      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("Notion error"));

      const result = await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: "Test message",
      });

      expect(result).toBeNull();
    });

    it("truncates message to 2000 chars", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "page-id" });

      const longMessage = "x".repeat(3000);
      await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: longMessage,
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      const messageContent = body.properties.Message.rich_text[0].text.content;
      expect(messageContent.length).toBe(2000);
    });
  });

  describe("listSubmissions", () => {
    it("returns mapped submission records", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        {
          id: "sub-1",
          url: SUB_1_URL,
          created_time: CREATED_TIME,
          properties: {
            Name: { title: [{ plain_text: "Alice" }] },
            Email: { email: "alice@example.com" },
            Company: { rich_text: [{ plain_text: "TechCorp" }] },
            Service: { rich_text: [{ plain_text: "DevOps" }] },
            Message: { rich_text: [{ plain_text: "Help me" }] },
            Status: { select: { name: "New" } },
            Source: { select: { name: "contact" } },
            [SUBMITTED_AT]: { date: { start: SUBMITTED_AT_DATE } },
          },
        },
      ]);

      const subs = await listSubmissions();

      expect(subs).toHaveLength(1);
      expect(subs[0].name).toBe("Alice");
      expect(subs[0].email).toBe("alice@example.com");
      expect(subs[0].status).toBe("New");
    });

    it("returns empty array on error", async () => {
      mockNotionFetchAll.mockRejectedValueOnce(new Error("API error"));

      const subs = await listSubmissions();

      expect(subs).toEqual([]);
    });
  });

  describe("updateSubmissionStatus", () => {
    it("patches the page status", async () => {
      mockNotionFetch.mockResolvedValueOnce({});

      const result = await updateSubmissionStatus("page-123", "In Review");

      expect(result).toBe(true);
      expect(mockNotionFetch).toHaveBeenCalledWith(
        "/pages/page-123",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("In Review");
    });

    it("returns false on error", async () => {
      mockNotionFetch.mockRejectedValueOnce(new Error("error"));

      const result = await updateSubmissionStatus("page-123", "Done");

      expect(result).toBe(false);
    });

    it("returns false when not configured (no API key)", async () => {
      vi.stubEnv("NOTION_API_KEY", "");
      const result = await updateSubmissionStatus("page-123", "Done");
      expect(result).toBe(false);
      expect(mockNotionFetch).not.toHaveBeenCalled();
    });
  });

  describe("saveSubmission edge cases", () => {
    it("handles missing optional fields (company, service, source)", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "page-id" });

      await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: "Hello",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Company.rich_text[0].text.content).toBe("");
      expect(body.properties.Service.rich_text[0].text.content).toBe("");
      expect(body.properties.Source.select.name).toBe("contact");
    });

    it("includes custom source when provided", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "page-id" });

      await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: "Hello",
        source: "subscribe",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Source.select.name).toBe("subscribe");
    });

    it("truncates name to 200 characters", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "page-id" });

      await saveSubmission({
        name: "x".repeat(300),
        email: "test@test.com",
        message: "Hello",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties.Name.title[0].text.content.length).toBe(200);
    });

    it("sets Submitted At date", async () => {
      mockNotionFetch.mockResolvedValueOnce({ id: "page-id" });

      await saveSubmission({
        name: "Test",
        email: "test@test.com",
        message: "Hello",
      });

      const body = JSON.parse(mockNotionFetch.mock.calls[0][1].body);
      expect(body.properties[SUBMITTED_AT].date.start).toBeDefined();
      expect(new Date(body.properties[SUBMITTED_AT].date.start).toString()).not.toBe("Invalid Date");
    });
  });

  describe("listSubmissions edge cases", () => {
    it("maps all fields correctly from Notion response", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        {
          id: "sub-1",
          url: SUB_1_URL,
          created_time: CREATED_TIME,
          properties: {
            Name: { title: [{ plain_text: "Alice" }] },
            Email: { email: "alice@example.com" },
            Company: { rich_text: [{ plain_text: "TechCorp" }] },
            Service: { rich_text: [{ plain_text: "DevOps" }] },
            Message: { rich_text: [{ plain_text: "Help needed" }] },
            Status: { select: { name: "In Review" } },
            Source: { select: { name: "subscribe" } },
            [SUBMITTED_AT]: { date: { start: SUBMITTED_AT_DATE } },
          },
        },
      ]);

      const subs = await listSubmissions();

      expect(subs[0].company).toBe("TechCorp");
      expect(subs[0].service).toBe("DevOps");
      expect(subs[0].message).toBe("Help needed");
      expect(subs[0].source).toBe("subscribe");
      expect(subs[0].status).toBe("In Review");
      expect(subs[0].submittedAt).toBe(SUBMITTED_AT_DATE);
      expect(subs[0].url).toBe(SUB_1_URL);
    });

    it("handles missing optional fields with defaults", async () => {
      mockNotionFetchAll.mockResolvedValueOnce([
        {
          id: "sub-2",
          url: "https://notion.so/sub-2",
          created_time: CREATED_TIME,
          properties: {
            Name: { title: [] },
            Email: {},
            Company: { rich_text: [] },
            Service: { rich_text: [] },
            Message: { rich_text: [] },
            Status: {},
            Source: {},
            [SUBMITTED_AT]: {},
          },
        },
      ]);

      const subs = await listSubmissions();

      expect(subs[0].name).toBe("");
      expect(subs[0].email).toBe("");
      expect(subs[0].company).toBe("");
      expect(subs[0].status).toBe("New");
      expect(subs[0].source).toBe("contact");
      expect(subs[0].submittedAt).toBe(CREATED_TIME);
    });

    it("slices results to the requested limit", async () => {
      const pages = Array.from({ length: 30 }, (_, i) => ({
        id: `sub-${i}`,
        url: `https://notion.so/sub-${i}`,
        created_time: CREATED_TIME,
        properties: {
          Name: { title: [{ plain_text: `User ${i}` }] },
          Email: { email: `user${i}@example.com` },
          Company: { rich_text: [] },
          Service: { rich_text: [] },
          Message: { rich_text: [] },
          Status: { select: { name: "New" } },
          Source: { select: { name: "contact" } },
          [SUBMITTED_AT]: { date: { start: SUBMITTED_AT_DATE } },
        },
      }));
      mockNotionFetchAll.mockResolvedValueOnce(pages);

      const subs = await listSubmissions(10);

      expect(subs).toHaveLength(10);
    });

    it("returns all results when limit exceeds total", async () => {
      const pages = Array.from({ length: 5 }, (_, i) => ({
        id: `sub-${i}`,
        url: `https://notion.so/sub-${i}`,
        created_time: CREATED_TIME,
        properties: {
          Name: { title: [{ plain_text: `User ${i}` }] },
          Email: { email: `user${i}@example.com` },
          Company: { rich_text: [] },
          Service: { rich_text: [] },
          Message: { rich_text: [] },
          Status: { select: { name: "New" } },
          Source: { select: { name: "contact" } },
          [SUBMITTED_AT]: { date: { start: SUBMITTED_AT_DATE } },
        },
      }));
      mockNotionFetchAll.mockResolvedValueOnce(pages);

      const subs = await listSubmissions(200);

      expect(subs).toHaveLength(5);
    });

    it("returns empty when not configured", async () => {
      vi.stubEnv("NOTION_API_KEY", "");
      const subs = await listSubmissions();
      expect(subs).toEqual([]);
      expect(mockNotionFetchAll).not.toHaveBeenCalled();
    });
  });
});
