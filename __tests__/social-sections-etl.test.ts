/**
 * Unit tests for scripts/etl/_social-sections.mjs — SocialAuto insight
 * transforms consumed by materialize-datalake-snapshots.mjs.
 *
 * The upstream insights engine (cu130-slim) applies the robust statistics;
 * these tests pin the gold-snapshot contract so honest-confidence fields
 * survive the materialize step.
 */
import { describe, expect, it } from "vitest";
import {
  socialEngagement,
  socialMonetization,
  socialOutliers,
  socialRecommendations,
} from "../scripts/etl/_social-sections.mjs";

const platforms = {
  linkedin: {
    focus_tier: "primary",
    confidence: "medium",
    posts: 12,
    impressions: 900,
    engagement: 120,
    avg_engagement_rate: 36.3,
    avg_engagement_rate_wilson_low: 32.04,
    median_engagement_rate: 30.1,
    median_engagement_per_post: 10,
    media_avg_er_shrunk: 28.4,
    text_avg_er_shrunk: 19.9,
    er_by_followers_pct: 5.2,
    benchmark: { verdict: "above" },
    momentum_7d_engagement_pct: -86.2,
    momentum_7d_engagement_z: -7.23,
    momentum_7d_impressions_z: -3.1,
    engagement_7d: 44,
    follower_growth: { current: 900, net: 64, slope_per_day: 2.12 },
    best_hour_athens: [19, 0.57],
    best_weekday_athens: [4, 0.6],
    best_hour_sample: 4,
    data_quality: { counter_resets: 1 },
    data_warnings: [],
  },
  twitter: {
    posts: 3,
    impressions: 40,
    engagement: 2,
    avg_engagement_rate: 2.94,
    avg_engagement_rate_wilson_low: 0.52,
    momentum_7d_engagement_z: 1.0, // noise — |z| < 1.645
    follower_growth: null,
    data_quality: {},
  },
};

describe("socialEngagement", () => {
  const rows = socialEngagement({ platforms })!;

  it("surfaces the honest-confidence fields", () => {
    const li = rows[0];
    expect(li.er_wilson_low_pct).toBe(32.04);
    expect(li.momentum_7d_engagement_z).toBe(-7.23);
    expect(li.momentum_significant).toBe(true);
    expect(li.follower_slope_per_day).toBe(2.12);
    expect(li.media_er_shrunk_pct).toBe(28.4);
    expect(li.best_hour_athens).toBe(19);
    expect(li.best_hour_sample).toBe(4);
    expect(li.counter_resets).toBe(1);
  });

  it("marks small-sample momentum as not significant", () => {
    const tw = rows.find((r) => r.platform === "twitter")!;
    expect(tw.momentum_significant).toBe(false);
    expect(tw.er_wilson_low_pct).toBe(0.52);
  });

  it("returns null without platforms", () => {
    expect(socialEngagement(null)).toBeNull();
    expect(socialEngagement({})).toBeNull();
  });
});

describe("socialMonetization", () => {
  it("summarises gate progress per account", () => {
    const gates = [
      {
        platform: "facebook",
        username: "themis.baltzakis",
        account_type: "user",
        followers: 66,
        gain_per_day: 0.5,
        program: "Facebook Stars (professional mode)",
        criteria: [
          { name: "country", met: true },
          { name: "followers ≥ 500", met: false },
          { name: "30-day hold", met: null },
        ],
        evaluated_at: "2026-10-13T00:00:00Z",
      },
      {
        platform: "threads",
        username: "cloudless.gr",
        role: "funnel",
        criteria: [],
      },
      { platform: "tiktok", error: "rate limited" },
    ];
    const rows = socialMonetization(gates)!;
    expect(rows).toHaveLength(3);
    expect(rows[0].criteria_met).toBe(1);
    expect(rows[0].criteria_total).toBe(3);
    expect(rows[0].criteria_unknown).toBe(1);
    expect(rows[0].follower_slope_per_day).toBe(0.5);
    expect(rows[1].role).toBe("funnel");
    expect(rows[2].error).toBe("rate limited");
  });

  it("returns null on empty input", () => {
    expect(socialMonetization(null)).toBeNull();
    expect(socialMonetization([])).toBeNull();
  });
});

describe("socialOutliers / socialRecommendations", () => {
  it("flattens outliers and follower anomalies", () => {
    const rows = socialOutliers({
      platforms: {
        linkedin: {
          outliers: [{ kind: "viral", engagement: 200, post_id: "p1" }],
          follower_growth: { anomaly: { delta: -40 } },
        },
      },
    })!;
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("viral");
  });

  it("passes recommendations through capped at 500 chars", () => {
    const rows = socialRecommendations({
      recommendations: [
        { type: "timing", priority: "high", platform: "linkedin", text: "x".repeat(600) },
      ],
    })!;
    expect(rows[0].text).toHaveLength(500);
  });
});
