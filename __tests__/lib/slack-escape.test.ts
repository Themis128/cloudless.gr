import { describe, it, expect } from "vitest";
import { slackEscape } from "@/lib/slack-escape";

describe("slackEscape", () => {
  it("returns em-dash for null", () => {
    expect(slackEscape(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(slackEscape(undefined)).toBe("—");
  });

  it("escapes &", () => {
    expect(slackEscape("AT&T")).toBe("AT&amp;T");
  });

  it("escapes <", () => {
    expect(slackEscape("<alert>")).toBe("&lt;alert&gt;");
  });

  it("escapes > (Slack link injection prevention)", () => {
    expect(slackEscape("<https://evil.com|click here>")).toBe(
      "&lt;https://evil.com|click here&gt;"
    );
  });

  it("converts numbers to string", () => {
    expect(slackEscape(42)).toBe("42");
  });

  it("removes bidi control characters", () => {
    // U+202E RIGHT-TO-LEFT OVERRIDE
    const withBidi = "hello‮world";
    expect(slackEscape(withBidi)).toBe("helloworld");
  });

  it("replaces ASCII control chars with space", () => {
    const withControl = "line1\nline2";
    const result = slackEscape(withControl);
    expect(result).not.toContain("\n");
    expect(result).toContain(" ");
  });

  it("truncates to maxLen (default 500)", () => {
    const long = "a".repeat(600);
    expect(slackEscape(long).length).toBe(500);
  });

  it("respects custom maxLen", () => {
    expect(slackEscape("hello world", 5)).toHaveLength(5);
  });

  it("passes through normal text unchanged", () => {
    expect(slackEscape("Hello, world!")).toBe("Hello, world!");
  });
});
