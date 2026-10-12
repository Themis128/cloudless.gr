/**
 * Tests for /api/admin/grafana/{health,dashboards}, /api/admin/audits and
 * /api/admin/auth-audit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true, user: { email: "a@b" } }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: apiAuth.user }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const grafana = vi.hoisted(() => ({
  isGrafanaConfigured: vi.fn(),
  pingGrafana: vi.fn(),
  listDashboards: vi.fn(),
}));
vi.mock("@/lib/grafana", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/grafana")>();
  return {
    ...actual,
    isGrafanaConfigured: grafana.isGrafanaConfigured,
    pingGrafana: grafana.pingGrafana,
    listDashboards: grafana.listDashboards,
  };
});

const authD1 = vi.hoisted(() => ({ getAuthDbFromEnv: vi.fn() }));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return { ...actual, getAuthDbFromEnv: authD1.getAuthDbFromEnv };
});

const audit = vi.hoisted(() => ({
  queryAuditLog: vi.fn(),
  getAuditLogCount: vi.fn(),
}));
vi.mock("@/lib/auth-audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-audit")>();
  return { ...actual, ...audit };
});

import { GET as healthGet } from "@/app/api/admin/grafana/health/route";
import { GET as dashboardsGet } from "@/app/api/admin/grafana/dashboards/route";
import { POST as auditsPost } from "@/app/api/admin/audits/route";
import { GET as authAuditGet } from "@/app/api/admin/auth-audit/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("grafana health + dashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
  });

  it("health: 401, reports configured/healthy", async () => {
    apiAuth.ok = false;
    expect(
      (await healthGet(new NextRequest("http://x/api/admin/grafana/health")))
        .status
    ).toBe(401);
    apiAuth.ok = true;

    grafana.isGrafanaConfigured.mockResolvedValue(false);
    const j = await (
      await healthGet(new NextRequest("http://x/api/admin/grafana/health"))
    ).json();
    expect(j).toEqual({ configured: false, healthy: false });
    expect(grafana.pingGrafana).not.toHaveBeenCalled();

    grafana.isGrafanaConfigured.mockResolvedValue(true);
    grafana.pingGrafana.mockResolvedValue(true);
    const res = await healthGet(new NextRequest("http://x/api/admin/grafana/health"));
    expect(await res.json()).toEqual({ configured: true, healthy: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("dashboards: unconfigured→empty, list, NotConfigured 503, upstream 502", async () => {
    grafana.isGrafanaConfigured.mockResolvedValue(false);
    const j = await (
      await dashboardsGet(new NextRequest("http://x/api/admin/grafana/dashboards"))
    ).json();
    expect(j).toEqual({ dashboards: [], configured: false });

    grafana.isGrafanaConfigured.mockResolvedValue(true);
    grafana.listDashboards.mockResolvedValue([{ uid: "d1" }]);
    const j2 = await (
      await dashboardsGet(new NextRequest("http://x/api/admin/grafana/dashboards"))
    ).json();
    expect(j2.dashboards).toEqual([{ uid: "d1" }]);

    const { GrafanaNotConfiguredError } = await import("@/lib/grafana");
    grafana.listDashboards.mockRejectedValue(new GrafanaNotConfiguredError());
    expect(
      (
        await dashboardsGet(
          new NextRequest("http://x/api/admin/grafana/dashboards")
        )
      ).status
    ).toBe(503);

    grafana.listDashboards.mockRejectedValue(new Error("upstream"));
    const res = await dashboardsGet(
      new NextRequest("http://x/api/admin/grafana/dashboards")
    );
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toBe("upstream");
  });
});

describe("POST /api/admin/audits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    vi.stubEnv("GITHUB_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("401s non-admin; 503s without GITHUB_TOKEN", async () => {
    apiAuth.ok = false;
    expect((await auditsPost(post("http://x/api/admin/audits", {}))).status).toBe(401);
    apiAuth.ok = true;

    vi.unstubAllEnvs();
    expect((await auditsPost(post("http://x/api/admin/audits", {}))).status).toBe(503);
  });

  it("dispatches workflow with branch, defaults to main", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const j = await (
      await auditsPost(post("http://x/api/admin/audits", { branch: "dev" }))
    ).json();
    expect(j.success).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toContain(
      "repos/Themis128/cloudless.gr/actions/workflows/audits-aggregator.yml/dispatches"
    );
    expect(JSON.parse(init.body)).toEqual({ ref: "dev" });

    await auditsPost(post("http://x/api/admin/audits", {}));
    expect(
      JSON.parse((vi.mocked(fetch).mock.calls[1][1] as { body: string }).body)
    ).toEqual({ ref: "main" });
  });

  it("propagates dispatch failure status; 500s on fetch error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    } as Response);
    const res = await auditsPost(post("http://x/api/admin/audits", {}));
    expect(res.status).toBe(403);
    expect((await res.json()).detail).toBe("forbidden");

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect((await auditsPost(post("http://x/api/admin/audits", {}))).status).toBe(
      500
    );
  });
});

describe("GET /api/admin/auth-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    apiAuth.user = { email: "admin@x" };
    authD1.getAuthDbFromEnv.mockReturnValue({ fake: true });
    audit.queryAuditLog.mockResolvedValue([{ id: 1 }]);
    audit.getAuditLogCount.mockResolvedValue(42);
  });

  it("401s non-admin; 503s without db", async () => {
    apiAuth.ok = false;
    expect(
      (await authAuditGet(new NextRequest("http://x/api/admin/auth-audit")))
        .status
    ).toBe(401);
    apiAuth.ok = true;

    authD1.getAuthDbFromEnv.mockReturnValue(null);
    expect(
      (await authAuditGet(new NextRequest("http://x/api/admin/auth-audit")))
        .status
    ).toBe(503);
  });

  it("forwards filters + capped limit to queryAuditLog", async () => {
    const j = await (
      await authAuditGet(
        new NextRequest(
          "http://x/api/admin/auth-audit?action=login&adminUserId=a&targetUserId=t&startDate=1&endDate=2&limit=500&offset=10"
        )
      )
    ).json();
    expect(j).toEqual({ entries: [{ id: 1 }], total: 1, admin: "admin@x" });
    expect(audit.queryAuditLog).toHaveBeenCalledWith(expect.anything(), {
      action: "login",
      adminUserId: "a",
      targetUserId: "t",
      startDate: 1,
      endDate: 2,
      limit: 100,
      offset: 10,
    });
  });

  it("count=true returns the count only", async () => {
    const j = await (
      await authAuditGet(
        new NextRequest("http://x/api/admin/auth-audit?count=true&action=login")
      )
    ).json();
    expect(j).toEqual({ count: 42, admin: "admin@x" });
    expect(audit.queryAuditLog).not.toHaveBeenCalled();
  });
});
