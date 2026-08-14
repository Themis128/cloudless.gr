import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  return {
    ...actual,
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const h = request.headers.get("authorization") ?? "";
      const token = h.startsWith("Bearer ") ? h.slice(7) : "";
      if (token === "test-admin-session") return { ok: true as const, user: adminUser };
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    },
  };
});

const {
  mockGetStripe,
  mockListRecentInvoices,
  mockResolveCustomer,
  mockCreateDraft,
  mockFinalize,
  mockSend,
} = vi.hoisted(() => ({
  mockGetStripe: vi.fn(),
  mockListRecentInvoices: vi.fn(),
  mockResolveCustomer: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockFinalize: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...a: unknown[]) => mockGetStripe(...a),
  listRecentInvoices: (...a: unknown[]) => mockListRecentInvoices(...a),
  resolveOrCreateCustomerByEmail: (...a: unknown[]) => mockResolveCustomer(...a),
  createDraftInvoice: (...a: unknown[]) => mockCreateDraft(...a),
}));

function adminReq(url: string, init?: RequestInit) {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: "Bearer test-admin-session",
      "content-type": "application/json",
    },
  });
}

describe("GET/POST /api/admin/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStripe.mockResolvedValue({
      invoices: { finalizeInvoice: mockFinalize, sendInvoice: mockSend },
    });
  });

  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/admin/invoices/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/invoices"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when Stripe missing", async () => {
    mockGetStripe.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/admin/invoices/route");
    const res = await GET(adminReq("http://localhost/api/admin/invoices"));
    expect(res.status).toBe(503);
  });

  it("lists invoices", async () => {
    mockListRecentInvoices.mockResolvedValue({
      invoices: [
        {
          id: "in_1",
          number: "INV-1",
          customerId: "cus_1",
          customerEmail: "a@b.com",
          status: "open",
          amountDue: 1200,
          amountPaid: 0,
          currency: "EUR",
          created: 1_700_000_000,
          hostedInvoiceUrl: "https://stripe.test/inv",
          invoicePdf: null,
        },
      ],
      hasMore: false,
    });
    const { GET } = await import("@/app/api/admin/invoices/route");
    const res = await GET(adminReq("http://localhost/api/admin/invoices"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.invoices[0].id).toBe("in_1");
  });

  it("creates a draft via email", async () => {
    mockResolveCustomer.mockResolvedValue("cus_new");
    mockCreateDraft.mockResolvedValue({
      id: "in_draft",
      number: null,
      customerId: "cus_new",
      customerEmail: "client@cloudless.gr",
      status: "draft",
      amountDue: 5000,
      amountPaid: 0,
      currency: "EUR",
      created: 1_700_000_000,
      hostedInvoiceUrl: null,
      invoicePdf: null,
    });
    const { POST } = await import("@/app/api/admin/invoices/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/invoices", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          email: "client@cloudless.gr",
          description: "Retainer August",
          amountEur: 50,
        }),
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.invoice.id).toBe("in_draft");
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_new", amountCents: 5000 })
    );
  });

  it("finalizes and sends", async () => {
    mockFinalize.mockResolvedValue({
      id: "in_1abc",
      status: "open",
      hosted_invoice_url: "https://pay.test",
    });
    mockSend.mockResolvedValue({
      id: "in_1abc",
      status: "open",
      hosted_invoice_url: "https://pay.test",
    });
    const { POST } = await import("@/app/api/admin/invoices/route");
    expect(
      (
        await POST(
          adminReq("http://localhost/api/admin/invoices", {
            method: "POST",
            body: JSON.stringify({ action: "finalize", invoiceId: "in_1abc" }),
          })
        )
      ).status
    ).toBe(200);
    expect(
      (
        await POST(
          adminReq("http://localhost/api/admin/invoices", {
            method: "POST",
            body: JSON.stringify({ action: "send", invoiceId: "in_1abc" }),
          })
        )
      ).status
    ).toBe(200);
  });

  it("rejects bad create body", async () => {
    const { POST } = await import("@/app/api/admin/invoices/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/invoices", {
        method: "POST",
        body: JSON.stringify({ action: "create", email: "x", description: "", amountEur: 0 }),
      })
    );
    expect(res.status).toBe(400);
  });
});
