import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadWorkspaces, mockReadPortals, mockGetCalendarItems } = vi.hoisted(() => ({
  mockReadWorkspaces: vi.fn(),
  mockReadPortals: vi.fn(),
  mockGetCalendarItems: vi.fn(),
}));

vi.mock("@/lib/workspace-server", () => ({
  readWorkspaces: mockReadWorkspaces,
}));
vi.mock("@/lib/client-portals", () => ({
  readPortals: mockReadPortals,
}));
vi.mock("@/lib/content-calendar", () => ({
  getCalendarItems: mockGetCalendarItems,
}));

import {
  aggregateWorkspaceAnalytics,
  aggregateAllWorkspaceAnalytics,
} from "@/lib/workspace-analytics";

const WS = [
  { id: "ws-1", name: "Acme", slug: "acme" },
  { id: "ws-2", name: "Beta", slug: "beta" },
];

function portal(over: Record<string, unknown> = {}) {
  return {
    token: "t",
    label: "p",
    workspaceId: "ws-1",
    steps: [],
    deliverables: [],
    paymentLinks: [],
    ...over,
  };
}

describe("aggregateWorkspaceAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadWorkspaces.mockResolvedValue(WS);
    mockReadPortals.mockResolvedValue([]);
    mockGetCalendarItems.mockResolvedValue([]);
  });

  it("returns a zeroed analytics object with workspace metadata", async () => {
    const out = await aggregateWorkspaceAnalytics("ws-1");
    expect(out.workspaceId).toBe("ws-1");
    expect(out.workspace).toEqual({ id: "ws-1", name: "Acme", slug: "acme" });
    expect(out.portals.total).toBe(0);
    expect(out.revenue.currency).toBe("EUR");
  });

  it("workspace=null when the id does not match any workspace", async () => {
    const out = await aggregateWorkspaceAnalytics("ws-missing");
    expect(out.workspace).toBeNull();
  });

  it("only counts portals and calendar items tagged to this workspace", async () => {
    mockReadPortals.mockResolvedValue([
      portal({ workspaceId: "ws-1" }),
      portal({ workspaceId: "ws-2" }),
      portal({ workspaceId: undefined }),
    ]);
    mockGetCalendarItems.mockResolvedValue([
      { workspaceId: "ws-1", status: "draft", date: "2030-01-01T00:00:00.000Z" },
      { workspaceId: "ws-2", status: "published", date: "2030-01-01T00:00:00.000Z" },
    ]);
    const out = await aggregateWorkspaceAnalytics("ws-1");
    expect(out.portals.total).toBe(1);
    expect(out.calendar.total).toBe(1);
    expect(out.calendar.draft).toBe(1);
  });

  it("aggregates deliverables, payment links, currency override, and next scheduled", async () => {
    const future = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    mockReadPortals.mockResolvedValue([
      portal({
        workspaceId: "ws-1",
        deliverables: [
          { status: "in_review" },
          { status: "approved" },
          { status: "changes_requested" },
          { status: "other" },
        ],
        paymentLinks: [
          { status: "open", amountCents: 5000, currency: "USD" },
          { status: "paid", amountCents: 7000, currency: "USD" },
          { status: "void", amountCents: 100 },
        ],
      }),
    ]);
    mockGetCalendarItems.mockResolvedValue([
      { workspaceId: "ws-1", status: "scheduled", date: future },
      { workspaceId: "ws-1", status: "scheduled", date: "2000-01-01T00:00:00.000Z" },
      { workspaceId: "ws-1", status: "cancelled", date: future },
    ]);
    const out = await aggregateWorkspaceAnalytics("ws-1");
    expect(out.deliverables).toEqual({
      total: 4,
      inReview: 1,
      approved: 1,
      changesRequested: 1,
      draft: 1,
    });
    expect(out.revenue.openCount).toBe(1);
    expect(out.revenue.openAmountCents).toBe(5000);
    expect(out.revenue.paidCount).toBe(1);
    expect(out.revenue.paidAmountCents).toBe(7000);
    expect(out.revenue.voidCount).toBe(1);
    expect(out.revenue.currency).toBe("USD");
    expect(out.calendar.scheduled).toBe(2);
    expect(out.calendar.cancelled).toBe(1);
    expect(out.calendar.nextScheduledAt).toBe(future);
  });
});

describe("aggregateAllWorkspaceAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadWorkspaces.mockResolvedValue(WS);
  });

  it("partitions rows per workspace and puts untagged rows in orgWide", async () => {
    mockReadPortals.mockResolvedValue([
      portal({ workspaceId: "ws-1" }),
      portal({ workspaceId: "ws-2" }),
      portal({ workspaceId: "ws-ghost" }),
      portal({ workspaceId: undefined }),
    ]);
    mockGetCalendarItems.mockResolvedValue([
      { workspaceId: "ws-1", status: "published", date: "2030-01-01T00:00:00.000Z" },
      { status: "draft", date: "2030-01-01T00:00:00.000Z" },
    ]);
    const { workspaces, orgWide } = await aggregateAllWorkspaceAnalytics();
    expect(workspaces).toHaveLength(2);
    const ws1 = workspaces.find((w) => w.workspaceId === "ws-1")!;
    const ws2 = workspaces.find((w) => w.workspaceId === "ws-2")!;
    expect(ws1.portals.total).toBe(1);
    expect(ws1.calendar.published).toBe(1);
    expect(ws2.portals.total).toBe(1);
    // Untagged + unknown-workspace rows land in orgWide.
    expect(orgWide.workspaceId).toBeNull();
    expect(orgWide.portals.total).toBe(2);
    expect(orgWide.calendar.draft).toBe(1);
  });

  it("returns empty lists when stores are empty", async () => {
    mockReadWorkspaces.mockResolvedValue([]);
    mockReadPortals.mockResolvedValue([]);
    mockGetCalendarItems.mockResolvedValue([]);
    const { workspaces, orgWide } = await aggregateAllWorkspaceAnalytics();
    expect(workspaces).toEqual([]);
    expect(orgWide.portals.total).toBe(0);
  });
});
