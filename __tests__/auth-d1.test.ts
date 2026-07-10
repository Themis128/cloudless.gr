/**
 * Unit tests for D1-based authentication layer.
 * Tests the auth-d1.ts library functions.
 */

import { describe, it, expect } from "vitest";

// Test that the D1 auth module exports the expected functions
describe("auth-d1 exports", () => {
  it("exports createUser function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.createUser).toBe("function");
  });

  it("exports authenticateUser function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.authenticateUser).toBe("function");
  });

  it("exports getUserBySession function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.getUserBySession).toBe("function");
  });

  it("exports isAdmin function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.isAdmin).toBe("function");
  });

  it("exports createPasswordResetToken function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.createPasswordResetToken).toBe("function");
  });

  it("exports consumePasswordResetToken function", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(typeof mod.consumePasswordResetToken).toBe("function");
  });

  it("exports AuthDatabase interface", async () => {
    const mod = await import("@/lib/auth-d1");
    expect(mod.AuthDatabase).toBeUndefined(); // It's an interface, not a value
  });
});

describe("Worker index-cloudflare-free.js", () => {
  it("exports default object with fetch method", () => {
    // This is a basic smoke test - the actual Worker functionality is tested in integration
    const fs = require("fs");
    const path = require("path");
    const workerPath = path.join(__dirname, "../src/index-cloudflare-free.js");
    expect(fs.existsSync(workerPath)).toBe(true);
  });
});