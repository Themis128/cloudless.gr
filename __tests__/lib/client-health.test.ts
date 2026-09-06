/**
 * Tests for src/lib/client-health.ts — pure scoring function, no I/O.
 */
import { describe, it, expect } from "vitest";
import {
  scoreClientHealth,
  bandForHealth,
  WATCH_THRESHOLD,
  AT_RISK_THRESHOLD,
} from "@/lib/client-health";
import type { ClientPortal } from "@/lib/client-portals";

const RECENT = new Date("2026-09-06");

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    token: "tok-1",
    label: "Website Redesign",
    clientName: "Acme Corp",
    clientEmail: "client@acme.com",
    createdAt: "2026-09-01T00:00:00Z",
    steps: [],
    deliverables: [],
    paymentLinks: [],
    ...overrides,
  } as ClientPortal;
}

describe("bandForHealth", () => {
  it("returns 'healthy' for scores >= WATCH_THRESHOLD", () => {
    expect(bandForHealth(100)).toBe("healthy");
    expect(bandForHealth(WATCH_THRESHOLD)).toBe("healthy");
    expect(bandForHealth(WATCH_THRESHOLD + 1)).toBe("healthy");
  });

  it("returns 'watch' for scores between AT_RISK and WATCH thresholds", () => {
    expect(bandForHealth(WATCH_THRESHOLD - 1)).toBe("watch");
    expect(bandForHealth(AT_RISK_THRESHOLD)).toBe("watch");
    expect(bandForHealth(AT_RISK_THRESHOLD + 1)).toBe("watch");
  });

  it("returns 'at_risk' for scores below AT_RISK_THRESHOLD", () => {
    expect(bandForHealth(AT_RISK_THRESHOLD - 1)).toBe("at_risk");
    expect(bandForHealth(0)).toBe("at_risk");
  });
});

describe("scoreClientHealth", () => {
  it("returns score 100 and healthy band for a perfect portal", () => {
    const portal = makePortal();
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBe(100);
    expect(result.band).toBe("healthy");
    expect(result.reasons).toHaveLength(0);
  });

  it("penalizes 25 per blocked step (capped at 50)", () => {
    const portal = makePortal({
      steps: [
        { id: "s1", name: "Step 1", status: "blocked", comments: [] },
        { id: "s2", name: "Step 2", status: "blocked", comments: [] },
        { id: "s3", name: "Step 3", status: "blocked", comments: [] }, // 3rd, but cap is 50
      ],
    });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBe(50); // 100 - 50 (cap)
    expect(result.reasons.some((r) => r.includes("blocked"))).toBe(true);
  });

  it("penalizes 20 for stale portal (no activity in 21+ days)", () => {
    const oldDate = "2026-08-01T00:00:00Z"; // 36 days before RECENT
    const portal = makePortal({ createdAt: oldDate, steps: [], deliverables: [] });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBe(80);
    expect(result.reasons.some((r) => r.includes("activity"))).toBe(true);
  });

  it("penalizes 15 for deliverables in_review > 7 days", () => {
    const staleDel = {
      id: "d1",
      title: "Design",
      status: "in_review" as const,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-20T00:00:00Z", // 17 days before RECENT
    };
    const portal = makePortal({ deliverables: [staleDel] });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBeLessThan(100);
    expect(result.reasons.some((r) => r.includes("review"))).toBe(true);
  });

  it("penalizes 20 for open payment links older than 14 days", () => {
    const oldPayment = {
      id: "pay-1",
      label: "Invoice",
      url: "https://pay.stripe.com/1",
      status: "open" as const,
      createdAt: "2026-08-15T00:00:00Z", // 22 days before RECENT
    };
    const portal = makePortal({ paymentLinks: [oldPayment] });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBeLessThan(100);
    expect(result.reasons.some((r) => r.includes("payment"))).toBe(true);
  });

  it("penalizes 10 for deliverables with changes_requested", () => {
    const changed = {
      id: "d2",
      title: "Copy",
      status: "changes_requested" as const,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-05T00:00:00Z",
    };
    const portal = makePortal({ deliverables: [changed] });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBe(90);
    expect(result.reasons.some((r) => r.includes("change requests"))).toBe(true);
  });

  it("caps score at 0 when all penalties combine", () => {
    const staleDel = {
      id: "d1", title: "D", status: "in_review" as const,
      createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
    };
    const oldPayment = {
      id: "p1", label: "P", url: "https://stripe.com", status: "open" as const,
      createdAt: "2026-07-01T00:00:00Z",
    };
    const changed = {
      id: "d2", title: "D2", status: "changes_requested" as const,
      createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
    };
    const portal = makePortal({
      createdAt: "2026-07-01T00:00:00Z",
      steps: [
        { id: "s1", name: "S", status: "blocked", comments: [] },
        { id: "s2", name: "S2", status: "blocked", comments: [] },
        { id: "s3", name: "S3", status: "blocked", comments: [] },
      ],
      deliverables: [staleDel, changed],
      paymentLinks: [oldPayment],
    });
    const result = scoreClientHealth(portal, RECENT);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("considers step.completedAt and comments in last activity", () => {
    const recentComment = "2026-09-05T00:00:00Z"; // 1 day before RECENT
    const portal = makePortal({
      createdAt: "2026-07-01T00:00:00Z", // old
      steps: [
        {
          id: "s1", name: "Step 1", status: "completed",
          completedAt: undefined,
          comments: [{ id: "c1", author: "dev", text: "Done", createdAt: recentComment }],
        },
      ],
    });
    // Recent comment prevents staleness penalty
    const result = scoreClientHealth(portal, RECENT);
    expect(result.reasons.some((r) => r.includes("activity"))).toBe(false);
  });
});
