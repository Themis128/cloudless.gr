import { describe, expect, it } from "vitest";
import { scoreClientHealth, bandForHealth } from "@/lib/client-health";
import type { ClientPortal } from "@/lib/client-portals";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY_MS = 86_400_000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    token: "11111111-2222-3333-4444-555555555555",
    label: "Website Rebuild",
    clientEmail: "client@acme.com",
    clientName: "Acme",
    createdAt: daysAgo(2),
    steps: [{ id: "s1", name: "Build", status: "in-progress", comments: [] }],
    ...overrides,
  };
}

describe("scoreClientHealth", () => {
  it("scores a fresh active portal as healthy 100", () => {
    const health = scoreClientHealth(makePortal(), NOW);
    expect(health.score).toBe(100);
    expect(health.band).toBe("healthy");
    expect(health.reasons).toEqual([]);
  });

  it("penalizes blocked steps, capped at 50", () => {
    const one = scoreClientHealth(
      makePortal({
        steps: [{ id: "s1", name: "A", status: "blocked", comments: [] }],
      }),
      NOW
    );
    expect(one.score).toBe(75);
    expect(one.band).toBe("healthy");

    const three = scoreClientHealth(
      makePortal({
        steps: [
          { id: "s1", name: "A", status: "blocked", comments: [] },
          { id: "s2", name: "B", status: "blocked", comments: [] },
          { id: "s3", name: "C", status: "blocked", comments: [] },
        ],
      }),
      NOW
    );
    expect(three.score).toBe(50);
  });

  it("penalizes stale portals (no activity in 21+ days)", () => {
    const health = scoreClientHealth(makePortal({ createdAt: daysAgo(30) }), NOW);
    expect(health.score).toBe(80);
    expect(health.reasons[0]).toContain("no activity");
  });

  it("counts recent comments and deliverable updates as activity", () => {
    const health = scoreClientHealth(
      makePortal({
        createdAt: daysAgo(60),
        steps: [
          {
            id: "s1",
            name: "Build",
            status: "in-progress",
            comments: [{ id: "c1", author: "Team", text: "update", createdAt: daysAgo(3) }],
          },
        ],
      }),
      NOW
    );
    expect(health.score).toBe(100);
  });

  it("penalizes deliverables stuck in review for over a week", () => {
    const health = scoreClientHealth(
      makePortal({
        deliverables: [
          {
            id: "d1",
            title: "Design",
            status: "in_review",
            createdAt: daysAgo(10),
            updatedAt: daysAgo(10),
          },
        ],
      }),
      NOW
    );
    expect(health.score).toBe(85);
    expect(health.reasons[0]).toContain("awaiting review");
  });

  it("penalizes aging open payments and unaddressed change requests", () => {
    const health = scoreClientHealth(
      makePortal({
        deliverables: [
          {
            id: "d1",
            title: "Design",
            status: "changes_requested",
            createdAt: daysAgo(3),
            updatedAt: daysAgo(3),
          },
        ],
        paymentLinks: [
          {
            id: "p1",
            label: "Deposit",
            url: "https://pay",
            status: "open",
            createdAt: daysAgo(20),
          },
        ],
      }),
      NOW
    );
    // −20 aging payment, −10 change request
    expect(health.score).toBe(70);
    expect(health.band).toBe("watch");
  });

  it("stacks penalties into at_risk and never goes below 0", () => {
    const health = scoreClientHealth(
      makePortal({
        createdAt: daysAgo(60),
        steps: [
          { id: "s1", name: "A", status: "blocked", comments: [] },
          { id: "s2", name: "B", status: "blocked", comments: [] },
        ],
        deliverables: [
          {
            id: "d1",
            title: "Design",
            status: "in_review",
            createdAt: daysAgo(30),
            updatedAt: daysAgo(30),
          },
        ],
        paymentLinks: [
          {
            id: "p1",
            label: "Deposit",
            url: "https://pay",
            status: "open",
            createdAt: daysAgo(30),
          },
        ],
      }),
      NOW
    );
    // Penalties: blocked ×2 (−50) + stale 30d (−20) + review wait (−15)
    // + aging payment (−20) = −105 → clamped to 0.
    expect(health.score).toBe(0);
    expect(health.band).toBe("at_risk");
    expect(health.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("bandForHealth", () => {
  it("maps thresholds to bands", () => {
    expect(bandForHealth(75)).toBe("healthy");
    expect(bandForHealth(74)).toBe("watch");
    expect(bandForHealth(50)).toBe("watch");
    expect(bandForHealth(49)).toBe("at_risk");
  });
});
