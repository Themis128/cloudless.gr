import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("notion.ts — Shared Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("notionFetch", () => {
    it("sends correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: "page", id: "123" }),
      });

      const { notionFetch } = await import("@/lib/notion");
      await notionFetch("/pages/123");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.notion.com/v1/pages/123");
      expect(init.headers.Authorization).toBe("Bearer secret_test_key_12345");
      expect(init.headers["Notion-Version"]).toBe("2022-06-28");
      expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      const { notionFetch } = await import("@/lib/notion");
      await expect(notionFetch("/pages/nonexistent")).rejects.toThrow(
        "Notion API error 404",
      );
    });

    it("passes custom init options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const { notionFetch } = await import("@/lib/notion");
      await notionFetch("/databases/db-id/query", {
        method: "POST",
        body: JSON.stringify({ filter: {} }),
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ filter: {} }));
    });
  });

  describe("extractText", () => {
    it("extracts plain text from rich_text array", async () => {
      const { extractText } = await import("@/lib/notion");
      const richText = [
        { plain_text: "Hello " },
        { plain_text: "world" },
      ];
      expect(extractText(richText)).toBe("Hello world");
    });

    it("returns empty string for undefined input", async () => {
      const { extractText } = await import("@/lib/notion");
      expect(extractText(undefined)).toBe("");
    });

    it("returns empty string for empty array", async () => {
      const { extractText } = await import("@/lib/notion");
      expect(extractText([])).toBe("");
    });
  });

  describe("blocksToHtml", () => {
    it("renders paragraph blocks", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ plain_text: "Hello world", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<p>");
      expect(html).toContain("Hello world");
    });

    it("renders headings", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "heading_1", heading_1: { rich_text: [{ plain_text: "H1", annotations: {} }] } },
        { type: "heading_2", heading_2: { rich_text: [{ plain_text: "H2", annotations: {} }] } },
        { type: "heading_3", heading_3: { rich_text: [{ plain_text: "H3", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<h1>H1</h1>");
      expect(html).toContain("<h2>H2</h2>");
      expect(html).toContain("<h3>H3</h3>");
    });

    it("renders bulleted list items wrapped in <ul>", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Item 1", annotations: {} }] } },
        { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Item 2", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>Item 1</li>");
      expect(html).toContain("<li>Item 2</li>");
      expect(html).toContain("</ul>");
    });

    it("renders numbered list items wrapped in <ol>", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "Step 1", annotations: {} }] } },
        { type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "Step 2", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<ol>");
      expect(html).toContain("</ol>");
    });

    it("renders code blocks", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "code",
          code: {
            rich_text: [{ plain_text: 'console.log("hello")', annotations: {} }],
            language: "javascript",
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<pre><code");
      expect(html).toContain("language-javascript");
    });

    it("renders divider", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [{ type: "divider", divider: {} }];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<hr />");
    });

    it("renders quote blocks", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "quote", quote: { rich_text: [{ plain_text: "A quote", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<blockquote>");
    });

    it("renders callout blocks with icon", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "callout",
          callout: {
            rich_text: [{ plain_text: "Important note", annotations: {} }],
            icon: { emoji: "💡" },
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("💡");
      expect(html).toContain("Important note");
    });

    it("renders bold/italic annotations", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [
              { plain_text: "bold", annotations: { bold: true } },
              { plain_text: " and ", annotations: {} },
              { plain_text: "italic", annotations: { italic: true } },
            ],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("escapes HTML in content", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ plain_text: "<script>alert('xss')</script>", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("flushes list when switching types", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Bullet", annotations: {} }] } },
        { type: "numbered_list_item", numbered_list_item: { rich_text: [{ plain_text: "Number", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<ul>");
      expect(html).toContain("</ul>");
      expect(html).toContain("<ol>");
      expect(html).toContain("</ol>");
    });

    it("renders empty paragraph as <br />", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "paragraph", paragraph: { rich_text: [] } },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<br />");
    });

    it("renders image with external URL", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "image",
          image: {
            type: "external",
            external: { url: "https://img.example.com/photo.jpg" },
            caption: [{ plain_text: "A photo" }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<figure>");
      expect(html).toContain('src="https://img.example.com/photo.jpg"');
      expect(html).toContain('alt="A photo"');
      expect(html).toContain("<figcaption>A photo</figcaption>");
      expect(html).toContain('loading="lazy"');
    });

    it("renders image with file URL via proxy (no caption)", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          id: "img-block-1",
          type: "image",
          image: {
            type: "file",
            file: { url: "https://s3.aws.com/img.png" },
            caption: [],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain('src="/api/notion-image?id=img-block-1&type=block"');
      expect(html).not.toContain("<figcaption>");
    });

    it("renders video with external URL", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "video",
          video: {
            type: "external",
            external: { url: "https://example.com/video.mp4" },
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<video");
      expect(html).toContain("controls");
      expect(html).toContain('src="https://example.com/video.mp4"');
    });

    it("renders embed block as link", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "embed",
          embed: { url: "https://codepen.io/example" },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain('href="https://codepen.io/example"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
    });

    it("renders bookmark block as link", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "bookmark",
          bookmark: { url: "https://docs.example.com" },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain('href="https://docs.example.com"');
    });

    it("renders to_do blocks with checkbox", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "to_do",
          to_do: {
            rich_text: [{ plain_text: "Buy milk", annotations: {} }],
            checked: false,
          },
        },
        {
          type: "to_do",
          to_do: {
            rich_text: [{ plain_text: "Write tests", annotations: {} }],
            checked: true,
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain('class="todo"');
      expect(html).toContain("Buy milk");
      expect(html).toContain("disabled");
      // First todo should NOT have checked
      expect(html).toContain('<input type="checkbox" disabled  /> Buy milk');
      // Second todo SHOULD have checked
      expect(html).toContain('<input type="checkbox" disabled checked /> Write tests');
    });

    it("renders toggle blocks", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "toggle",
          toggle: {
            rich_text: [{ plain_text: "Click to expand", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<details>");
      expect(html).toContain("<summary>Click to expand</summary>");
      expect(html).toContain("</details>");
    });

    it("renders code annotation", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ plain_text: "npm install", annotations: { code: true } }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<code>npm install</code>");
    });

    it("renders strikethrough annotation", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ plain_text: "deleted text", annotations: { strikethrough: true } }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<s>deleted text</s>");
    });

    it("renders underline annotation", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ plain_text: "underlined", annotations: { underline: true } }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<u>underlined</u>");
    });

    it("renders links in rich text", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                plain_text: "click here",
                href: "https://example.com",
                annotations: {},
              },
            ],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
      expect(html).toContain("click here");
    });

    it("combines multiple annotations on same text", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                plain_text: "important",
                annotations: { bold: true, italic: true },
              },
            ],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<strong>");
      expect(html).toContain("<em>");
      expect(html).toContain("important");
    });

    it("renders code block with default language when not specified", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "code",
          code: {
            rich_text: [{ plain_text: "hello", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("language-plain");
    });

    it("flushes pending list at end of blocks", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ plain_text: "Last item", annotations: {} }] } },
      ];
      const html = blocksToHtml(blocks);
      // List should be flushed even though no non-list block follows
      expect(html).toContain("<ul>");
      expect(html).toContain("</ul>");
      expect(html).toContain("<li>Last item</li>");
    });

    it("renders unknown block type with text as paragraph", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "column_list",
          column_list: {
            rich_text: [{ plain_text: "column content", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("<p>column content</p>");
    });

    it("skips unknown block type with no text", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        { type: "table_of_contents", table_of_contents: {} },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toBe("");
    });

    it("renders callout without emoji icon", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const blocks = [
        {
          type: "callout",
          callout: {
            rich_text: [{ plain_text: "Note text", annotations: {} }],
          },
        },
      ];
      const html = blocksToHtml(blocks);
      expect(html).toContain("callout");
      expect(html).toContain("Note text");
    });

    it("handles empty blocks array", async () => {
      const { blocksToHtml } = await import("@/lib/notion");
      const html = blocksToHtml([]);
      expect(html).toBe("");
    });
  });

  describe("notionFetchAll (paginated POST)", () => {
    it("follows pagination cursors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "1" }],
              has_more: true,
              next_cursor: "cursor-abc",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "2" }],
              has_more: false,
              next_cursor: null,
            }),
        });

      const { notionFetchAll } = await import("@/lib/notion");
      const results = await notionFetchAll("/databases/db/query", {});

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: "1" });
      expect(results[1]).toEqual({ id: "2" });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should include start_cursor
      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondBody.start_cursor).toBe("cursor-abc");
    });

    it("returns single page results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ id: "a" }, { id: "b" }],
            has_more: false,
          }),
      });

      const { notionFetchAll } = await import("@/lib/notion");
      const results = await notionFetchAll("/databases/db/query");

      expect(results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("notionListAll (paginated GET)", () => {
    it("follows pagination cursors for GET endpoints", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "block1" }],
              has_more: true,
              next_cursor: "cursor-xyz",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "block2" }],
              has_more: false,
            }),
        });

      const { notionListAll } = await import("@/lib/notion");
      const results = await notionListAll("/blocks/page-id/children");

      expect(results).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should have cursor in URL
      const secondUrl = mockFetch.mock.calls[1][0];
      expect(secondUrl).toContain("start_cursor=cursor-xyz");
    });

    it("appends cursor correctly to URL with existing query params", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "1" }],
              has_more: true,
              next_cursor: "cur-2",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: "2" }],
              has_more: false,
            }),
        });

      const { notionListAll } = await import("@/lib/notion");
      const results = await notionListAll("/blocks/id/children?some=param");

      // Second URL should use & instead of ? since the path already has query params
      const secondUrl = mockFetch.mock.calls[1][0];
      expect(secondUrl).toContain("&page_size=100");
      expect(secondUrl).toContain("&start_cursor=cur-2");
    });
  });

  describe("notionFetch error handling", () => {
    it("includes path and body in error message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request body"),
      });

      const { notionFetch } = await import("@/lib/notion");
      await expect(notionFetch("/databases/bad/query")).rejects.toThrow(
        "Notion API error 400 on /databases/bad/query: Bad request body",
      );
    });

    it("handles text() rejection gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("stream error")),
      });

      const { notionFetch } = await import("@/lib/notion");
      await expect(notionFetch("/pages/123")).rejects.toThrow("Notion API error 500");
    });
  });

  // ─── Page helpers ────────────────────────────────────────────────

  describe("updatePage", () => {
    it("sends PATCH with properties", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "page-1" }),
      });

      const { updatePage } = await import("@/lib/notion");
      const result = await updatePage("page-1", { Status: { select: { name: "Done" } } });

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.properties.Status.select.name).toBe("Done");
    });

    it("returns false on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve("not found") });
      const { updatePage } = await import("@/lib/notion");
      expect(await updatePage("bad-id", {})).toBe(false);
    });
  });

  describe("archivePage", () => {
    it("sends PATCH with archived: true", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "page-1", archived: true }),
      });

      const { archivePage } = await import("@/lib/notion");
      const result = await archivePage("page-1");
      expect(result).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.archived).toBe(true);
    });
  });

  describe("restorePage", () => {
    it("sends PATCH with archived: false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "page-1", archived: false }),
      });

      const { restorePage } = await import("@/lib/notion");
      const result = await restorePage("page-1");
      expect(result).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.archived).toBe(false);
    });
  });

  // ─── Block helpers ───────────────────────────────────────────────

  describe("appendBlocks", () => {
    it("sends PATCH to /blocks/{id}/children", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const { appendBlocks, paragraphBlock } = await import("@/lib/notion");
      const result = await appendBlocks("parent-1", [paragraphBlock("Hello")]);
      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toContain("/blocks/parent-1/children");
      expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
    });

    it("caps blocks at 100", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const { appendBlocks, paragraphBlock } = await import("@/lib/notion");
      const blocks = Array.from({ length: 150 }, (_, i) => paragraphBlock(`Block ${i}`));
      await appendBlocks("parent-1", blocks);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.children.length).toBe(100);
    });

    it("returns false on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("bad") });
      const { appendBlocks } = await import("@/lib/notion");
      expect(await appendBlocks("bad-id", [])).toBe(false);
    });
  });

  describe("deleteBlock", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "block-1", archived: true }),
      });

      const { deleteBlock } = await import("@/lib/notion");
      expect(await deleteBlock("block-1")).toBe(true);
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });
  });

  // ─── Block builders ─────────────────────────────────────────────

  describe("block builders", () => {
    it("paragraphBlock creates a paragraph", async () => {
      const { paragraphBlock } = await import("@/lib/notion");
      const block = paragraphBlock("Hello world");
      expect(block.type).toBe("paragraph");
      expect(block.paragraph.rich_text[0].text.content).toBe("Hello world");
    });

    it("headingBlock creates h1/h2/h3", async () => {
      const { headingBlock } = await import("@/lib/notion");
      const h1 = headingBlock(1, "Title");
      expect(h1.type).toBe("heading_1");
      expect(h1.heading_1.rich_text[0].text.content).toBe("Title");

      const h3 = headingBlock(3, "Sub");
      expect(h3.type).toBe("heading_3");
    });

    it("bulletBlock creates bulleted list item", async () => {
      const { bulletBlock } = await import("@/lib/notion");
      const block = bulletBlock("Item");
      expect(block.type).toBe("bulleted_list_item");
    });

    it("numberedBlock creates numbered list item", async () => {
      const { numberedBlock } = await import("@/lib/notion");
      const block = numberedBlock("Step 1");
      expect(block.type).toBe("numbered_list_item");
    });

    it("todoBlock creates to-do with checked flag", async () => {
      const { todoBlock } = await import("@/lib/notion");
      const unchecked = todoBlock("Buy milk");
      expect(unchecked.to_do.checked).toBe(false);

      const checked = todoBlock("Done task", true);
      expect(checked.to_do.checked).toBe(true);
    });

    it("codeBlock creates code with language", async () => {
      const { codeBlock } = await import("@/lib/notion");
      const block = codeBlock("const x = 1;", "typescript");
      expect(block.code.language).toBe("typescript");
      expect(block.code.rich_text[0].text.content).toBe("const x = 1;");
    });

    it("codeBlock defaults to plain text", async () => {
      const { codeBlock } = await import("@/lib/notion");
      const block = codeBlock("echo hi");
      expect(block.code.language).toBe("plain text");
    });

    it("dividerBlock creates divider", async () => {
      const { dividerBlock } = await import("@/lib/notion");
      const block = dividerBlock();
      expect(block.type).toBe("divider");
    });

    it("calloutBlock creates callout with emoji", async () => {
      const { calloutBlock } = await import("@/lib/notion");
      const block = calloutBlock("Important note", "⚠️");
      expect(block.callout.icon.emoji).toBe("⚠️");
      expect(block.callout.rich_text[0].text.content).toBe("Important note");
    });

    it("calloutBlock defaults to 💡 emoji", async () => {
      const { calloutBlock } = await import("@/lib/notion");
      const block = calloutBlock("Tip");
      expect(block.callout.icon.emoji).toBe("💡");
    });
  });

  // ─── Table of Contents ──────────────────────────────────────────

  describe("extractToc", () => {
    it("extracts headings from blocks", async () => {
      const { extractToc } = await import("@/lib/notion");
      const blocks = [
        { id: "b1", type: "heading_1", heading_1: { rich_text: [{ plain_text: "Introduction" }] } },
        { id: "b2", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Some text" }] } },
        { id: "b3", type: "heading_2", heading_2: { rich_text: [{ plain_text: "Details" }] } },
        { id: "b4", type: "heading_3", heading_3: { rich_text: [{ plain_text: "Sub-detail" }] } },
      ];

      const toc = extractToc(blocks);
      expect(toc).toHaveLength(3);
      expect(toc[0]).toEqual({ text: "Introduction", level: 1, blockId: "b1" });
      expect(toc[1]).toEqual({ text: "Details", level: 2, blockId: "b3" });
      expect(toc[2]).toEqual({ text: "Sub-detail", level: 3, blockId: "b4" });
    });

    it("returns empty array for no headings", async () => {
      const { extractToc } = await import("@/lib/notion");
      const blocks = [
        { id: "b1", type: "paragraph", paragraph: { rich_text: [{ plain_text: "Just text" }] } },
      ];
      expect(extractToc(blocks)).toEqual([]);
    });

    it("returns empty for empty blocks", async () => {
      const { extractToc } = await import("@/lib/notion");
      expect(extractToc([])).toEqual([]);
    });
  });
});
