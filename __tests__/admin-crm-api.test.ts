import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const isHubSpotConfiguredMock = vi.fn();
const listCompaniesMock = vi.fn();
const listDealsMock = vi.fn();
const listOwnersMock = vi.fn();
const getPipelinesMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  listCompanies: listCompaniesMock,
  listDeals: listDealsMock,
  listOwners: listOwnersMock,
  getPipelines: getPipelinesMock,
}));

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

const unauthorizedResponse = {
  ok: false,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
  }),
};

describe("Admin HubSpot CRM API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isHubSpotConfiguredMock.mockResolvedValue(true);
    listCompaniesMock.mockResolvedValue([
      {
        id: "company_1",
        properties: { name: "Cloudless", domain: "cloudless.gr" },
      },
    ]);
    listDealsMock.mockResolvedValue([
      {
        id: "deal_1",
        properties: {
          dealname: "Project X",
          amount: "1000",
          dealstage: "appointmentscheduled",
          pipeline: "default",
        },
      },
    ]);
    listOwnersMock.mockResolvedValue([
      {
        id: "owner_1",
        email: "owner@cloudless.gr",
        firstName: "Cloud",
        lastName: "Less",
      },
    ]);
    getPipelinesMock.mockResolvedValue([
      {
        id: "pipeline_1",
        label: "Sales Pipeline",
        stages: [
          { id: "stage_1", label: "Appointment Scheduled" },
          { id: "stage_2", label: "Closed Won" },
        ],
      },
    ]);
  });

  // --- Companies ---

  it("returns 401 for unauthenticated request to companies", async () => {
    requireAdminMock.mockReturnValueOnce(unauthorizedResponse);
    const { GET } = await import("@/app/api/admin/crm/companies/route");
    const res = await GET(makeRequest("/api/admin/crm/companies"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot is not configured for companies", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/crm/companies/route");
    const response = await GET(makeRequest("/api/admin/crm/companies"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "HubSpot not configured." });
  });

  it("returns companies data", async () => {
    const { GET } = await import("@/app/api/admin/crm/companies/route");
    const response = await GET(makeRequest("/api/admin/crm/companies?limit=10"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.companies[0].id).toBe("company_1");
  });

  // --- Deals ---

  it("returns 401 for unauthenticated request to deals", async () => {
    requireAdminMock.mockReturnValueOnce(unauthorizedResponse);
    const { GET } = await import("@/app/api/admin/crm/deals/route");
    const res = await GET(makeRequest("/api/admin/crm/deals"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot is not configured for deals", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/crm/deals/route");
    const res = await GET(makeRequest("/api/admin/crm/deals"));
    expect(res.status).toBe(503);
  });

  it("returns deals data", async () => {
    const { GET } = await import("@/app/api/admin/crm/deals/route");
    const response = await GET(makeRequest("/api/admin/crm/deals?limit=10"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.deals[0].id).toBe("deal_1");
  });

  // --- Owners ---

  it("returns 401 for unauthenticated request to owners", async () => {
    requireAdminMock.mockReturnValueOnce(unauthorizedResponse);
    const { GET } = await import("@/app/api/admin/crm/owners/route");
    const res = await GET(makeRequest("/api/admin/crm/owners"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot is not configured for owners", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/crm/owners/route");
    const res = await GET(makeRequest("/api/admin/crm/owners"));
    expect(res.status).toBe(503);
  });

  it("returns owners data", async () => {
    const { GET } = await import("@/app/api/admin/crm/owners/route");
    const response = await GET(makeRequest("/api/admin/crm/owners"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.owners[0].email).toBe("owner@cloudless.gr");
  });

  // --- Pipelines ---

  it("returns 401 for unauthenticated request to pipelines", async () => {
    requireAdminMock.mockReturnValueOnce(unauthorizedResponse);
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when HubSpot is not configured for pipelines", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "HubSpot not configured." });
  });

  it("returns pipelines for deals objectType by default", async () => {
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.objectType).toBe("deals");
    expect(Array.isArray(data.pipelines)).toBe(true);
    expect(data.pipelines[0].id).toBe("pipeline_1");
  });

  it("accepts objectType query param (tickets, contacts)", async () => {
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines?objectType=tickets"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.objectType).toBe("tickets");
    expect(getPipelinesMock).toHaveBeenCalledWith("tickets");
  });

  it("falls back to deals for unknown objectType", async () => {
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines?objectType=invalid"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.objectType).toBe("deals");
    expect(getPipelinesMock).toHaveBeenCalledWith("deals");
  });

  it("returns 500 when getPipelines throws", async () => {
    getPipelinesMock.mockRejectedValueOnce(new Error("HubSpot API error"));
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to fetch pipelines");
  });

  it("includes fetchedAt timestamp in pipelines response", async () => {
    const { GET } = await import("@/app/api/admin/crm/pipelines/route");
    const res = await GET(makeRequest("/api/admin/crm/pipelines"));
    const data = await res.json();
    expect(data.fetchedAt).toBeTruthy();
    expect(() => new Date(data.fetchedAt)).not.toThrow();
  });
});
