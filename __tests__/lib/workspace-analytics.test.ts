import { describe, it, expect } from "vitest";
import {
  EXPIRING_SOON_DAYS,
  bucketPortal,
  emptyAnalytics,
  reducePortals,
  reduceCalendar,
} from "@/lib/workspace-analytics";
import type { ClientPortal } from "@/lib/client-portals";
import type { CalendarItem } from "@/lib/content-calendar";

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    token: "tok-1",
    label: "Test",
    steps: [],
    deliverables: [],
    paymentLinks: [],
    comments: [],
    status: "active",
    ...overrides,
  };
}

describe("EXPIRING_SOON_DAYS", () => {
  it("is a positive number", () => {
    expect(EXPIRING_SOON_DAYS).toBeGreaterThan(0);
  });
});

describe("bucketPortal", () => {
  it("returns not expired and not expiring soon when no expiresAt", () => {
    const result = bucketPortal(makePortal());
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(false);
  });

  it("returns expired=true for a past expiry date", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const result = bucketPortal(makePortal({ expiresAt: past }));
    expect(result.expired).toBe(true);
    expect(result.expiringSoon).toBe(false);
  });

  it("returns expiringSoon=true for expiry within EXPIRING_SOON_DAYS", () => {
    const soon = new Date(Date.now() + (EXPIRING_SOON_DAYS - 1) * 86_400_000).toISOString();
    const result = bucketPortal(makePortal({ expiresAt: soon }));
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(true);
  });

  it("returns not expiring soon for far future expiry", () => {
    const future = new Date(Date.now() + (EXPIRING_SOON_DAYS + 5) * 86_400_000).toISOString();
    const result = bucketPortal(makePortal({ expiresAt: future }));
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(false);
  });
});

describe("emptyAnalytics", () => {
  it("returns a zeroed-out analytics object for null", () => {
    const a = emptyAnalytics(null);
    expect(a.workspaceId).toBeNull();
    expect(a.portals.total).toBe(0);
    expect(a.deliverables.total).toBe(0);
    expect(a.revenue.openAmountCents).toBe(0);
    expect(a.calendar.total).toBe(0);
    expect(a.calendar.nextScheduledAt).toBeNull();
  });

  it("sets workspaceId from argument", () => {
    const a = emptyAnalytics("ws-abc");
    expect(a.workspaceId).toBe("ws-abc");
  });
});

describe("reducePortals", () => {
  it("increments totals correctly", () => {
    const out = emptyAnalytics(null);
    reducePortals(out, [makePortal(), makePortal()]);
    expect(out.portals.total).toBe(2);
    expect(out.portals.active).toBe(2);
  });

  it("counts expired portals", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const out = emptyAnalytics(null);
    reducePortals(out, [makePortal({ expiresAt: past })]);
    expect(out.portals.expired).toBe(1);
    expect(out.portals.active).toBe(0);
  });

  it("counts revenue from payment links", () => {
    const out = emptyAnalytics(null);
    const portal = makePortal({
      paymentLinks: [
        { id: "l1", label: "Invoice", url: "https://stripe.com", amountCents: 3000, status: "open" },
        { id: "l2", label: "Invoice2", url: "https://stripe.com", amountCents: 2000, status: "paid" },
      ],
    });
    reducePortals(out, [portal]);
    expect(out.revenue.openCount).toBe(1);
    expect(out.revenue.openAmountCents).toBe(3000);
    expect(out.revenue.paidAmountCents).toBe(2000);
  });
});

describe("reduceCalendar", () => {
  const makeItem = (overrides: Partial<CalendarItem>): CalendarItem => ({
    id: "i1",
    title: "Test",
    type: "blog_post",
    platform: "meta",
    date: "2026-09-10",
    status: "draft",
    ...overrides,
  });

  it("counts items by status", () => {
    const out = emptyAnalytics(null);
    reduceCalendar(out, [
      makeItem({ status: "draft" }),
      makeItem({ status: "scheduled", date: "2030-01-01" }),
      makeItem({ status: "published" }),
      makeItem({ status: "cancelled" }),
    ]);
    expect(out.calendar.total).toBe(4);
    expect(out.calendar.draft).toBe(1);
    expect(out.calendar.scheduled).toBe(1);
    expect(out.calendar.published).toBe(1);
    expect(out.calendar.cancelled).toBe(1);
  });
});
