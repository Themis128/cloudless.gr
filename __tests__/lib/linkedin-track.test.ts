import { describe, it, expect, beforeEach, vi } from "vitest";
import { trackLinkedInConversion } from "@/lib/linkedin-track";

describe("trackLinkedInConversion", () => {
  beforeEach(() => {
    // Wipe whatever LinkedInInsightTag left on window across tests.
    (window as { lintrk?: unknown }).lintrk = undefined;
  });

  it("is a no-op when window.lintrk is not present (no consent / no partner ID)", () => {
    expect(() => trackLinkedInConversion(123)).not.toThrow();
  });

  it("calls lintrk('track', { conversion_id }) with a numeric ID", () => {
    const spy = vi.fn();
    (window as { lintrk?: typeof spy }).lintrk = spy;

    trackLinkedInConversion(987654);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("track", { conversion_id: 987654 });
  });

  it("accepts a string ID as well (Campaign Manager occasionally emits them)", () => {
    const spy = vi.fn();
    (window as { lintrk?: typeof spy }).lintrk = spy;

    trackLinkedInConversion("CV-42");

    expect(spy).toHaveBeenCalledWith("track", { conversion_id: "CV-42" });
  });
});
