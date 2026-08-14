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
  mockListProjects,
  mockCreateProject,
  mockUpdateStatus,
  mockListTime,
  mockCreateTime,
} = vi.hoisted(() => ({
  mockListProjects: vi.fn(),
  mockCreateProject: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockListTime: vi.fn(),
  mockCreateTime: vi.fn(),
}));

vi.mock("@/lib/agency-projects-d1", () => ({
  listAgencyProjects: (...a: unknown[]) => mockListProjects(...a),
  createAgencyProject: (...a: unknown[]) => mockCreateProject(...a),
  updateAgencyProjectStatus: (...a: unknown[]) => mockUpdateStatus(...a),
  listTimeEntries: (...a: unknown[]) => mockListTime(...a),
  createTimeEntry: (...a: unknown[]) => mockCreateTime(...a),
  isAgencyProjectStatus: (v: string) =>
    ["active", "on_hold", "done", "cancelled"].includes(v),
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

describe("GET/POST /api/admin/delivery/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/admin/delivery/projects/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/delivery/projects"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AUTH_DB unbound", async () => {
    mockListProjects.mockResolvedValue({ bound: false, projects: [] });
    const { GET } = await import("@/app/api/admin/delivery/projects/route");
    const res = await GET(adminReq("http://localhost/api/admin/delivery/projects"));
    expect(res.status).toBe(503);
  });

  it("lists projects", async () => {
    mockListProjects.mockResolvedValue({
      bound: true,
      projects: [
        {
          id: "ap_1",
          name: "Acme site",
          clientEmail: "a@b.com",
          espoAccountId: null,
          status: "active",
          hourlyRateCents: 9000,
          currency: "EUR",
          stripeCustomerId: null,
          notes: null,
          createdAt: 1,
          updatedAt: 1,
          totalMinutes: 90,
          unbilledMinutes: 90,
        },
      ],
    });
    const { GET } = await import("@/app/api/admin/delivery/projects/route");
    const res = await GET(adminReq("http://localhost/api/admin/delivery/projects"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.projects[0].name).toBe("Acme site");
  });

  it("creates a project", async () => {
    mockCreateProject.mockResolvedValue({
      id: "ap_new",
      name: "Retainer",
      clientEmail: "c@cloudless.gr",
      espoAccountId: null,
      status: "active",
      hourlyRateCents: 10000,
      currency: "EUR",
      stripeCustomerId: null,
      notes: null,
      createdAt: 1,
      updatedAt: 1,
      totalMinutes: 0,
      unbilledMinutes: 0,
    });
    const { POST } = await import("@/app/api/admin/delivery/projects/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          name: "Retainer",
          clientEmail: "c@cloudless.gr",
          hourlyRateEur: 100,
        }),
      })
    );
    expect(res.status).toBe(201);
    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Retainer", hourlyRateCents: 10000 })
    );
  });

  it("sets status", async () => {
    mockUpdateStatus.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/delivery/projects/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects", {
        method: "POST",
        body: JSON.stringify({ action: "set_status", id: "ap_abc", status: "done" }),
      })
    );
    expect(res.status).toBe(200);
  });
});

describe("GET/POST /api/admin/delivery/projects/[id]/time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs hours", async () => {
    mockCreateTime.mockResolvedValue({
      id: "te_1",
      projectId: "ap_abc",
      userId: "test-admin-sub",
      workDate: "2026-08-14",
      minutes: 90,
      billable: true,
      description: "Landing page",
      stripeInvoiceId: null,
      createdAt: 1,
    });
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/time/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/time", {
        method: "POST",
        body: JSON.stringify({
          workDate: "2026-08-14",
          hours: 1.5,
          description: "Landing page",
        }),
      }),
      { params: Promise.resolve({ id: "ap_abc" }) }
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.entry.minutes).toBe(90);
    expect(mockCreateTime).toHaveBeenCalledWith(
      expect.objectContaining({ minutes: 90, projectId: "ap_abc" })
    );
  });

  it("lists entries", async () => {
    mockListTime.mockResolvedValue({
      bound: true,
      entries: [
        {
          id: "te_1",
          projectId: "ap_abc",
          userId: null,
          workDate: "2026-08-14",
          minutes: 60,
          billable: true,
          description: "x",
          stripeInvoiceId: null,
          createdAt: 1,
        },
      ],
    });
    const { GET } = await import("@/app/api/admin/delivery/projects/[id]/time/route");
    const res = await GET(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/time"),
      { params: Promise.resolve({ id: "ap_abc" }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).entries).toHaveLength(1);
  });

  it("rejects bad time body", async () => {
    const { POST } = await import("@/app/api/admin/delivery/projects/[id]/time/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/delivery/projects/ap_abc/time", {
        method: "POST",
        body: JSON.stringify({ workDate: "bad", hours: 0 }),
      }),
      { params: Promise.resolve({ id: "ap_abc" }) }
    );
    expect(res.status).toBe(400);
  });
});
