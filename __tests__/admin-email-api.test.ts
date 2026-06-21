import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock() factories can reference them safely.
// ---------------------------------------------------------------------------

const {
  mockRequireAdmin,
  mockIsHubSpotConfigured,
  mockListNewsletterSubscribers,
  mockSearchContacts,
  mockListContacts,
  mockIsActiveCampaignConfigured,
  mockListACLists,
  mockListAutomations,
  mockGetConfig,
  mockFetch,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockIsHubSpotConfigured: vi.fn(),
  mockListNewsletterSubscribers: vi.fn(),
  mockSearchContacts: vi.fn(),
  mockListContacts: vi.fn(),
  mockIsActiveCampaignConfigured: vi.fn(),
  mockListACLists: vi.fn(),
  mockListAutomations: vi.fn(),
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));

vi.mock("@/lib/espocrm", () => ({
  // src/lib/espocrm.ts renamed the configured-check to isEspoCRMConfigured;
  // route imports the new name. Keep the old mock variable as the backing
  // implementation so behavior tests don't need to be re-written.
  isEspoCRMConfigured: mockIsHubSpotConfigured,
  isHubSpotConfigured: mockIsHubSpotConfigured,
  listNewsletterSubscribers: mockListNewsletterSubscribers,
  // /api/admin/email/contacts switched from raw fetch → searchContacts /
  // listContacts (lib/espocrm) after the HubSpot decom. Mock both so the
  // route's `try { … }` branch resolves instead of throwing → 500.
  searchContacts: mockSearchContacts,
  listContacts: mockListContacts,
}));

vi.mock("@/lib/activecampaign", () => ({
  isActiveCampaignConfigured: mockIsActiveCampaignConfigured,
  listACLists: mockListACLists,
  listAutomations: mockListAutomations,
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
    mockGetConfig.mockResolvedValue({});
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
      mockListNewsletterSubscribers.mockResolvedValueOnce([{ id: "1" }, { id: "2" }, { id: "3" }]);
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

    it("returns contacts from EspoCRM (subscribers tab → searchContacts)", async () => {
      // Route at `?tab=subscribers` calls searchContacts("leadSource",
      // "newsletter_signup") and returns the .results slice + .total.
      // Schema mirrors the old HubSpot shape (id + properties.email) so the
      // admin UI didn't need to change.
      mockSearchContacts.mockResolvedValueOnce({
        results: [{ id: "1", properties: { email: "a@b.com" } }],
        total: 1,
      });
      const { GET } = await import("@/app/api/admin/email/contacts/route");
      const res = await GET(makeGet("/api/admin/email/contacts?tab=subscribers"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.contacts).toHaveLength(1);
      expect(data.contacts[0].properties.email).toBe("a@b.com");
      expect(mockSearchContacts).toHaveBeenCalledWith("leadSource", "newsletter_signup");
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
      mockListACLists.mockResolvedValueOnce([{ id: "1", name: "Main", subscriber_count: "200" }]);
      const { GET } = await import("@/app/api/admin/email/lists/route");
      const res = await GET(makeGet("/api/admin/email/lists"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.lists[0].name).toBe("Main");
    });
  });

  // ── GET /api/admin/email/automations ─────────────────────────────────────────
  // Route uses ActiveCampaign: isActiveCampaignConfigured + listAutomations.

  describe("GET /api/admin/email/automations", () => {
    it("returns 503 when ActiveCampaign not configured", async () => {
      mockIsActiveCampaignConfigured.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/automations/route");
      const res = await GET(makeGet("/api/admin/email/automations"));
      expect(res.status).toBe(503);
      expect(mockListAutomations).not.toHaveBeenCalled();
    });

    it("returns real automations from ActiveCampaign", async () => {
      mockListAutomations.mockResolvedValueOnce([
        { id: "7", name: "Welcome series", status: "1", entered: "120", exited: "95" },
      ]);
      const { GET } = await import("@/app/api/admin/email/automations/route");
      const res = await GET(makeGet("/api/admin/email/automations"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.total).toBe(1);
      expect(data.automations[0].name).toBe("Welcome series");
    });
  });
});
