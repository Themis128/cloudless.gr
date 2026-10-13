import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchAiDocs, createAiSearchNamespace } from "@/lib/ai-search";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function workersEnv() {
  (globalThis as Record<string, unknown>).caches = {};
}
function noWorkersEnv() {
  delete (globalThis as Record<string, unknown>).caches;
}

beforeEach(() => {
  mockFetch.mockReset();
  noWorkersEnv();
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_API_TOKEN;
  delete process.env.AI_SEARCH_INSTANCE;
  delete process.env.AI_SEARCH_NAMESPACE;
});

describe("searchAiDocs", () => {
  it("returns null outside Workers and without credentials", async () => {
    expect(await searchAiDocs("q")).toBeNull();
    workersEnv();
    expect(await searchAiDocs("q")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts to the AI Search REST endpoint with defaults", async () => {
    workersEnv();
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_API_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ answer: "a", results: [] }), { status: 200 })
    );
    const out = await searchAiDocs("deploy runbook");
    expect(out).toEqual({ answer: "a", results: [] });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/accounts/acct/ai-search/namespaces/default/instances/default/search");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toMatchObject({ query: "deploy runbook", max_num_results: 5 });
  });

  it("honours explicit namespace/instance/maxResults and env overrides", async () => {
    workersEnv();
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_API_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await searchAiDocs("q", "ns2", "inst2", 9);
    expect(mockFetch.mock.calls[0][0]).toContain("/namespaces/ns2/instances/inst2/");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).max_num_results).toBe(9);
    process.env.AI_SEARCH_NAMESPACE = "envns";
    process.env.AI_SEARCH_INSTANCE = "envinst";
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await searchAiDocs("q");
    expect(mockFetch.mock.calls[1][0]).toContain("/namespaces/envns/instances/envinst/");
  });

  it("warns + null on non-ok and fetch throw", async () => {
    workersEnv();
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_API_TOKEN = "tok";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 403 }));
    expect(await searchAiDocs("q")).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await searchAiDocs("q")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("createAiSearchNamespace", () => {
  it("fails fast outside Workers / without credentials", async () => {
    expect(await createAiSearchNamespace("n")).toEqual({
      success: false,
      error: "Not in Workers environment",
    });
    workersEnv();
    expect((await createAiSearchNamespace("n")).error).toBe("Missing credentials");
  });

  it("returns the created id on success", async () => {
    workersEnv();
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_API_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { id: "ns1" } }), { status: 200 })
    );
    expect(await createAiSearchNamespace("docs", "site docs")).toEqual({
      success: true,
      id: "ns1",
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/accounts/acct/ai-search/namespaces");
    expect(JSON.parse(init.body)).toEqual({ name: "docs", description: "site docs" });
  });

  it("surfaces API errors and fetch failures", async () => {
    workersEnv();
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_API_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errors: [{ message: "dup" }] }), { status: 409 })
    );
    expect(await createAiSearchNamespace("n")).toEqual({ success: false, error: "dup" });
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );
    expect(await createAiSearchNamespace("n")).toEqual({ success: false, error: "Unknown error" });
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect(await createAiSearchNamespace("n")).toEqual({ success: false, error: "net" });
  });
});
