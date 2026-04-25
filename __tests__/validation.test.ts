import { describe, it, expect } from "vitest";
import { isValidEmail, EMAIL_MAX_LENGTH, EMAIL_REGEX } from "@/lib/validation";

describe("validation.ts", () => {
  describe("EMAIL_MAX_LENGTH", () => {
    it("is 254", () => {
      expect(EMAIL_MAX_LENGTH).toBe(254);
    });
  });

  describe("EMAIL_REGEX", () => {
    it("matches a valid email", () => {
      expect(EMAIL_REGEX.test("user@example.com")).toBe(true);
    });
    it("does not match an email without @", () => {
      expect(EMAIL_REGEX.test("userexample.com")).toBe(false);
    });
  });

  describe("isValidEmail()", () => {
    it("returns true for a valid email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("returns true for a valid email with subdomain", () => {
      expect(isValidEmail("admin@mail.cloudless.gr")).toBe(true);
    });

    it("returns true for a valid email with plus sign", () => {
      expect(isValidEmail("user+tag@example.com")).toBe(true);
    });

    it("returns false for an empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("returns false when @ is missing", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("returns false when domain is missing", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    it("returns false when local part is missing", () => {
      expect(isValidEmail("@example.com")).toBe(false);
    });

    it("returns false for email with spaces", () => {
      expect(isValidEmail("user @example.com")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isValidEmail(null)).toBe(false);
    });

    it("returns false for a number", () => {
      expect(isValidEmail(42)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidEmail(undefined)).toBe(false);
    });

    it("returns false for an object", () => {
      expect(isValidEmail({ email: "user@example.com" })).toBe(false);
    });

    it("returns false when email exceeds 254 characters", () => {
      const long = "a".repeat(249) + "@b.com"; // 249+6=255 > 254
      expect(long.length).toBeGreaterThan(254);
      expect(isValidEmail(long)).toBe(false);
    });

    it("returns true for email exactly at 254 characters", () => {
      const local = "a".repeat(248); // 248+6=254
      const email = `${local}@b.com`;
      expect(email.length).toBe(254);
      expect(isValidEmail(email)).toBe(true);
    });
  });
});
