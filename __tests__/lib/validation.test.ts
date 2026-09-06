import { describe, it, expect } from "vitest";
import { isValidEmail, EMAIL_MAX_LENGTH, EMAIL_REGEX } from "@/lib/validation";

describe("isValidEmail", () => {
  it("returns true for a valid email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user+tag@sub.domain.org")).toBe(true);
  });

  it("returns false for missing @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("returns false for missing domain part", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("returns false for missing local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("returns false for whitespace in email", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
    expect(isValidEmail("user@ example.com")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  it("returns false for email exceeding EMAIL_MAX_LENGTH", () => {
    const longLocal = "a".repeat(EMAIL_MAX_LENGTH);
    expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
  });

  it("returns true for an email exactly at EMAIL_MAX_LENGTH", () => {
    const email = `${"a".repeat(EMAIL_MAX_LENGTH - "@b.co".length)}@b.co`;
    expect(email.length).toBe(EMAIL_MAX_LENGTH);
    expect(isValidEmail(email)).toBe(true);
  });
});

describe("EMAIL_REGEX", () => {
  it("matches valid email", () => {
    expect(EMAIL_REGEX.test("a@b.com")).toBe(true);
  });

  it("does not match email with spaces", () => {
    expect(EMAIL_REGEX.test("a b@c.com")).toBe(false);
  });
});

describe("EMAIL_MAX_LENGTH", () => {
  it("is 254", () => {
    expect(EMAIL_MAX_LENGTH).toBe(254);
  });
});
