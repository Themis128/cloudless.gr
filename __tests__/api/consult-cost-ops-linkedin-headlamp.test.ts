/**
 * Tests for /api/admin/{consultations,cost,ops,linkedin-cap,headlamp/token}.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const libs = vi.hoisted(() => ({
  getUpcomingConsultations: vi.fn(),
  isConfiguredAsync: vi.fn(),
  getIntegrationsAsync: vi.fn(),
  getCostSummary: vi.fn(),
  invalidateCache: vi.fn(),
  isInCluster: vi.fn(),
  k8sPost: vi.fn(),
}));
vi.mock("@/lib/cal-com", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cal-com")>();
  return { ...actual, getUpcomingConsultations: libs.getUpcomingConsultations };
});
vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations")>();
  return {
    ...actual,
    isConfiguredAsync: libs.isConfiguredAsync,
    getIntegrationsAsync: libs.getIntegrationsAsync,
  };
});
vi.mock("@/lib/cost-analytics", () => ({
  getCostSummary: libs.getCostSummary,
}));
vi.mock("@/lib/content-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content-cache")>();
  return { ...actual, invalidateCache: libs.invalidateCache };
});
vi.mock("@/lib/k8s-cluster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/k8s-cluster")>();
  return {
    ...actual,
    isInCluster: libs.isInCluster,
    k8sPost: libs.k8sPost,
  };
});

import { GET as consultGet } from "@/app/api/admin/consultations/route";
import { GET as costGet } from "@/app/api/admin/cost/route";
import { POST as opsPost } from "@/app/api/admin/ops/route";
import { POST as liCapPost } from "@/app/api/admin/linkedin-cap/route";
import { POST as headlampPost } from "@/app/api/admin/headlamp/token/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("consultations + cost", () => {
  it("consultations: unconfigured → empty, list, fetch-fail degrade", async () => {
    libs.isConfiguredAsync.mockResolvedValue(false);
    const j = await (
      await consultGet(new NextRequest("http://x/api/admin/consultations"))
    ).json();
    expect(j).toEqual({ consultations: [], configured: false });

    libs.isConfiguredAsync.mockResolvedValue(true);
    libs.getUpcomingConsultations.mockResolvedValue([{ id: "c" }]);
    const j2 = await (
      await consultGet(new NextRequest("http://x/api/admin/consultations"))
    ).json();
    expect(j2.consultations).toHaveLength(1);

    libs.getUpcomingConsultations.mockRejectedValue(new Error("cal down"));
    const j3 = await (
      await consultGet(new NextRequest("http://x/api/admin/consultations"))
    ).json();
    expect(j3).toEqual({
      consultations: [],
      configured: true,
      error: "Fetch failed",
    });
  });

  it("cost: summary with cache header; 502 on failure", async () => {
    libs.getCostSummary.mockResolvedValue({ total_30d: 42 });
    const res = await costGet(new NextRequest("http://x/api/admin/cost"));
    expect((await res.json()).total_30d).toBe(42);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");

    libs.getCostSummary.mockRejectedValue(new Error("d1 down"));
    const res2 = await costGet(new NextRequest("http://x/api/admin/cost"));
    expect(res2.status).toBe(502);
    expect((await res2.json()).detail).toBe("d1 down");
  });
});

describe("admin ops", () => {
  it("validates command; clear-cache; health-check; 500 on throw", async () => {
    expect(
      (await opsPost(post("http://x/api/admin/ops", {}))).status
    ).toBe(400);
    expect(
      (await opsPost(post("http://x/api/admin/ops", { command: "nuke" })))
        .status
    ).toBe(400);

    const j = await (
      await opsPost(
        post("http://x/api/admin/ops", { command: "clear-cache", target: "blog:" })
      )
    ).json();
    expect(j.result.cleared).toBe("blog:");
    expect(libs.invalidateCache).toHaveBeenCalledWith("blog:");

    const j2 = await (
      await opsPost(post("http://x/api/admin/ops", { command: "clear-cache" }))
    ).json();
    expect(j2.result.cleared).toBe("(all)");

    libs.getIntegrationsAsync.mockResolvedValue({
      STRIPE_SECRET_KEY: "sk",
      ESPOCRM_BASE_URL: "u",
      ESPOCRM_API_KEY: "k",
    });
    const j3 = await (
      await opsPost(post("http://x/api/admin/ops", { command: "health-check" }))
    ).json();
    expect(j3.result.checks).toEqual({
      stripe: true,
      email: true,
      slack: false,
      notion: false,
      espocrm: true,
    });

    libs.getIntegrationsAsync.mockRejectedValue(new Error("ssm down"));
    expect(
      (
        await opsPost(
          post("http://x/api/admin/ops", { command: "health-check" })
        )
      ).status
    ).toBe(500);
  });
});

describe("linkedin-cap", () => {
  const cap = (body: unknown) =>
    liCapPost(
      new Request("http://x/api/admin/linkedin-cap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  it("503s when the module loaded without LINKEDIN_ACCESS_TOKEN", async () => {
    vi.resetModules();
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    const { POST } = await import("@/app/api/admin/linkedin-cap/route");
    const res = await POST(
      new Request("http://x/api/admin/linkedin-cap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: "e1" }),
      })
    );
    expect(res.status).toBe(503);
    vi.resetModules();
  });

  it("400s without eventId; 503s without token; forwards conversion", async () => {
    expect((await cap({})).status).toBe(400);

    vi.stubGlobal("fetch", vi.fn());
    const { env } = process;
    env.LINKEDIN_ACCESS_TOKEN = "tok";
    env.LINKEDIN_CONVERSION_ID = "conv1";

    // token captured at module import — route reads env at import time
    vi.resetModules();
    const { POST: cap2 } = await import(
      "@/app/api/admin/linkedin-cap/route"
    );
    const req = (body: unknown) =>
      cap2(
        new Request("http://x/api/admin/linkedin-cap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      );

    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const j = await (
      await req({ eventId: "e1", email: "a@b", firstName: "A" })
    ).json();
    expect(j).toEqual({ success: true, eventId: "e1" });
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as { body: string }).body
    );
    expect(body.elements[0]).toMatchObject({
      conversion: "urn:lla:linkedin.com:conversion:conv1",
      eventId: "e1",
      email: "a@b",
      userData: { firstName: "A" },
    });

    // explicit conversionId overrides env
    await req({ eventId: "e2", conversionId: "conv2" });
    const body2 = JSON.parse(
      (vi.mocked(fetch).mock.calls[1][1] as { body: string }).body
    );
    expect(body2.elements[0].conversion).toContain("conv2");

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: async () => "li err",
    } as Response);
    expect((await req({ eventId: "e" })).status).toBe(500);

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect((await req({ eventId: "e" })).status).toBe(500);

    delete env.LINKEDIN_ACCESS_TOKEN;
    delete env.LINKEDIN_CONVERSION_ID;
  });
});

describe("headlamp token", () => {
  it("401s non-admin; 503 outside cluster; mints + error paths", async () => {
    apiAuth.ok = false;
    expect(
      (await headlampPost(post("http://x/api/admin/headlamp/token", {}))).status
    ).toBe(401);
    apiAuth.ok = true;

    libs.isInCluster.mockReturnValue(false);
    expect(
      (await headlampPost(post("http://x/api/admin/headlamp/token", {}))).status
    ).toBe(503);

    libs.isInCluster.mockReturnValue(true);
    libs.k8sPost.mockResolvedValue({
      ok: true,
      data: { status: { token: "jwt", expirationTimestamp: "t" } },
    });
    const j = await (
      await headlampPost(post("http://x/api/admin/headlamp/token", {}))
    ).json();
    expect(j).toEqual({ token: "jwt", expirationTimestamp: "t" });
    expect(libs.k8sPost).toHaveBeenCalledWith(
      expect.stringContaining("headlamp-admin/token"),
      expect.objectContaining({ kind: "TokenRequest" })
    );

    libs.k8sPost.mockResolvedValue({ ok: false, status: 403, error: "rbac" });
    expect(
      (await headlampPost(post("http://x/api/admin/headlamp/token", {}))).status
    ).toBe(502);

    libs.k8sPost.mockResolvedValue({ ok: false, status: 501, error: "x" });
    expect(
      (await headlampPost(post("http://x/api/admin/headlamp/token", {}))).status
    ).toBe(501);

    libs.k8sPost.mockResolvedValue({ ok: true, data: { status: {} } });
    expect(
      (await headlampPost(post("http://x/api/admin/headlamp/token", {}))).status
    ).toBe(502);
  });
});
