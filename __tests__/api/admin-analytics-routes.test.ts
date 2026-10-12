/**
 * Tests for /api/admin/analytics/{datalake,engine,lake-catalog,lake-parquet,
 * roi,workspaces,workspaces/[id]}.
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
  getDatalakeDashboard: vi.fn(),
  isAnalyticsEngineQueryConfigured: vi.fn(),
  queryAnalyticsEngineSql: vi.fn(),
  defaultEdgeLatencySql: vi.fn(() => "SELECT 1"),
  getRoiFromLake: vi.fn(),
  aggregateAllWorkspaceAnalytics: vi.fn(),
  aggregateWorkspaceAnalytics: vi.fn(),
  getDataLakeBucketFromEnv: vi.fn(),
  getConfig: vi.fn(),
}));
vi.mock("@/lib/datalake-r2", () => ({
  getDatalakeDashboard: libs.getDatalakeDashboard,
}));
vi.mock("@/lib/analytics-engine-query", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/analytics-engine-query")>();
  return {
    ...actual,
    isAnalyticsEngineQueryConfigured: libs.isAnalyticsEngineQueryConfigured,
    queryAnalyticsEngineSql: libs.queryAnalyticsEngineSql,
    defaultEdgeLatencySql: libs.defaultEdgeLatencySql,
  };
});
vi.mock("@/lib/datalake-serve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/datalake-serve")>();
  return { ...actual, getRoiFromLake: libs.getRoiFromLake };
});
vi.mock("@/lib/workspace-analytics", () => ({
  aggregateAllWorkspaceAnalytics: libs.aggregateAllWorkspaceAnalytics,
  aggregateWorkspaceAnalytics: libs.aggregateWorkspaceAnalytics,
}));
vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: libs.getDataLakeBucketFromEnv,
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: libs.getConfig }));

import { GET as datalakeGet } from "@/app/api/admin/analytics/datalake/route";
import { GET as engineGet } from "@/app/api/admin/analytics/engine/route";
import { GET as catalogGet } from "@/app/api/admin/analytics/lake-catalog/route";
import { GET as parquetGet } from "@/app/api/admin/analytics/lake-parquet/route";
import { GET as roiGet } from "@/app/api/admin/analytics/roi/route";
import { GET as workspacesGet } from "@/app/api/admin/analytics/workspaces/route";
import { GET as workspaceGet } from "@/app/api/admin/analytics/workspaces/[id]/route";

const A = "http://localhost/api/admin/analytics";

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("datalake + roi + workspaces proxies", () => {
  it("datalake: forwards refresh flag + payload", async () => {
    libs.getDatalakeDashboard.mockResolvedValue({ sections: {} });
    const j = await (
      await datalakeGet(new NextRequest(`${A}/datalake?refresh=1`))
    ).json();
    expect(j).toEqual({ sections: {} });
    expect(libs.getDatalakeDashboard).toHaveBeenCalledWith({ refresh: true });

    await datalakeGet(new NextRequest(`${A}/datalake`));
    expect(libs.getDatalakeDashboard).toHaveBeenLastCalledWith({
      refresh: false,
    });
  });

  it("roi: days param + 500 on failure", async () => {
    libs.getRoiFromLake.mockResolvedValue({ linkedin: { configured: true } });
    const j = await (await roiGet(new NextRequest(`${A}/roi?days=7`))).json();
    expect(j.linkedin.configured).toBe(true);
    expect(libs.getRoiFromLake).toHaveBeenCalledWith(7);

    libs.getRoiFromLake.mockRejectedValue(new Error("lake down"));
    expect((await roiGet(new NextRequest(`${A}/roi`))).status).toBe(500);
  });

  it("workspaces: aggregate all + by id; 502 on failure; missing id 400", async () => {
    libs.aggregateAllWorkspaceAnalytics.mockResolvedValue({ workspaces: [] });
    const j = await (
      await workspacesGet(new NextRequest(`${A}/workspaces`))
    ).json();
    expect(j.workspaces).toEqual([]);

    libs.aggregateAllWorkspaceAnalytics.mockRejectedValue(new Error("x"));
    expect(
      (await workspacesGet(new NextRequest(`${A}/workspaces`))).status
    ).toBe(502);

    libs.aggregateWorkspaceAnalytics.mockResolvedValue({ id: "w1" });
    const res = await workspaceGet(new NextRequest(`${A}/workspaces/w1`), {
      params: Promise.resolve({ id: "w1" }),
    });
    expect((await res.json()).id).toBe("w1");
    expect(libs.aggregateWorkspaceAnalytics).toHaveBeenCalledWith("w1");

    libs.aggregateWorkspaceAnalytics.mockRejectedValue(new Error("x"));
    expect(
      (
        await workspaceGet(new NextRequest(`${A}/workspaces/w1`), {
          params: Promise.resolve({ id: "w1" }),
        })
      ).status
    ).toBe(502);
  });
});

describe("analytics engine SQL", () => {
  it("503s unconfigured; 401 non-admin", async () => {
    apiAuth.ok = false;
    expect((await engineGet(new NextRequest(`${A}/engine`))).status).toBe(401);
    apiAuth.ok = true;

    libs.isAnalyticsEngineQueryConfigured.mockReturnValue(false);
    expect((await engineGet(new NextRequest(`${A}/engine`))).status).toBe(503);
  });

  it("runs SELECT queries, defaults SQL, rejects non-SELECT, 502 on failure", async () => {
    libs.isAnalyticsEngineQueryConfigured.mockReturnValue(true);
    libs.queryAnalyticsEngineSql.mockResolvedValue({ rows: [{ n: 1 }] });

    const j = await (await engineGet(new NextRequest(`${A}/engine`))).json();
    expect(j.count).toBe(1);
    expect(libs.queryAnalyticsEngineSql).toHaveBeenCalledWith("SELECT 1");

    await engineGet(
      new NextRequest(`${A}/engine?sql=${encodeURIComponent(" select x ")}`)
    );
    expect(libs.queryAnalyticsEngineSql).toHaveBeenLastCalledWith("select x");

    expect(
      (
        await engineGet(
          new NextRequest(
            `${A}/engine?sql=${encodeURIComponent("drop table t")}`
          )
        )
      ).status
    ).toBe(400);

    libs.queryAnalyticsEngineSql.mockRejectedValue(new Error("engine err"));
    const res = await engineGet(new NextRequest(`${A}/engine`));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("engine err");
  });
});

describe("lake catalog + parquet", () => {
  it("catalog returns the allowlist with caching header", async () => {
    const res = await catalogGet(new NextRequest(`${A}/lake-catalog`));
    const j = await res.json();
    expect(Array.isArray(j.catalog)).toBe(true);
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });

  it("parquet: unknown id 400, unbound 503, missing 404, streams bytes", async () => {
    expect(
      (await parquetGet(new NextRequest(`${A}/lake-parquet?id=bogus`))).status
    ).toBe(400);
    expect(
      (await parquetGet(new NextRequest(`${A}/lake-parquet`))).status
    ).toBe(400);

    libs.getDataLakeBucketFromEnv.mockReturnValue(null);
    expect(
      (await parquetGet(new NextRequest(`${A}/lake-parquet?id=gsc`))).status
    ).toBe(503);

    const get = vi.fn();
    libs.getDataLakeBucketFromEnv.mockReturnValue({ get });
    get.mockResolvedValue(null);
    const res404 = await parquetGet(new NextRequest(`${A}/lake-parquet?id=gsc`));
    expect(res404.status).toBe(404);
    expect(get).toHaveBeenCalledWith(
      "lake/gsc-keywords/keywords.parquet"
    );

    get.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const res = await parquetGet(new NextRequest(`${A}/lake-parquet?id=gsc`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("X-Lake-Path")).toBe(
      "lake/gsc-keywords/keywords.parquet"
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });
});

import { GET as summaryGet } from "@/app/api/admin/analytics/route";
import { IntegrationNotConfiguredError } from "@/lib/integrations";

describe("GET /api/admin/analytics — consolidated catch tails", () => {
  it("maps IntegrationNotConfiguredError via mapIntegrationError", async () => {
    libs.getConfig.mockRejectedValue(new IntegrationNotConfiguredError(["STRIPE_SECRET_KEY"]));
    const res = await summaryGet(
      new NextRequest("http://localhost/api/admin/analytics")
    );
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe("integration_not_configured");
  });

  it("generic error → 500", async () => {
    libs.getConfig.mockRejectedValue(new Error("ssm down"));
    const res = await summaryGet(
      new NextRequest("http://localhost/api/admin/analytics")
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to fetch analytics data");
  });
});
