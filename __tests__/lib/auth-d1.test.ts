import { describe, it, expect } from "vitest";

import { validatePasswordStrength, getAuthDbFromEnv } from "@/lib/auth-d1";

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("8 characters");
  });

  it("rejects passwords with no uppercase letter", () => {
    const result = validatePasswordStrength("abcdef1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("uppercase");
  });

  it("rejects passwords with no lowercase letter", () => {
    const result = validatePasswordStrength("ABCDEF1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("lowercase");
  });

  it("rejects passwords with no digit", () => {
    const result = validatePasswordStrength("Abcdefg!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("number");
  });

  it("rejects passwords with no special character", () => {
    const result = validatePasswordStrength("Abcdefg1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("special character");
  });

  it("accepts a valid password meeting all requirements", () => {
    const result = validatePasswordStrength("SecurePass1!");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe("getAuthDbFromEnv", () => {
  it("returns null in Node test environment (no D1 binding or HTTP auth)", () => {
    const db = getAuthDbFromEnv();
    expect(db).toBeNull();
  });
});
