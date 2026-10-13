import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_AUTH_D1_DATABASE_ID,
  D1WriteLimitError,
  canUseD1Http,
  getHttpAuthDb,
  isD1WriteLimitError,
  resetHttpAuthDbCache,
} from "@/lib/d1-http";

beforeEach(() => {
  resetHttpAuthDbCache();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_D1_DATABASE_ID;
});

describe("DEFAULT_AUTH_D1_DATABASE_ID", () => {
  it("is a non-empty UUID string", () => {
    expect(DEFAULT_AUTH_D1_DATABASE_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe("canUseD1Http", () => {
  it("returns false when env vars are missing", () => {
    expect(canUseD1Http()).toBe(false);
  });

  it("returns false when only account ID is set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    expect(canUseD1Http()).toBe(false);
  });

  it("returns false when only API token is set", () => {
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    expect(canUseD1Http()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    expect(canUseD1Http()).toBe(true);
  });
});

describe("getHttpAuthDb", () => {
  it("returns null when credentials are not configured", () => {
    expect(getHttpAuthDb()).toBeNull();
  });

  it("returns an AuthDatabase-like object when credentials are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    const db = getHttpAuthDb();
    expect(db).not.toBeNull();
    expect(typeof db?.prepare).toBe("function");
  });
});

describe("resetHttpAuthDbCache", () => {
  it("clears the cached instance so next call rebuilds", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    const db1 = getHttpAuthDb();
    resetHttpAuthDbCache();
    const db2 = getHttpAuthDb();
    expect(db1).not.toBe(db2);
  });
});


const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function credEnv() {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
  process.env.CLOUDFLARE_API_TOKEN = "tok";
}

describe("isD1WriteLimitError", () => {
  it("matches the class and message pattern", () => {
    expect(isD1WriteLimitError(new D1WriteLimitError("x"))).toBe(true);
    expect(
      isD1WriteLimitError(new Error("You have exceeded your D1 free tier daily write limit"))
    ).toBe(true);
    expect(isD1WriteLimitError(new Error("other"))).toBe(false);
    expect(isD1WriteLimitError("not an error")).toBe(false);
  });
});

describe("queryRemote via prepare()", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    credEnv();
    resetHttpAuthDbCache();
  });

  it("posts sql+params to the D1 REST endpoint", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: [{ results: [{ id: 1 }], success: true }] }))
    );
    const db = getHttpAuthDb()!;
    const out = await db.prepare("SELECT * FROM t WHERE id = ?").bind(7).all<{ id: number }>();
    expect(out).toEqual({ results: [{ id: 1 }], success: true });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acct/d1/database/${DEFAULT_AUTH_D1_DATABASE_ID}/query`
    );
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ sql: "SELECT * FROM t WHERE id = ?", params: [7] });
  });

  it("run() and first(col) map the result payload", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, result: [{ results: [], success: true, meta: { changes: 3 } }] })
      )
    );
    const db = getHttpAuthDb()!;
    const run = await db.prepare("DELETE FROM t").bind().run();
    expect(run).toEqual({ success: true, meta: { changes: 3 } });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: [{ results: [{ email: "a@b" }] }] }))
    );
    expect(await db.prepare("SELECT email FROM u").bind().first("email")).toBe("a@b");
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: [{ results: [] }] }))
    );
    expect(await db.prepare("SELECT email FROM u").bind().first()).toBeNull();
  });

  it("throws when credentials disappear between prepare and call", async () => {
    const db = getHttpAuthDb()!;
    const stmt = db.prepare("SELECT 1").bind();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    await expect(stmt.all()).rejects.toThrow("not configured");
  });

  it("throws on invalid JSON bodies", async () => {
    mockFetch.mockResolvedValue(new Response("not json", { status: 200 }));
    const db = getHttpAuthDb()!;
    await expect(db.prepare("SELECT 1").bind().all()).rejects.toThrow("invalid JSON");
  });

  it("maps API errors and detects the write-limit error", async () => {
    const db = getHttpAuthDb()!;
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, errors: [{ message: "exceeded your D1 free tier daily write limit" }] }),
        { status: 400 }
      )
    );
    await expect(db.prepare("INSERT").bind().run()).rejects.toBeInstanceOf(D1WriteLimitError);

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, errors: [{ message: "syntax error" }, { message: "near X" }] }),
        { status: 400 }
      )
    );
    await expect(db.prepare("BAD").bind().run()).rejects.toThrow("syntax error; near X");

    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 500, statusText: "boom" }));
    await expect(db.prepare("X").bind().run()).rejects.toThrow("500");
  });

  it("throws when no result payload is returned", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, result: [] })));
    const db = getHttpAuthDb()!;
    await expect(db.prepare("SELECT 1").bind().all()).rejects.toThrow("no result payload");
  });
});
