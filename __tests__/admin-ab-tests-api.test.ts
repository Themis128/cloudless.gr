import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_FLAGS } from "@/lib/ab-flags";
import { resetJsonConfigMemory, writeJsonConfig } from "@/lib/app-config-json";

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
const ABTEST_URL = "http://localhost/api/admin/ab-tests";
const CONFIG_KEY = "AB_FLAGS_JSON";

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

function makeAdminToken(): string {
  return "test-admin-session";
}

function makeUserToken(): string {
  return "test-user-session";
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeUserToken()}` } });
}

describe("GET /api/admin/ab-tests", () => {
  beforeEach(() => {
    resetJsonConfigMemory();
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(new NextRequest(ABTEST_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(userReq(ABTEST_URL));
    expect(res.status).toBe(403);
  });

  it("returns flags array for admin", async () => {
    await writeJsonConfig(CONFIG_KEY, DEFAULT_FLAGS);
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(adminReq(ABTEST_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.flags)).toBe(true);
    expect(data.flags.length).toBeGreaterThan(0);
    expect(data.flags[0]).toHaveProperty("id");
    expect(data.flags[0]).toHaveProperty("enabled");
    expect(data.flags[0]).toHaveProperty("trafficSplit");
  });

  it("falls back to DEFAULT_FLAGS when nothing is stored", async () => {
    const { GET } = await import("@/app/api/admin/ab-tests/route");
    const res = await GET(adminReq(ABTEST_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flags).toEqual(DEFAULT_FLAGS);
  });
});

describe("PATCH /api/admin/ab-tests", () => {
  beforeEach(async () => {
    resetJsonConfigMemory();
    await writeJsonConfig(CONFIG_KEY, structuredClone(DEFAULT_FLAGS));
  });

  it("returns 400 when id is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(
      adminReq(ABTEST_URL, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when flag id is unknown", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(
      adminReq(ABTEST_URL, {
        method: "PATCH",
        body: JSON.stringify({ id: "does-not-exist", enabled: true }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("updates a flag and returns updated flags", async () => {
    const { PATCH } = await import("@/app/api/admin/ab-tests/route");
    const res = await PATCH(
      adminReq(ABTEST_URL, {
        method: "PATCH",
        body: JSON.stringify({ id: "hero-cta", enabled: true, trafficSplit: 60 }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.flags)).toBe(true);
    const updated = data.flags.find((f: { id: string }) => f.id === "hero-cta");
    expect(updated.enabled).toBe(true);
    expect(updated.trafficSplit).toBe(60);
  });
});

describe("POST /api/admin/ab-tests (reset)", () => {
  beforeEach(() => {
    resetJsonConfigMemory();
  });

  it("resets to default flags", async () => {
    const { POST } = await import("@/app/api/admin/ab-tests/route");
    const res = await POST(
      adminReq(ABTEST_URL, {
        method: "POST",
        body: JSON.stringify({ action: "reset" }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flags).toEqual(DEFAULT_FLAGS);
  });

  it("returns 400 for unknown action", async () => {
    const { POST } = await import("@/app/api/admin/ab-tests/route");
    const res = await POST(
      adminReq(ABTEST_URL, {
        method: "POST",
        body: JSON.stringify({ action: "invalid" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
