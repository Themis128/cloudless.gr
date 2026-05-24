import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock() factories can reference them safely.
// ---------------------------------------------------------------------------

const {
  mockRequireAdmin,
  mockIsHubSpotConfigured,
  mockListNewsletterSubscribers,
  mockIsActiveCampaignConfigured,
  mockListACLists,
  mockGetConfig,
  mockFetch,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockIsHubSpotConfigured: vi.fn(),
  mockListNewsletterSubscribers: vi.fn(),
  mockIsActiveCampaignConfigured: vi.fn(),
  mockListACLists: vi.fn(),
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: mockIsHubSpotConfigured,
  listNewsletterSubscribers: mockListNewsletterSubscribers,
}));

vi.mock("@/lib/activecampaign", () => ({
  isActiveCampaignConfigured: mockIsActiveCampaignConfigured,
  listACLists: mockListACLists,
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

describe("Admin Email API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockReturnValue({ ok: true, user: { sub: "admin" } });
    mockIsHubSpotConfigured.mockResolvedValue(true);
    mockIsActiveCampaignConfigured.mockResolvedValue(true);
    mockGetConfig.mockResolvedValue({ HUBSPOT_API_KEY: "test" }); // NOSONAR
    vi.stubGlobal("fetch", mockFetch);
  });

  // ── GET /api/admin/email/campaigns ───────────────────────────────────────────
  // Route is a 501 stub — HubSpot Marketing Emails requires 'content' scope.

  describe("GET /api/admin/email/campaigns", () => {
    it("returns 501 (HubSpot scope not available)", async () => {
      const { GET } = await import("@/app/api/admin/email/campaigns/route");
      const res = await GET(makeGet("/api/admin/email/campaigns"));
      expect(res.status).toBe(501);
      const data = await res.json();
      expect(data.error).toMatch(/content.*scope/i);
    });
  });

  // ── GET /api/admin/email/stats ───────────────────────────────────────────────
  // Route uses HubSpot: isHubSpotConfigured + listNewsletterSubscribers.

  describe("GET /api/admin/email/stats", () => {
    it("returns 503 when HubSpot not configured", async () => {
      mockIsHubSpotConfigured.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/stats/route");
      const res = await GET(makeGet("/api/admin/email/stats"));
      expect(res.status).toBe(503);
    });

    it("returns subscriber stats", async () => {
      mockListNewsletterSubscribers.mockResolvedValueOnce([
        { id: "1" },
        { id: "2" },
        { id: "3" },
      ]);
      const { GET } = await import("@/app/api/admin/email/stats/route");
      const res = await GET(makeGet("/api/admin/email/stats"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.totalSubscribers).toBe(3);
      expect(data.fetchedAt).toBeTruthy();
    });
  });

  // ── GET /api/admin/email/contacts ────────────────────────────────────────────
  // Route uses HubSpot: isHubSpotConfigured + getConfig + raw fetch to HubSpot API.

  describe("GET /api/admin/email/contacts", () => {
    it("returns 503 when HubSpot not configured", async () => {
      mockIsHubSpotConfigured.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/contacts/route");
      const res = await GET(makeGet("/api/admin/email/contacts"));
      expect(res.status).toBe(503);
    });

    it("returns contacts from HubSpot", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: "1", properties: { email: "a@b.com" } }],
            total: 1,
          }),
          { status: 200 },
        ),
      );
      const { GET } = await import("@/app/api/admin/email/contacts/route");
      const res = await GET(
        makeGet("/api/admin/email/contacts?tab=subscribers"),
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.contacts).toHaveLength(1);
      expect(data.contacts[0].properties.email).toBe("a@b.com");
    });
  });

  // ── GET /api/admin/email/lists ───────────────────────────────────────────────
  // Route uses ActiveCampaign: isActiveCampaignConfigured + listACLists.

  describe("GET /api/admin/email/lists", () => {
    it("returns 503 when ActiveCampaign not configured", async () => {
      mockIsActiveCampaignConfigured.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/lists/route");
      const res = await GET(makeGet("/api/admin/email/lists"));
      expect(res.status).toBe(503);
    });

    it("returns lists", async () => {
      mockListACLists.mockResolvedValueOnce([
        { id: "1", name: "Main", subscriber_count: "200" },
      ]);
      const { GET } = await import("@/app/api/admin/email/lists/route");
      const res = await GET(makeGet("/api/admin/email/lists"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.lists[0].name).toBe("Main");
    });
  });

  // ── GET /api/admin/email/automations ─────────────────────────────────────────
  // Route is a stub returning an empty array until ActiveCampaign automations are wired.

  describe("GET /api/admin/email/automations", () => {
    it("returns empty automations list", async () => {
      const { GET } = await import("@/app/api/admin/email/automations/route");
      const res = await GET(makeGet("/api/admin/email/automations"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.automations).toEqual([]);
    });
  });
});
