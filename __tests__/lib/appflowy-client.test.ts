import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Real-code tests for src/lib/appflowy.ts — the AppFlowy Cloud HTTP client.
 *
 * Fakes only at the boundaries: `@/lib/ssm-config` getConfig and global fetch.
 * The full client logic (GoTrue token caching, HS256 service-JWT signing,
 * folder flattening, collab-string extraction, fallbacks, error classes)
 * executes for real.
 */

const getConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig }));

const BASE = "https://appflowy.test";
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

type Mod = typeof import("@/lib/appflowy");

async function load(cfg: Record<string, string>): Promise<Mod> {
  vi.resetModules();
  getConfig.mockResolvedValue(cfg);
  return import("@/lib/appflowy");
}

const USER_CFG = { APPFLOWY_API_URL: BASE, APPFLOWY_EMAIL: "u@x.co", APPFLOWY_PASSWORD: "pw" };
const JWT_CFG = { APPFLOWY_API_URL: BASE, APPFLOWY_JWT_SECRET: "jwt-secret" };

function tokenOk(token = "tok-1") {
  return jsonRes({ access_token: token, expires_in: 3600 });
}

function workspaceBody(n = 2) {
  return {
    data: Array.from({ length: n }, (_, i) => ({
      workspace_id: `w${i}`,
      workspace_name: `W${i}`,
      owner_uid: i,
      member_count: 1,
      created_at: "2026",
    })),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  getConfig.mockReset();
});

