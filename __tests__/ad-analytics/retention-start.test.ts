import { describe, it, expect } from "vitest";
import { linkedInRetentionStart } from "@/lib/ad-analytics/runtime";

describe("linkedInRetentionStart", () => {
  it("starts on the first of the month after now minus 10 years", () => {
    expect(linkedInRetentionStart(new Date("2026-10-17T12:00:00Z"))).toBe("2016-11-01");
  });

  it("rolls over the year in December", () => {
    expect(linkedInRetentionStart(new Date("2026-12-31T23:59:59Z"))).toBe("2017-01-01");
  });

  it("is never earlier than LinkedIn's 10-year limit", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const start = new Date(linkedInRetentionStart(now) + "T00:00:00Z");
    const limit = new Date(Date.UTC(2016, 2, 1));
    expect(start.getTime()).toBeGreaterThan(limit.getTime());
  });
});
