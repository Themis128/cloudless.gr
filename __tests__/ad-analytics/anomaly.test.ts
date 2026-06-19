// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  evaluateAnomalies,
  findingDedupKey,
  DEFAULTS,
} from "@/lib/ad-analytics/anomaly";
import type { AdMetrics } from "@/lib/ad-analytics/types";

function m(over: Partial<AdMetrics> = {}): AdMetrics {
  return {
    platform: "linkedin",
    campaignId: "692134846",
    windowStart: "2026-06-19T08:00:00.000Z",
    windowEnd: "2026-06-19T09:00:00.000Z",
    impressions: 1000,
    clicks: 10,
    conversions: 1,
    spendEur: 10,
    ctr: 0.01,
    cpcEur: 1.0,
    cpaEur: 10.0,
    ...over,
  };
}

describe("evaluateAnomalies — DEFAULTS", () => {
  it("exports conservative industry-aligned thresholds", () => {
    // These numbers are the contract — if you change them you also need to
    // update skills/ad-analytics/SKILL.md and the Notion architecture doc.
    expect(DEFAULTS.spendPaceMultiplier).toBe(1.5);
    expect(DEFAULTS.cpcSpikeMultiplier).toBe(1.4);
    expect(DEFAULTS.zeroConversionsHours).toBe(24);
    expect(DEFAULTS.minCtr).toBe(0.003);
  });
});

describe("evaluateAnomalies — rules", () => {
  it("returns no findings on a healthy snapshot", () => {
    const findings = evaluateAnomalies({
      current: m(),
      previous: m(),
      windowHours: 1,
    });
    expect(findings).toEqual([]);
  });

  it("fires cpc_spike when current CPC ≥ 1.4× previous CPC", () => {
    const findings = evaluateAnomalies({
      current: m({ cpcEur: 2.0, spendEur: 20 }),
      previous: m({ cpcEur: 1.0, spendEur: 10 }),
    });
    const cpcSpike = findings.find((f) => f.rule === "cpc_spike");
    expect(cpcSpike).toBeDefined();
    expect(cpcSpike?.severity).toBe("warning");
    expect(cpcSpike?.detail.baseline).toBe(1.0);
  });

  it("does NOT fire cpc_spike on a cold start (no previous)", () => {
    const findings = evaluateAnomalies({
      current: m({ cpcEur: 10.0 }),
      previous: null,
    });
    expect(findings.find((f) => f.rule === "cpc_spike")).toBeUndefined();
  });

  it("fires cpc_ceiling (critical) when CPC > maxCpcEur", () => {
    const findings = evaluateAnomalies({
      current: m({ cpcEur: 12 }),
      previous: m({ cpcEur: 10 }),
      rules: { maxCpcEur: 10 },
    });
    const ceiling = findings.find((f) => f.rule === "cpc_ceiling");
    expect(ceiling).toBeDefined();
    expect(ceiling?.severity).toBe("critical");
    expect(ceiling?.detail.threshold).toBe(10);
  });

  it("fires ctr_floor only when impressions ≥ 200 (avoids small-sample false alarms)", () => {
    // Below the impressions floor — must NOT fire even with a terrible CTR.
    const smallSample = evaluateAnomalies({
      current: m({ impressions: 50, clicks: 0, ctr: 0 }),
    });
    expect(smallSample.find((f) => f.rule === "ctr_floor")).toBeUndefined();

    // Above the impressions floor with CTR below DEFAULTS.minCtr (0.3%).
    const real = evaluateAnomalies({
      current: m({ impressions: 1000, clicks: 1, ctr: 0.001 }),
    });
    const floor = real.find((f) => f.rule === "ctr_floor");
    expect(floor).toBeDefined();
    expect(floor?.detail.threshold).toBe(DEFAULTS.minCtr);
  });

  it("fires zero_conversions ONLY when windowHours ≥ zeroConversionsHours", () => {
    // 15-min window — too short to claim "no conversions in 24h"; must NOT fire.
    const short = evaluateAnomalies({
      current: m({ conversions: 0, spendEur: 50 }),
      windowHours: 1,
    });
    expect(short.find((f) => f.rule === "zero_conversions")).toBeUndefined();

    // 24h+ window — fires.
    const long = evaluateAnomalies({
      current: m({ conversions: 0, spendEur: 50 }),
      windowHours: 24,
    });
    const zero = long.find((f) => f.rule === "zero_conversions");
    expect(zero).toBeDefined();
    expect(zero?.severity).toBe("critical");
  });

  it("fires spend_pace when current spend ≥ 1.5× previous", () => {
    const findings = evaluateAnomalies({
      current: m({ spendEur: 20 }),
      previous: m({ spendEur: 10 }),
    });
    const pace = findings.find((f) => f.rule === "spend_pace");
    expect(pace).toBeDefined();
    expect(pace?.detail.baseline).toBe(10);
  });

  it("respects per-campaign overrides over DEFAULTS", () => {
    const findings = evaluateAnomalies({
      current: m({ cpcEur: 5 }),
      previous: m({ cpcEur: 4 }), // 1.25× — under the default 1.4× but over 1.2×
      rules: { cpcSpikeMultiplier: 1.2 },
    });
    expect(findings.find((f) => f.rule === "cpc_spike")).toBeDefined();
  });
});

describe("findingDedupKey", () => {
  it("composes a stable per-day key so repeats inside the same day collapse", () => {
    const k1 = findingDedupKey({
      campaignSlug: "shop-online",
      platform: "linkedin",
      rule: "cpc_spike",
      windowEnd: "2026-06-19T09:14:59.999Z",
    });
    const k2 = findingDedupKey({
      campaignSlug: "shop-online",
      platform: "linkedin",
      rule: "cpc_spike",
      windowEnd: "2026-06-19T23:45:00.000Z",
    });
    // Same day → same key (don't re-alert in the next 15-min tick).
    expect(k1).toBe(k2);

    const tomorrow = findingDedupKey({
      campaignSlug: "shop-online",
      platform: "linkedin",
      rule: "cpc_spike",
      windowEnd: "2026-06-20T08:00:00.000Z",
    });
    // Different day → different key (re-alert tomorrow if it persists).
    expect(tomorrow).not.toBe(k1);
  });
});
