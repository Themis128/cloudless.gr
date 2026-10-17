/**
 * appflowy.ts residual branches: GoTrue token caching/default expiry and
 * unreadable error bodies, service-JWT fallback, unconfigured short-circuits,
 * user-API → admin-API fallbacks with missing `data`, folder flattening of
 * null / primitive children, CRDT text extraction fallbacks, and the
 * page-write helpers' sparse/unconfigured paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const BASE = "https://af.example";
const USER_CFG = {
  APPFLOWY_API_URL: `${BASE}/`,
  APPFLOWY_EMAIL: "u@x.co",
  APPFLOWY_PASSWORD: "pw",
};
const JWT_CFG = { APPFLOWY_API_URL: BASE, APPFLOWY_JWT_SECRET: "s3cret" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** A failed response whose body cannot be read. */
const unreadable = (status: number) =>
  ({
    ok: false,
    status,
    text: () => Promise.reject(new Error("stream gone")),
  }) as unknown as Response;

const token = (extra: Record<string, unknown> = {}) => json({ access_token: "tok", ...extra });

type Route = [string, Response | (() => Response)];
let routes: Route[] = [];
function route(...r: Route[]) {
  routes = r;
  mockFetch.mockImplementation(async (url: string) => {
    for (const [frag, out] of routes) {
      if (String(url).includes(frag)) return typeof out === "function" ? out() : out.clone();
    }
    return json({}, 599);
  });
}
const urls = () => mockFetch.mock.calls.map(([u]) => String(u));

async function lib() {
  return await import("@/lib/appflowy");
}

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  mockGetCfg.mockResolvedValue(USER_CFG);
});
afterEach(() => vi.useRealTimers());

describe("auth", () => {
  it("defaults the GoTrue token lifetime to an hour when expires_in is missing", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-17T10:00:00Z"), toFake: ["Date"] });
    route(["/gotrue/token", token()], ["/api/admin/user", json({ data: [] })]);
    const { listAllUsers } = await lib();
    await listAllUsers();
    vi.setSystemTime(new Date("2026-10-17T10:50:00Z")); // 50 min: still valid
    await listAllUsers();
    expect(urls().filter((u) => u.includes("/gotrue/token"))).toHaveLength(1);
    vi.setSystemTime(new Date("2026-10-17T10:59:45Z")); // inside the 30 s refresh margin
    await listAllUsers();
    expect(urls().filter((u) => u.includes("/gotrue/token"))).toHaveLength(2);
  });

  it("a GoTrue failure with an unreadable body raises AppFlowyApiError with an empty body", async () => {
    route(["/gotrue/token", () => unreadable(401)]);
    const { listAllUsers, AppFlowyApiError } = await lib();
    const err = await listAllUsers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppFlowyApiError);
    expect((err as InstanceType<typeof AppFlowyApiError>).status).toBe(401);
    expect((err as InstanceType<typeof AppFlowyApiError>).body).toBe("");
  });

  it("without user credentials, signs a service-role HS256 JWT", async () => {
    mockGetCfg.mockResolvedValue(JWT_CFG);
    route(["/api/admin/user", json({ data: [{ uid: 1 }] })]);
    const { listAllUsers } = await lib();
    expect(await listAllUsers()).toEqual([{ uid: 1 }]);
    expect(urls().some((u) => u.includes("/gotrue/"))).toBe(false);
    const auth = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const [head, body, sig] = auth.Authorization.replace("Bearer ", "").split(".");
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(body, "base64url").toString())).toMatchObject({
      role: "supabase_admin",
    });
    expect(sig).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("a user list without data is empty", async () => {
    route(["/gotrue/token", token()], ["/api/admin/user", json({})]);
    const { listAllUsers } = await lib();
    expect(await listAllUsers()).toEqual([]);
  });

  it("an API error with an unreadable body keeps an empty body", async () => {
    route(["/gotrue/token", token()], ["/api/admin/user", () => unreadable(500)]);
    const { listAllUsers } = await lib();
    await expect(listAllUsers()).rejects.toMatchObject({ status: 500, body: "" });
  });
});

