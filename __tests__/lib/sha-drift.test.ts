import { describe, it, expect } from "vitest";
import {
  shaEquivalent,
  evaluateDrift,
  GRACE_WINDOW_MS,
} from "@/lib/sha-drift";
import type { DriftSnapshot } from "@/lib/sha-drift";

describe("shaEquivalent", () => {
  it("returns true when full SHA matches short prefix", () => {
    const full = "abcdef1234567890abcdef1234567890abcdef12";
    const short = "abcdef123456";
    expect(shaEquivalent(full, short)).toBe(true);
    expect(shaEquivalent(short, full)).toBe(true);
  });

  it("returns true for identical strings", () => {
    expect(shaEquivalent("abc123", "abc123")).toBe(true);
  });

  it("returns false for different SHAs", () => {
    expect(shaEquivalent("aaaa", "bbbb")).toBe(false);
  });

  it("returns false when either is null", () => {
    expect(shaEquivalent(null, "abc")).toBe(false);
    expect(shaEquivalent("abc", null)).toBe(false);
    expect(shaEquivalent(null, null)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(shaEquivalent("ABCDEF", "abcdef")).toBe(true);
  });
});

const NOW = 1_000_000_000_000; // fixed timestamp

function makeSnapshot(overrides: Partial<DriftSnapshot> = {}): DriftSnapshot {
  return {
    cloudExpected: "abc1234567890",
    piExpected: "def1234567890",
    cloud: "abc1234567890",
    pi: "def1234567890",
    cloudSsmModifiedAt: new Date(NOW - 1_000),
    piSsmModifiedAt: new Date(NOW - 1_000),
    ...overrides,
  };
}

describe("evaluateDrift", () => {
  it("reports no drift when both surfaces match", () => {
    const report = evaluateDrift(makeSnapshot(), NOW);
    expect(report.drifted).toBe(false);
    expect(report.surfaces.every((s) => s.matches)).toBe(true);
  });

  it("reports drift when cloud SHA differs and outside grace window", () => {
    const old = new Date(NOW - GRACE_WINDOW_MS - 60_000);
    const snapshot = makeSnapshot({ cloud: "000000000000", cloudSsmModifiedAt: old, piSsmModifiedAt: old });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.drifted).toBe(true);
    expect(report.surfaces[0].matches).toBe(false);
  });

  it("does not report drift within grace window even with mismatch", () => {
    const recent = new Date(NOW - 30_000);
    const snapshot = makeSnapshot({ cloud: "000000000000", cloudSsmModifiedAt: recent });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.withinGrace).toBe(true);
    expect(report.drifted).toBe(false);
  });

  it("handles null actual (unreachable endpoint)", () => {
    const old = new Date(NOW - GRACE_WINDOW_MS - 1);
    const snapshot = makeSnapshot({ cloud: null, cloudSsmModifiedAt: old, piSsmModifiedAt: old });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.surfaces[0].matches).toBe(false);
    expect(report.surfaces[0].reason).toContain("unreachable");
  });

  it("ageMs is null when no SSM dates provided", () => {
    const snapshot = makeSnapshot({ cloudSsmModifiedAt: null, piSsmModifiedAt: null });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.ageMs).toBeNull();
    expect(report.withinGrace).toBe(false);
  });

  it("uses the most recent SSM date for grace window", () => {
    const oldDate = new Date(NOW - GRACE_WINDOW_MS - 1);
    const recentDate = new Date(NOW - 1_000);
    const snapshot = makeSnapshot({
      cloud: "mismatch",
      cloudSsmModifiedAt: oldDate,
      piSsmModifiedAt: recentDate,
    });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.withinGrace).toBe(true);
    expect(report.drifted).toBe(false);
  });

  it("accepts dev/0.1.0 as static fallback, marks not matching", () => {
    const old = new Date(NOW - GRACE_WINDOW_MS - 1);
    const snapshot = makeSnapshot({ cloud: "dev", cloudSsmModifiedAt: old, piSsmModifiedAt: old });
    const report = evaluateDrift(snapshot, NOW);
    expect(report.surfaces[0].matches).toBe(false);
    expect(report.surfaces[0].reason).toContain("static fallback");
  });

  it("GRACE_WINDOW_MS is 10 minutes", () => {
    expect(GRACE_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});
