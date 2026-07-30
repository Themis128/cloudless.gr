// @vitest-environment node
/**
 * /api/admin/users — D1 provider path (PR-04).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    ok: true,
    user: { sub: "admin", groups: ["admin"], roles: ["admin"] },
  })),
}));

const listUsers = vi.fn();
const setUserAdminRole = vi.fn();
const setUserDisabled = vi.fn();
const getAuthDbFromEnv = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: (...a: unknown[]) => getAuthDbFromEnv(...a),
  listUsers: (...a: unknown[]) => listUsers(...a),
  setUserAdminRole: (...a: unknown[]) => setUserAdminRole(...a),
  setUserDisabled: (...a: unknown[]) => setUserDisabled(...a),
}));

function adminReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, { method: init?.method, body: init?.body });
}

describe("/api/admin/users — D1 path", () => {
  beforeEach(() => {
    vi.resetModules();
    listUsers.mockReset();
    setUserAdminRole.mockReset();
    setUserDisabled.mockReset();
    getAuthDbFromEnv.mockReset();
    getAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET lists D1 users with provider d1", async () => {
    listUsers.mockResolvedValue([
      {
        id: "u1",
        email: "alice@cloudless.gr",
        name: "Alice",
        company: null,
        phone: null,
        created_at: 1_700_000_000,
        role: "admin",
        disabled: false,
        emailVerified: true,
      },
    ]);
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users?limit=60"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("d1");
    expect(body.users[0].email).toBe("alice@cloudless.gr");
    expect(body.users[0].role).toBe("admin");
  });

  it("GET returns 503 when AUTH_DB missing", async () => {
    getAuthDbFromEnv.mockReturnValue(null);
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    expect(res.status).toBe(503);
  });

  it("POST promote calls setUserAdminRole", async () => {
    setUserAdminRole.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "promote", username: "u1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(setUserAdminRole).toHaveBeenCalledWith(expect.anything(), "u1", true);
  });

  it("POST disable calls setUserDisabled", async () => {
    setUserDisabled.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ action: "disable", username: "u1" }),
      })
    );
    expect(res.status).toBe(200);
    expect(setUserDisabled).toHaveBeenCalledWith(expect.anything(), "u1", true);
  });
});