describe("unconfigured short-circuits", () => {
  beforeEach(() => mockGetCfg.mockResolvedValue({ APPFLOWY_API_URL: BASE }));

  it("workspace, folder and page writers return their empty values without fetching", async () => {
    const m = await lib();
    expect(await m.listAllWorkspaces()).toEqual([]);
    expect(await m.createPage("w", { parent_view_id: "p" })).toBeNull();
    expect(await m.appendBlockToPage("w", "v", [{ type: "paragraph" }])).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("user API → admin API fallbacks", () => {
  it("workspaces: empty user payload falls back to admin; missing admin data is []", async () => {
    route(
      ["/gotrue/token", token()],
      ["/api/workspace", json({})],
      ["/api/admin/workspace", json({})]
    );
    const { listAllWorkspaces } = await lib();
    expect(await listAllWorkspaces()).toEqual([]);
    expect(urls().filter((u) => u.includes("/api/"))).toEqual([
      `${BASE}/api/workspace`,
      `${BASE}/api/admin/workspace`,
    ]);
    // cached: no further requests
    await listAllWorkspaces();
    expect(urls().filter((u) => u.includes("/api/"))).toHaveLength(2);
  });

  it("views: a folder with no usable views falls back to admin; missing admin data is []", async () => {
    route(
      ["/gotrue/token", token()],
      ["/folder?depth=10", json({ data: [null, 7, "x", { children: [null] }] })],
      ["/admin/workspace/w1/views", json({})]
    );
    const { listAllViewsDeep } = await lib();
    expect(await listAllViewsDeep("w1")).toEqual([]);
    expect(urls().some((u) => u.includes("/admin/workspace/w1/views"))).toBe(true);
  });

  it("views: null and primitive children are skipped while real views are kept", async () => {
    route(
      ["/gotrue/token", token()],
      [
        "/folder?depth=10",
        json({
          data: {
            view_id: "root",
            name: "Root",
            layout: 1,
            children: [null, 42, { view: { view_id: "d1", name: "Doc" }, children: ["junk"] }],
          },
        }),
      ]
    );
    const { listAllViewsDeep } = await lib();
    expect(await listAllViewsDeep("w2")).toEqual([
      { view_id: "root", name: "Root", type: "folder", last_edited_time: "" },
      { view_id: "d1", name: "Doc", type: "document", last_edited_time: "" },
    ]);
  });

  it("folder and created page payloads without data resolve to null", async () => {
    route(["/gotrue/token", token()], ["/folder?depth=2", json({})], ["/page-view", json({})]);
    const { getWorkspaceFolder, createPage } = await lib();
    expect(await getWorkspaceFolder("w")).toBeNull();
    expect(await createPage("w", { parent_view_id: "p" })).toBeNull();
  });

  it("appendBlockToPage logs a failure with an unreadable body", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    route(["/gotrue/token", token()], ["/append-block", () => unreadable(422)]);
    const { appendBlockToPage } = await lib();
    expect(await appendBlockToPage("w", "v", [])).toBe(false);
    expect(err).toHaveBeenCalledWith("[appflowy] appendBlockToPage failed:", 422, "");
    err.mockRestore();
  });
});

describe("getDocument text extraction", () => {
  async function docText(encoded: unknown) {
    route(
      ["/gotrue/token", token()],
      [
        "/page-view/v1",
        json({ data: { data: encoded === undefined ? {} : { encoded_collab: encoded } } }),
      ]
    );
    const { getDocument } = await lib();
    return (await getDocument("w", "v1")) as { text: string; content: string[] };
  }
  const bytes = (s: string) => Array.from(Buffer.from(s, "latin1"));

  it("no encoded collab gives empty text and content", async () => {
    const d = await docText(undefined);
    expect(d.text).toBe("");
    expect(d.content).toEqual([]);
  });

  it("a key with no value, or a value of only control bytes, falls through to the string scan", async () => {
    const d = await docText(
      bytes(
        "\u0000Slug: \u0002\u0003'\u0000a fallback sentence that is long enough\u0000Name\u0000"
      )
    );
    expect(d.text).toBe("a fallback sentence that is long enough");
  });

  it("bytes with no printable runs extract nothing", async () => {
    expect((await docText([1, 2, 3, 0, 255])).text).toBe("");
  });

  it("the string scan drops structural keys, $-ids and short ids, keeps bold fields and long prose", async () => {
    const parts = [
      "children_map",
      "$abcdef",
      "w$abcdef",
      "abc123XYZ",
      "**Mood**: upbeat and calm",
      "short words",
      "this sentence is comfortably over the limit",
    ];
    const d = await docText(bytes(`\u0000${parts.join("\u0000")}\u0000`));
    expect(d.text.split("\n")).toEqual([
      "**Mood**: upbeat and calm",
      "this sentence is comfortably over the limit",
    ]);
  });
});
