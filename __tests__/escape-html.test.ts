import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";

describe("escapeHtml()", () => {
  it("escapes & to &amp;", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes < to &lt;", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes > to &gt;", () => {
    expect(escapeHtml("2 > 1")).toBe("2 &gt; 1");
  });

  it('escapes " to &quot;', () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes ' to &#39;", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("escapes all special chars in a complex XSS payload", () => {
    const input = `<script>alert('XSS & "fun"')</script>`;
    const output = escapeHtml(input);
    expect(output).not.toContain("<");
    expect(output).not.toContain(">");
    expect(output).not.toContain('"');
    expect(output).not.toContain("'");
    expect(output).toContain("&lt;script&gt;");
    expect(output).toContain("&amp;");
    expect(output).toContain("&quot;");
    expect(output).toContain("&#39;");
  });

  it("escapes multiple & in one string", () => {
    expect(escapeHtml("a & b & c")).toBe("a &amp; b &amp; c");
  });
});

describe("htmlToPlainText()", () => {
  it("strips tags and keeps text", async () => {
    const { htmlToPlainText } = await import("@/lib/escape-html");
    expect(htmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("removes residual angle brackets from partial tags", async () => {
    const { htmlToPlainText } = await import("@/lib/escape-html");
    const out = htmlToPlainText("<scr<script>ipt>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });
});

describe("sanitizeForLog()", () => {
  it("collapses CR/LF", async () => {
    const { sanitizeForLog } = await import("@/lib/escape-html");
    expect(sanitizeForLog("a\nb\rc")).toBe("a b c");
  });
});
