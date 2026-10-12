import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));

import {
  GrafanaNotConfiguredError,
  GrafanaApiError,
  isGrafanaConfigured,
  pingGrafana,
  listDatasources,
  syncPrometheusDatasource,
  prometheusQuery,
  listDashboards,
  getDashboard,
  upsertDashboard,
} from "@/lib/grafana";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  mockFetch.mockReset();
  m.getConfig.mockResolvedValue({
    GRAFANA_BASE_URL: "https://grafana.example",
    GRAFANA_API_TOKEN: "glsa_tok",
  });
});

describe("config gate", () => {
  it("throws GrafanaNotConfiguredError without a token; isGrafanaConfigured mirrors it", async () => {
    m.getConfig.mockResolvedValue({});
    await expect(listDatasources()).rejects.toBeInstanceOf(GrafanaNotConfiguredError);
    expect(await isGrafanaConfigured()).toBe(false);
    m.getConfig.mockResolvedValue({ GRAFANA_API_TOKEN: "t" });
    expect(await isGrafanaConfigured()).toBe(true);
  });

  it("defaults the base url and strips a trailing slash", async () => {
    m.getConfig.mockResolvedValue({
      GRAFANA_BASE_URL: "https://g.example/",
      GRAFANA_API_TOKEN: "t",
    });
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listDatasources();
    expect(mockFetch.mock.calls[0][0]).toBe("https://g.example/api/datasources");
    m.getConfig.mockResolvedValue({ GRAFANA_API_TOKEN: "t" });
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listDatasources();
    expect(mockFetch.mock.calls[1][0]).toBe("https://grafana.cloudless.gr/api/datasources");
  });
});

describe("pingGrafana", () => {
  it("returns res.ok and false on failure/throw", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 200 }));
    expect(await pingGrafana()).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("https://grafana.example/api/health");
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await pingGrafana()).toBe(false);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    expect(await pingGrafana()).toBe(false);
    m.getConfig.mockResolvedValue({});
    expect(await pingGrafana()).toBe(false);
  });
});

describe("datasource + dashboard calls", () => {
  it("sends the bearer token and JSON headers", async () => {
    mockFetch.mockResolvedValueOnce(okJson([{ uid: "prom" }]));
    const out = await listDatasources();
    expect(out).toHaveLength(1);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer glsa_tok");
    expect(headers.Accept).toBe("application/json");
  });

  it("wraps non-ok responses in GrafanaApiError", async () => {
    mockFetch.mockResolvedValueOnce(new Response("boom", { status: 502 }));
    await expect(listDatasources()).rejects.toMatchObject({
      name: "GrafanaApiError",
      status: 502,
      message: expect.stringContaining("boom"),
    });
  });

  it("syncPrometheusDatasource posts an optional url body", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uid: "prom" }));
    await syncPrometheusDatasource("http://prom:9090");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ url: "http://prom:9090" });
    mockFetch.mockResolvedValueOnce(okJson({ uid: "prom" }));
    await syncPrometheusDatasource();
    expect(mockFetch.mock.calls[1][1].body).toBeUndefined();
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 404 }));
    await expect(syncPrometheusDatasource()).rejects.toBeInstanceOf(GrafanaApiError);
  });

  it("prometheusQuery encodes the query", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ data: 1 }));
    expect(await prometheusQuery("up{job='x'}")).toEqual({ data: 1 });
    expect(mockFetch.mock.calls[0][0]).toContain("query=up%7Bjob%3D'x'%7D");
    mockFetch.mockResolvedValueOnce(new Response("e", { status: 500 }));
    await expect(prometheusQuery("up")).rejects.toBeInstanceOf(GrafanaApiError);
  });

  it("listDashboards sets type/limit and optional query", async () => {
    mockFetch.mockResolvedValueOnce(okJson([{ uid: "d1" }]));
    await listDashboards("seo");
    expect(mockFetch.mock.calls[0][0]).toContain("type=dash-db");
    expect(mockFetch.mock.calls[0][0]).toContain("query=seo");
    mockFetch.mockResolvedValueOnce(okJson([]));
    await listDashboards();
    expect(mockFetch.mock.calls[1][0]).not.toContain("query=");
    mockFetch.mockResolvedValueOnce(new Response("e", { status: 500 }));
    await expect(listDashboards()).rejects.toBeInstanceOf(GrafanaApiError);
  });

  it("getDashboard encodes the uid", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ dashboard: {}, meta: {} }));
    await getDashboard("a/b c");
    expect(mockFetch.mock.calls[0][0]).toContain("dashboards/uid/a%2Fb%20c");
    mockFetch.mockResolvedValueOnce(new Response("e", { status: 404 }));
    await expect(getDashboard("x")).rejects.toBeInstanceOf(GrafanaApiError);
  });

  it("upsertDashboard posts overwrite+message defaults and options", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ uid: "u1", url: "/d/u1", version: 3 }));
    const out = await upsertDashboard({ title: "t" });
    expect(out.uid).toBe("u1");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.overwrite).toBe(true);
    expect(body.message).toContain("/api/admin/grafana");
    mockFetch.mockResolvedValueOnce(okJson({ uid: "u2", url: "", version: 1 }));
    await upsertDashboard({ uid: "u2" }, { folderUid: "f", overwrite: false, message: "m" });
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body2).toMatchObject({ folderUid: "f", overwrite: false, message: "m" });
    mockFetch.mockResolvedValueOnce(new Response("e", { status: 409 }));
    await expect(upsertDashboard({})).rejects.toBeInstanceOf(GrafanaApiError);
  });
});
