import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { getIntegrationsAsyncMock } = vi.hoisted(() => ({
  getIntegrationsAsyncMock: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: () => getIntegrationsAsyncMock(),
}));

import {
  NOTION_API,
  NOTION_VERSION,
  notionHeaders,
  notionFetch,
  notionFetchAll,
  notionListAll,
  notionImageProxyUrl,
  fetchBlocksDeep,
  createPage,
  updatePage,
  archivePage,
  restorePage,
  appendBlocks,
  deleteBlock,
  extractText,
  blocksToHtml,
  extractToc,
  textBlock,
  paragraphBlock,
  headingBlock,
  bulletBlock,
  numberedBlock,
  todoBlock,
  codeBlock,
  dividerBlock,
  calloutBlock,
} from "@/lib/notion";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function jsonResp(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null,
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe("notion", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getIntegrationsAsyncMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    getIntegrationsAsyncMock.mockResolvedValue({ NOTION_API_KEY: "secret_test" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("constants", () => {
    it("NOTION_API points to v1 endpoint", () => {
      expect(NOTION_API).toBe("https://api.notion.com/v1");
    });

    it("NOTION_VERSION is the documented API version", () => {
      expect(NOTION_VERSION).toBe("2022-06-28");
    });
  });

  describe("notionHeaders", () => {
    it("returns Authorization + Notion-Version + Content-Type", async () => {
      const h = await notionHeaders();
      expect(h.Authorization).toBe("Bearer secret_test");
      expect(h["Notion-Version"]).toBe(NOTION_VERSION);
      expect(h["Content-Type"]).toBe("application/json");
    });

    it("throws when NOTION_API_KEY is missing", async () => {
      getIntegrationsAsyncMock.mockResolvedValueOnce({});
      await expect(notionHeaders()).rejects.toThrow(/NOTION_API_KEY/);
    });
  });

  describe("notionFetch", () => {
    it("rejects paths containing :// (SSRF guard)", async () => {
      await expect(notionFetch("https://evil.example/x")).rejects.toThrow(/invalid path/);
    });

    it("rejects paths starting with //", async () => {
      await expect(notionFetch("//evil.example/x")).rejects.toThrow(/invalid path/);
    });

    it("returns JSON on 200", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ id: "p1" }));
      const r = await notionFetch<{ id: string }>("/pages/p1");
      expect(r.id).toBe("p1");
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.notion.com/v1/pages/p1");
    });

    it("retries on 429 with Retry-After delay", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({}, 429, { "Retry-After": "2" }))
        .mockResolvedValueOnce(jsonResp({ ok: 1 }));
      const promise = notionFetch("/x");
      await vi.advanceTimersByTimeAsync(2_500);
      const r = (await promise) as { ok: number };
      expect(r.ok).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries on 5xx with exponential backoff", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({}, 500))
        .mockResolvedValueOnce(jsonResp({}, 502))
        .mockResolvedValueOnce(jsonResp({ ok: 1 }));
      const promise = notionFetch("/x");
      await vi.advanceTimersByTimeAsync(5_000);
      const r = (await promise) as { ok: number };
      expect(r.ok).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("throws on 4xx with the response body in the message", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: "bad" }, 400));
      await expect(notionFetch("/x")).rejects.toThrow(/Notion API error 400/);
    });

    it("throws after exhausting retries on persistent 5xx", async () => {
      fetchMock.mockResolvedValue(jsonResp({}, 500));
      const promise = notionFetch("/x");
      // Attach a no-op handler so the rejection isn't flagged as
      // unhandled while the fake-timer awaits complete.
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(promise).rejects.toThrow(/Notion API error 500/);
    });
  });

  describe("notionFetchAll (paginated POST)", () => {
    it("walks next_cursor until has_more=false", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResp({ results: [{ id: 1 }], has_more: true, next_cursor: "c1" })
        )
        .mockResolvedValueOnce(jsonResp({ results: [{ id: 2 }], has_more: false }));
      const out = await notionFetchAll<{ id: number }>("/databases/x/query");
      expect(out.map((o) => o.id)).toEqual([1, 2]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
      expect(secondBody.start_cursor).toBe("c1");
    });

    it("returns [] when first page has no results", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ results: [], has_more: false }));
      expect(await notionFetchAll("/x")).toEqual([]);
    });
  });

  describe("notionListAll (paginated GET)", () => {
    it("appends page_size + start_cursor to existing query string", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResp({ results: [1], has_more: true, next_cursor: "c1" }))
        .mockResolvedValueOnce(jsonResp({ results: [2], has_more: false }));
      const out = await notionListAll<number>("/blocks/b1/children?foo=bar");
      expect(out).toEqual([1, 2]);
      const url1 = fetchMock.mock.calls[0][0] as string;
      const url2 = fetchMock.mock.calls[1][0] as string;
      expect(url1).toContain("foo=bar&page_size=100");
      expect(url2).toContain("start_cursor=c1");
    });

    it("uses ? when path has no query string", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ results: [], has_more: false }));
      await notionListAll("/blocks/b1/children");
      expect(fetchMock.mock.calls[0][0]).toContain("?page_size=100");
    });
  });

  describe("fetchBlocksDeep", () => {
    it("recursively fetches children for blocks with has_children", async () => {
      fetchMock
        // root blocks
        .mockResolvedValueOnce(
          jsonResp({
            results: [
              { id: "b1", type: "toggle", has_children: true },
              { id: "b2", type: "paragraph", has_children: false },
            ],
            has_more: false,
          })
        )
        // b1's children
        .mockResolvedValueOnce(
          jsonResp({
            results: [{ id: "b1a", type: "paragraph", has_children: false }],
            has_more: false,
          })
        );
      const out = await fetchBlocksDeep("p1");
      expect(out).toHaveLength(2);
      expect(out[0].children).toHaveLength(1);
      expect(out[0].children?.[0].id).toBe("b1a");
      expect(out[1].children).toBeUndefined();
    });
  });

  describe("page CRUD", () => {
    it("createPage returns the new page id on success", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ id: "new-page" }));
      const id = await createPage("db1", { Name: { title: [] } });
      expect(id).toBe("new-page");
    });

    it("createPage returns null on API error", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({ message: "bad" }, 400));
      const id = await createPage("db1", {});
      expect(id).toBeNull();
    });

    it("updatePage PATCHes /pages/<id> with properties", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      const ok = await updatePage("p1", { Status: { select: { name: "done" } } });
      expect(ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/pages/p1");
      expect((init as { method: string }).method).toBe("PATCH");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.properties).toBeDefined();
    });

    it("archivePage sets archived=true", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      await archivePage("p1");
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.archived).toBe(true);
    });

    it("restorePage sets archived=false", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      await restorePage("p1");
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.archived).toBe(false);
    });

    it("update/archive/restore return false on error", async () => {
      fetchMock.mockResolvedValue(jsonResp({}, 400));
      expect(await updatePage("p1", {})).toBe(false);
      expect(await archivePage("p1")).toBe(false);
      expect(await restorePage("p1")).toBe(false);
    });
  });

  describe("block CRUD", () => {
    it("appendBlocks PATCHes /blocks/<parent>/children with children array", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      await appendBlocks("p1", [{ type: "paragraph" }]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/blocks/p1/children");
      expect((init as { method: string }).method).toBe("PATCH");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.children).toHaveLength(1);
    });

    it("appendBlocks slices children to Notion's 100-block limit", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      await appendBlocks(
        "p1",
        Array.from({ length: 250 }, (_, i) => ({ id: i }))
      );
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.children).toHaveLength(100);
    });

    it("deleteBlock DELETEs /blocks/<id>", async () => {
      fetchMock.mockResolvedValueOnce(jsonResp({}));
      await deleteBlock("b1");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/blocks/b1");
      expect((init as { method: string }).method).toBe("DELETE");
    });
  });

  describe("notionImageProxyUrl", () => {
    it("returns the local proxy URL with default type=block", () => {
      expect(notionImageProxyUrl("abc")).toBe("/api/notion-image?id=abc&type=block");
    });

    it("supports type=cover", () => {
      expect(notionImageProxyUrl("abc", "cover")).toContain("type=cover");
    });

    it("URL-encodes the id", () => {
      expect(notionImageProxyUrl("a b/c")).toContain("a%20b%2Fc");
    });
  });

  describe("extractText", () => {
    it("joins plain_text fragments", () => {
      expect(extractText([{ plain_text: "Hello, " }, { plain_text: "world." }])).toBe(
        "Hello, world."
      );
    });

    it("returns empty string for undefined", () => {
      expect(extractText(undefined)).toBe("");
    });

    it("returns empty string for empty array", () => {
      expect(extractText([])).toBe("");
    });
  });

  describe("blocksToHtml", () => {
    it("renders a paragraph block", () => {
      const html = blocksToHtml([
        {
          id: "b1",
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "hello" }] },
        },
      ]);
      expect(html).toContain("hello");
    });

    it("escapes HTML in plain_text", () => {
      const html = blocksToHtml([
        {
          id: "b1",
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "<script>x</script>" }] },
        },
      ]);
      expect(html).not.toContain("<script>x</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("wraps bulleted_list_item blocks in <ul>", () => {
      const html = blocksToHtml([
        {
          id: "b1",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ plain_text: "a" }] },
        },
        {
          id: "b2",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ plain_text: "b" }] },
        },
      ]);
      expect(html).toContain("<ul>");
      expect(html).toContain("</ul>");
    });

    it("wraps numbered_list_item blocks in <ol>", () => {
      const html = blocksToHtml([
        {
          id: "b1",
          type: "numbered_list_item",
          numbered_list_item: { rich_text: [{ plain_text: "a" }] },
        },
      ]);
      expect(html).toContain("<ol>");
      expect(html).toContain("</ol>");
    });

    it("returns empty string for empty input", () => {
      expect(blocksToHtml([])).toBe("");
    });
  });

  describe("extractToc", () => {
    it("collects heading_1/2/3 in document order with correct levels", () => {
      const toc = extractToc([
        {
          id: "h1",
          type: "heading_1",
          heading_1: { rich_text: [{ plain_text: "Title" }] },
        },
        {
          id: "p1",
          type: "paragraph",
        },
        {
          id: "h2",
          type: "heading_2",
          heading_2: { rich_text: [{ plain_text: "Sub" }] },
        },
        {
          id: "h3",
          type: "heading_3",
          heading_3: { rich_text: [{ plain_text: "Sub-sub" }] },
        },
      ]);
      expect(toc).toEqual([
        { text: "Title", level: 1, blockId: "h1" },
        { text: "Sub", level: 2, blockId: "h2" },
        { text: "Sub-sub", level: 3, blockId: "h3" },
      ]);
    });

    it("returns [] when no headings present", () => {
      expect(extractToc([{ id: "p1", type: "paragraph" } as never])).toEqual([]);
    });
  });

  describe("block builders", () => {
    it("textBlock wraps content under the chosen type key", () => {
      const b = textBlock("paragraph", "hi");
      expect(b.object).toBe("block");
      expect(b.type).toBe("paragraph");
      expect(b.paragraph.rich_text[0].text.content).toBe("hi");
    });

    it("paragraphBlock delegates to textBlock", () => {
      expect(paragraphBlock("hi").type).toBe("paragraph");
    });

    it("headingBlock produces heading_<level>", () => {
      expect(headingBlock(1, "h").type).toBe("heading_1");
      expect(headingBlock(2, "h").type).toBe("heading_2");
      expect(headingBlock(3, "h").type).toBe("heading_3");
    });

    it("bulletBlock + numberedBlock produce list_item blocks", () => {
      expect(bulletBlock("x").type).toBe("bulleted_list_item");
      expect(numberedBlock("x").type).toBe("numbered_list_item");
    });

    it("todoBlock defaults checked=false and respects the flag", () => {
      expect(todoBlock("buy milk").to_do.checked).toBe(false);
      expect(todoBlock("buy milk", true).to_do.checked).toBe(true);
    });

    it("codeBlock defaults language to 'plain text'", () => {
      expect(codeBlock("console.log()").code.language).toBe("plain text");
      expect(codeBlock("console.log()", "javascript").code.language).toBe("javascript");
    });

    it("dividerBlock produces a divider block", () => {
      expect(dividerBlock().type).toBe("divider");
    });

    it("calloutBlock defaults emoji and respects override", () => {
      expect(calloutBlock("tip").callout.icon.emoji).toBe("💡");
      expect(calloutBlock("warn", "⚠️").callout.icon.emoji).toBe("⚠️");
    });
  });
});
