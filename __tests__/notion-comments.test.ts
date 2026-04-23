import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  listComments,
  addComment,
  replyToDiscussion,
  getCommentCount,
} from "@/lib/notion-comments";

describe("notion-comments.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── listComments ─────────────────────────────────────────────

  describe("listComments", () => {
    it("fetches comments for a page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: "comment-1",
                parent: { page_id: "page-1" },
                discussion_id: "disc-1",
                created_time: "2026-01-01T00:00:00.000Z",
                last_edited_time: "2026-01-01T00:00:00.000Z",
                created_by: { id: "user-1" },
                rich_text: [{ plain_text: "Great doc!" }],
              },
              {
                id: "comment-2",
                parent: { page_id: "page-1" },
                discussion_id: "disc-1",
                created_time: "2026-01-02T00:00:00.000Z",
                last_edited_time: "2026-01-02T00:00:00.000Z",
                created_by: { id: "user-2" },
                rich_text: [{ plain_text: "Agreed!" }],
              },
            ],
            has_more: false,
          }),
      });

      const comments = await listComments("page-1");
      expect(comments).toHaveLength(2);
      expect(comments[0].text).toBe("Great doc!");
      expect(comments[0].discussionId).toBe("disc-1");
      expect(comments[0].createdByUserId).toBe("user-1");
      expect(comments[1].text).toBe("Agreed!");
    });

    it("includes block_id in URL query param", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });

      await listComments("block-xyz");
      expect(mockFetch.mock.calls[0][0]).toContain("block_id=block-xyz");
    });

    it("returns empty when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      const comments = await listComments("page-1");
      expect(comments).toEqual([]);
    });

    it("returns empty on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("error"),
      });
      const comments = await listComments("page-1");
      expect(comments).toEqual([]);
    });
  });

  // ─── addComment ──────────────────────────────────────────────

  describe("addComment", () => {
    it("creates a comment on a page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "new-comment",
            parent: { page_id: "page-1" },
            discussion_id: "disc-new",
            created_time: "2026-01-01T00:00:00.000Z",
            last_edited_time: "2026-01-01T00:00:00.000Z",
            created_by: { id: "bot-1" },
            rich_text: [{ plain_text: "Hello from bot" }],
          }),
      });

      const comment = await addComment("page-1", "Hello from bot");
      expect(comment).not.toBeNull();
      expect(comment!.text).toBe("Hello from bot");
      expect(comment!.parentPageId).toBe("page-1");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.parent.page_id).toBe("page-1");
      expect(body.rich_text[0].text.content).toBe("Hello from bot");
    });

    it("truncates text to 2000 chars", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "c",
            parent: {},
            discussion_id: "",
            created_time: "",
            last_edited_time: "",
            created_by: {},
            rich_text: [],
          }),
      });

      const longText = "x".repeat(3000);
      await addComment("page-1", longText);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.rich_text[0].text.content.length).toBe(2000);
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      expect(await addComment("page-1", "text")).toBeNull();
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad request"),
      });
      expect(await addComment("page-1", "text")).toBeNull();
    });
  });

  // ─── replyToDiscussion ───────────────────────────────────────

  describe("replyToDiscussion", () => {
    it("sends discussion_id in body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "reply-1",
            parent: { page_id: "page-1" },
            discussion_id: "disc-1",
            created_time: "",
            last_edited_time: "",
            created_by: {},
            rich_text: [{ plain_text: "Reply text" }],
          }),
      });

      const reply = await replyToDiscussion("disc-1", "Reply text");
      expect(reply!.text).toBe("Reply text");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.discussion_id).toBe("disc-1");
      expect(body.rich_text[0].text.content).toBe("Reply text");
    });

    it("returns null when not configured", async () => {
      process.env.NOTION_API_KEY = "";
      resetIntegrationCache();
      expect(await replyToDiscussion("disc-1", "text")).toBeNull();
    });
  });

  // ─── getCommentCount ─────────────────────────────────────────

  describe("getCommentCount", () => {
    it("returns the number of comments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { id: "c1", parent: {}, discussion_id: "", created_time: "", last_edited_time: "", created_by: {}, rich_text: [] },
              { id: "c2", parent: {}, discussion_id: "", created_time: "", last_edited_time: "", created_by: {}, rich_text: [] },
              { id: "c3", parent: {}, discussion_id: "", created_time: "", last_edited_time: "", created_by: {}, rich_text: [] },
            ],
            has_more: false,
          }),
      });

      const count = await getCommentCount("page-1");
      expect(count).toBe(3);
    });

    it("returns 0 when no comments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], has_more: false }),
      });
      expect(await getCommentCount("page-1")).toBe(0);
    });
  });
});
