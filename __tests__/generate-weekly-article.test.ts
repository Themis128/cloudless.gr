/**
 * Unit tests for the pure helpers in scripts/generate-weekly-article.ts.
 *
 * Focus on the two pieces of real business logic that are easy to break and
 * hard to notice in production:
 *   - pickLruCategory chooses the right next-up topic
 *   - markdownToNotionBlocks converts Claude's markdown output to the
 *     block shape Notion expects
 */

import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  pickLruCategory,
  markdownToNotionBlocks,
  type RecentPost,
} from "../scripts/generate-weekly-article";

describe("pickLruCategory", () => {
  it("returns the first never-used category when one is missing from history", () => {
    const recent: RecentPost[] = [
      { title: "a", category: "Cloud", date: "2026-05-20" },
      { title: "b", category: "Serverless", date: "2026-05-13" },
      { title: "c", category: "AI Marketing", date: "2026-05-06" },
    ];
    expect(pickLruCategory(recent)).toBe("Analytics");
  });

  it("returns the least-recently-used category when all four have been used", () => {
    const recent: RecentPost[] = [
      { title: "a", category: "Cloud", date: "2026-05-20" },
      { title: "b", category: "Serverless", date: "2026-05-13" },
      { title: "c", category: "Analytics", date: "2026-04-29" },
      { title: "d", category: "AI Marketing", date: "2026-05-06" },
    ];
    expect(pickLruCategory(recent)).toBe("Analytics");
  });

  it("uses the most recent date when a category appears multiple times", () => {
    const recent: RecentPost[] = [
      { title: "a1", category: "Cloud", date: "2026-05-20" },
      { title: "a2", category: "Cloud", date: "2026-04-01" },
      { title: "b", category: "Serverless", date: "2026-05-13" },
      { title: "c", category: "Analytics", date: "2026-04-29" },
      { title: "d", category: "AI Marketing", date: "2026-05-06" },
    ];
    expect(pickLruCategory(recent)).toBe("Analytics");
  });

  it("returns the first category from the declared list when history is empty", () => {
    expect(pickLruCategory([])).toBe(CATEGORIES[0]);
  });
});

describe("markdownToNotionBlocks", () => {
  it("renders an empty string as zero blocks", () => {
    expect(markdownToNotionBlocks("")).toEqual([]);
  });

  it("turns one paragraph line into a single paragraph block", () => {
    const blocks = markdownToNotionBlocks("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "Hello world" } }],
      },
    });
  });

  it("joins consecutive non-empty lines into the same paragraph", () => {
    const blocks = markdownToNotionBlocks("line one\nline two");
    expect(blocks).toHaveLength(1);
    expect(
      (blocks[0] as { paragraph: { rich_text: { text: { content: string } }[] } }).paragraph
        .rich_text[0].text.content
    ).toBe("line one line two");
  });

  it("starts a new paragraph after a blank line", () => {
    const blocks = markdownToNotionBlocks("first\n\nsecond");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });

  it("recognises H1, H2, and H3 headings", () => {
    const blocks = markdownToNotionBlocks("# A\n## B\n### C");
    expect(blocks.map((b) => (b as { type: string }).type)).toEqual([
      "heading_1",
      "heading_2",
      "heading_3",
    ]);
  });

  it("flushes a buffered paragraph before a heading", () => {
    const blocks = markdownToNotionBlocks("intro line\n# Heading\nmore");
    expect(blocks.map((b) => (b as { type: string }).type)).toEqual([
      "paragraph",
      "heading_1",
      "paragraph",
    ]);
  });

  it("converts dash and asterisk bullets to bulleted_list_item", () => {
    const blocks = markdownToNotionBlocks("- one\n* two");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => (b as { type: string }).type === "bulleted_list_item")).toBe(true);
  });

  it("converts ordered list items to numbered_list_item", () => {
    const blocks = markdownToNotionBlocks("1. first\n2. second");
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => (b as { type: string }).type === "numbered_list_item")).toBe(true);
  });

  it("handles a realistic mixed article", () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph that spans",
      "two lines.",
      "",
      "## Section",
      "- bullet a",
      "- bullet b",
      "",
      "1. step one",
      "2. step two",
      "",
      "Closing thought.",
    ].join("\n");
    const types = markdownToNotionBlocks(md).map((b) => (b as { type: string }).type);
    expect(types).toEqual([
      "heading_1",
      "paragraph",
      "heading_2",
      "bulleted_list_item",
      "bulleted_list_item",
      "numbered_list_item",
      "numbered_list_item",
      "paragraph",
    ]);
  });
});
