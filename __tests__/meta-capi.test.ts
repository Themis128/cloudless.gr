import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// Sentry SDK is dynamically imported inside captureCapiError; stub it so
// tests don't hit the network and don't need the real module present.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: (cb: (scope: { setTag: (k: string, v: string) => void }) => void) =>
    cb({ setTag: vi.fn() }),
}));

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

describe("meta-capi", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isCapiConfigured", () => {
    it("returns false when env vars are missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
      vi.resetModules();
      const { isCapiConfigured } = await import("@/lib/meta-capi");
      expect(isCapiConfigured()).toBe(false);
    });

    it("returns true when both env vars are set", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "EAAB_test_token");
      vi.resetModules();
      const { isCapiConfigured } = await import("@/lib/meta-capi");
      expect(isCapiConfigured()).toBe(true);
    });
  });

  describe("sendCapiEvent short-circuit", () => {
    it("skips when CAPI is not configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
      vi.resetModules();
      const { sendCapiEvent } = await import("@/lib/meta-capi");
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await sendCapiEvent("Lead", { eventId: "abc" });
      expect(result).toEqual({
        ok: false,
        skipped: true,
        reason: "CAPI not configured",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("skips when eventId is empty", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "tok");
      vi.resetModules();
      const { sendCapiEvent } = await import("@/lib/meta-capi");
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await sendCapiEvent("Lead", { eventId: "   " });
      expect(result).toEqual({
        ok: false,
        skipped: true,
        reason: "missing eventId",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("PII hashing in sendCapiEvent", () => {
    it("hashes email lowercase+trimmed and normalizes phone to digits before hashing", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "EAAB_secret_token");
      vi.resetModules();
      const { sendCapiEvent } = await import("@/lib/meta-capi");

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
        );

      await sendCapiEvent("Lead", {
        eventId: "evt-1",
        email: "  Foo@Bar.COM  ",
        phone: "+30 210 123-4567",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);

      // Fix #2: access_token must be in body, NOT query string.
      expect(url).not.toContain("access_token=");
      expect(body.access_token).toBe("EAAB_secret_token");

      const userData = body.data[0].user_data;
      expect(userData.em).toEqual([sha256("foo@bar.com")]);
      // Fix #1: phone normalized to digits before hashing.
      expect(userData.ph).toEqual([sha256("302101234567")]);
    });
  });

  describe("error handling", () => {
    it("redacts the access token from error body on non-OK response", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "EAAB_secret_token");
      vi.resetModules();
      const { sendCapiEvent } = await import("@/lib/meta-capi");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "Invalid access_token=EAAB_secret_token" },
          }),
          { status: 400 },
        ),
      );

      const result = await sendCapiEvent("Lead", { eventId: "evt-err" });
      expect(result.ok).toBe(false);
      if (!result.ok && !("skipped" in result && result.skipped)) {
        expect(result.status).toBe(400);
        expect(result.error).not.toContain("EAAB_secret_token");
        expect(result.error).toContain("[redacted-token]");
      }
    });

    it("returns a timeout error when fetch is aborted", async () => {
      vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123");
      vi.stubEnv("META_CAPI_ACCESS_TOKEN", "tok");
      vi.resetModules();
      const { sendCapiEvent } = await import("@/lib/meta-capi");

      vi.spyOn(globalThis, "fetch").mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;
            signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      );

      vi.useFakeTimers();
      const promise = sendCapiEvent("Lead", { eventId: "evt-timeout" });
      await vi.advanceTimersByTimeAsync(6000);
      const result = await promise;
      vi.useRealTimers();

      expect(result.ok).toBe(false);
      if (!result.ok && !("skipped" in result && result.skipped)) {
        expect(result.status).toBe(0);
        expect(result.error).toMatch(/aborted/i);
      }
    });
  });
});

describe("meta-pixel", () => {
  it("generateEventId produces unique IDs even with identical inputs", async () => {
    const { generateEventId } = await import("@/lib/meta-pixel");
    const a = generateEventId("contact");
    const b = generateEventId("contact");
    expect(a).not.toBe(b);
    expect(a.startsWith("contact-")).toBe(true);
  });
});
