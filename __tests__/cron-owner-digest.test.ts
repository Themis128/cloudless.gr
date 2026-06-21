import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockIsCronAuthorized,
  mockSlackPost,
  mockReadPortals,
  mockGetCalendarItems,
  mockListContacts,
  mockIsConfiguredAsync,
} = vi.hoisted(() => ({
  mockIsCronAuthorized: vi.fn(),
  mockSlackPost: vi.fn(),
  mockReadPortals: vi.fn(),
  mockGetCalendarItems: vi.fn(),
  mockListContacts: vi.fn(),
  mockIsConfiguredAsync: vi.fn(),
}));

vi.mock("@/lib/cron-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cron-auth")>();
  return { ...actual, isCronAuthorized: mockIsCronAuthorized };
});
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockSlackPost;
  },
}));
vi.mock("@/lib/client-portals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client-portals")>();
  return { ...actual, readPortals: mockReadPortals };
});
vi.mock("@/lib/content-calendar", () => ({ getCalendarItems: mockGetCalendarItems }));
vi.mock("@/lib/espocrm", () => ({ listContacts: mockListContacts }));
vi.mock("@/lib/integrations", () => ({ isConfiguredAsync: mockIsConfiguredAsync }));

import { GET } from "@/app/api/cron/owner-digest/route";

const DAY_MS = 86_400_000;

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/owner-digest", {
    headers: { authorization: "Bearer secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCronAuthorized.mockResolvedValue(true);
  mockSlackPost.mockResolvedValue(true);
  mockReadPortals.mockResolvedValue([]);
  mockGetCalendarItems.mockResolvedValue([]);
  mockListContacts.mockResolvedValue([]);
  mockIsConfiguredAsync.mockResolvedValue(true);
});

describe("GET /api/cron/owner-digest", () => {
  it("rejects unauthorized callers", async () => {
    mockIsCronAuthorized.mockResolvedValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("posts a digest with lead, content, review, payment, and health counts", async () => {
    const recent = new Date(Date.now() - DAY_MS).toISOString();
    mockListContacts.mockResolvedValue([
      { properties: { createdate: recent } },
      { properties: { createdate: "2020-01-01T00:00:00Z" } },
    ]);
    mockGetCalendarItems.mockResolvedValue([
      { status: "published" },
      { status: "published" },
      { status: "scheduled" },
      { status: "draft" },
    ]);
    mockReadPortals.mockResolvedValue([
      {
        token: "t",
        label: "Rebuild",
        clientEmail: "c@a.com",
        clientName: "Acme",
        createdAt: recent,
        steps: [],
        deliverables: [
          {
            id: "d1",
            title: "Design",
            status: "in_review",
            createdAt: recent,
            updatedAt: recent,
          },
        ],
        paymentLinks: [
          { id: "p1", label: "Deposit", url: "https://pay", status: "open", createdAt: recent },
        ],
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      sent: true,
      newLeads: 1,
      published: 2,
      scheduled: 1,
      awaitingReview: 1,
      openPayments: 1,
      clientsNeedingAttention: 0,
    });
    const payload = mockSlackPost.mock.calls[0][0];
    expect(payload.text).toContain("1 new leads");
    const body = JSON.stringify(payload.blocks);
    expect(body).toContain("Design");
    expect(body).toContain("Deposit");
  });

  it("flags at-risk clients in the digest", async () => {
    const old = new Date(Date.now() - 60 * DAY_MS).toISOString();
    mockReadPortals.mockResolvedValue([
      {
        token: "t",
        label: "Stalled",
        clientEmail: "c@a.com",
        clientName: "Acme",
        createdAt: old,
        steps: [
          { id: "s1", name: "A", status: "blocked", comments: [] },
          { id: "s2", name: "B", status: "blocked", comments: [] },
        ],
      },
    ]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.clientsNeedingAttention).toBe(1);
    const body = JSON.stringify(mockSlackPost.mock.calls[0][0].blocks);
    expect(body).toContain("Stalled");
    expect(body).toContain("blocked");
  });

  it("reports HubSpot as unconfigured without failing", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.newLeads).toBeNull();
    const body = JSON.stringify(mockSlackPost.mock.calls[0][0].blocks);
    expect(body).toContain("HubSpot not configured");
  });

  it("degrades gracefully when calendar and portals sources throw", async () => {
    mockGetCalendarItems.mockRejectedValue(new Error("notion down"));
    mockReadPortals.mockRejectedValue(new Error("ssm down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.published).toBe(0);
    expect(data.awaitingReview).toBe(0);
  });
});
