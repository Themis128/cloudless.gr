/**
 * Tests for /api/admin/grafana/{datasources,prometheus} and
 * /api/admin/gsc/{crawl-stats,index,inspect} (+ shared gsc/_helpers).
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

const grafana = vi.hoisted(() => ({
  listDatasources: vi.fn(),
  syncPrometheusDatasource: vi.fn(),
  prometheusQuery: vi.fn(),
}));
vi.mock("@/lib/grafana", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/grafana")>();
  return {
    ...actual,
    listDatasources: grafana.listDatasources,
    syncPrometheusDatasource: grafana.syncPrometheusDatasource,
    prometheusQuery: grafana.prometheusQuery,
  };
});

const ssm = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ssm);

const gsc = vi.hoisted(() => ({
  getCrawlStats: vi.fn(),
  requestIndexing: vi.fn(),
  getIndexingStatus: vi.fn(),
  inspectUrl: vi.fn(),
}));
vi.mock("@/lib/gsc-admin", () => gsc);

import {
  GET as dsGet,
  POST as dsPost,
} from "@/app/api/admin/grafana/datasources/route";
import { POST as promPost } from "@/app/api/admin/grafana/prometheus/route";
import { GET as crawlGet } from "@/app/api/admin/gsc/crawl-stats/route";
import {
  POST as indexPost,
  GET as indexGet,
} from "@/app/api/admin/gsc/index/route";
import { POST as inspectPost } from "@/app/api/admin/gsc/inspect/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const G = "http://localhost/api/admin/grafana";
const S = "http://localhost/api/admin/gsc";

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
  ssm.getConfig.mockResolvedValue({});
});

describe("grafana datasources", () => {
  it("GET: lists, 503 NotConfigured, 502 ApiError, 500 other", async () => {
    apiAuth.ok = false;
    expect((await dsGet(new NextRequest(`${G}/datasources`))).status).toBe(401);
    apiAuth.ok = true;

    grafana.listDatasources.mockResolvedValue([{ name: "prom" }]);
    const j = await (await dsGet(new NextRequest(`${G}/datasources`))).json();
    expect(j.datasources).toEqual([{ name: "prom" }]);

    const { GrafanaNotConfiguredError, GrafanaApiError } = await import(
      "@/lib/grafana"
    );
    grafana.listDatasources.mockRejectedValue(
      new GrafanaNotConfiguredError()
    );
    expect((await dsGet(new NextRequest(`${G}/datasources`))).status).toBe(503);

    grafana.listDatasources.mockRejectedValue(new GrafanaApiError(502, "api err"));
    expect((await dsGet(new NextRequest(`${G}/datasources`))).status).toBe(502);

    grafana.listDatasources.mockRejectedValue(new Error("other"));
    expect((await dsGet(new NextRequest(`${G}/datasources`))).status).toBe(500);
  });

  it("POST: uses config/body URL, syncs, error ladder", async () => {
    ssm.getConfig.mockResolvedValue({ PROMETHEUS_URL: "http://cfg:9090" });
    grafana.syncPrometheusDatasource.mockResolvedValue({ name: "prom" });

    const j = await (await dsPost(post(`${G}/datasources`, {}))).json();
    expect(j.ok).toBe(true);
    expect(grafana.syncPrometheusDatasource).toHaveBeenCalledWith(
      "http://cfg:9090"
    );

    // body overrides config; invalid JSON falls back to config
    await dsPost(post(`${G}/datasources`, { prometheusUrl: "http://body:1" }));
    expect(grafana.syncPrometheusDatasource).toHaveBeenLastCalledWith(
      "http://body:1"
    );
    await dsPost(post(`${G}/datasources`, "{bad"));
    expect(grafana.syncPrometheusDatasource).toHaveBeenLastCalledWith(
      "http://cfg:9090"
    );

    // no config → default in-cluster URL
    ssm.getConfig.mockResolvedValue({});
    await dsPost(post(`${G}/datasources`, {}));
    expect(grafana.syncPrometheusDatasource).toHaveBeenLastCalledWith(
      expect.stringContaining("monitoring.svc.cluster.local:9090")
    );

    const { GrafanaNotConfiguredError, GrafanaApiError } = await import(
      "@/lib/grafana"
    );
    grafana.syncPrometheusDatasource.mockRejectedValue(
      new GrafanaNotConfiguredError()
    );
    expect((await dsPost(post(`${G}/datasources`, {}))).status).toBe(503);
    grafana.syncPrometheusDatasource.mockRejectedValue(
      new GrafanaApiError(502, "api err")
    );
    expect((await dsPost(post(`${G}/datasources`, {}))).status).toBe(502);
    grafana.syncPrometheusDatasource.mockRejectedValue(new Error("x"));
    expect((await dsPost(post(`${G}/datasources`, {}))).status).toBe(500);
  });
});

describe("grafana prometheus", () => {
  it("validates query; proxies; error ladder", async () => {
    expect((await promPost(post(`${G}/prometheus`, "{bad"))).status).toBe(400);
    expect((await promPost(post(`${G}/prometheus`, {}))).status).toBe(400);
    expect(
      (await promPost(post(`${G}/prometheus`, { query: "  " }))).status
    ).toBe(400);

    grafana.prometheusQuery.mockResolvedValue([{ value: 1 }]);
    const j = await (
      await promPost(post(`${G}/prometheus`, { query: "up" }))
    ).json();
    expect(j.results).toEqual([{ value: 1 }]);

    const { GrafanaNotConfiguredError, GrafanaApiError } = await import(
      "@/lib/grafana"
    );
    grafana.prometheusQuery.mockRejectedValue(new GrafanaNotConfiguredError());
    expect(
      (await promPost(post(`${G}/prometheus`, { query: "up" }))).status
    ).toBe(503);
    grafana.prometheusQuery.mockRejectedValue(new GrafanaApiError(502, "api"));
    expect(
      (await promPost(post(`${G}/prometheus`, { query: "up" }))).status
    ).toBe(502);
    grafana.prometheusQuery.mockRejectedValue("weird");
    const j2 = await (
      await promPost(post(`${G}/prometheus`, { query: "up" }))
    ).json();
    expect(j2.error).toBe("Query failed");
  });
});

describe("gsc routes (crawl-stats, index, inspect)", () => {
  it("crawl-stats GET: 401, success, 502 on op failure", async () => {
    apiAuth.ok = false;
    expect((await crawlGet(new NextRequest(`${S}/crawl-stats`))).status).toBe(
      401
    );
    apiAuth.ok = true;

    gsc.getCrawlStats.mockResolvedValue({ samples: [{ category: "404" }] });
    const j = await (await crawlGet(new NextRequest(`${S}/crawl-stats`))).json();
    expect(j.samples).toHaveLength(1);

    gsc.getCrawlStats.mockRejectedValue(new Error("gsc down"));
    expect((await crawlGet(new NextRequest(`${S}/crawl-stats`))).status).toBe(
      502
    );
  });

  it("index POST: bad JSON, missing url, success, 502", async () => {
    expect((await indexPost(post(`${S}/index`, "{bad"))).status).toBe(400);
    expect((await indexPost(post(`${S}/index`, {}))).status).toBe(400);
    expect((await indexPost(post(`${S}/index`, { url: " " }))).status).toBe(
      400
    );

    gsc.requestIndexing.mockResolvedValue({ done: true });
    const j = await (
      await indexPost(post(`${S}/index`, { url: " https://x/p " }))
    ).json();
    expect(j.done).toBe(true);
    expect(gsc.requestIndexing).toHaveBeenCalledWith("https://x/p");

    gsc.requestIndexing.mockRejectedValue(new Error("quota"));
    expect(
      (await indexPost(post(`${S}/index`, { url: "https://x/p" }))).status
    ).toBe(502);
  });

  it("index GET: url param required, status lookup", async () => {
    expect((await indexGet(new NextRequest(`${S}/index`))).status).toBe(400);

    gsc.getIndexingStatus.mockResolvedValue({ notified: "2026-01-01" });
    const j = await (
      await indexGet(new NextRequest(`${S}/index?url=https%3A%2F%2Fx%2Fp`))
    ).json();
    expect(j.notified).toBe("2026-01-01");
  });

  it("inspect POST: validation + inspect proxy", async () => {
    expect((await inspectPost(post(`${S}/inspect`, "{bad"))).status).toBe(400);
    expect((await inspectPost(post(`${S}/inspect`, { url: "" }))).status).toBe(
      400
    );

    gsc.inspectUrl.mockResolvedValue({ verdict: "PASS" });
    const j = await (
      await inspectPost(post(`${S}/inspect`, { url: "https://x/p" }))
    ).json();
    expect(j.verdict).toBe("PASS");

    gsc.inspectUrl.mockRejectedValue(new Error("gsc err"));
    expect(
      (await inspectPost(post(`${S}/inspect`, { url: "https://x/p" }))).status
    ).toBe(502);
  });
});
