/**
 * Tests for POST /api/webhooks/espocrm/fanout, GET /api/admin/appflowy/status
 * and POST /api/pi-proxy.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const dispatch = vi.hoisted(() => ({ dispatchEspoEvent: vi.fn() }));
vi.mock("@/lib/espocrm-dispatch", () => dispatch);

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const appflowy = vi.hoisted(() => ({
  isAppFlowyConfigured: vi.fn(),
  listAllWorkspaces: vi.fn(),
  listWorkspaceViews: vi.fn(),
  getDocument: vi.fn(),
  extractDocText: vi.fn(),
}));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy")>();
  return {
    ...actual,
    isAppFlowyConfigured: appflowy.isAppFlowyConfigured,
    listAllWorkspaces: appflowy.listAllWorkspaces,
    listWorkspaceViews: appflowy.listWorkspaceViews,
    getDocument: appflowy.getDocument,
    extractDocText: appflowy.extractDocText,
  };
});

import { POST as fanoutPost } from "@/app/api/webhooks/espocrm/fanout/route";
import { GET as appflowyStatus } from "@/app/api/admin/appflowy/status/route";
import { POST as piProxy } from "@/app/api/pi-proxy/route";

const FANOUT = "http://localhost/api/webhooks/espocrm/fanout";
const STATUS = "http://localhost/api/admin/appflowy/status";
const PROXY = "http://localhost/api/pi-proxy";

describe("POST /api/webhooks/espocrm/fanout", () => {
  const post = (body: unknown, bearer = "queue-secret") =>
    fanoutPost(
      new NextRequest(FANOUT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ESPOCRM_QUEUE_PRODUCER_SECRET", "queue-secret");
    dispatch.dispatchEspoEvent.mockResolvedValue(undefined);
  });

  it("503s without env secret; 401s on bad/missing bearer", async () => {
    vi.unstubAllEnvs();
    expect((await post({})).status).toBe(503);

    vi.stubEnv("ESPOCRM_QUEUE_PRODUCER_SECRET", "queue-secret");
    expect((await post({}, "")).status).toBe(401);
    expect((await post({}, "wrong")).status).toBe(401);
  });

  it("400s on invalid JSON / missing entity+action", async () => {
    expect((await post("{bad")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ entity: "Contact" })).status).toBe(400);
  });

  it("dispatches and reports the record count", async () => {
    const j = await (
      await post({ entity: "Case", action: "update", records: [{ id: "1" }] })
    ).json();
    expect(j).toEqual({ ok: true, dispatched: 1 });
    expect(dispatch.dispatchEspoEvent).toHaveBeenCalledWith("Case", "update", [
      { id: "1" },
    ]);

    const j2 = await (
      await post({ entity: "Lead", action: "create", records: "not-array" })
    ).json();
    expect(j2.dispatched).toBe(0);
  });
});

describe("GET /api/admin/appflowy/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    appflowy.listAllWorkspaces.mockResolvedValue([
      { workspace_id: "ws1", workspace_name: "Cloudless" },
    ]);
    appflowy.listWorkspaceViews.mockResolvedValue([]);
    appflowy.getDocument.mockResolvedValue({});
    appflowy.extractDocText.mockResolvedValue("doc text");
  });

  it("401s non-admin", async () => {
    apiAuth.ok = false;
    expect((await appflowyStatus(new NextRequest(STATUS))).status).toBe(401);
  });

  it("200s unauthenticated when not configured", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    const j = await (await appflowyStatus(new NextRequest(STATUS))).json();
    expect(j.authenticated).toBe(false);
    expect(j.databases).toEqual([]);
  });

  it("reports per-database status with samples; skips bad docs", async () => {
    appflowy.listWorkspaceViews.mockResolvedValue([
      { view_id: "v1", name: "Doc A", type: 0, last_edited_time: "t" },
      { view_id: "v2", name: "Doc B", type: 0, last_edited_time: "t" },
    ]);
    appflowy.getDocument.mockImplementation(async (_w: string, id: string) => {
      if (id === "v2") throw new Error("gone");
      return {};
    });
    const j = await (await appflowyStatus(new NextRequest(STATUS))).json();
    expect(j.authenticated).toBe(true);
    expect(j.botName).toBe("Cloudless");
    expect(j.databases).toHaveLength(10);
    const db = j.databases[0];
    expect(db.connected).toBe(true);
    expect(db.count).toBe(2);
    expect(db.sample).toHaveLength(1); // v2 skipped
    expect(db.sample[0].contentPreview).toBe("doc text");
  });

  it("marks databases disconnected when view listing throws", async () => {
    appflowy.listWorkspaceViews.mockRejectedValue(new Error("api down"));
    const j = await (await appflowyStatus(new NextRequest(STATUS))).json();
    expect(j.databases.every((d: { connected: boolean }) => !d.connected)).toBe(
      true
    );
    expect(j.databases[0].error).toBe("upstream-appflowy-error");
  });

  it("handles missing workspace + workspace list failure", async () => {
    appflowy.listAllWorkspaces.mockResolvedValue([]);
    const j1 = await (await appflowyStatus(new NextRequest(STATUS))).json();
    // resolveBotName succeeds (empty list → default name) but no workspaceId
    expect(j1.authenticated).toBe(true);
    expect(j1.databases[0].error).toBe("No workspace found");

    appflowy.listAllWorkspaces.mockRejectedValue(new Error("ws fail"));
    const j2 = await (await appflowyStatus(new NextRequest(STATUS))).json();
    expect(j2.authenticated).toBe(false);
  });
});

describe("POST /api/pi-proxy", () => {
  const post = (body: unknown) =>
    piProxy(
      new NextRequest(PROXY, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    apiAuth.ok = true;
    vi.stubEnv("PI_PROXY_TARGET_OMV", "http://omv.local:8080");
    vi.stubEnv("PI_PROXY_TARGET_FUNNEL", "https://funnel.example.com/path/");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("401s non-admin", async () => {
    apiAuth.ok = false;
    expect((await post({ target: "omv" })).status).toBe(401);
  });

  it("validates target, env origin, pathKey and method", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ target: "evil" })).status).toBe(403);
    expect(
      (await post({ target: "omv", pathKey: "custom/path" })).status
    ).toBe(400);
    expect((await post({ target: "omv", pathKey: 42 })).status).toBe(400);
    expect(
      (await post({ target: "omv", method: "OPTIONS" })).status
    ).toBe(400);
  });

  it("403s when env origin is missing or not http(s)", async () => {
    vi.unstubAllEnvs();
    expect((await post({ target: "omv" })).status).toBe(403);
    vi.stubEnv("PI_PROXY_TARGET_OMV", "ftp://nope");
    expect((await post({ target: "omv" })).status).toBe(403);
    vi.stubEnv("PI_PROXY_TARGET_OMV", "not a url");
    expect((await post({ target: "omv" })).status).toBe(403);
  });

  it("proxies to the env origin + fixed path, forwarding JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ healthy: true }),
    } as Response);
    const res = await post({
      target: "omv",
      pathKey: "health",
      method: "post",
      body: { ping: 1 },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ healthy: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [
      string,
      { method: string; body?: string },
    ];
    expect(url).toBe("http://omv.local:8080/api/health");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"ping":1}');
  });

  it("defaults to root path, GET, no body; nulls non-JSON upstream", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    const res = await post({ target: "funnel" });
    expect(await res.json()).toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://funnel.example.com/"
    );
  });

  it("propagates upstream status; 500s on fetch error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => null,
    } as unknown as Response);
    expect((await post({ target: "omv" })).status).toBe(503);

    vi.mocked(fetch).mockRejectedValue(new Error("network"));
    expect((await post({ target: "omv" })).status).toBe(500);
  });
});
