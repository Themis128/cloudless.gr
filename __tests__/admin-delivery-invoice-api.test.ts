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
  mockGetProject,
  mockListUnbilled,
  mockMarkInvoiced,
  mockSetCustomer,
  mockGetStripe,
  mockResolveCustomer,
  mockCreateDraft,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockListUnbilled: vi.fn(),
  mockMarkInvoiced: vi.fn(),
  mockSetCustomer: vi.fn(),
  mockGetStripe: vi.fn(),
  mockResolveCustomer: vi.fn(),
  mockCreateDraft: vi.fn(),
}));

vi.mock("@/lib/agency-projects-d1", () => ({
  getAgencyProject: (...a: unknown[]) => mockGetProject(...a),
  listUnbilledBillableEntries: (...a: unknown[]) => mockListUnbilled(...a),
  markTimeEntriesInvoiced: (...a: unknown[]) => mockMarkInvoiced(...a),
  setAgencyProjectStripeCustomer: (...a: unknown[]) => mockSetCustomer(...a),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...a: unknown[]) => mockGetStripe(...a),
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

const project = {
  id: "ap_abc",
  name: "Acme site",
  clientEmail: "a@b.com",
  espoAccountId: null,
  status: "active" as const,
  hourlyRateCents: 10000,
  currency: "EUR",
  stripeCustomerId: null as string | null,
  notes: null,
  createdAt: 1,
  updatedAt: 1,
  totalMinutes: 90,
  unbilledMinutes: 90,
};

describe("POST /api/admin/delivery/projects/[id]/invoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStripe.mockResolvedValue({});
    mockGetProject.mockResolvedValue({ bound: true, project });
    mockListUnbilled.mockResolvedValue({
      bound: true,
      entries: [
        {
          id: "te_1",
          projectId: "ap_abc",
          userId: null,
          workDate: "2026-08-14",
          minutes: 90,
          billable: true,
          description: "Landing",
          stripeInvoiceId: null,
          createdAt: 1,
        },
      ],
    });
    mockResolveCustomer.mockResolvedValue("cus_1");
    mockSetCustomer.mockResolvedValue(true);
    mockCreateDraft.mockResolvedValue({
      id: "in_1",
      number: null,
      customerId: "cus_1",
      customerEmail: "a@b.com",
      status: "draft",
      amountDue: 15000,
      amountPaid: 0,
      currency: "EUR",
      created: 1,
      hostedInvoiceUrl: null,
      invoicePdf: null,
    });
    mockMarkInvoiced.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/invoice/route");
    const res = await POST(
      new NextRequest("http://localhost/api/admin/delivery/projects/ap_abc/invoice"),
      {
        params: Promise.resolve({ id: "ap_abc" }),
      }
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 when Stripe missing", async () => {
    mockGetStripe.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/invoice/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/invoice", { method: "POST" }),
      {
        params: Promise.resolve({ id: "ap_abc" }),
      }
    );
    expect(res.status).toBe(503);
  });

  it("rejects missing hourly rate", async () => {
    mockGetProject.mockResolvedValueOnce({
      bound: true,
      project: { ...project, hourlyRateCents: null },
    });
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/invoice/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/invoice", { method: "POST" }),
      {
        params: Promise.resolve({ id: "ap_abc" }),
      }
    );
    expect(res.status).toBe(400);
  });

  it("creates a draft and stamps entries", async () => {
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/invoice/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/invoice", { method: "POST" }),
      {
        params: Promise.resolve({ id: "ap_abc" }),
      }
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.invoice.id).toBe("in_1");
    expect(data.amountCents).toBe(15000);
    expect(data.stamped).toBe(1);
    expect(mockResolveCustomer).toHaveBeenCalledWith("a@b.com");
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_1", amountCents: 15000, currency: "eur" })
    );
    expect(mockMarkInvoiced).toHaveBeenCalledWith(["te_1"], "in_1");
  });

  it("reuses existing Stripe customer", async () => {
    mockGetProject.mockResolvedValueOnce({
      bound: true,
      project: { ...project, stripeCustomerId: "cus_existing" },
    });
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/invoice/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/invoice", { method: "POST" }),
      {
        params: Promise.resolve({ id: "ap_abc" }),
      }
    );
    expect(res.status).toBe(201);
    expect(mockResolveCustomer).not.toHaveBeenCalled();
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_existing" })
    );
  });
});
