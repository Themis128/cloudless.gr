import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Hoist mock variables so vi.mock() factories can reference them safely.
// ---------------------------------------------------------------------------
const { getDocsMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock jose: replace jwtVerify with a decode-only version so tests can use
// fake-signed tokens without hitting the real Cognito JWKS endpoint.
// ---------------------------------------------------------------------------
vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      if (payload.exp && Date.now() >= payload.exp * 1000)
        throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

// Mock only the Notion data layer — auth and integrations use real code.
vi.mock("@/lib/notion-docs", () => ({
  getDocs: getDocsMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    "cognito:username": "admin-user",
    "cognito:groups": ["admin"],
    aud: "test-client-id",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/admin/notion/docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test_key_12345";
    process.env.NOTION_DOCS_DB_ID = "docs-db-123";
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(
      unauthRequest("http://localhost/api/admin/notion/docs"),
    );
    expect(res.status).toBe(401);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Notion Docs not configured", async () => {
    vi.stubEnv("NOTION_DOCS_DB_ID", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/notion/docs"),
    );
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toBe("Notion Docs not configured");
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("returns all docs including unpublished", async () => {
    getDocsMock.mockResolvedValueOnce([
      { id: "d1", title: "Getting Started", published: true, category: "Guides" },
      { id: "d2", title: "Draft Doc", published: false, category: "Guides" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/notion/docs"),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.docs).toHaveLength(2);
    expect(data.count).toBe(2);
    expect(data.docs[0].published).toBe(true);
    expect(data.docs[1].published).toBe(false);
  });

  it("returns empty list when no docs exist", async () => {
    getDocsMock.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/notion/docs"),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.docs).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("returns 503 when NOTION_API_KEY is missing", async () => {
    vi.stubEnv("NOTION_API_KEY", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/admin/notion/docs/route");
    const res = await GET(
      adminRequest("http://localhost/api/admin/notion/docs"),
    );
    expect(res.status).toBe(503);
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});
