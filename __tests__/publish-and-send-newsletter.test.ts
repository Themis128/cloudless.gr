/**
 * Unit tests for the pure helpers in scripts/publish-and-send-newsletter.ts.
 *
 * The script is auto-invoked when run directly via tsx, but the
 * `process.argv[1]` guard at the bottom skips main() during import so we
 * can exercise the rendering functions in isolation.
 */

import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  categoryOffer,
  blocksToHtml,
  renderNewsletter,
  renderPlaintext,
} from "../scripts/publish-and-send-newsletter";

describe("escapeHtml", () => {
  it("escapes the five XML-significant characters", () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("just words")).toBe("just words");
  });
});

describe("categoryOffer", () => {
  it("returns the matching offer for a known category", () => {
    const offer = categoryOffer("Serverless", "https://example.test");
    expect(offer.title).toBe("Serverless Migration Assessment");
    expect(offer.url).toBe("https://example.test/en/contact");
  });

  it("falls back to the Cloud offer for unknown categories", () => {
    const offer = categoryOffer("Quantum", "https://example.test");
    expect(offer.title).toBe("Free Cloud Cost Audit");
  });

  it("wires siteUrl into the contact URL", () => {
    const offer = categoryOffer("Cloud", "https://cloudless.gr");
    expect(offer.url).toBe("https://cloudless.gr/en/contact");
  });
});

describe("blocksToHtml", () => {
  function paragraphBlock(text: string) {
    return {
      type: "paragraph",
      paragraph: {
        rich_text: [{ plain_text: text, annotations: {} }],
      },
    };
  }

  it("renders a paragraph as <p>", () => {
    const { html, text } = blocksToHtml([paragraphBlock("Hello world")]);
    expect(html).toBe("<p>Hello world</p>");
    expect(text).toBe("Hello world");
  });

  it("renders heading_1/2/3 distinctly", () => {
    const { html } = blocksToHtml([
      { type: "heading_1", heading_1: { rich_text: [{ plain_text: "A" }] } },
      { type: "heading_2", heading_2: { rich_text: [{ plain_text: "B" }] } },
      { type: "heading_3", heading_3: { rich_text: [{ plain_text: "C" }] } },
    ]);
    expect(html).toContain("<h1>A</h1>");
    expect(html).toContain("<h2>B</h2>");
    expect(html).toContain("<h3>C</h3>");
  });

  it("groups consecutive bulleted_list_items inside one <ul>", () => {
    const { html } = blocksToHtml([
      {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "one" }] },
      },
      {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "two" }] },
      },
    ]);
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html.match(/<\/ul>/g)).toHaveLength(1);
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("closes a list before switching between ul and ol", () => {
    const { html } = blocksToHtml([
      {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "a" }] },
      },
      {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ plain_text: "1" }] },
      },
    ]);
    expect(html).toMatch(/<ul>\s*<li>a<\/li>\s*<\/ul>\s*<ol>\s*<li>1<\/li>\s*<\/ol>/);
  });

  it("escapes HTML inside code blocks", () => {
    const { html } = blocksToHtml([
      {
        type: "code",
        code: {
          rich_text: [{ plain_text: '<script>alert("x")</script>' }],
          language: "html",
        },
      },
    ]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('class="language-html"');
  });

  it("wraps quote in <blockquote>", () => {
    const { html, text } = blocksToHtml([
      { type: "quote", quote: { rich_text: [{ plain_text: "wise words" }] } },
    ]);
    expect(html).toBe("<blockquote>wise words</blockquote>");
    expect(text).toContain("> wise words");
  });

  it("emits hr for dividers and skips empty paragraphs", () => {
    const { html, text } = blocksToHtml([
      paragraphBlock(""),
      { type: "divider", divider: {} },
      paragraphBlock("after"),
    ]);
    expect(html).not.toContain("<p></p>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<p>after</p>");
    expect(text).toContain("---");
  });

  it("applies bold/italic/code annotations and href", () => {
    const { html } = blocksToHtml([
      {
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              plain_text: "linky",
              annotations: { bold: true, italic: true, code: true },
              href: "https://example.test",
            },
          ],
        },
      },
    ]);
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain("<code>");
    expect(html).toContain('<a href="https://example.test">');
  });
});

describe("renderNewsletter", () => {
  const post = {
    id: "p1",
    title: "Cutting AWS bills",
    slug: "cutting-aws-bills",
    excerpt: "Practical levers.",
    category: "Cloud",
    readTime: "6 min read",
  };

  it("includes the post URL built from SITE_URL and slug", () => {
    process.env.SITE_URL = "https://example.test";
    const html = renderNewsletter(post, "<p>body</p>");
    expect(html).toContain("https://example.test/en/blog/cutting-aws-bills");
    expect(html).toContain("<p>body</p>");
  });

  it("falls back to https://cloudless.gr when SITE_URL is unset", () => {
    delete process.env.SITE_URL;
    const html = renderNewsletter(post, "");
    expect(html).toContain("https://cloudless.gr/en/blog/cutting-aws-bills");
  });

  it("escapes potentially-hostile titles to prevent injection in the rendered email", () => {
    const evil = { ...post, title: "<script>alert(1)</script>" };
    const html = renderNewsletter(evil, "");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the matching category offer", () => {
    const html = renderNewsletter({ ...post, category: "Analytics" }, "");
    expect(html).toContain("Analytics Stack Review");
  });

  it("keeps the unsubscribe token verbatim for the email provider", () => {
    const html = renderNewsletter(post, "");
    expect(html).toContain("%UNSUBSCRIBELINK%");
  });
});

describe("renderPlaintext", () => {
  const post = {
    id: "p1",
    title: "Plain title",
    slug: "plain-title",
    excerpt: "Excerpt.",
    category: "Cloud",
    readTime: "3 min read",
  };

  it("renders title, category, excerpt, body, and CTA", () => {
    process.env.SITE_URL = "https://example.test";
    const out = renderPlaintext(post, "the body");
    expect(out).toContain("Plain title");
    expect(out).toContain("Cloud · 3 min read");
    expect(out).toContain("Excerpt.");
    expect(out).toContain("the body");
    expect(out).toContain("https://example.test/en/blog/plain-title");
    expect(out).toContain("Free Cloud Cost Audit");
    expect(out).toContain("%UNSUBSCRIBELINK%");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression guard for the AppFlowy review-queue convention.
//
// Blog posts pending newsletter publication are named "[Review] <title>".
// The script searches for pages starting with that prefix. Lock the literal
// in source so a future rename has to update this test too.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AppFlowy publisher review filter", () => {
  const source = readFileSync(
    resolve(__dirname, "../scripts/publish-and-send-newsletter.ts"),
    "utf8"
  );

  it("searches for pages with the [Review] prefix (not a Notion status)", () => {
    expect(source).toContain("[Review]");
    expect(source).not.toContain('equals: "Approved"');
  });
});
