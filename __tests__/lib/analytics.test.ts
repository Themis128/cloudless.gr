import { describe, it, expect, vi } from "vitest";
import { trackAnalyticsEvent, trackS3Event, type AnalyticsEvent } from "@/lib/analytics";

describe("trackAnalyticsEvent", () => {
  it("returns false when event name is empty", async () => {
    const result = await trackAnalyticsEvent({ event: "" });
    expect(result).toBe(false);
  });

  it("returns false when event name is whitespace", async () => {
    const result = await trackAnalyticsEvent({ event: "   " });
    expect(result).toBe(false);
  });

  it("returns false when D1 binding is unavailable (test env)", async () => {
    const result = await trackAnalyticsEvent({ event: "page_view" });
    expect(result).toBe(false);
  });
});

describe("trackS3Event", () => {
  it("does not throw", () => {
    expect(() => trackS3Event({ event: "test_event" })).not.toThrow();
  });

  it("is a no-op when D1 is unavailable (fire-and-forget)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    trackS3Event({ event: "fire_and_forget" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
