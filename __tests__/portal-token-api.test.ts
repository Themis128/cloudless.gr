import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ClientPortal } from "@/app/api/admin/client-portals/route";
import { resetJsonConfigMemory, writeJsonConfig } from "@/lib/app-config-json";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockCustomersList, mockInvoicesList, mockSubsList } = vi.hoisted(() => ({
  mockCustomersList: vi.fn(),
  mockInvoicesList: vi.fn(),
  mockSubsList: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    STRIPE_SECRET_KEY: "sk_test_x",
  }),
}));

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    customers: { list: mockCustomersList },
    invoices: { list: mockInvoicesList },
    subscriptions: { list: mockSubsList },
  }),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const VALID_TOKEN = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const MOCK_PORTAL: ClientPortal = {
  token: VALID_TOKEN,
  label: "Acme Corp",
  clientEmail: "acme@example.com",
  clientName: "Jane Doe",
  createdAt: new Date().toISOString(),
  steps: [
    {
      id: "step-1",
      name: "Free Audit",
      status: "completed",
      completedAt: new Date().toISOString(),
      comments: [],
    },
    {
      id: "step-2",
      name: "Proposal & Scope",
      status: "in-progress",
      comments: [
        {
          id: "c1",
          author: "Cloudless Team",
          text: "Proposal sent.",
          createdAt: new Date().toISOString(),
        },
      ],
    },
    { id: "step-3", name: "Implementation", status: "pending", comments: [] },
  ],
};

function makeReq(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/portal/${token}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/portal/[token]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetJsonConfigMemory();
    await writeJsonConfig("CLIENT_PORTALS_JSON", [MOCK_PORTAL]);
    mockCustomersList.mockResolvedValue({ data: [{ id: "cus_test" }] });
    mockInvoicesList.mockResolvedValue({ data: [] });
    mockSubsList.mockResolvedValue({ data: [] });
  });

  it("returns 401 for short/invalid token", async () => {
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq("short"), { params: Promise.resolve({ token: "short" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown token", async () => {
    await writeJsonConfig("CLIENT_PORTALS_JSON", []);
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when D1 app_config has no portals", async () => {
    await writeJsonConfig("CLIENT_PORTALS_JSON", []);
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  it("returns client data for valid token", async () => {
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.client).toMatchObject({
      name: "Jane Doe",
      email: "acme@example.com",
      label: "Acme Corp",
    });
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps).toHaveLength(3);
    expect(data.steps[0]).toMatchObject({ name: "Free Audit", status: "completed" });
    expect(data.steps[1].comments).toHaveLength(1);
    expect(Array.isArray(data.projects)).toBe(true);
    expect(Array.isArray(data.invoices)).toBe(true);
    expect(Array.isArray(data.subscriptions)).toBe(true);
  });

  it("returns empty invoices when no Stripe customer found", async () => {
    mockCustomersList.mockResolvedValue({ data: [] });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoices).toEqual([]);
    expect(data.subscriptions).toEqual([]);
  });

  it("returns invoices for matching Stripe customer", async () => {
    mockInvoicesList.mockResolvedValue({
      data: [
        {
          id: "in_test_1",
          number: "INV-001",
          amount_paid: 4900,
          currency: "eur",
          status: "paid",
          created: Math.floor(Date.now() / 1000),
          invoice_pdf: "https://invoice.stripe.com/pdf",
        },
      ],
    });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0]).toMatchObject({
      id: "in_test_1",
      number: "INV-001",
      amount: 4900,
      currency: "EUR",
    });
  });
});

describe("GET /api/portal/[token] tails", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetJsonConfigMemory();
    await writeJsonConfig("CLIENT_PORTALS_JSON", [MOCK_PORTAL]);
    mockCustomersList.mockResolvedValue({ data: [{ id: "cus_test" }] });
    mockInvoicesList.mockResolvedValue({ data: [] });
    mockSubsList.mockResolvedValue({ data: [] });
  });

  const call = async () => {
    const { GET } = await import("@/app/api/portal/[token]/route");
    return GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
  };

  it("maps subscription items with product-name, nickname, and defaults", async () => {
    mockSubsList.mockResolvedValue({
      data: [
        {
          id: "sub_named",
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1750000000,
          items: { data: [{ price: { product: { name: "Analytics Pro" }, unit_amount: 9900, currency: "eur", recurring: { interval: "month" } } }] },
        },
        {
          id: "sub_nick",
          status: "trialing",
          cancel_at_period_end: true,
          items: { data: [{ price: { nickname: "Starter Nick", unit_amount: 1900 } }] },
        },
        {
          id: "sub_empty",
          status: "canceled",
          items: { data: [] },
        },
      ],
    });
    const res = await call();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.subscriptions.map((s: { id: string }) => s.id)).toEqual([
      "sub_named",
      "sub_nick",
      "sub_empty",
    ]);
    expect(data.subscriptions[0]).toMatchObject({ planName: "Analytics Pro", amount: 9900, interval: "month", currentPeriodEnd: 1750000000 });
    expect(data.subscriptions[1]).toMatchObject({ planName: "Starter Nick", currency: "EUR" });
    expect(data.subscriptions[2]).toMatchObject({ planName: "Plan", amount: 0 });
  });

  it("returns empty invoices/subscriptions when the Stripe lookup throws", async () => {
    mockCustomersList.mockRejectedValue(new Error("stripe down"));
    const res = await call();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.invoices).toEqual([]);
    expect(data.subscriptions).toEqual([]);
  });

  it("returns only client-owned AppFlowy projects when configured", async () => {
    const appflowy = await import("@/lib/appflowy");
    vi.mocked(appflowy.isAppFlowyConfigured).mockResolvedValue(true);
    vi.doMock("@/lib/appflowy-projects", () => ({
      listProjects: vi.fn().mockResolvedValue([
        { id: "p1", name: "Acme site", type: "Client", owner: "acme@example.com" },
        { id: "p2", name: "Other", type: "Client", owner: "other@example.com" },
        { id: "p3", name: "Internal", type: "Internal", owner: "acme@example.com" },
      ]),
    }));
    vi.resetModules();
    const { writeJsonConfig: writeFresh } = await import("@/lib/app-config-json");
    await writeFresh("CLIENT_PORTALS_JSON", [MOCK_PORTAL]);
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    vi.doUnmock("@/lib/appflowy-projects");
    vi.resetModules();
  });
});
