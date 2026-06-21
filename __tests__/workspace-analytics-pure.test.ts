/**
 * Tests for pure/exported helpers in src/lib/workspace-analytics.ts.
 * No mocks — exercises deterministic aggregation logic.
 */
import { describe, it, expect } from "vitest";
import {
  bucketPortal,
  emptyAnalytics,
  reducePortals,
  reduceCalendar,
  EXPIRING_SOON_DAYS,
} from "@/lib/workspace-analytics";
import type { ClientPortal } from "@/lib/client-portals";
import type { CalendarItem } from "@/lib/content-calendar";

function makePortal(overrides: Partial<ClientPortal> = {}): ClientPortal {
  return {
    token: "tok-1",
    label: "Test Portal",
    clientEmail: "client@example.com",
    clientName: "Test Client",
    createdAt: "2024-01-01T00:00:00Z",
    steps: [],
    deliverables: [],
    paymentLinks: [],
    ...overrides,
  };
}

function makeCalendarItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: "cal-1",
    title: "Test Post",
    type: "social_post",
    platform: "meta",
    date: "2024-06-15T10:00:00Z",
    status: "draft",
    ...overrides,
  };
}

describe("bucketPortal", () => {
  it("returns not expired and not expiring for portal without expiresAt", () => {
    const result = bucketPortal(makePortal());
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(false);
  });

  it("returns expired=true for past expiresAt", () => {
    const result = bucketPortal(makePortal({ expiresAt: "2020-01-01T00:00:00Z" }));
    expect(result.expired).toBe(true);
    expect(result.expiringSoon).toBe(false);
  });

  it("returns expiringSoon=true when within EXPIRING_SOON_DAYS", () => {
    const soon = new Date(Date.now() + (EXPIRING_SOON_DAYS - 1) * 24 * 60 * 60 * 1000);
    const result = bucketPortal(makePortal({ expiresAt: soon.toISOString() }));
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(true);
  });

  it("returns neither for far-future expiresAt", () => {
    const result = bucketPortal(makePortal({ expiresAt: "2099-01-01T00:00:00Z" }));
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(false);
  });

  it("handles invalid date string gracefully", () => {
    const result = bucketPortal(makePortal({ expiresAt: "not-a-date" }));
    // NaN is not finite so neither flag is set
    expect(result.expired).toBe(false);
    expect(result.expiringSoon).toBe(false);
  });
});

describe("emptyAnalytics", () => {
  it("returns zeroed structure with the given workspaceId", () => {
    const a = emptyAnalytics("ws-1");
    expect(a.workspaceId).toBe("ws-1");
    expect(a.workspace).toBeNull();
    expect(a.portals.total).toBe(0);
    expect(a.deliverables.total).toBe(0);
    expect(a.revenue.openCount).toBe(0);
    expect(a.revenue.paidAmountCents).toBe(0);
    expect(a.calendar.total).toBe(0);
  });

  it("accepts null workspaceId for org-wide bucket", () => {
    const a = emptyAnalytics(null);
    expect(a.workspaceId).toBeNull();
  });
});

