import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password-hashing";

// password-hashing uses SESSION_SECRET as a pepper via process.env.
// We set a stable pepper for all tests so results are reproducible.
beforeEach(() => {
  process.env.SESSION_SECRET = "test-pepper-stable";
});

describe("hashPassword", () => {
  it("returns a string in salt:hex format", async () => {
    const h = await hashPassword("mypassword");
    const parts = h.split(":");
    expect(parts).toHaveLength(2);
    const [salt, hex] = parts;
    expect(salt.length).toBeGreaterThan(0);
    expect(hex).toMatch(/^[0-9a-f]{64}$/); // 256-bit hex
  });

  it("generates a different salt on each call (output not deterministic)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2); // random salt → different ciphertext
  });

  it("handles empty password", async () => {
    const h = await hashPassword("");
    expect(h).toContain(":");
  });

  it("handles unicode passwords", async () => {
    const h = await hashPassword("αβγδ-cloudless");
    expect(h).toContain(":");
  });
});

describe("verifyPassword", () => {
  it("verifies a freshly hashed password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("wrong-horse-battery", hash)).toBe(false);
  });

  it("is case-sensitive", async () => {
    const hash = await hashPassword("Password123");
    expect(await verifyPassword("password123", hash)).toBe(false);
  });

  it("verifies legacy SHA-256 hash (no salt prefix)", async () => {
    // Legacy format: just a 64-char hex string, no colon
    // Produce the expected legacy hash manually
    const pepper = process.env.SESSION_SECRET ?? "";
    const encoder = new TextEncoder();
    const data = encoder.encode("legacypass" + pepper);
    const buf = await crypto.subtle.digest("SHA-256", data);
    const legacyHash = Array.from(new Uint8Array(buf), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

    expect(await verifyPassword("legacypass", legacyHash)).toBe(true);
    expect(await verifyPassword("wrongpass", legacyHash)).toBe(false);
  });

  it("rejects a totally invalid hash string", async () => {
    // Falls into legacy path with garbage — should return false, not throw
    expect(await verifyPassword("anything", "notahex")).toBe(false);
  });
});
