/**
 * Tests for src/lib/escape-html.ts
 */
import { describe, it, expect } from "vitest";
import { escapeHtml, htmlToPlainText, sanitizeForLog } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

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
    expect(escapeHtml('<a href="x&y">it\'s</a>')).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;it&#39;s&lt;/a&gt;'
    );
  });

  it("does not modify plain text", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles non-string input by coercing via String()", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
    expect(escapeHtml(undefined as unknown as string)).toBe("");
    expect(escapeHtml(42 as unknown as string)).toBe("42");
  });
});

describe("htmlToPlainText", () => {
  it("removes simple HTML tags", () => {
    expect(htmlToPlainText("<p>Hello</p>")).toContain("Hello");
    expect(htmlToPlainText("<p>Hello</p>")).not.toContain("<p>");
  });

  it("handles nested tags", () => {
    const result = htmlToPlainText("<div><span>Text</span></div>");
    expect(result).toContain("Text");
    expect(result).not.toContain("<");
  });

  it("collapses multiple spaces", () => {
    const result = htmlToPlainText("<p>A</p><p>B</p>");
    expect(result.includes("  ")).toBe(false);
  });

  it("collapses excessive newlines to double newline", () => {
    const result = htmlToPlainText("A\n\n\n\n\nB");
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlToPlainText("  <p>text</p>  ").trim()).toBe("text");
  });

  it("handles empty string", () => {
    expect(htmlToPlainText("")).toBe("");
  });

  it("removes stray angle brackets", () => {
    expect(htmlToPlainText("a < b > c")).not.toContain("<");
    expect(htmlToPlainText("a < b > c")).not.toContain(">");
  });
});

describe("sanitizeForLog", () => {
  it("removes newline characters", () => {
    expect(sanitizeForLog("line1\nline2")).not.toContain("\n");
  });

  it("removes carriage returns", () => {
    expect(sanitizeForLog("line1\rline2")).not.toContain("\r");
  });

  it("removes null bytes", () => {
    expect(sanitizeForLog("text\0more")).not.toContain("\0");
  });

  it("truncates to 500 characters", () => {
    const long = "a".repeat(1000);
    expect(sanitizeForLog(long)).toHaveLength(500);
  });

  it("coerces non-string values", () => {
    expect(sanitizeForLog(42)).toBe("42");
    expect(sanitizeForLog(null)).toBe("null");
  });
});
