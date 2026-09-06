import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isTurnstileConfigured, getTurnstileSiteKey, verifyTurnstileToken } from "@/lib/turnstile";

beforeEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isTurnstileConfigured", () => {
  it("returns false when TURNSTILE_SECRET_KEY is not set", () => {
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("returns false for empty or whitespace value", () => {
    process.env.TURNSTILE_SECRET_KEY = "   ";
    expect(isTurnstileConfigured()).toBe(false);
  });

  it("returns true when TURNSTILE_SECRET_KEY has a value", () => {
    process.env.TURNSTILE_SECRET_KEY = "my-secret";
    expect(isTurnstileConfigured()).toBe(true);
  });
});

describe("getTurnstileSiteKey", () => {
  it("returns null when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set", () => {
    expect(getTurnstileSiteKey()).toBeNull();
  });

  it("returns the site key when set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key-123";
    expect(getTurnstileSiteKey()).toBe("site-key-123");
  });

  it("returns null for empty string", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "";
    expect(getTurnstileSiteKey()).toBeNull();
  });
});

describe("verifyTurnstileToken", () => {
  it("returns ok:true when secret is not configured (allow-through)", async () => {
    const result = await verifyTurnstileToken("any-token");
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for missing token when secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const result = await verifyTurnstileToken(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Missing");
  });

  it("returns ok:false for short token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const result = await verifyTurnstileToken("short");
    expect(result.ok).toBe(false);
  });

  it("returns ok:true when Cloudflare verifies the token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    }));
    const result = await verifyTurnstileToken("a-valid-token-1234567890");
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when Cloudflare rejects the token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid-input-response"] }),
    }));
    const result = await verifyTurnstileToken("bad-token-that-is-long-enough");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("invalid-input-response");
  });

  it("returns ok:false on fetch failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await verifyTurnstileToken("a-valid-token-1234567890");
    expect(result.ok).toBe(false);
  });
});
