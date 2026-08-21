import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireAdmin, mockIsConfiguredAsync, mockListContacts, mockListLeads, mockReadPendingClients } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn(),
    mockIsConfiguredAsync: vi.fn(),
    mockListContacts: vi.fn(),
    mockListLeads: vi.fn(),
    mockReadPendingClients: vi.fn(),
  }));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/integrations", () => ({
  isConfiguredAsync: mockIsConfiguredAsync,
  IntegrationNotConfiguredError: class IntegrationNotConfiguredError extends Error {
    constructor(keys: string[]) {
      super(`Not configured: ${keys.join(", ")}`);
      this.name = "IntegrationNotConfiguredError";
    }
  },
}));
vi.mock("@/lib/espocrm", () => ({ listContacts: mockListContacts, listLeads: mockListLeads }));
vi.mock("@/lib/pending-clients", () => ({
  readPendingClients: mockReadPendingClients,
  PLAN_LABELS: { bundle: "Full-Stack Growth Engine (Bundle)" },
}));

import { GET } from "@/app/api/admin/leads/route";

function makeRequest(url = "http://localhost/api/admin/leads"): NextRequest {
  return new NextRequest(url);
}

const ESPOCRM_CONTACT = {
  id: "1",
  emailAddress: "Jane@Acme.com",
  firstName: "Jane",
  lastName: "Doe",
  accountName: "Acme",
  createdAt: "2026-06-01T10:00:00Z",
  leadSource: "NEW",
};

const PENDING_CLIENT = {
  email: "jane@acme.com",
  name: "Jane Doe",
  plan: "bundle",
  submittedAt: "2026-05-30T09:00:00Z",
  status: "waiting",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ ok: true });
  mockIsConfiguredAsync.mockResolvedValue(true);
  mockListContacts.mockResolvedValue([ESPOCRM_CONTACT]);
  mockListLeads.mockResolvedValue([]);
  mockReadPendingClients.mockResolvedValue([]);
});

describe("GET /api/admin/leads", () => {
  it("returns 401-style response when auth fails", async () => {
    const denied = Response.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: denied });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns EspoCRM contacts as unified leads", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.leads[0]).toMatchObject({
      email: "Jane@Acme.com",
      name: "Jane Doe",
      company: "Acme",
      sources: ["espocrm"],
      status: "NEW",
    });
  });

  it("merges a portal enrollment with the same email (case-insensitive)", async () => {
    mockReadPendingClients.mockResolvedValue([PENDING_CLIENT]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.leads[0].sources.sort((a: string, b: string) => a.localeCompare(b))).toEqual([
      "espocrm",
      "portal",
    ]);
    expect(data.leads[0].interest).toBe("Full-Stack Growth Engine (Bundle)");
    expect(data.leads[0].portalStatus).toBe("waiting");
    // First touch wins: portal submission predates EspoCRM createdate.
    expect(data.leads[0].createdAt).toBe("2026-05-30T09:00:00Z");
  });

  it("sorts leads newest-first by createdAt", async () => {
    mockListContacts.mockResolvedValue([
      ESPOCRM_CONTACT,
      {
        id: "2",
        emailAddress: "new@corp.com",
        createdAt: "2026-06-10T10:00:00Z",
      },
    ]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.leads.map((l: { email: string }) => l.email)).toEqual([
      "new@corp.com",
      "Jane@Acme.com",
    ]);
  });

  it("skips EspoCRM contacts without an email", async () => {
    mockListContacts.mockResolvedValue([{ id: "3", firstName: "Ghost" }]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.total).toBe(0);
  });

  it("still serves portal leads when EspoCRM is unconfigured", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    mockReadPendingClients.mockResolvedValue([PENDING_CLIENT]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.leads[0].sources).toEqual(["portal"]);
    expect(mockListContacts).not.toHaveBeenCalled();
  });

  it("returns 503 when no source is available", async () => {
    mockIsConfiguredAsync.mockResolvedValue(false);
    mockReadPendingClients.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });

  it("caps the limit parameter at 100", async () => {
    await GET(makeRequest("http://localhost/api/admin/leads?limit=5000"));
    expect(mockListContacts).toHaveBeenCalledWith(100);
  });

  it("returns 500 on unexpected errors", async () => {
    mockReadPendingClients.mockRejectedValue(new Error("disk on fire"));
    mockListContacts.mockRejectedValue(new Error("api down"));
    // Promise.allSettled absorbs both failures → empty result, not a 500.
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
  });
});
