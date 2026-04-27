import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ClientPortal } from "@/app/api/admin/client-portals/route";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSSMSend, mockCustomersList, mockInvoicesList, mockSubsList } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
  mockCustomersList: vi.fn(),
  mockInvoicesList: vi.fn(),
  mockSubsList: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    STRIPE_SECRET_KEY: "sk_test_x",
    NOTION_API_KEY: "",
    NOTION_PROJECTS_DB_ID: "",
  }),
}));

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(function() { return { send: mockSSMSend }; }),
  };
});

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
    { id: "step-1", name: "Free Audit", status: "completed", completedAt: new Date().toISOString(), comments: [] },
    { id: "step-2", name: "Proposal & Scope", status: "in-progress", comments: [
      { id: "c1", author: "Cloudless Team", text: "Proposal sent.", createdAt: new Date().toISOString() },
    ]},
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
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
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([]) } });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when SSM throws", async () => {
    mockSSMSend.mockRejectedValue(new Error("SSM error"));
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
  });

  it("returns client data for valid token", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
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
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
    mockCustomersList.mockResolvedValue({ data: [] });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoices).toEqual([]);
    expect(data.subscriptions).toEqual([]);
  });

  it("returns invoices for matching Stripe customer", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
    mockInvoicesList.mockResolvedValue({
      data: [{
        id: "in_test_1",
        number: "INV-001",
        amount_paid: 4900,
        currency: "eur",
        status: "paid",
        created: Math.floor(Date.now() / 1000),
        invoice_pdf: "https://invoice.stripe.com/pdf",
      }],
    });
    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(makeReq(VALID_TOKEN), { params: Promise.resolve({ token: VALID_TOKEN }) });
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
