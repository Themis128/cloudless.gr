import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock integrations
vi.mock("@/lib/integrations", () => ({
  getIntegrations: vi.fn().mockReturnValue({
    NOTION_API_KEY: "secret_test_key_12345",
  }),
  isConfigured: vi.fn().mockReturnValue(true),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  searchPages,
  searchDatabases,
  listUsers,
  getBotUser,
  getUser,
  getDatabaseSchema,
  getPropertyOptions,
} from "@/lib/notion-search";
import { isConfigured } from "@/lib/integrations";

describe("notion-search.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── searchPages ──────────────────────────────────────────────────

  describe("searchPages", () => {
    it("sends POST to /search with query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                object: "page",
                id: "page-1",
                url: "https://notion.so/page-1",
                last_edited_time: "2026-01-01T00:00:00.000Z",
                parent: { type: "database_id", database_id: "db-1" },
                icon: { emoji: "📄" },
                properties: { Title: { title: [{ plain_text: "Test Page" }] } },
              },
            ],
            has_more: false,
            next_cursor: null,
          }),
      });

      const result = await searchPages("test");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe("Test Page");
      expect(result.results[0].type).toBe("page");
      expect(result.results[0].icon).toBe("📄");
      expect(result.hasMore).toBe(false);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe("test");
    });

    it("passes filter for page type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });

      await searchPages("q", { filter: "page" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.filter).toEqual({ value: "page", property: "object" });
    });

    it("passes startCursor for pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });

      await searchPages("q", { startCursor: "cursor-abc" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.start_cursor).toBe("cursor-abc");
    });

    it("returns empty when not configured", async () => {
      vi.mocked(isConfigured).mockReturnValueOnce(false);
      const result = await searchPages("test");
      expect(result.results).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("err") });
      const result = await searchPages("test");
      expect(result.results).toEqual([]);
    });

    it("maps database results correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                object: "database",
                id: "db-1",
                title: [{ plain_text: "My Database" }],
                url: "https://notion.so/db-1",
                last_edited_time: "2026-01-01T00:00:00.000Z",
                parent: { type: "workspace", workspace: true },
                icon: null,
              },
            ],
            has_more: true,
            next_cursor: "next-abc",
          }),
      });

      const result = await searchPages("");
      expect(result.results[0].type).toBe("database");
      expect(result.results[0].title).toBe("My Database");
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("next-abc");
    });

    it("caps limit at 100", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });

      await searchPages("q", { limit: 200 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.page_size).toBe(100);
    });
  });

  // ─── searchDatabases ─────────────────────────────────────────────

  describe("searchDatabases", () => {
    it("filters to databases only", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });

      await searchDatabases("test", 10);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.filter).toEqual({ value: "database", property: "object" });
    });
  });

  // ─── listUsers ───────────────────────────────────────────────────

  describe("listUsers", () => {
    it("lists workspace users", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: "user-1",
                name: "Alice",
                type: "person",
                avatar_url: "https://img.com/alice.png",
                person: { email: "alice@test.com" },
              },
              {
                id: "bot-1",
                name: "My Bot",
                type: "bot",
                avatar_url: null,
                bot: { owner: { user: { person: { email: "bot@test.com" } } } },
              },
            ],
          }),
      });

      const users = await listUsers();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("Alice");
      expect(users[0].email).toBe("alice@test.com");
      expect(users[0].type).toBe("person");
      expect(users[1].type).toBe("bot");
    });

    it("returns empty when not configured", async () => {
      vi.mocked(isConfigured).mockReturnValueOnce(false);
      const users = await listUsers();
      expect(users).toEqual([]);
    });

    it("returns empty on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("unauthorized") });
      const users = await listUsers();
      expect(users).toEqual([]);
    });
  });

  // ─── getBotUser ──────────────────────────────────────────────────

  describe("getBotUser", () => {
    it("returns the bot user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "bot-id",
            name: "Cloudless Bot",
            type: "bot",
            avatar_url: "",
            bot: {},
          }),
      });

      const bot = await getBotUser();
      expect(bot?.name).toBe("Cloudless Bot");
      expect(bot?.type).toBe("bot");
    });

    it("returns null when not configured", async () => {
      vi.mocked(isConfigured).mockReturnValueOnce(false);
      expect(await getBotUser()).toBeNull();
    });
  });

  // ─── getUser ─────────────────────────────────────────────────────

  describe("getUser", () => {
    it("returns a specific user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "user-1",
            name: "Bob",
            type: "person",
            avatar_url: "https://img.com/bob.png",
            person: { email: "bob@test.com" },
          }),
      });

      const user = await getUser("user-1");
      expect(user?.name).toBe("Bob");
      expect(user?.email).toBe("bob@test.com");
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve("not found") });
      expect(await getUser("bad-id")).toBeNull();
    });
  });

  // ─── getDatabaseSchema ──────────────────────────────────────────

  describe("getDatabaseSchema", () => {
    it("returns schema with properties", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "db-id",
            title: [{ plain_text: "My DB" }],
            url: "https://notion.so/db",
            properties: {
              Name: { id: "title", type: "title" },
              Status: {
                id: "abc",
                type: "select",
                select: {
                  options: [
                    { name: "Active", color: "green" },
                    { name: "Archived", color: "gray" },
                  ],
                },
              },
              Tags: {
                id: "def",
                type: "multi_select",
                multi_select: {
                  options: [{ name: "Frontend", color: "blue" }],
                },
              },
            },
          }),
      });

      const schema = await getDatabaseSchema("db-id");
      expect(schema?.title).toBe("My DB");
      expect(schema?.properties).toHaveLength(3);

      const status = schema?.properties.find((p) => p.name === "Status");
      expect(status?.type).toBe("select");
      expect(status?.options).toHaveLength(2);
      expect(status?.options?.[0].name).toBe("Active");

      const tags = schema?.properties.find((p) => p.name === "Tags");
      expect(tags?.options).toHaveLength(1);
    });

    it("returns null when not configured", async () => {
      vi.mocked(isConfigured).mockReturnValueOnce(false);
      expect(await getDatabaseSchema("db-id")).toBeNull();
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve("not found") });
      expect(await getDatabaseSchema("bad-id")).toBeNull();
    });
  });

  // ─── getPropertyOptions ─────────────────────────────────────────

  describe("getPropertyOptions", () => {
    it("returns options for a select property", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "db-id",
            title: [],
            url: "",
            properties: {
              Status: {
                id: "abc",
                type: "select",
                select: {
                  options: [
                    { name: "Open", color: "green" },
                    { name: "Closed", color: "red" },
                  ],
                },
              },
            },
          }),
      });

      const options = await getPropertyOptions("db-id", "Status");
      expect(options).toHaveLength(2);
      expect(options[0].name).toBe("Open");
    });

    it("returns empty for non-existent property", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "db-id",
            title: [],
            url: "",
            properties: {},
          }),
      });

      const options = await getPropertyOptions("db-id", "Missing");
      expect(options).toEqual([]);
    });
  });
});
