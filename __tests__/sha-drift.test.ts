import { describe, it, expect } from "vitest";
import { shaEquivalent, evaluateDrift, GRACE_WINDOW_MS, type DriftSnapshot } from "@/lib/sha-drift";

describe("sha-drift", () => {
  describe("shaEquivalent", () => {
    it("matches a full SHA against its 12-char prefix", () => {
      const full = "a1b2c3d4e5f60718293a4b5c6d7e8f0011223344";
      expect(shaEquivalent(full, full.slice(0, 12))).toBe(true);
      expect(shaEquivalent(full.slice(0, 12), full)).toBe(true);
    });

    it("matches a 7-char abbreviation against the full SHA", () => {
      const full = "deadbeef0011223344556677889900112233aabb";
      expect(shaEquivalent(full, full.slice(0, 7))).toBe(true);
    });

    it("is case-insensitive", () => {
      const a = "DEADBEEF0011223344556677889900112233AABB";
      const b = "deadbeef0011223344556677889900112233aabb";
      expect(shaEquivalent(a, b)).toBe(true);
    });

    it("rejects two SHAs that share no prefix", () => {
      expect(shaEquivalent("aaaa1111", "bbbb2222")).toBe(false);
    });

    it("rejects null on either side", () => {
      expect(shaEquivalent(null, "deadbeef")).toBe(false);
      expect(shaEquivalent("deadbeef", null)).toBe(false);
      expect(shaEquivalent(null, null)).toBe(false);
    });

    it("rejects empty strings", () => {
      expect(shaEquivalent("", "deadbeef")).toBe(false);
      expect(shaEquivalent("deadbeef", "")).toBe(false);
    });
  });

  describe("evaluateDrift", () => {
    const SHA = "deadbeef0011223344556677889900112233aabb";
    const PI_SHORT = SHA.slice(0, 12);
    const OTHER = "ffffffffffffffffffffffffffffffffffffffff";

    const snapshotBase = (overrides: Partial<DriftSnapshot> = {}): DriftSnapshot => ({
      cloudExpected: SHA,
      piExpected: PI_SHORT,
      cloud: SHA,
      pi: PI_SHORT,
      cloudSsmModifiedAt: null,
      piSsmModifiedAt: null,
      ...overrides,
    });

    it("reports drifted=false when both surfaces match", () => {
      const r = evaluateDrift(snapshotBase());
      expect(r.drifted).toBe(false);
      expect(r.surfaces).toHaveLength(2);
      expect(r.surfaces.every((s) => s.matches)).toBe(true);
    });

    it("reports drifted=true when cloud SHA differs and no grace window", () => {
      const r = evaluateDrift(snapshotBase({ cloud: OTHER }));
      expect(r.drifted).toBe(true);
      const cloud = r.surfaces.find((s) => s.name === "cloud");
      expect(cloud?.matches).toBe(false);
      expect(cloud?.reason).toMatch(/SHA differs/);
    });

    it("reports drifted=true when pi SHA differs and no grace window", () => {
      const r = evaluateDrift(snapshotBase({ pi: OTHER }));
      expect(r.drifted).toBe(true);
      const pi = r.surfaces.find((s) => s.name === "pi");
      expect(pi?.matches).toBe(false);
    });

    it("flags an unreachable surface with the explicit reason", () => {
      const r = evaluateDrift(snapshotBase({ pi: null }));
      const pi = r.surfaces.find((s) => s.name === "pi");
      expect(pi?.matches).toBe(false);
      expect(pi?.reason).toMatch(/unreachable/);
    });

    it("flags a static-fallback APP_VERSION explicitly", () => {
      const r = evaluateDrift(snapshotBase({ cloud: "0.1.0" }));
      const cloud = r.surfaces.find((s) => s.name === "cloud");
      expect(cloud?.matches).toBe(false);
      expect(cloud?.reason).toMatch(/APP_VERSION/);
    });

    it("also flags 'dev' as a static-fallback APP_VERSION", () => {
      const r = evaluateDrift(snapshotBase({ pi: "dev" }));
      const pi = r.surfaces.find((s) => s.name === "pi");
      expect(pi?.matches).toBe(false);
      expect(pi?.reason).toMatch(/APP_VERSION/);
    });

    it("suppresses drift during the grace window after a fresh SSM write", () => {
      const now = 1_700_000_000_000;
      const justNow = new Date(now - 30_000); // 30s ago, well within grace
      const r = evaluateDrift(
        snapshotBase({
          cloud: OTHER,
          cloudSsmModifiedAt: justNow,
        }),
        now
      );
      expect(r.withinGrace).toBe(true);
      expect(r.drifted).toBe(false);
      // A mismatched surface is still reported even when grace suppresses
      // the overall alert.
      expect(r.surfaces.find((s) => s.name === "cloud")?.matches).toBe(false);
    });

    it("releases the grace window once GRACE_WINDOW_MS has elapsed", () => {
      const now = 1_700_000_000_000;
      const longAgo = new Date(now - GRACE_WINDOW_MS - 1_000);
      const r = evaluateDrift(
        snapshotBase({
          cloud: OTHER,
          cloudSsmModifiedAt: longAgo,
        }),
        now
      );
      expect(r.withinGrace).toBe(false);
      expect(r.drifted).toBe(true);
    });

    it("uses the latest of cloud/pi SSM modify times for grace calculation", () => {
      const now = 1_700_000_000_000;
      const old = new Date(now - GRACE_WINDOW_MS - 5_000);
      const fresh = new Date(now - 60_000);
      const r = evaluateDrift(
        snapshotBase({
          cloud: OTHER,
          cloudSsmModifiedAt: old,
          piSsmModifiedAt: fresh,
        }),
        now
      );
      expect(r.withinGrace).toBe(true);
      expect(r.drifted).toBe(false);
    });

    it("returns ageMs=null when neither SSM modify time is provided", () => {
      const r = evaluateDrift(snapshotBase());
      expect(r.ageMs).toBeNull();
      expect(r.withinGrace).toBe(false);
    });
  });
});
