import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Workspace } from "@/app/api/admin/workspaces/route";
import { resetJsonConfigMemory, writeJsonConfig } from "@/lib/app-config-json";
import { WORKSPACES_CONFIG_KEY, resetWorkspaceCache } from "@/lib/workspace-server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});
const WORKSPACES_URL = "http://localhost/api/admin/workspaces";
const ACME_WORKSPACE = "Acme Workspace";

beforeEach(() => {
  resetJsonConfigMemory();
  resetWorkspaceCache();
});

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

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

const MOCK_WS: Workspace = {
  id: "ws-uuid-1234",
  name: ACME_WORKSPACE,
  slug: "acme-workspace",
  description: "Main client workspace",
  adminEmails: ["admin@acme.com"],
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------
describe("GET /api/admin/workspaces", () => {
  beforeEach(async () => {
    await writeJsonConfig(WORKSPACES_CONFIG_KEY, [MOCK_WS]);
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(new NextRequest(WORKSPACES_URL));
    expect(res.status).toBe(401);
  });

  it("returns workspace list for admin", async () => {
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(adminReq(WORKSPACES_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.workspaces)).toBe(true);
    expect(data.workspaces[0]).toMatchObject({
      id: "ws-uuid-1234",
      name: ACME_WORKSPACE,
      slug: "acme-workspace",
    });
  });

  it("returns empty array when nothing is stored", async () => {
    resetJsonConfigMemory();
    const { GET } = await import("@/app/api/admin/workspaces/route");
    const res = await GET(adminReq(WORKSPACES_URL));
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
    resetJsonConfigMemory();
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(
      adminReq(WORKSPACES_URL, {
        method: "POST",
        body: JSON.stringify({ description: "test" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a workspace with auto-generated slug", async () => {
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(
      adminReq(WORKSPACES_URL, {
        method: "POST",
        body: JSON.stringify({
          name: "My New Client",
          description: "First client workspace",
          adminEmails: ["owner@client.com"],
        }),
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.workspace.name).toBe("My New Client");
    expect(data.workspace.slug).toBe("my-new-client");
    expect(data.workspace.adminEmails).toContain("owner@client.com");
    expect(typeof data.workspace.id).toBe("string");
  });

  it("returns 409 when slug already exists", async () => {
    await writeJsonConfig(WORKSPACES_CONFIG_KEY, [MOCK_WS]);
    const { POST } = await import("@/app/api/admin/workspaces/route");
    const res = await POST(
      adminReq(WORKSPACES_URL, {
        method: "POST",
        body: JSON.stringify({ name: ACME_WORKSPACE }), // same slug as MOCK_WS
      })
    );
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH (update)
// ---------------------------------------------------------------------------
describe("PATCH /api/admin/workspaces", () => {
  beforeEach(async () => {
    await writeJsonConfig(WORKSPACES_CONFIG_KEY, [MOCK_WS]);
  });

  it("returns 400 when id is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(
      adminReq(WORKSPACES_URL, {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when workspace not found", async () => {
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(
      adminReq(WORKSPACES_URL, {
        method: "PATCH",
        body: JSON.stringify({ id: "does-not-exist", name: "X" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("updates workspace name and slug", async () => {
    const { PATCH } = await import("@/app/api/admin/workspaces/route");
    const res = await PATCH(
      adminReq(WORKSPACES_URL, {
        method: "PATCH",
        body: JSON.stringify({ id: MOCK_WS.id, name: "Acme Renamed" }),
      })
    );
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
  beforeEach(async () => {
    await writeJsonConfig(WORKSPACES_CONFIG_KEY, [MOCK_WS]);
  });

  it("returns 400 when id is missing", async () => {
    const { DELETE } = await import("@/app/api/admin/workspaces/route");
    const res = await DELETE(
      adminReq(WORKSPACES_URL, {
        method: "DELETE",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("deletes workspace and returns ok", async () => {
    const { DELETE } = await import("@/app/api/admin/workspaces/route");
    const res = await DELETE(
      adminReq(WORKSPACES_URL, {
        method: "DELETE",
        body: JSON.stringify({ id: MOCK_WS.id }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
