import { describe, it, expect } from "vitest";
import { sanitizeLog, sanitizeError } from "@/lib/log-sanitizer";

describe("sanitizeLog", () => {
  it("passes through plain text", () => {
    expect(sanitizeLog("hello world")).toBe("hello world");
  });

  it("removes newline characters", () => {
    expect(sanitizeLog("line1\nline2")).not.toContain("\n");
    expect(sanitizeLog("line1\r\nline2")).not.toContain("\r");
  });

  it("removes null bytes (control characters)", () => {
    expect(sanitizeLog("abc\x00def")).not.toContain("\x00");
  });

  it("removes % to prevent format specifier injection", () => {
    expect(sanitizeLog("value=%s")).not.toContain("%");
  });

  it("truncates to 500 characters by default", () => {
    const long = "a".repeat(600);
    expect(sanitizeLog(long)).toHaveLength(500);
  });

  it("respects custom maxLength", () => {
    expect(sanitizeLog("hello world", 5)).toHaveLength(5);
  });

  it("redacts email addresses", () => {
    const result = sanitizeLog("user@example.com logged in");
    expect(result).not.toContain("user@example.com");
    expect(result).toContain("[REDACTED:");
  });

  it("redacts Slack tokens (xoxb/xoxp)", () => {
    const result = sanitizeLog("token=xoxb-12345678901");
    expect(result).not.toContain("xoxb-12345678901");
  });

  it("redacts password fields", () => {
    const result = sanitizeLog("password=MySecret123");
    expect(result).not.toContain("MySecret123");
  });
});

describe("sanitizeError", () => {
  it("sanitizes Error message", () => {
    const err = new Error("failed: user@example.com not found");
    const result = sanitizeError(err);
    expect(result).not.toContain("user@example.com");
  });

  it("sanitizes non-Error values via String()", () => {
    expect(sanitizeError("bad input\n")).not.toContain("\n");
    expect(sanitizeError(42)).toBe("42");
  });
});
