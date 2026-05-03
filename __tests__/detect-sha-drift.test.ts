import { describe, expect, it } from "vitest";
import {
  shaEquivalent,
  evaluateDrift,
  type DriftSnapshot,
} from "@/lib/sha-drift";

const FULL_A = "49f2b0711ba5ab25d18e3fc2c72158f345aa546a";
const SHORT_A = "49f2b0711ba5"; // 12-char form
const SHORT_A_7 = "49f2b07"; // 7-char form
const FULL_B = "8ad71c64240af32f7357133fd4e30207ebeadd7f";

describe("shaEquivalent", () => {
  it("returns true for identical SHAs", () => {
    expect(shaEquivalent(FULL_A, FULL_A)).toBe(true);
  });

  it("returns true when one is a prefix of the other (12-char vs full)", () => {
    expect(shaEquivalent(FULL_A, SHORT_A)).toBe(true);
    expect(shaEquivalent(SHORT_A, FULL_A)).toBe(true);
  });

  it("returns true for 7-char abbreviated prefix", () => {
    expect(shaEquivalent(FULL_A, SHORT_A_7)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(shaEquivalent(FULL_A.toUpperCase(), SHORT_A)).toBe(true);
  });

  it("returns false for different SHAs", () => {
    expect(shaEquivalent(FULL_A, FULL_B)).toBe(false);
    expect(shaEquivalent(SHORT_A, FULL_B)).toBe(false);
  });

  it("returns false when either side is null", () => {
    expect(shaEquivalent(null, FULL_A)).toBe(false);
    expect(shaEquivalent(FULL_A, null)).toBe(false);
    expect(shaEquivalent(null, null)).toBe(false);
  });
});

describe("evaluateDrift", () => {
  const NOW = new Date("2026-05-03T12:00:00Z").getTime();
  const RECENT = new Date("2026-05-03T11:55:00Z"); // 5 minutes ago — inside grace
  const OLD = new Date("2026-05-03T11:30:00Z"); // 30 minutes ago — outside grace

  function snap(over: Partial<DriftSnapshot>): DriftSnapshot {
    return {
      expected: FULL_A,
      cloud: FULL_A,
      pi: FULL_A,
      ssmModifiedAt: OLD,
      ...over,
    };
  }

  it("reports no drift when both surfaces match", () => {
    const r = evaluateDrift(snap({}), NOW);
    expect(r.drifted).toBe(false);
    expect(r.surfaces.every((s) => s.matches)).toBe(true);
  });

  it("matches across SHA length variants (12-char Pi, full cloud)", () => {
    const r = evaluateDrift(snap({ cloud: FULL_A, pi: SHORT_A }), NOW);
    expect(r.drifted).toBe(false);
  });

  it("flags drift when cloud reports a different SHA", () => {
    const r = evaluateDrift(snap({ cloud: FULL_B, pi: FULL_A }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.find((s) => s.name === "cloud")?.matches).toBe(false);
    expect(r.surfaces.find((s) => s.name === "pi")?.matches).toBe(true);
  });

  it("flags drift when Pi reports a different SHA", () => {
    const r = evaluateDrift(snap({ cloud: FULL_A, pi: FULL_B }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.find((s) => s.name === "pi")?.matches).toBe(false);
  });

  it("recognises the 'APP_VERSION not wired' fallback", () => {
    const r = evaluateDrift(snap({ cloud: "0.1.0", pi: "0.1.0" }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.every((s) => s.reason.includes("APP_VERSION not wired"))).toBe(true);
  });

  it("does NOT flag drift inside the grace window (10 min after SSM publish)", () => {
    // Both surfaces still showing the OLD SHA right after a new publish — expected.
    const r = evaluateDrift(
      snap({ ssmModifiedAt: RECENT, cloud: FULL_B, pi: FULL_B }),
      NOW,
    );
    expect(r.withinGrace).toBe(true);
    expect(r.drifted).toBe(false);
  });

  it("flags drift outside the grace window even with the same situation", () => {
    const r = evaluateDrift(
      snap({ ssmModifiedAt: OLD, cloud: FULL_B, pi: FULL_B }),
      NOW,
    );
    expect(r.withinGrace).toBe(false);
    expect(r.drifted).toBe(true);
  });

  it("flags 'endpoint unreachable' when a surface returns null", () => {
    const r = evaluateDrift(snap({ cloud: null, pi: FULL_A }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.find((s) => s.name === "cloud")?.reason).toContain("unreachable");
  });

  it("computes ageMs correctly", () => {
    const r = evaluateDrift(snap({ ssmModifiedAt: OLD }), NOW);
    expect(r.ageMs).toBe(30 * 60 * 1000);
  });

  it("returns null ageMs when ssmModifiedAt is missing", () => {
    const r = evaluateDrift(snap({ ssmModifiedAt: null }), NOW);
    expect(r.ageMs).toBeNull();
    expect(r.withinGrace).toBe(false);
  });
});
