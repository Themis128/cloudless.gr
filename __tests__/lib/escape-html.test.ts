import { describe, it, expect } from "vitest";
import { escapeHtml, htmlToPlainText } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all special chars together", () => {
    expect(escapeHtml('<a href="foo">O\'Malley & co</a>')).toBe(
      "&lt;a href=&quot;foo&quot;&gt;O&#39;Malley &amp; co&lt;/a&gt;"
    );
  });

  it("returns plain string unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("coerces null to empty string without throwing", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
  });

  it("coerces number to string", () => {
    expect(escapeHtml(42 as unknown as string)).toBe("42");
  });
});

describe("htmlToPlainText", () => {
  it("strips simple tags", () => {
    expect(htmlToPlainText("<p>hello</p>")).toBe("hello");
  });

  it("strips anchor tags", () => {
    expect(htmlToPlainText('<a href="https://example.com">link</a>')).toBe("link");
  });

  it("collapses multiple spaces from adjacent tags", () => {
    // tags become spaces, then [ \t\f\v]+ collapses runs; result is single space
    expect(htmlToPlainText("<b>one</b> <i>two</i>")).toBe("one two");
  });

  it("removes bare angle brackets without inserting spaces", () => {
    // bare <> are stripped; spaces between words are preserved
    expect(htmlToPlainText("a < b > c")).toBe("a c");
  });

  it("returns empty string for tag-only input", () => {
    expect(htmlToPlainText("<br><br>")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(htmlToPlainText("  <p>text</p>  ")).toBe("text");
  });

  it("handles empty string", () => {
    expect(htmlToPlainText("")).toBe("");
  });
});
