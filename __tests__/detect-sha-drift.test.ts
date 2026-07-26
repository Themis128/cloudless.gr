import { describe, expect, it } from "vitest";
import { shaEquivalent, evaluateDrift, type DriftSnapshot } from "@/lib/sha-drift";

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
      cloudExpected: FULL_A,
      piExpected: FULL_A,
      cloud: FULL_A,
      pi: FULL_A,
      cloudSsmModifiedAt: OLD,
      piSsmModifiedAt: OLD,
      ...over,
    };
  }

  it("reports no drift when both surfaces match", () => {
    const r = evaluateDrift(snap({}), NOW);
    expect(r.drifted).toBe(false);
    expect(r.surfaces.every((s) => s.matches)).toBe(true);
  });

  it("each surface compared to its own expected SHA (real-world: Pi short vs cloud full)", () => {
    // Pi deploys SHORT_A (12-char), cloud deploys FULL_A (40-char), both correct.
    const r = evaluateDrift(
      snap({ cloudExpected: FULL_A, piExpected: SHORT_A, cloud: FULL_A, pi: SHORT_A }),
      NOW
    );
    expect(r.drifted).toBe(false);
  });

  it("flags drift when cloud reports a SHA different from its own expected", () => {
    const r = evaluateDrift(snap({ cloud: FULL_B, pi: FULL_A }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.find((s) => s.name === "cloud")?.matches).toBe(false);
    expect(r.surfaces.find((s) => s.name === "pi")?.matches).toBe(true);
  });

  it("flags drift when Pi reports a SHA different from its own expected", () => {
    const r = evaluateDrift(snap({ cloud: FULL_A, pi: FULL_B }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.find((s) => s.name === "pi")?.matches).toBe(false);
  });

  it("does NOT flag false drift when cloud and Pi deployed different commits (normal)", () => {
    // Cloud deployed FULL_A, Pi deployed FULL_B — each matches its own SSM param.
    const r = evaluateDrift(
      snap({
        cloudExpected: FULL_A,
        piExpected: FULL_B,
        cloud: FULL_A,
        pi: FULL_B,
      }),
      NOW
    );
    expect(r.drifted).toBe(false);
  });

  it("recognises the 'APP_VERSION not wired' fallback", () => {
    const r = evaluateDrift(snap({ cloud: "0.1.0", pi: "0.1.0" }), NOW);
    expect(r.drifted).toBe(true);
    expect(r.surfaces.every((s) => s.reason.includes("APP_VERSION not wired"))).toBe(true);
  });

  it("does NOT flag drift inside grace window when most-recent SSM write is fresh", () => {
    // Pi just deployed (RECENT) but cloud hasn't caught up yet.
    const r = evaluateDrift(
      snap({ cloudSsmModifiedAt: OLD, piSsmModifiedAt: RECENT, cloud: FULL_B, pi: FULL_B }),
      NOW
    );
    expect(r.withinGrace).toBe(true);
    expect(r.drifted).toBe(false);
  });

  it("flags drift outside the grace window even with the same situation", () => {
    const r = evaluateDrift(
      snap({ cloudSsmModifiedAt: OLD, piSsmModifiedAt: OLD, cloud: FULL_B, pi: FULL_B }),
      NOW
    );
    expect(r.withinGrace).toBe(false);
    expect(r.drifted).toBe(true);
  });
});
