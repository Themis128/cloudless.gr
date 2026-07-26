/**
 * Anomaly evaluator for the ad-analytics module — Phase 4.
 *
 * Inputs:
 *  - `current`: the just-pulled snapshot (`AdMetrics` for one campaign × platform).
 *  - `previous`: the last bookmarked snapshot, if any. Used as the rolling
 *    baseline for the CPC-spike and spend-pace rules.
 *  - `rules`: per-campaign overrides for the thresholds. Anything left
 *    undefined falls back to the industry defaults captured in `DEFAULTS`
 *    below.
 *
 * Output: a list of triggered `AnomalyFinding` rows — one per fired rule —
 * which the runtime renders as a Block Kit DM via the configured notify
 * channel (`level: "anomaly"`).
 *
 * Thresholds and rationale come from:
 *  - Improvado 2026 ad anomaly playbook
 *    https://improvado.io/blog/marketing-anomaly-detection-automated-alerts
 *  - Go-Insights monitoring methodology
 *    https://www.go-insights.com/anomaly-detection
 *  - Ryze AI's "stop wasting ad spend automatically"
 *    https://www.get-ryze.ai/answers/how-to-stop-wasting-ad-spend-automatically
 *  - GitHub / Tinybird Z-score reference for the statistical layer
 *    (CPC spike multiplier is the simpler ratio-of-means version; full Z-score
 *    waits until we have ≥7 bookmarked snapshots to compute stddev over).
 *
 * Operating principles:
 *  - Conservative by default. Industry guidance: a 20% CPA increase over 3
 *    days is more reliable than a 10% increase over 1 day.
 *  - "No previous snapshot" suppresses rules that require a baseline (spend
 *    pace, CPC spike). Absolute-threshold rules (`maxCpcEur`, `minCtr`,
 *    `zeroConversionsHours`) still fire — they don't need a baseline.
 *  - Never throws. The runtime calls this in a hot path; a logic error must
 *    never break the poll.
 *
 * See `skills/ad-analytics/SKILL.md` operating principles + the architecture
 * doc §10 (added in this PR) for the wire-up and operator-facing notes.
 */

import type { AdMetrics, AnomalyRules } from "./types";

/**
 * Industry-default thresholds. Applied when the campaign opts into anomaly
 * DMs (has a `level: "anomaly"` notify channel) but leaves the corresponding
 * `AnomalyRules` field undefined. Source: see file header.
 */
export const DEFAULTS: Required<
  Pick<
    AnomalyRules,
    "spendPaceMultiplier" | "cpcSpikeMultiplier" | "zeroConversionsHours" | "minCtr"
  >
> = {
  spendPaceMultiplier: 1.5,
  cpcSpikeMultiplier: 1.4,
  zeroConversionsHours: 24,
  minCtr: 0.003,
};

export type AnomalyRuleId =
  | "cpc_spike"
  | "cpc_ceiling"
  | "ctr_floor"
  | "zero_conversions"
  | "spend_pace";

export interface AnomalyFinding {
  /** Stable id for the rule that fired — used for de-dup keying. */
  rule: AnomalyRuleId;
  /** "warning" | "critical" — drives the emoji + DM thread color. */
  severity: "warning" | "critical";
  /** Human-readable one-liner shown to the operator. */
  message: string;
  /** Structured detail the renderer can format. */
  detail: {
    metric: string;
    observed: number;
    threshold: number;
    /** Rolling baseline value, if applicable. */
    baseline?: number;
  };
}

export interface EvaluateAnomaliesOpts {
  current: AdMetrics;
  previous?: AdMetrics | null;
  rules?: AnomalyRules;
  /** Length of the current window in hours — used by `zero_conversions`. */
  windowHours?: number;
}

/**
 * Evaluate every rule against the current snapshot and return all findings.
 * Empty array = no anomalies — the runtime should NOT post a DM.
 */
