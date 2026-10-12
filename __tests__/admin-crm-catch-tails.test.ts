import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

const requireAdminMock = vi.fn();
const isConfiguredMock = vi.fn();
const listCompaniesMock = vi.fn();
const listContactsMock = vi.fn();
const listDealsMock = vi.fn();
const listOwnersMock = vi.fn();
const listTicketsMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/integrations", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/integrations")>();
  return { ...mod, isConfiguredAsync: vi.fn(async () => true) };
});
vi.mock("@/lib/espocrm", () => ({
  isEspoCRMConfigured: isConfiguredMock,
  listCompanies: listCompaniesMock,
  listContacts: listContactsMock,
  listDeals: listDealsMock,
  listOwners: listOwnersMock,
  listTickets: listTicketsMock,
}));

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

describe("admin crm routes — error mapping tails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    isConfiguredMock.mockResolvedValue(true);
  });

  const cases = [
    {
      name: "companies",
      path: "/api/admin/crm/companies",
      load: () => import("@/app/api/admin/crm/companies/route"),
      list: () => listCompaniesMock,
      errorText: "Failed to fetch companies.",
    },
    {
      name: "contacts",
      path: "/api/admin/crm/contacts",
      load: () => import("@/app/api/admin/crm/contacts/route"),
      list: () => listContactsMock,
      errorText: "Failed to fetch contacts.",
    },
    {
      name: "deals",
      path: "/api/admin/crm/deals",
      load: () => import("@/app/api/admin/crm/deals/route"),
      list: () => listDealsMock,
      errorText: "Failed to fetch deals.",
    },
    {
      name: "owners",
      path: "/api/admin/crm/owners",
      load: () => import("@/app/api/admin/crm/owners/route"),
      list: () => listOwnersMock,
      errorText: "Failed to fetch owners.",
    },
    {
      name: "tickets",
      path: "/api/admin/crm/tickets",
      load: () => import("@/app/api/admin/crm/tickets/route"),
      list: () => listTicketsMock,
      errorText: "Failed to fetch tickets.",
    },
  ];

  for (const c of cases) {
    it(`${c.name}: IntegrationNotConfiguredError maps via mapIntegrationError`, async () => {
      c.list().mockRejectedValueOnce(
        new IntegrationNotConfiguredError(["ESPOCRM_URL"])
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { GET } = await c.load();
      const res = await GET(req(c.path));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).not.toBe(500);
      spy.mockRestore();
    });

    it(`${c.name}: generic error → 500`, async () => {
      c.list().mockRejectedValueOnce(new Error("crm exploded"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { GET } = await c.load();
      const res = await GET(req(c.path));
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe(c.errorText);
      spy.mockRestore();
    });
  }
});
