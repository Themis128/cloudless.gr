/**
 * Client health score — deterministic, explainable 0–100 score per portal
 * (Phase 4). Pure function over the portal state, no I/O.
 *
 * Starts at 100 and subtracts for risk signals:
 *   blocked steps            −25 each (capped −50)
 *   stale project            −20 (no step/deliverable activity in 21 days)
 *   reviews waiting > 7 days −15
 *   open payment > 14 days   −20
 *   changes requested        −10 (unaddressed client feedback)
 */

import type { ClientPortal } from "@/lib/client-portals";

export type HealthBand = "healthy" | "watch" | "at_risk";

export interface ClientHealth {
  score: number;
  band: HealthBand;
  reasons: string[];
}

export const WATCH_THRESHOLD = 75;
export const AT_RISK_THRESHOLD = 50;

const DAY_MS = 86_400_000;
const STALE_DAYS = 21;
const REVIEW_WAIT_DAYS = 7;
const PAYMENT_AGE_DAYS = 14;

function daysBetween(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / DAY_MS;
}

function lastActivityAt(portal: ClientPortal): string | undefined {
  const timestamps: string[] = [portal.createdAt];
  for (const step of portal.steps) {
    if (step.completedAt) timestamps.push(step.completedAt);
    for (const c of step.comments) timestamps.push(c.createdAt);
  }
  for (const d of portal.deliverables ?? []) {
    timestamps.push(d.updatedAt);
  }
  return timestamps.toSorted((a, b) => b.localeCompare(a))[0];
}

function penalizeBlockedSteps(portal: ClientPortal, reasons: string[]): number {
  const blocked = portal.steps.filter((s) => s.status === "blocked").length;
  if (blocked === 0) return 0;
  const penalty = Math.min(blocked * 25, 50);
  reasons.push(`${blocked} blocked step(s) (−${penalty})`);
  return penalty;
}

function penalizeStaleness(portal: ClientPortal, now: Date, reasons: string[]): number {
  const age = daysBetween(lastActivityAt(portal), now);
  if (age !== null && age > STALE_DAYS) {
    reasons.push(`no activity for ${Math.floor(age)} days (−20)`);
    return 20;
  }
  return 0;
}

function penalizeStaleReviews(portal: ClientPortal, now: Date, reasons: string[]): number {
  const waiting = (portal.deliverables ?? []).filter((d) => {
    if (d.status !== "in_review") return false;
    const age = daysBetween(d.updatedAt, now);
    return age !== null && age > REVIEW_WAIT_DAYS;
  }).length;
  if (waiting === 0) return 0;
  reasons.push(`${waiting} deliverable(s) awaiting review > ${REVIEW_WAIT_DAYS} days (−15)`);
  return 15;
}

function penalizeAgingPayments(portal: ClientPortal, now: Date, reasons: string[]): number {
  const aging = (portal.paymentLinks ?? []).filter((l) => {
    if (l.status !== "open") return false;
    const age = daysBetween(l.createdAt, now);
    return age !== null && age > PAYMENT_AGE_DAYS;
  }).length;
  if (aging === 0) return 0;
  reasons.push(`${aging} open payment(s) older than ${PAYMENT_AGE_DAYS} days (−20)`);
  return 20;
}

function penalizeChangeRequests(portal: ClientPortal, reasons: string[]): number {
  const changes = (portal.deliverables ?? []).filter(
    (d) => d.status === "changes_requested"
  ).length;
  if (changes === 0) return 0;
  reasons.push(`${changes} deliverable(s) with unaddressed change requests (−10)`);
  return 10;
}

export function bandForHealth(score: number): HealthBand {
  if (score < AT_RISK_THRESHOLD) return "at_risk";
  if (score < WATCH_THRESHOLD) return "watch";
  return "healthy";
}

export function scoreClientHealth(portal: ClientPortal, now = new Date()): ClientHealth {
  const reasons: string[] = [];
  const penalty =
    penalizeBlockedSteps(portal, reasons) +
    penalizeStaleness(portal, now, reasons) +
    penalizeStaleReviews(portal, now, reasons) +
    penalizeAgingPayments(portal, now, reasons) +
    penalizeChangeRequests(portal, reasons);

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, band: bandForHealth(score), reasons };
}