export function evaluateAnomalies(opts: EvaluateAnomaliesOpts): AnomalyFinding[] {
  const { current, previous, rules = {}, windowHours = 1 } = opts;
  const findings: AnomalyFinding[] = [];

  // ---- CPC spike (vs rolling baseline) -------------------------------------
  const cpcMult = rules.cpcSpikeMultiplier ?? DEFAULTS.cpcSpikeMultiplier;
  if (previous?.cpcEur && current.cpcEur && previous.cpcEur > 0) {
    if (current.cpcEur >= previous.cpcEur * cpcMult) {
      findings.push({
        rule: "cpc_spike",
        severity: "warning",
        message: `CPC is ${(current.cpcEur / previous.cpcEur).toFixed(2)}× the prior window's CPC (€${current.cpcEur.toFixed(2)} vs €${previous.cpcEur.toFixed(2)}).`,
        detail: {
          metric: "cpcEur",
          observed: current.cpcEur,
          threshold: previous.cpcEur * cpcMult,
          baseline: previous.cpcEur,
        },
      });
    }
  }

  // ---- CPC ceiling (absolute) ---------------------------------------------
  if (rules.maxCpcEur && current.cpcEur && current.cpcEur > rules.maxCpcEur) {
    findings.push({
      rule: "cpc_ceiling",
      severity: "critical",
      message: `CPC €${current.cpcEur.toFixed(2)} exceeds the configured ceiling of €${rules.maxCpcEur.toFixed(2)}.`,
      detail: {
        metric: "cpcEur",
        observed: current.cpcEur,
        threshold: rules.maxCpcEur,
      },
    });
  }

  // ---- CTR floor (absolute) ------------------------------------------------
  // Only meaningful when there are enough impressions to make a CTR
  // measurement statistically real. Skip when impressions < 200 so a 1-click
  // window doesn't fire a false alarm.
  const minCtr = rules.minCtr ?? DEFAULTS.minCtr;
  if (current.impressions >= 200 && typeof current.ctr === "number" && current.ctr < minCtr) {
    findings.push({
      rule: "ctr_floor",
      severity: "warning",
      message: `CTR ${(current.ctr * 100).toFixed(2)}% is below the floor of ${(minCtr * 100).toFixed(2)}%.`,
      detail: {
        metric: "ctr",
        observed: current.ctr,
        threshold: minCtr,
      },
    });
  }

  // ---- Zero conversions while spending ------------------------------------
  const zeroHours = rules.zeroConversionsHours ?? DEFAULTS.zeroConversionsHours;
  // Only fire when the configured window covers at least `zeroHours`. The
  // 15-min poll window can't tell whether conversions are missing for "24h"
  // — that's a derived fact the runtime feeds via `windowHours`.
  if (windowHours >= zeroHours && current.spendEur > 0 && current.conversions === 0) {
    findings.push({
      rule: "zero_conversions",
      severity: "critical",
      message: `€${current.spendEur.toFixed(2)} spent over ~${zeroHours}h with zero conversions.`,
      detail: {
        metric: "conversions",
        observed: 0,
        threshold: zeroHours,
      },
    });
  }

  // ---- Spend pace (vs rolling baseline) -----------------------------------
  const paceMult = rules.spendPaceMultiplier ?? DEFAULTS.spendPaceMultiplier;
  if (previous && previous.spendEur > 0 && current.spendEur > 0) {
    if (current.spendEur >= previous.spendEur * paceMult) {
      findings.push({
        rule: "spend_pace",
        severity: "warning",
        message: `Spend is ${(current.spendEur / previous.spendEur).toFixed(2)}× the prior window (€${current.spendEur.toFixed(2)} vs €${previous.spendEur.toFixed(2)}).`,
        detail: {
          metric: "spendEur",
          observed: current.spendEur,
          threshold: previous.spendEur * paceMult,
          baseline: previous.spendEur,
        },
      });
    }
  }

  return findings;
}

/**
 * Stable key per-finding so the runtime can de-dup re-sent alerts. Combines
 * campaign + platform + rule + window-day so the SAME alert in the next 15-min
 * tick doesn't spam the DM channel — but a fresh occurrence the next morning
 * does.
 */
export function findingDedupKey(opts: {
  campaignSlug: string;
  platform: string;
  rule: AnomalyRuleId;
  windowEnd: string; // ISO
}): string {
  const day = opts.windowEnd.slice(0, 10); // YYYY-MM-DD
  return `ad-analytics:anomaly:${opts.campaignSlug}:${opts.platform}:${opts.rule}:${day}`;
}
