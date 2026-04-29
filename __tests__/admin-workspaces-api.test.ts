import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Workspace } from "@/app/api/admin/workspaces/route";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSSMSend } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(function() { return { send: mockSSMSend }; }),
  };
});

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    "cognito:groups": ["admin"],
    token_use: "id",
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

const MOCK_WS: Workspace = {
  id: "ws-uuid-1234",
  name: "Acme Workspace",
  slug: "acme-workspace",
  description: "Main client workspace",
  adminEmails: ["admin@acme.com"],
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------
describe("GET /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_WS]) } });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/workspaces"));
    expect(res.status).toBe(401);
  });

  it("returns workspace list for admin", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_WS]) } });
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(adminReq("http://localhost/api/admin/workspaces"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.workspaces)).toBe(true);
    expect(data.workspaces[0]).toMatchObject({
      id: "ws-uuid-1234",
      name: "Acme Workspace",
      slug: "acme-workspace",
    });
  });

  it("returns empty array when SSM throws", async () => {
    mockSSMSend.mockRejectedValue(new Error("Not found"));
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(adminReq("http://localhost/api/admin/workspaces"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.workspaces).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST (create)
// ---------------------------------------------------------------------------
describe("POST /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
      .mockResolvedValue({});
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(adminReq("http://localhost/api/admin/workspaces", {
      method: "POST",
      body: JSON.stringify({ description: "test" }),
    }));
    expect(res.status).toBe(400);
  });

  it("creates a workspace with auto-generated slug", async () => {
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
      .mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(adminReq("http://localhost/api/admin/workspaces", {
      method: "POST",
      body: JSON.stringify({
        name: "My New Client",
        description: "First client workspace",
        adminEmails: ["owner@client.com"],
      }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.workspace.name).toBe("My New Client");
    expect(data.workspace.slug).toBe("my-new-client");
    expect(data.workspace.adminEmails).toContain("owner@client.com");
    expect(typeof data.workspace.id).toBe("string");
  });

  it("returns 409 when slug already exists", async () => {
    mockSSMSend.mockReset();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_WS]) } })
      .mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(adminReq("http://localhost/api/admin/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Acme Workspace" }), // same slug as MOCK_WS
    }));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH (update)
// ---------------------------------------------------------------------------
describe("PATCH /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_WS]) } })
      .mockResolvedValue({});
  });

  it("returns 400 when id is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/workspaces", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when workspace not found", async () => {
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/workspaces", {
      method: "PATCH",
      body: JSON.stringify({ id: "does-not-exist", name: "X" }),
    }));
    expect(res.status).toBe(404);
  });

  it("updates workspace name and slug", async () => {
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_WS]) } })
      .mockResolvedValue({});
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(adminReq("http://localhost/api/admin/workspaces", {
      method: "PATCH",
      body: JSON.stringify({ id: MOCK_WS.id, name: "Acme Renamed" }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.workspace.name).toBe("Acme Renamed");
    expect(data.workspace.slug).toBe("acme-renamed");
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_WS]) } })
      .mockResolvedValue({});
  });

  it("returns 400 when id is missing", async () => {
    const { DELETE } = await import("@/app/api/admin/workspaces/route");
    const res = await DELETE(adminReq("http://localhost/api/admin/workspaces", {
      method: "DELETE",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("deletes workspace and returns ok", async () => {
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_WS]) } })
      .mockResolvedValue({});
    const { DELETE } = await import("@/app/api/admin/workspaces/route");
    const res = await DELETE(adminReq("http://localhost/api/admin/workspaces", {
      method: "DELETE",
      body: JSON.stringify({ id: MOCK_WS.id }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
