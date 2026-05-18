import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock getConfig so tests never touch AWS SSM or environment variable loading
const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
  resetSsmCache: vi.fn(),
}));

const AC_URL = "https://test.api-us1.com";
const AC_TOKEN = "test-ac-token";

const CONFIGURED_CONFIG = {
  ACTIVECAMPAIGN_API_URL: AC_URL,
  ACTIVECAMPAIGN_API_TOKEN: AC_TOKEN,
};

describe("activecampaign.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetConfig.mockResolvedValue(CONFIGURED_CONFIG);
  });

  // ── isActiveCampaignConfigured ───────────────────────────────────────────────

  describe("isActiveCampaignConfigured", () => {
    it("returns true when config has URL and token", async () => {
      const { isActiveCampaignConfigured } = await import("@/lib/activecampaign");
      expect(await isActiveCampaignConfigured()).toBe(true);
    });

    it("returns false when API URL missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ ACTIVECAMPAIGN_API_URL: "", ACTIVECAMPAIGN_API_TOKEN: AC_TOKEN });
      const { isActiveCampaignConfigured } = await import("@/lib/activecampaign");
      expect(await isActiveCampaignConfigured()).toBe(false);
    });

    it("returns false when API token missing", async () => {
      mockGetConfig.mockResolvedValueOnce({ ACTIVECAMPAIGN_API_URL: AC_URL, ACTIVECAMPAIGN_API_TOKEN: "" });
      const { isActiveCampaignConfigured } = await import("@/lib/activecampaign");
      expect(await isActiveCampaignConfigured()).toBe(false);
    });
  });

  // ── listCampaigns ────────────────────────────────────────────────────────────

  describe("listCampaigns", () => {
    it("returns campaigns array on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          campaigns: [
            { id: "1", name: "Newsletter", subject: "Hello", status: "1", send_amt: "500", opens: "100", uniqueopens: "90", linkclicks: "20", sdate: "2026-04-01", cdate: "2026-03-20" },
          ],
        }),
      });
      const { listCampaigns } = await import("@/lib/activecampaign");
      const result = await listCampaigns();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Newsletter");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/3/campaigns"),
        expect.objectContaining({ headers: expect.objectContaining({ "Api-Token": AC_TOKEN }) }),
      );
    });

    it("returns empty array on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const { listCampaigns } = await import("@/lib/activecampaign");
      expect(await listCampaigns()).toEqual([]);
    });
  });

  // ── getCampaign ──────────────────────────────────────────────────────────────

  describe("getCampaign", () => {
    it("returns a single campaign", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaign: { id: "42", name: "Single", subject: "Sub", status: "1", send_amt: "0", opens: "0", uniqueopens: "0", linkclicks: "0", sdate: "", cdate: "" } }),
      });
      const { getCampaign } = await import("@/lib/activecampaign");
      const c = await getCampaign("42");
      expect(c?.id).toBe("42");
    });

    it("returns null on 404", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const { getCampaign } = await import("@/lib/activecampaign");
      expect(await getCampaign("missing")).toBeNull();
    });
  });

  // ── createCampaign ───────────────────────────────────────────────────────────

  describe("createCampaign", () => {
    it("POSTs campaign and returns result", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaign: { id: "99", name: "New Camp", subject: "Hi", status: "0", send_amt: "0", opens: "0", uniqueopens: "0", linkclicks: "0", sdate: "", cdate: "" } }),
      });
      const { createCampaign } = await import("@/lib/activecampaign");
      const result = await createCampaign({
        name: "New Camp",
        subject: "Hi",
        fromname: "Cloudless",
        fromemail: "hello@cloudless.gr",
        listId: "1",
      });
      expect(result?.id).toBe("99");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.campaign.name).toBe("New Camp");
      expect(body.campaign.lists[0].id).toBe("1");
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });
      const { createCampaign } = await import("@/lib/activecampaign");
      const result = await createCampaign({
        name: "Bad",
        subject: "Bad",
        fromname: "X",
        fromemail: "x@x.com",
        listId: "1",
      });
      expect(result).toBeNull();
    });
  });

  // ── listACContacts ───────────────────────────────────────────────────────────

  describe("listACContacts", () => {
    it("returns contacts on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [
            { id: "1", email: "a@b.com", firstName: "Alice", lastName: "Smith", cdate: "", udate: "" },
          ],
        }),
      });
      const { listACContacts } = await import("@/lib/activecampaign");
      const result = await listACContacts();
      expect(result[0].email).toBe("a@b.com");
    });

    it("returns empty array on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const { listACContacts } = await import("@/lib/activecampaign");
      expect(await listACContacts()).toEqual([]);
    });
  });

  // ── listACLists ──────────────────────────────────────────────────────────────

  describe("listACLists", () => {
    it("returns lists on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [{ id: "1", name: "Main List", subscriber_count: "200" }] }),
      });
      const { listACLists } = await import("@/lib/activecampaign");
      const result = await listACLists();
      expect(result[0].name).toBe("Main List");
    });
  });

  // ── listAutomations ──────────────────────────────────────────────────────────

  describe("listAutomations", () => {
    it("returns automations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          automations: [{ id: "1", name: "Welcome", status: "1", entered: "50", exited: "10" }],
        }),
      });
      const { listAutomations } = await import("@/lib/activecampaign");
      const result = await listAutomations();
      expect(result[0].name).toBe("Welcome");
    });
  });

  // ── getEmailStats ────────────────────────────────────────────────────────────

  describe("getEmailStats", () => {
    it("aggregates totals from three parallel calls", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ meta: { total: "1200" } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ meta: { total: "45" } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ meta: { total: "8" } }) });
      const { getEmailStats } = await import("@/lib/activecampaign");
      const stats = await getEmailStats();
      expect(stats.totalContacts).toBe(1200);
      expect(stats.totalCampaigns).toBe(45);
      expect(stats.totalLists).toBe(8);
    });

    it("returns zeros on API errors", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });
      const { getEmailStats } = await import("@/lib/activecampaign");
      const stats = await getEmailStats();
      expect(stats.totalContacts).toBe(0);
      expect(stats.totalCampaigns).toBe(0);
      expect(stats.totalLists).toBe(0);
    });
  });
});
