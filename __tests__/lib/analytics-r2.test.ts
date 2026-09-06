/**
 * Tests for src/lib/analytics-r2.ts
 *
 * Covers:
 *  - trackR2Event() — writes NDJSON to R2 bucket at a keyed path
 *  - trackEvent() — branches on env.DATALAKE_BUCKET presence
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackR2Event, trackEvent, type AnalyticsEvent } from "@/lib/analytics-r2";
import type { R2Bucket } from "@cloudflare/workers-types";

// ---------------------------------------------------------------------------
function makeBucket() {
  return { put: vi.fn().mockResolvedValue(undefined) } as unknown as R2Bucket;
}

const BASE_EVT: AnalyticsEvent = {
  event: "page_view",
  user_id: "u1",
  page: "/home",
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
describe("trackR2Event", () => {
  it("calls bucket.put with an ndjson key and record", async () => {
    const bucket = makeBucket();
    await trackR2Event({ DATALAKE_BUCKET: bucket }, BASE_EVT);
    expect(bucket.put).toHaveBeenCalledOnce();
    const [key, record, opts] = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      { httpMetadata: { contentType: string } },
    ];
    expect(key).toMatch(/^events\/year=\d{4}\/month=\d{2}\/day=\d{2}\//);
    expect(key).toMatch(/\.ndjson$/);
    const parsed = JSON.parse(record);
    expect(parsed.event).toBe("page_view");
    expect(parsed.user_id).toBe("u1");
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(opts.httpMetadata.contentType).toBe("application/x-ndjson");
  });

  it("swallows R2 errors (console.error, no throw)", async () => {
    const bucket = { put: vi.fn().mockRejectedValue(new Error("R2 down")) } as unknown as R2Bucket;
    await expect(trackR2Event({ DATALAKE_BUCKET: bucket }, BASE_EVT)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("R2 write failed"),
      "R2 down"
    );
  });

  it("includes all optional fields in the record", async () => {
    const bucket = makeBucket();
    const evt: AnalyticsEvent = {
      event: "checkout_complete",
      email: "user@example.com",
      country: "GR",
      amount: 2900,
      currency: "EUR",
      plan: "pro",
      source: "organic",
      properties: { utm: "test" },
    };
    await trackR2Event({ DATALAKE_BUCKET: bucket }, evt);
    const [, record] = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    const parsed = JSON.parse(record);
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.amount).toBe(2900);
    expect(parsed.properties).toEqual({ utm: "test" });
  });
});

// ---------------------------------------------------------------------------
describe("trackEvent", () => {
  it("calls trackR2Event when DATALAKE_BUCKET is present", () => {
    const bucket = makeBucket();
    trackEvent({ DATALAKE_BUCKET: bucket }, BASE_EVT);
    // fire-and-forget: just verify put was scheduled (bucket.put mock called)
    // Give microtask queue a tick
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(bucket.put).toHaveBeenCalled();
        resolve();
      }, 0)
    );
  });

  it("warns and does not crash when env is undefined", () => {
    expect(() => trackEvent(undefined, BASE_EVT)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("DATALAKE_BUCKET not available")
    );
  });

  it("warns when env has no DATALAKE_BUCKET", () => {
    trackEvent({} as never, BASE_EVT);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("DATALAKE_BUCKET not available")
    );
  });
});
