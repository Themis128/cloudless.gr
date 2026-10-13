/**
 * appflowy.ts tail coverage — token resolution (user JWT + service JWT),
 * listAllWorkspaces/listAllViewsDeep admin fallbacks, getAppFlowySummary,
 * getDocument collab extraction + admin fallback, listWorkspaceViews,
 * searchDocuments, updateViewName error path.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));

import { extractDocText, getAppFlowySummary } from "@/lib/appflowy";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const lastUrl = () => String(mockFetch.mock.calls.at(-1)?.[0]);

function cfgEmail() {
  m.getConfig.mockResolvedValue({
    APPFLOWY_API_URL: "https://af.example",
    APPFLOWY_EMAIL: "a@b.c",
    APPFLOWY_PASSWORD: "pw",
  });
}
function cfgSecret() {
  m.getConfig.mockResolvedValue({
    APPFLOWY_API_URL: "https://af.example",
    APPFLOWY_JWT_SECRET: "secret",
  });
}
function gotrue() {
  mockFetch.mockResolvedValueOnce(json({ access_token: "user-tok", expires_in: 3600 }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.resetModules();
  m.getConfig.mockResolvedValue({});
});

describe("workspace listing + summary", () => {
  it("lists workspaces via the user API and caches", async () => {
    cfgEmail();
    gotrue();
    mockFetch.mockResolvedValueOnce(json({ data: [{ workspace_id: "w1" }] }));
    const mod = await import("@/lib/appflowy");
    const out = await mod.listAllWorkspaces();
    expect(out).toEqual([{ workspace_id: "w1" }]);
    expect(lastUrl()).toContain("/api/workspace");
    expect(mockFetch.mock.calls.at(-1)![1].headers.Authorization).toBe("Bearer user-tok");
    expect(await mod.listAllWorkspaces()).toEqual(out); // cached — no extra fetch
  });

  it("falls through to the admin surface when the user path fails", async () => {
    cfgSecret(); // service JWT — no gotrue call
    mockFetch
      .mockResolvedValueOnce(json({ data: [] })) // user path returns empty
      .mockResolvedValueOnce(json({ data: [{ workspace_id: "w2" }] }));
    const mod = await import("@/lib/appflowy");
    expect(await mod.listAllWorkspaces()).toEqual([{ workspace_id: "w2" }]);
    expect(lastUrl()).toContain("/api/admin/workspace");
    const auth = mockFetch.mock.calls.at(-1)![1].headers.Authorization as string;
    expect(auth.startsWith("Bearer ")).toBe(true);
    // service JWT has 3 dot-separated parts
    expect(auth.slice(7).split(".")).toHaveLength(3);
  });

  it("rethrows non-config admin failures and returns [] when unconfigured", async () => {
    cfgSecret();
    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));
    const mod = await import("@/lib/appflowy");
    await expect(mod.listAllWorkspaces()).rejects.toMatchObject({ name: "AppFlowyApiError" });

    const mod2 = await import("@/lib/appflowy");
    m.getConfig.mockResolvedValue({}); // unconfigured
    expect(await mod2.listAllWorkspaces()).toEqual([]);
    expect(await mod2.listAllUsers()).toEqual([]);
    expect(await mod2.listAllViewsDeep("w")).toEqual([]);
    expect(await mod2.getWorkspaceFolder("w")).toBeNull();
  });

  it("getAppFlowySummary aggregates health + counts", async () => {
    expect(await getAppFlowySummary()).toEqual({
      configured: false,
      healthy: false,
      workspaceCount: 0,
      userCount: 0,
    });
    cfgSecret(); // service JWT — deterministic, no gotrue round-trip
    const mod = await import("@/lib/appflowy");
    mockFetch
      .mockResolvedValueOnce(new Response("ok", { status: 200 })) // /api/health
      .mockResolvedValueOnce(json({ data: [{ workspace_id: "w1" }, { workspace_id: "w2" }] }))
      .mockResolvedValueOnce(json({ data: [{ uid: 1 }] }));
    const sum = await mod.getAppFlowySummary();
    expect(sum).toEqual({ configured: true, healthy: true, workspaceCount: 2, userCount: 1 });
  });

  it("getAppFlowySummary swallows listing failures into zero counts", async () => {
    cfgSecret();
    const mod = await import("@/lib/appflowy");
    // health + user/admin workspace paths + user/admin user paths all fail
    for (let i = 0; i < 5; i++) mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    const sum = await mod.getAppFlowySummary();
    expect(sum.configured).toBe(true);
    expect(sum.healthy).toBe(false);
    expect(sum.workspaceCount).toBe(0);
    expect(sum.userCount).toBe(0);
  });
});

describe("listAllViewsDeep fallbacks", () => {
  it("flattens + dedupes folder views and caches per workspace", async () => {
    cfgSecret();
    const tree = {
      data: {
        view: { view_id: "root", name: "Root", layout: 1 },
        children: [
          { view_id: "p1", name: "Page", layout: 0 },
          { view_id: "p1", name: "Page", layout: 0 }, // dup
          {
            view_id: "f1",
            name: "Sub",
            has_children: true,
            children: [{ view_id: "p2", name: "Deep" }],
          },
        ],
      },
    };
    mockFetch.mockResolvedValueOnce(json(tree));
    const mod = await import("@/lib/appflowy");
    const views = await mod.listAllViewsDeep("w1");
    expect(views.map((v) => v.view_id)).toEqual(["root", "p1", "f1", "p2"]);
    expect(views.find((v) => v.view_id === "f1")?.type).toBe("folder");
    expect(views.find((v) => v.view_id === "p1")?.type).toBe("document");
    expect(await mod.listAllViewsDeep("w1")).toEqual(views); // cached
  });

  it("returns [] on 404/400 and falls to admin on other errors", async () => {
    cfgSecret();
    mockFetch.mockResolvedValueOnce(new Response("nf", { status: 404 }));
    let mod = await import("@/lib/appflowy");
    expect(await mod.listAllViewsDeep("w1")).toEqual([]);

    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(json({ data: [{ view_id: "a1", name: "A", type: "document" }] }));
    vi.resetModules();
    mod = await import("@/lib/appflowy");
    cfgSecret();
    const views = await mod.listAllViewsDeep("w2");
    expect(views[0].view_id).toBe("a1");
    expect(lastUrl()).toContain("/api/admin/workspace/w2/views");
  });

  it("admin fallback: 404 → [], other errors → throw", async () => {
    cfgSecret();
    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("nf", { status: 404 }));
    let mod = await import("@/lib/appflowy");
    expect(await mod.listAllViewsDeep("w3")).toEqual([]);

    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));
    vi.resetModules();
    mod = await import("@/lib/appflowy");
    cfgSecret();
    await expect(mod.listAllViewsDeep("w4")).rejects.toMatchObject({ name: "AppFlowyApiError" });
  });
});

describe("getDocument + collab extraction", () => {
  it("extracts CMS fields from encoded_collab bytes (array)", async () => {
    cfgSecret();
    const blob = Buffer.from(`Title**Name**: Acme Corp' stuff **Slug**: acme-corp'`);
    mockFetch.mockResolvedValueOnce(json({ data: { data: { encoded_collab: Array.from(blob) } } }));
    const mod = await import("@/lib/appflowy");
    const doc = (await mod.getDocument("w", "v")) as { text: string };
    expect(doc.text).toContain("**Name**: Acme Corp");
    expect(doc.text).toContain("**Slug**: acme-corp");
  });

  it("falls back to latin-string extraction for plain content", async () => {
    cfgSecret();
    const blob = Buffer.from("garbage A sentence with enough words to survive the filter.");
    mockFetch.mockResolvedValueOnce(
      json({ data: { data: { encoded_collab: blob.toString("base64") } } })
    );
    const mod = await import("@/lib/appflowy");
    const doc = (await mod.getDocument("w", "v")) as { text: string };
    expect(doc.text).toContain("sentence with enough words");
  });

  it("returns empty text for unrecognized collab shapes", async () => {
    cfgSecret();
    mockFetch.mockResolvedValueOnce(json({ data: { data: { encoded_collab: 42 } } }));
    const mod = await import("@/lib/appflowy");
    const doc = (await mod.getDocument("w", "v")) as { text: string; content: unknown[] };
    expect(doc.text).toBe("");
    expect(doc.content).toEqual([]);
  });

  it("falls back to the admin document endpoint on user-path failure", async () => {
    cfgSecret();
    mockFetch
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(json({ data: { admin: "doc" } }));
    const mod = await import("@/lib/appflowy");
    expect(await mod.getDocument("w s", "v/s")).toEqual({ admin: "doc" });
    expect(lastUrl()).toContain("/api/admin/workspace/w%20s/document/v%2Fs");

    mockFetch
      .mockReset()
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));
    vi.resetModules();
    const mod2 = await import("@/lib/appflowy");
    cfgSecret();
    await expect(mod2.getDocument("w", "v")).rejects.toMatchObject({ name: "AppFlowyApiError" });
  });

  it("extractDocText returns '' for docs without text/content", async () => {
    expect(await extractDocText({ other: 1 })).toBe("");
    expect(await extractDocText({ content: [5, null] })).toBe("\n");
  });
});

describe("views/search/update", () => {
  it("listWorkspaceViews delegates + searchDocuments filters names", async () => {
    cfgSecret();
    mockFetch.mockResolvedValueOnce(
      json({
        data: [
          { view_id: "1", name: "Pricing Page", layout: 0 },
          { view_id: "2", name: "About", layout: 0 },
        ],
      })
    );
    const mod = await import("@/lib/appflowy");
    expect((await mod.listWorkspaceViews("w")).length).toBe(2);
    expect(await mod.searchDocuments("w", "pricing")).toHaveLength(1);
    expect(await mod.searchDocuments("w", "  ")).toEqual([]);

    // error path: views call throws non-config → propagates
    mockFetch.mockReset().mockResolvedValueOnce(new Response("x", { status: 500 }));
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    vi.resetModules();
    const mod2 = await import("@/lib/appflowy");
    cfgSecret();
    await expect(mod2.searchDocuments("w9", "q")).rejects.toMatchObject({
      name: "AppFlowyApiError",
    });
  });

  it("updateViewName PATCHes and reports failures", async () => {
    cfgSecret();
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const mod = await import("@/lib/appflowy");
    expect(await mod.updateViewName("w", "v", "New")).toBe(true);
    expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");

    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect(await mod.updateViewName("w", "v", "New")).toBe(false);

    mockFetch.mockRejectedValueOnce(new Error("net"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await mod.updateViewName("w", "v", "New")).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("updateViewName"), expect.any(Error));
    err.mockRestore();
  });

  it("throws AppFlowyNotConfiguredError through the whole surface", async () => {
    const mod = await import("@/lib/appflowy");
    expect(await mod.updateViewName("w", "v", "x")).toBe(false);
    await expect(mod.getDocument("w", "v")).rejects.toMatchObject({
      name: "AppFlowyNotConfiguredError",
    });
  });

  it("drops short latin runs that fail every inclusion filter", async () => {
    cfgSecret();
    // "tiny" is a 4-char printable run: not skipped, not an id (needs 6+),
    // not a CMS field, and too short for the sentence branch -> filtered out.
    const blob = Buffer.from("tiny");
    mockFetch.mockResolvedValueOnce(
      json({ data: { data: { encoded_collab: blob.toString("base64") } } })
    );
    const mod = await import("@/lib/appflowy");
    const doc = (await mod.getDocument("w", "v")) as { text: string };
    expect(doc.text).toBe("");
  });
});
