import { describe, it, expect } from "vitest";
import { sanitizeCmsHtml } from "@/lib/sanitize-cms-html";

describe("sanitizeCmsHtml", () => {
  it("passes through safe HTML unchanged", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeCmsHtml(html)).toBe(html);
  });

  it("removes <script> tags", () => {
    const html = "<p>Safe</p><script>alert(1)</script>";
    const result = sanitizeCmsHtml(html);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Safe");
  });

  it("removes <iframe> tags", () => {
    const html = '<p>Content</p><iframe src="evil.com"></iframe>';
    expect(sanitizeCmsHtml(html)).not.toContain("<iframe");
  });

  it("removes <style> tags", () => {
    const html = "<style>body { display:none }</style><p>hi</p>";
    expect(sanitizeCmsHtml(html)).not.toContain("<style");
  });

  it("removes <form> and <input> tags", () => {
    const html = '<form action="/phish"><input type="text" /></form>';
    const result = sanitizeCmsHtml(html);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
  });

  it("removes event handler attributes", () => {
    const html = '<a href="/page" onclick="evil()">Click</a>';
    const result = sanitizeCmsHtml(html);
    expect(result).not.toContain("onclick");
    expect(result).toContain("Click");
  });

  it("removes onload attributes", () => {
    const html = '<img src="x.png" onload="evil()" />';
    expect(sanitizeCmsHtml(html)).not.toContain("onload");
  });

  it("strips javascript: href values", () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeCmsHtml(html);
    expect(result).not.toContain("javascript:");
  });

  it("strips data: src values", () => {
    const html = '<img src="data:text/html,<script>evil()</script>" />';
    const result = sanitizeCmsHtml(html);
    expect(result).not.toContain("data:text/html");
  });

  it("preserves safe href values", () => {
    const html = '<a href="https://cloudless.gr">Link</a>';
    const result = sanitizeCmsHtml(html);
    expect(result).toContain("https://cloudless.gr");
  });

  it("handles empty string", () => {
    expect(sanitizeCmsHtml("")).toBe("");
  });

  it("neutralizes nested/split dangerous tags in a single pass", () => {
    const result = sanitizeCmsHtml("<scr<script>ipt>alert(1)</script>");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
  });

  it("neutralizes uppercase dangerous tags and event attrs", () => {
    const result = sanitizeCmsHtml('<SCRIPT>alert(1)</SCRIPT><a href="/p" ONCLICK="x()">y</a>');
    expect(result).not.toContain("alert(1)");
    expect(result).not.toContain("ONCLICK");
    expect(result).toContain("y");
  });

  it("drops script payloads nested inside allowed elements", () => {
    const result = sanitizeCmsHtml("<svg><script>alert(1)</script></svg>");
    expect(result).not.toContain("alert(1)");
  });
});
