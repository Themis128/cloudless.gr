import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const isHubSpotConfiguredMock = vi.fn();
const listCompaniesMock = vi.fn();
const listDealsMock = vi.fn();
const listOwnersMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  listCompanies: listCompaniesMock,
  listDeals: listDealsMock,
  listOwners: listOwnersMock,
}));

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, {
    method: "GET",
  });
}

describe("Admin HubSpot CRM API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isHubSpotConfiguredMock.mockResolvedValue(true);
    listCompaniesMock.mockResolvedValue([{ id: "company_1", properties: { name: "Cloudless", domain: "cloudless.gr" } }]);
    listDealsMock.mockResolvedValue([{ id: "deal_1", properties: { dealname: "Project X", amount: "1000", dealstage: "appointmentscheduled", pipeline: "default" } }]);
    listOwnersMock.mockResolvedValue([{ id: "owner_1", email: "owner@cloudless.gr", firstName: "Cloud", lastName: "Less" }]);
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

  it("returns deals data", async () => {
    const { GET } = await import("@/app/api/admin/crm/deals/route");
    const response = await GET(makeRequest("/api/admin/crm/deals?limit=10"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.deals[0].id).toBe("deal_1");
  });

  it("returns owners data", async () => {
    const { GET } = await import("@/app/api/admin/crm/owners/route");
    const response = await GET(makeRequest("/api/admin/crm/owners"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.owners[0].email).toBe("owner@cloudless.gr");
  });
});
