import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listAllWorkspacesMock, listWorkspaceViewsMock } = vi.hoisted(() => ({
  listAllWorkspacesMock: vi.fn(),
  listWorkspaceViewsMock: vi.fn(),
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

vi.mock("@/lib/appflowy", async (orig) => {
  const mod = await orig<typeof import("@/lib/appflowy")>();
  return {
    ...mod,
    listAllWorkspaces: (...a: unknown[]) => listAllWorkspacesMock(...a),
    listWorkspaceViews: (...a: unknown[]) => listWorkspaceViewsMock(...a),
  };
});

function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    preferred_username: "admin-user",
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

function adminRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${makeAdminToken()}` },
  });
}

function unauthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/admin/notion/docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    listAllWorkspacesMock.mockResolvedValue([{ workspace_id: "ws1" }]);
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(unauthRequest("http://localhost/api/admin/notion/docs"));
    expect(res.status).toBe(401);
    expect(listWorkspaceViewsMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Notion Docs not configured", async () => {
    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    listAllWorkspacesMock.mockRejectedValue(new AppFlowyNotConfiguredError());
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(adminRequest("http://localhost/api/admin/notion/docs"));
    expect(res.status).toBe(503);
    expect(listWorkspaceViewsMock).not.toHaveBeenCalled();
  });

  it("returns all docs including unpublished", async () => {
    listWorkspaceViewsMock.mockResolvedValue([
      { view_id: "d1", name: "Getting Started", layout: "Document", created_at: "2026-01-01", last_edited_time: "2026-06-01" },
      { view_id: "d2", name: "Draft Doc", layout: "Document", created_at: "2026-01-02", last_edited_time: "2026-06-02" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(adminRequest("http://localhost/api/admin/notion/docs"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.docs).toHaveLength(2);
    expect(data.count).toBe(2);
    expect(data.docs[0].title).toBe("Getting Started");
    expect(data.docs[1].title).toBe("Draft Doc");
  });

  it("returns empty list when no docs exist", async () => {
    listWorkspaceViewsMock.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(adminRequest("http://localhost/api/admin/notion/docs"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.docs).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("returns 503 when AppFlowy is not configured", async () => {
    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    listAllWorkspacesMock.mockRejectedValue(new AppFlowyNotConfiguredError());
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(adminRequest("http://localhost/api/admin/notion/docs"));
    expect(res.status).toBe(503);
    expect(listWorkspaceViewsMock).not.toHaveBeenCalled();
  });
});