describe("reducePortals", () => {
  it("counts total, active, expired portals", () => {
    const out = emptyAnalytics("ws-1");
    const portals = [
      makePortal({ expiresAt: "2099-01-01T00:00:00Z" }),
      makePortal({ expiresAt: "2020-01-01T00:00:00Z" }),
      makePortal(), // no expiry = active
    ];
    reducePortals(out, portals);
    expect(out.portals.total).toBe(3);
    expect(out.portals.active).toBe(2);
    expect(out.portals.expired).toBe(1);
  });

  it("counts deliverables by status", () => {
    const out = emptyAnalytics("ws-1");
    const portal = makePortal({
      deliverables: [
        {
          id: "d1",
          title: "A",
          status: "in_review",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
        },
        {
          id: "d2",
          title: "B",
          status: "approved",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-03T00:00:00Z",
        },
        {
          id: "d3",
          title: "C",
          status: "changes_requested",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-04T00:00:00Z",
        },
        {
          id: "d4",
          title: "D",
          status: "draft",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-05T00:00:00Z",
        },
      ],
    });
    reducePortals(out, [portal]);
    expect(out.deliverables.total).toBe(4);
    expect(out.deliverables.inReview).toBe(1);
    expect(out.deliverables.approved).toBe(1);
    expect(out.deliverables.changesRequested).toBe(1);
    expect(out.deliverables.draft).toBe(1);
  });

  it("aggregates revenue from payment links", () => {
    const out = emptyAnalytics("ws-1");
    const portal = makePortal({
      paymentLinks: [
        {
          id: "pl1",
          label: "Invoice 1",
          url: "https://pay.stripe.com/1",
          amountCents: 10000,
          currency: "EUR",
          status: "paid",
          createdAt: "2024-01-01T00:00:00Z",
          paidAt: "2024-01-05T00:00:00Z",
        },
        {
          id: "pl2",
          label: "Invoice 2",
          url: "https://pay.stripe.com/2",
          amountCents: 5000,
          currency: "EUR",
          status: "open",
          createdAt: "2024-02-01T00:00:00Z",
        },
        {
          id: "pl3",
          label: "Voided",
          url: "https://pay.stripe.com/3",
          amountCents: 2000,
          currency: "EUR",
          status: "void",
          createdAt: "2024-03-01T00:00:00Z",
        },
      ],
    });
    reducePortals(out, [portal]);
    expect(out.revenue.paidCount).toBe(1);
    expect(out.revenue.paidAmountCents).toBe(10000);
    expect(out.revenue.openCount).toBe(1);
    expect(out.revenue.openAmountCents).toBe(5000);
    expect(out.revenue.voidCount).toBe(1);
  });

  it("picks non-EUR currency from payment links", () => {
    const out = emptyAnalytics("ws-1");
    const portal = makePortal({
      paymentLinks: [
        {
          id: "pl1",
          label: "USD Invoice",
          url: "https://pay.stripe.com/1",
          amountCents: 100,
          currency: "USD",
          status: "open",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ],
    });
    reducePortals(out, [portal]);
    expect(out.revenue.currency).toBe("USD");
  });

  it("handles empty portals array", () => {
    const out = emptyAnalytics("ws-1");
    reducePortals(out, []);
    expect(out.portals.total).toBe(0);
  });
});

describe("reduceCalendar", () => {
  it("counts items by status", () => {
    const out = emptyAnalytics("ws-1");
    const items: CalendarItem[] = [
      makeCalendarItem({ status: "draft" }),
      makeCalendarItem({ id: "c2", status: "scheduled", date: "2099-06-01T10:00:00Z" }),
      makeCalendarItem({ id: "c3", status: "published" }),
      makeCalendarItem({ id: "c4", status: "cancelled" }),
    ];
    reduceCalendar(out, items);
    expect(out.calendar.total).toBe(4);
    expect(out.calendar.draft).toBe(1);
    expect(out.calendar.scheduled).toBe(1);
    expect(out.calendar.published).toBe(1);
    expect(out.calendar.cancelled).toBe(1);
  });

  it("finds next scheduled item in the future", () => {
    const out = emptyAnalytics("ws-1");
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const laterDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const items: CalendarItem[] = [
      makeCalendarItem({ id: "c1", status: "scheduled", date: laterDate }),
      makeCalendarItem({ id: "c2", status: "scheduled", date: futureDate }),
    ];
    reduceCalendar(out, items);
    expect(out.calendar.nextScheduledAt).toBe(futureDate);
  });

  it("ignores past scheduled items for nextScheduledAt", () => {
    const out = emptyAnalytics("ws-1");
    const items: CalendarItem[] = [
      makeCalendarItem({ status: "scheduled", date: "2020-01-01T10:00:00Z" }),
    ];
    reduceCalendar(out, items);
    expect(out.calendar.nextScheduledAt).toBeNull();
  });

  it("handles empty items array", () => {
    const out = emptyAnalytics("ws-1");
    reduceCalendar(out, []);
    expect(out.calendar.total).toBe(0);
    expect(out.calendar.nextScheduledAt).toBeNull();
  });
});
