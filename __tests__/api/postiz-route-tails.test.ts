/**
 * Tails for the postiz admin route error branches — not-configured 503,
 * upstream 502 passthrough, and unexpected-throw rethrow.
 * Only the auth + postiz lib boundaries are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updatePostReleaseId: vi.fn(),
  getIntegrationSettings: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: m.requireAdmin }));

// Keep the real error classes so `instanceof` discrimination works —
// only the two network functions are replaced.
vi.mock("@/lib/postiz", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/postiz")>();
  return {
    ...real,
    updatePostReleaseId: m.updatePostReleaseId,
    getIntegrationSettings: m.getIntegrationSettings,
  };
});

import { PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";
import { PUT } from "@/app/api/admin/postiz/posts/[id]/release-id/route";
import { GET } from "@/app/api/admin/postiz/integrations/[id]/settings/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const putReq = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/postiz/posts/p1/release-id", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const getReq = () =>
  new NextRequest("http://localhost/api/admin/postiz/integrations/i1/settings");

describe("postiz admin route error branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ ok: true });
  });

  it("release-id: 503 on not-configured, 502 on upstream, rethrow otherwise", async () => {
    m.updatePostReleaseId.mockRejectedValueOnce(new PostizNotConfiguredError());
    let res = await PUT(putReq({ releaseId: "tw_123" }), params("p1"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "postiz_not_configured" });

    m.updatePostReleaseId.mockRejectedValueOnce(new PostizApiError(422, "bad id"));
    res = await PUT(putReq({ releaseId: "tw_123" }), params("p1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "postiz_upstream",
      status: 422,
      body: "bad id",
    });

    m.updatePostReleaseId.mockRejectedValueOnce(new Error("boom"));
    await expect(PUT(putReq({ releaseId: "tw_123" }), params("p1"))).rejects.toThrow("boom");
  });

  it("settings: 503 on not-configured, 502 on upstream, rethrow otherwise", async () => {
    m.getIntegrationSettings.mockRejectedValueOnce(new PostizNotConfiguredError());
    let res = await GET(getReq(), params("i1"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "postiz_not_configured" });

    m.getIntegrationSettings.mockRejectedValueOnce(new PostizApiError(404, "no integ"));
    res = await GET(getReq(), params("i1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "postiz_upstream",
      status: 404,
      body: "no integ",
    });

    m.getIntegrationSettings.mockRejectedValueOnce(new Error("boom"));
    await expect(GET(getReq(), params("i1"))).rejects.toThrow("boom");
  });
});
