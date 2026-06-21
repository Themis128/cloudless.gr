import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

const { listSubmissionsMock, updateSubmissionStatusMock } = vi.hoisted(() => ({
  listSubmissionsMock: vi.fn(),
  updateSubmissionStatusMock: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/notion-forms", () => ({
  listSubmissions: listSubmissionsMock,
  updateSubmissionStatus: updateSubmissionStatusMock,
}));

function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    aud: "test-client-id",
    iss: "https://auth.cloudless.gr/realms/cloudless",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function adminReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      ...(init?.headers as Record<string, string>),
    },
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url);
}

const BASE = "http://localhost/api/admin/notion/submissions";

describe("GET /api/admin/notion/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_SUBMISSIONS_DB_ID = "submissions-db-id";
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    const res = await GET(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    vi.stubEnv("NOTION_SUBMISSIONS_DB_ID", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);
  });

  it("returns submissions list", async () => {
    listSubmissionsMock.mockResolvedValueOnce([
      { id: "s1", email: "a@example.com" },
      { id: "s2", email: "b@example.com" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(2);
    expect(data.count).toBe(2);
  });

  it("respects the limit query param (capped at 100)", async () => {
    listSubmissionsMock.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    await GET(adminReq(`${BASE}?limit=200`));
    expect(listSubmissionsMock).toHaveBeenCalledWith(100);
  });

  it("uses default limit of 50 when not specified", async () => {
    listSubmissionsMock.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    await GET(adminReq(BASE));
    expect(listSubmissionsMock).toHaveBeenCalledWith(50);
  });

  it("returns 500 when listSubmissions throws", async () => {
    listSubmissionsMock.mockRejectedValueOnce(new Error("Notion error"));
    const { GET } = await import("@/app/api/admin/notion/submissions/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/notion/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_SUBMISSIONS_DB_ID = "submissions-db-id";
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 503 when NOTION_API_KEY is missing", async () => {
    vi.stubEnv("NOTION_API_KEY", "");
    resetIntegrationCache();
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "Done" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 when pageId or status is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status value", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "Pending" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/New.*In Review.*Done/);
  });

  it("updates submission status successfully", async () => {
    updateSubmissionStatusMock.mockResolvedValueOnce(true);
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "In Review" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 500 when updateSubmissionStatus returns false", async () => {
    updateSubmissionStatusMock.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "Done" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(500);
  });

  it("accepts all valid status values", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/submissions/route");
    for (const status of ["New", "In Review", "Done"]) {
      updateSubmissionStatusMock.mockResolvedValueOnce(true);
      const res = await PATCH(
        adminReq(BASE, {
          method: "PATCH",
          body: JSON.stringify({ pageId: "p1", status }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(200);
    }
  });
});