describe("config + health", () => {
  it("isAppFlowyConfigured is false without base URL or credentials", async () => {
    const m = await load({});
    expect(await m.isAppFlowyConfigured()).toBe(false);
    await expect(m.listAllUsers()).resolves.toEqual([]);
    expect(m.AppFlowyNotConfiguredError).toBeDefined();
  });

  it("isAppFlowyConfigured true with user creds or jwt secret", async () => {
    expect(await (await load(USER_CFG)).isAppFlowyConfigured()).toBe(true);
    expect(await (await load(JWT_CFG)).isAppFlowyConfigured()).toBe(true);
  });

  it("pingAppFlowyHealth hits /api/health unauthenticated and degrades on errors", async () => {
    const m = await load(USER_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({ ok: true }));
    expect(await m.pingAppFlowyHealth()).toBe(true);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe(`${BASE}/api/health`);
    mockFetch.mockResolvedValueOnce(jsonRes("x", 503));
    expect(await m.pingAppFlowyHealth()).toBe(false);
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await m.pingAppFlowyHealth()).toBe(false);
    expect(await (await load({})).pingAppFlowyHealth()).toBe(false);
  });

  it("getAppFlowySummary reports unconfigured without fetching", async () => {
    const m = await load({});
    expect(await m.getAppFlowySummary()).toEqual({
      configured: false,
      healthy: false,
      workspaceCount: 0,
      userCount: 0,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("auth: GoTrue user token + service JWT", () => {
  it("password grant goes to /gotrue/token?grant_type=password and caches the token", async () => {
    const m = await load(USER_CFG);
    mockFetch
      .mockResolvedValueOnce(tokenOk("tok-a"))
      .mockResolvedValueOnce(jsonRes({ data: [] }))
      .mockResolvedValueOnce(jsonRes({ data: [] }));
    await m.listAllUsers();
    await m.listAllUsers(); // second call reuses the cached token

    const tokenCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/gotrue/token"));
    expect(tokenCalls).toHaveLength(1);
    expect(String(tokenCalls[0]![0])).toBe(`${BASE}/gotrue/token?grant_type=password`);
    const init = tokenCalls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ email: "u@x.co", password: "pw" });
    // /api/* calls carry the user token
    const apiCall = mockFetch.mock.calls.find((c) => String(c[0]).includes("/api/admin/user"));
    expect((apiCall![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-a" });
  });

  it("GoTrue error becomes AppFlowyApiError", async () => {
    const m = await load(USER_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes("bad grant", 400));
    await expect(m.listAllUsers()).rejects.toThrow(/AppFlowy API error 400/);
  });

  it("GoTrue response without access_token throws", async () => {
    const m = await load(USER_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({}));
    await expect(m.listAllUsers()).rejects.toThrow(/missing access_token/);
  });

  it("service JWT path signs HS256 with supabase_admin role when no user creds", async () => {
    const m = await load(JWT_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({ data: [] }));
    await m.listAllUsers();
    const auth = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    const [head, body, sig] = auth.Authorization.replace("Bearer ", "").split(".");
    const dec = (s: string) =>
      JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    expect(dec(head).alg).toBe("HS256");
    expect(dec(body).role).toBe("supabase_admin");
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("workspaces / users / views", () => {
  it("listAllWorkspaces uses the user API then caches for 60s", async () => {
    const m = await load(USER_CFG);
    mockFetch.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(jsonRes(workspaceBody(3)));
    const ws = await m.listAllWorkspaces();
    expect(ws).toHaveLength(3);
    mockFetch.mockClear();
    expect(await m.listAllWorkspaces()).toHaveLength(3); // cache hit
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("listAllWorkspaces falls back to /admin/workspace when user path 404s", async () => {
    const m = await load(JWT_CFG);
    mockFetch
      .mockResolvedValueOnce(jsonRes("nf", 404))
      .mockResolvedValueOnce(jsonRes(workspaceBody(1)));
    expect(await m.listAllWorkspaces()).toHaveLength(1);
    expect(String(mockFetch.mock.calls[1]![0])).toContain("/api/admin/workspace");
  });

  it("listAllViewsDeep flattens nested folder trees, dedupes, and caches", async () => {
    const m = await load(USER_CFG);
    const tree = {
      view: { view_id: "root", name: "Root", layout: 1 },
      children: [
        { view_id: "v1", name: "Doc A" },
        {
          view_id: "v2",
          name: "Folder",
          has_children: true,
          children: [{ view_id: "v3", name: "Deep" }],
        },
        { view_id: "v1", name: "Doc A" },
      ],
    };
    mockFetch.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(jsonRes({ data: tree }));
    const views = await m.listAllViewsDeep("w1");
    expect(views.map((v) => v.view_id).sort()).toEqual(["root", "v1", "v2", "v3"]);
    expect(views.find((v) => v.view_id === "v2")!.type).toBe("folder");
    expect(views.find((v) => v.view_id === "v1")!.type).toBe("document");
    mockFetch.mockClear();
    await m.listAllViewsDeep("w1"); // cached
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("listAllViewsDeep treats fresh-workspace 404 as empty and falls back to admin on other errors", async () => {
    const m = await load(JWT_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes("nf", 404));
    expect(await m.listAllViewsDeep("w-fresh")).toEqual([]);
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(jsonRes("boom", 500))
      .mockResolvedValueOnce(jsonRes({ data: [{ view_id: "a", name: "A" }] }));
    expect(await m.listAllViewsDeep("w2")).toHaveLength(1);
    expect(String(mockFetch.mock.calls[1]![0])).toContain("/api/admin/workspace/w2/views");
  });

  it("searchDocuments filters by name and returns [] unconfigured", async () => {
    const m = await load(USER_CFG);
    expect(await m.searchDocuments("w", "  ")).toEqual([]);
    mockFetch.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(
      jsonRes({
        data: {
          view: { view_id: "r", name: "R" },
          children: [
            { view_id: "x", name: "Guide A" },
            { view_id: "y", name: "Other" },
          ],
        },
      })
    );
    const hits = await m.searchDocuments("w-s", "guide");
    expect(hits.map((v) => v.view_id)).toEqual(["x"]);
  });

  it("getWorkspaceFolder returns the tree, null on 404, and rethrows real errors", async () => {
    const m = await load(JWT_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({ data: { view_id: "root", name: "R", layout: 1 } }));
    expect((await m.getWorkspaceFolder("w"))?.view_id).toBe("root");
    mockFetch.mockResolvedValueOnce(jsonRes("nf", 404));
    expect(await m.getWorkspaceFolder("w")).toBeNull();
    mockFetch.mockResolvedValueOnce(jsonRes("err", 500));
    await expect(m.getWorkspaceFolder("w")).rejects.toThrow(/500/);
  });
});

describe("documents + collab extraction", () => {
  it("getDocument extracts CMS fields from encoded_collab bytes", async () => {
    const m = await load(USER_CFG);
    // CRDT dump shape: **Key**: value' — the value runs until a ' terminator.
    const collab = Buffer.from(
      "\x00binary**Name**: Cloud Guide'junk**Summary**: A short sum'pad",
      "latin1"
    );
    mockFetch
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(
        jsonRes({
          data: { view: { view_id: "v", name: "V" }, data: { encoded_collab: Array.from(collab) } },
        })
      );
    const doc = (await m.getDocument("w", "v")) as { text: string };
    expect(doc.text).toContain("**Name**: Cloud Guide");
    expect(doc.text).toContain("**Summary**: A short sum");
  });

  it("getDocument falls back to printable-string extraction and the admin endpoint", async () => {
    const m = await load(USER_CFG);
    mockFetch
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(
        jsonRes({
          data: {
            data: {
              encoded_collab: Buffer.from(
                "paragraph noisy 1234abcd This is a long readable sentence worth keeping",
                "latin1"
              ).toString("base64"),
            },
          },
        })
      );
    const doc = (await m.getDocument("w", "v2")) as { text: string };
    expect(doc.text).toContain("This is a long readable sentence worth keeping");

    // Fresh module: the user-token cache from above would skew call ordering.
    const m2 = await load(JWT_CFG);
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(jsonRes("err", 500))
      .mockResolvedValueOnce(jsonRes({ data: { admin: true } }));
    expect(await m2.getDocument("w", "v3")).toEqual({ admin: true });
  });

  it("extractDocText handles text, content arrays, and garbage", async () => {
    const m = await load(JWT_CFG);
    expect(await m.extractDocText({ text: "hi" })).toBe("hi");
    expect(await m.extractDocText({ content: ["a", { text: "b" }] })).toBe("a\nb");
    expect(await m.extractDocText(null)).toBe("");
    expect(await m.extractDocText({})).toBe("");
  });

  it("markdownToHtml converts headings, emphasis, code, and paragraphs", async () => {
    const m = await load(JWT_CFG);
    const html = await m.markdownToHtml("# T\n\n## S\nsome **bold** and `code` and *em*");
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain("<h2>S</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<em>em</em>");
  });
});

describe("writes", () => {
  it("createPage POSTs and invalidates the views cache; errors → null", async () => {
    const m = await load(JWT_CFG);
    mockFetch
      .mockResolvedValueOnce(jsonRes({ data: [{ view_id: "r", name: "R" }] })) // admin views (prime cache)
      .mockResolvedValueOnce(jsonRes({ data: { view_id: "new-1" } }));
    await m.listAllViewsDeep("w");
    const res = await m.createPage("w", { parent_view_id: "r", name: "P" });
    expect(res?.view_id).toBe("new-1");
    const createCall = mockFetch.mock.calls[1]!;
    expect(String(createCall[0])).toContain("/api/workspace/w/page-view");
    expect(JSON.parse((createCall[1] as RequestInit).body as string)).toMatchObject({
      layout: 0,
      name: "P",
    });
    // Cache invalidated → next listAllViewsDeep fetches again
    mockFetch.mockResolvedValueOnce(jsonRes({ data: { view: { view_id: "x2", name: "X2" } } }));
    await m.listAllViewsDeep("w");
    expect(mockFetch).toHaveBeenCalledTimes(3);

    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(jsonRes("err", 500));
    expect(await m.createPage("w", { parent_view_id: "r" })).toBeNull();
  });

  it("appendBlockToPage POSTs blocks; !ok and exceptions → false", async () => {
    const m = await load(JWT_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({}));
    expect(await m.appendBlockToPage("w", "v", [{ type: "paragraph" }])).toBe(true);
    expect(String(mockFetch.mock.calls[0]![0])).toContain("/page-view/v/append-block");
    mockFetch.mockResolvedValueOnce(jsonRes("err", 500));
    expect(await m.appendBlockToPage("w", "v", [])).toBe(false);
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await m.appendBlockToPage("w", "v", [])).toBe(false);
  });

  it("updateViewName PATCHes and reports res.ok", async () => {
    const m = await load(JWT_CFG);
    mockFetch.mockResolvedValueOnce(jsonRes({}));
    expect(await m.updateViewName("w", "v", "[Draft] X")).toBe(true);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ view_id: "v", name: "[Draft] X" });
    mockFetch.mockResolvedValueOnce(jsonRes("e", 403));
    expect(await m.updateViewName("w", "v", "N")).toBe(false);
    expect(await (await load({})).updateViewName("w", "v", "N")).toBe(false);
  });
});
