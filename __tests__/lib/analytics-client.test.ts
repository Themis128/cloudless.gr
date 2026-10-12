import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  connQuery: vi.fn(),
  connClose: vi.fn(),
  registerFileBuffer: vi.fn(),
  instantiate: vi.fn(),
}));

vi.mock("@/lib/fetch-with-auth", () => ({ fetchWithAuth: m.fetchWithAuth }));

vi.mock("@duckdb/duckdb-wasm", () => ({
  getJsDelivrBundles: () => ({ mvp: {}, eh: {} }),
  selectBundle: vi.fn(async () => ({
    mainWorker: "https://cdn.example/worker.js",
    mainModule: "https://cdn.example/duckdb.wasm",
    pthreadWorker: undefined,
  })),
  ConsoleLogger: class {},
  LogLevel: { WARNING: 2 },
  AsyncDuckDB: class {
    registerFileBuffer = m.registerFileBuffer;
    instantiate = m.instantiate;
    connect = async () => ({ query: m.connQuery, close: m.connClose });
  },
}));

import { isDuckDBAvailable, queryLakeParquet } from "@/lib/analytics-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

class FakeWorker {
  constructor(public url: string) {}
}

beforeEach(() => {
  vi.clearAllMocks();
  m.connQuery.mockResolvedValue({ toArray: () => [{ a: 1 }] });
  m.connClose.mockResolvedValue(undefined);
  m.registerFileBuffer.mockResolvedValue(undefined);
  m.instantiate.mockResolvedValue(undefined);
});

describe("isDuckDBAvailable", () => {
  it("reflects Worker availability in this env", () => {
    const had = typeof Worker !== "undefined";
    expect(isDuckDBAvailable()).toBe(had);
  });
});

describe("queryLakeParquet", () => {
  it("returns [] when Worker is unavailable", async () => {
    const orig = globalThis.Worker;
    // @ts-expect-error — simulate a non-worker env
    delete globalThis.Worker;
    const out = await queryLakeParquet("cat1", "SELECT 1");
    expect(out).toEqual([]);
    globalThis.Worker = orig;
    expect(m.fetchWithAuth).not.toHaveBeenCalled();
  });

  it("throws on a non-ok lake-parquet response", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    m.fetchWithAuth.mockResolvedValue(new Response("x", { status: 500 }));
    await expect(queryLakeParquet("cat1", "SELECT 1")).rejects.toThrow("lake-parquet 500");
  });

  it("loads parquet into duckdb, runs the sql, and closes the conn", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:fake"),
    });
    m.fetchWithAuth.mockResolvedValue(
      new Response(new Uint8Array([80, 65, 82, 49]).buffer, { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(new Response("worker-js", { status: 200 }));

    const rows = await queryLakeParquet("cat/1", "SELECT * FROM lake");
    expect(rows).toEqual([{ a: 1 }]);

    // Worker script was fetched for the blob wrap.
    expect(mockFetch).toHaveBeenCalledWith("https://cdn.example/worker.js");
    // Parquet registered under a sanitized name.
    const [name, bytes] = m.registerFileBuffer.mock.calls[0];
    expect(name).toBe("lake_cat_1.parquet");
    expect(bytes).toBeInstanceOf(Uint8Array);
    // View created + user sql executed + conn closed.
    expect(m.connQuery).toHaveBeenNthCalledWith(
      1,
      "CREATE OR REPLACE VIEW lake AS SELECT * FROM read_parquet('lake_cat_1.parquet')"
    );
    expect(m.connQuery).toHaveBeenNthCalledWith(2, "SELECT * FROM lake");
    expect(m.connClose).toHaveBeenCalled();
    expect(m.fetchWithAuth).toHaveBeenCalledWith(
      "/api/admin/analytics/lake-parquet?id=cat%2F1"
    );
  });
});
