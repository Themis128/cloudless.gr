import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const isActiveCampaignConfiguredMock = vi.fn();
const listCampaignsMock = vi.fn();
const createCampaignMock = vi.fn();
const getEmailStatsMock = vi.fn();
const listACContactsMock = vi.fn();
const listACListsMock = vi.fn();
const listAutomationsMock = vi.fn();
const getCampaignMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/activecampaign", () => ({
  isActiveCampaignConfigured: isActiveCampaignConfiguredMock,
  listCampaigns: listCampaignsMock,
  createCampaign: createCampaignMock,
  getEmailStats: getEmailStatsMock,
  listACContacts: listACContactsMock,
  listACLists: listACListsMock,
  listAutomations: listAutomationsMock,
  getCampaign: getCampaignMock,
}));

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

function makePost(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockCampaign = {
  id: "c1",
  name: "Newsletter April",
  subject: "Updates",
  status: "1",
  send_amt: "500",
  opens: "100",
  uniqueopens: "90",
  linkclicks: "20",
  sdate: "2026-04-01",
  cdate: "2026-03-20",
};

describe("Admin Email API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isActiveCampaignConfiguredMock.mockResolvedValue(true);
  });

  // ── GET /api/admin/email/campaigns ───────────────────────────────────────────

  describe("GET /api/admin/email/campaigns", () => {
    it("returns 503 when ActiveCampaign not configured", async () => {
      isActiveCampaignConfiguredMock.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/campaigns/route");
      const res = await GET(makeGet("/api/admin/email/campaigns"));
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("ActiveCampaign") });
    });

    it("returns campaigns list", async () => {
      listCampaignsMock.mockResolvedValueOnce([mockCampaign]);
      const { GET } = await import("@/app/api/admin/email/campaigns/route");
      const res = await GET(makeGet("/api/admin/email/campaigns"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.campaigns).toHaveLength(1);
      expect(data.campaigns[0].id).toBe("c1");
      expect(data.total).toBe(1);
    });

    it("respects limit query param", async () => {
      listCampaignsMock.mockResolvedValueOnce([]);
      const { GET } = await import("@/app/api/admin/email/campaigns/route");
      await GET(makeGet("/api/admin/email/campaigns?limit=50"));
      expect(listCampaignsMock).toHaveBeenCalledWith(50);
    });
  });

  // ── POST /api/admin/email/campaigns ─────────────────────────────────────────

  describe("POST /api/admin/email/campaigns", () => {
    it("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/admin/email/campaigns/route");
      const res = await POST(makePost("/api/admin/email/campaigns", { name: "Test" }));
      expect(res.status).toBe(400);
    });

    it("creates campaign and returns 201", async () => {
      createCampaignMock.mockResolvedValueOnce(mockCampaign);
      const { POST } = await import("@/app/api/admin/email/campaigns/route");
      const res = await POST(makePost("/api/admin/email/campaigns", {
        name: "Newsletter April",
        subject: "Updates",
        listId: "1",
        fromname: "Cloudless",
        fromemail: "hello@cloudless.gr",
      }));
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.campaign.id).toBe("c1");
    });

    it("returns 500 when createCampaign fails", async () => {
      createCampaignMock.mockResolvedValueOnce(null);
      const { POST } = await import("@/app/api/admin/email/campaigns/route");
      const res = await POST(makePost("/api/admin/email/campaigns", {
        name: "X",
        subject: "Y",
        listId: "1",
        fromname: "Z",
        fromemail: "z@z.com",
      }));
      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/admin/email/stats ───────────────────────────────────────────────

  describe("GET /api/admin/email/stats", () => {
    it("returns 503 when not configured", async () => {
      isActiveCampaignConfiguredMock.mockResolvedValueOnce(false);
      const { GET } = await import("@/app/api/admin/email/stats/route");
      const res = await GET(makeGet("/api/admin/email/stats"));
      expect(res.status).toBe(503);
    });

    it("returns aggregated stats", async () => {
      getEmailStatsMock.mockResolvedValueOnce({ totalContacts: 500, totalCampaigns: 12, totalLists: 3 });
      const { GET } = await import("@/app/api/admin/email/stats/route");
      const res = await GET(makeGet("/api/admin/email/stats"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.totalContacts).toBe(500);
      expect(data.totalCampaigns).toBe(12);
      expect(data.fetchedAt).toBeTruthy();
    });
  });

  // ── GET /api/admin/email/contacts ────────────────────────────────────────────

  describe("GET /api/admin/email/contacts", () => {
    it("returns contacts", async () => {
      listACContactsMock.mockResolvedValueOnce([
        { id: "1", email: "a@b.com", firstName: "Alice", lastName: "Smith", cdate: "", udate: "" },
      ]);
      const { GET } = await import("@/app/api/admin/email/contacts/route");
      const res = await GET(makeGet("/api/admin/email/contacts"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.contacts[0].email).toBe("a@b.com");
    });
  });

  // ── GET /api/admin/email/lists ───────────────────────────────────────────────

  describe("GET /api/admin/email/lists", () => {
    it("returns lists", async () => {
      listACListsMock.mockResolvedValueOnce([{ id: "1", name: "Main", subscriber_count: "200" }]);
      const { GET } = await import("@/app/api/admin/email/lists/route");
      const res = await GET(makeGet("/api/admin/email/lists"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.lists[0].name).toBe("Main");
    });
  });

  // ── GET /api/admin/email/automations ─────────────────────────────────────────

  describe("GET /api/admin/email/automations", () => {
    it("returns automations", async () => {
      listAutomationsMock.mockResolvedValueOnce([{ id: "1", name: "Welcome", status: "1", entered: "50", exited: "10" }]);
      const { GET } = await import("@/app/api/admin/email/automations/route");
      const res = await GET(makeGet("/api/admin/email/automations"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.automations[0].name).toBe("Welcome");
    });
  });
});
