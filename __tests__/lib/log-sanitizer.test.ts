import { describe, it, expect } from "vitest";
import { sanitizeLog, sanitizeError } from "@/lib/log-sanitizer";

describe("sanitizeLog", () => {
  it("returns a plain string unchanged", () => {
    expect(sanitizeLog("hello world")).toBe("hello world");
  });

  it("removes control characters", () => {
    // \x00-\x1F are stripped entirely; newlines handled separately below
    expect(sanitizeLog("tab\there")).toBe("tabhere");
    expect(sanitizeLog("null\x00byte")).toBe("nullbyte");
  });

  it("removes format specifiers (%)", () => {
    expect(sanitizeLog("value: %s")).toBe("value: s");
    expect(sanitizeLog("%d items")).toBe("d items");
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(600);
    const result = sanitizeLog(long);
    expect(result).toHaveLength(500);
  });

  it("respects a custom maxLength", () => {
    const result = sanitizeLog("abcdefghij", 5);
    expect(result).toHaveLength(5);
    expect(result).toBe("abcde");
  });

  it("redacts email addresses", () => {
    const result = sanitizeLog("user is foo@example.com today");
    expect(result).not.toContain("foo@example.com");
    expect(result).toContain("[REDACTED:");
  });

  it("redacts Slack tokens", () => {
    const result = sanitizeLog("token=xoxb-abc1234567890");
    expect(result).not.toContain("xoxb-abc1234567890");
    expect(result).toContain("[REDACTED:");
  });

  it("redacts password fields", () => {
    const result = sanitizeLog("password: mysecretpass");
    expect(result).not.toContain("mysecretpass");
    expect(result).toContain("[REDACTED:");
  });

  it("handles empty string", () => {
    expect(sanitizeLog("")).toBe("");
  });

  it("removes CRLF newlines (control-char pass strips \\r\\n before newline pass)", () => {
    const result = sanitizeLog("line1\r\nline2");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    // \x00-\x1F removal runs first, stripping \r and \n entirely
    expect(result).toBe("line1line2");
  });
});

describe("sanitizeError", () => {
  it("extracts and sanitizes an Error message", () => {
    const err = new Error("failed at foo@bar.com");
    const result = sanitizeError(err);
    expect(result).not.toContain("foo@bar.com");
    expect(result).toContain("[REDACTED:");
  });

  it("handles non-Error objects", () => {
    expect(sanitizeError("plain string error")).toBe("plain string error");
    expect(sanitizeError(42)).toBe("42");
  });

  it("handles null and undefined", () => {
    expect(sanitizeError(null)).toBe("null");
    expect(sanitizeError(undefined)).toBe("undefined");
  });
});
