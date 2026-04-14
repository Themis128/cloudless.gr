/**
 * Unit tests for the CRM list helpers in src/lib/hubspot.ts:
 *   getPipelines, listCompanies, listDeals, listOwners
 *
 * Strategy:
 * - Mock `@/lib/integrations` to provide a fake HubSpot API key
 * - Mock `@/lib/ssm-config` so SSM is never hit
 * - Stub `fetch` per-test to simulate HubSpot API responses
 * - `vi.resetModules()` in beforeEach to avoid cross-test module state
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/integrations", () => ({
  getIntegrations: vi.fn().mockReturnValue({ HUBSPOT_API_KEY: "test-hs-token" }),
  isConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({ HUBSPOT_API_KEY: "test-hs-token" }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function hubspotOk(results: unknown[]) {
  return {
    ok: true as const,
    json: async () => ({ results }),
  };
}

function hubspotError(status = 401) {
  return {
    ok: false as const,
    status,
    json: async () => ({ message: "Unauthorized" }),
  };
}

const SAMPLE_PIPELINE = {
  id: "default",
  label: "Sales Pipeline",
  stages: [{ id: "appointmentscheduled", label: "Appointment Scheduled" }],
};

const SAMPLE_COMPANY = {
  id: "c1",
  properties: { name: "Acme Corp", domain: "acme.com", city: "Berlin" },
};

const SAMPLE_DEAL = {
  id: "d1",
  properties: {
    dealname: "Enterprise Deal",
    amount: "9900",
    dealstage: "closedwon",
    closedate: "2025-06-01T00:00:00Z",
  },
};

const SAMPLE_OWNER = {
  id: "o1",
  email: "owner@cloudless.gr",
  firstName: "Themistoklis",
  lastName: "B",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("getPipelines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns pipeline results on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotOk([SAMPLE_PIPELINE])));

    const { getPipelines } = await import("@/lib/hubspot");
    const result = await getPipelines();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "default", label: "Sales Pipeline" });
  });

  it("uses provided objectType in the request URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { getPipelines } = await import("@/lib/hubspot");
    await getPipelines("contacts");

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("/crm/v3/pipelines/contacts");
  });

  it("defaults to 'deals' objectType", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { getPipelines } = await import("@/lib/hubspot");
    await getPipelines();

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("/crm/v3/pipelines/deals");
  });

  it("returns [] when HubSpot API returns non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotError()));

    const { getPipelines } = await import("@/lib/hubspot");
    expect(await getPipelines()).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { getPipelines } = await import("@/lib/hubspot");
    expect(await getPipelines()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("listCompanies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns company list on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotOk([SAMPLE_COMPANY])));

    const { listCompanies } = await import("@/lib/hubspot");
    const result = await listCompanies();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "c1" });
  });

  it("passes limit parameter in URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listCompanies } = await import("@/lib/hubspot");
    await listCompanies(50);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=50");
  });

  it("clamps limit to 100 max", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listCompanies } = await import("@/lib/hubspot");
    await listCompanies(500);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=100");
  });

  it("clamps limit to 1 min", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listCompanies } = await import("@/lib/hubspot");
    await listCompanies(-5);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=1");
  });

  it("uses default limit 20 for non-finite input", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listCompanies } = await import("@/lib/hubspot");
    await listCompanies(NaN);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=20");
  });

  it("returns [] on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotError(500)));

    const { listCompanies } = await import("@/lib/hubspot");
    expect(await listCompanies()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("listDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns deal list on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotOk([SAMPLE_DEAL])));

    const { listDeals } = await import("@/lib/hubspot");
    const result = await listDeals();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "d1" });
  });

  it("passes limit parameter in URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listDeals } = await import("@/lib/hubspot");
    await listDeals(30);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=30");
  });

  it("clamps limit to 100 max", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listDeals } = await import("@/lib/hubspot");
    await listDeals(999);

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("limit=100");
  });

  it("returns [] on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotError(403)));

    const { listDeals } = await import("@/lib/hubspot");
    expect(await listDeals()).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

    const { listDeals } = await import("@/lib/hubspot");
    expect(await listDeals()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("listOwners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns owner list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(hubspotOk([SAMPLE_OWNER])),
    );

    const { listOwners } = await import("@/lib/hubspot");
    const result = await listOwners();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "o1", email: "owner@cloudless.gr" });
  });

  it("hits the /crm/v3/owners endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue(hubspotOk([]));
    vi.stubGlobal("fetch", mockFetch);

    const { listOwners } = await import("@/lib/hubspot");
    await listOwners();

    const url: string = mockFetch.mock.calls[0]?.[0];
    expect(url).toContain("/crm/v3/owners");
  });

  it("returns [] on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hubspotError()));

    const { listOwners } = await import("@/lib/hubspot");
    expect(await listOwners()).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));

    const { listOwners } = await import("@/lib/hubspot");
    expect(await listOwners()).toEqual([]);
  });
});
