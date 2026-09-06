import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password-hashing";

beforeEach(() => {
  process.env.SESSION_SECRET = "test-session-secret";
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
});

describe("hashPassword", () => {
  it("returns a string with salt:hash format", async () => {
    const hash = await hashPassword("mypassword");
    expect(typeof hash).toBe("string");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0); // salt
    expect(parts[1].length).toBe(64); // 256-bit hex = 64 chars
  });

  it("generates different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("mypassword");
    const hash2 = await hashPassword("mypassword");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for a correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false when the hash has no colon (legacy path, wrong password)", async () => {
    // Legacy SHA-256 hash of "password" + SESSION_SECRET
    const encoder = new TextEncoder();
    const data = encoder.encode("password" + "test-session-secret");
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const legacyHash = Array.from(new Uint8Array(hashBuf), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
    // Verify the correct password works against the legacy hash
    expect(await verifyPassword("password", legacyHash)).toBe(true);
    // And wrong password fails
    expect(await verifyPassword("wrong", legacyHash)).toBe(false);
  });

  it("returns false for empty stored hash", async () => {
    // edge case: no colon, empty — should not throw
    expect(await verifyPassword("any", "")).toBe(false);
  });
});
