import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const getAuthDbFromEnvMock = vi.fn();
const getD1ConfigValueMock = vi.fn();
const setD1ConfigValueMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => getAuthDbFromEnvMock(),
}));

vi.mock("@/lib/ssm-config-d1", () => ({
  getD1ConfigValue: (...args: unknown[]) => getD1ConfigValueMock(...args),
  setD1ConfigValue: (...args: unknown[]) => setD1ConfigValueMock(...args),
}));

function makeRequest(method: string, body?: unknown, url = "http://localhost/api/admin/config") {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET/PUT /api/admin/config", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAdminMock.mockReset();
    getAuthDbFromEnvMock.mockReset();
    getD1ConfigValueMock.mockReset();
    setD1ConfigValueMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, user: { sub: "admin" } });
  });

  it("returns 503 when AUTH_DB is not bound", async () => {
    getAuthDbFromEnvMock.mockReturnValue(null);
    const { GET } = await import("@/app/api/admin/config/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(503);
  });

  it("lists config keys without values", async () => {
    const all = vi.fn().mockResolvedValue({
      results: [{ key: "KUMA_BASE_URL", description: "kuma", updated_at: 1 }],
    });
    getAuthDbFromEnvMock.mockReturnValue({
      prepare: () => ({ bind: () => ({ all, first: vi.fn(), run: vi.fn() }), all, first: vi.fn(), run: vi.fn() }),
    });
    const { GET } = await import("@/app/api/admin/config/route");
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { configured: boolean; count: number };
    expect(json.configured).toBe(true);
    expect(json.count).toBe(1);
  });

  it("rejects blocked secret keys on PUT", async () => {
    getAuthDbFromEnvMock.mockReturnValue({});
    const { PUT } = await import("@/app/api/admin/config/route");
    const res = await PUT(makeRequest("PUT", { key: "STRIPE_SECRET_KEY", value: "sk_test" }));
    expect(res.status).toBe(403);
    expect(setD1ConfigValueMock).not.toHaveBeenCalled();
  });

  it("writes non-secret keys via setD1ConfigValue", async () => {
    getAuthDbFromEnvMock.mockReturnValue({});
    setD1ConfigValueMock.mockResolvedValue(undefined);
    const { PUT } = await import("@/app/api/admin/config/route");
    const res = await PUT(
      makeRequest("PUT", { key: "KUMA_STATUS_PAGE_SLUG", value: "cloudless", description: "slug" })
    );
    expect(res.status).toBe(200);
    expect(setD1ConfigValueMock).toHaveBeenCalledWith(
      expect.anything(),
      "KUMA_STATUS_PAGE_SLUG",
      "cloudless",
      "slug"
    );
  });
});
