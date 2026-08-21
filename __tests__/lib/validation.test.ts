import { describe, it, expect } from "vitest";
import { isValidEmail, EMAIL_MAX_LENGTH } from "@/lib/validation";

describe("isValidEmail", () => {
  it("accepts a standard email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts a subdomain email", () => {
    expect(isValidEmail("foo@mail.cloudless.gr")).toBe(true);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("rejects missing domain", () => {
    expect(isValidEmail("foo@")).toBe(false);
  });

  it("rejects missing local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("rejects email exceeding max length", () => {
    const long = "a".repeat(EMAIL_MAX_LENGTH) + "@b.com";
    expect(isValidEmail(long)).toBe(false);
  });

  it("accepts email exactly at max length boundary (if format is valid)", () => {
    const local = "a".repeat(EMAIL_MAX_LENGTH - "@b.co".length);
    const email = local + "@b.co";
    expect(email.length).toBe(EMAIL_MAX_LENGTH);
    expect(isValidEmail(email)).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(isValidEmail("foo bar@example.com")).toBe(false);
  });
});
