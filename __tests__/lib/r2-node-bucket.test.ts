// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Real-code tests for src/lib/r2-node-bucket.ts — the Node-side R2Bucket
 * shim over the S3 API. Fakes only at the client boundary
 * (`@/lib/r2-upload` createR2ClientFromEnv + r2ObjectUrl); all conversions,
 * error mapping, XML list parsing, and object shapes run for real.
 */

const r2Fetch = vi.fn();
const createR2ClientFromEnv = vi.fn(() => ({ fetch: r2Fetch }));
const r2ObjectUrl = vi.fn((key: string, bucket: string) => `https://r2.test/${bucket}/${key}`);

vi.mock("@/lib/r2-upload", () => ({ createR2ClientFromEnv, r2ObjectUrl }));

const ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CF_ACCOUNT_ID",
  "CF_R2_ACCESS_KEY_ID",
  "R2_ACCESS_KEY_ID",
  "CF_R2_SECRET_ACCESS_KEY",
  "R2_SECRET_ACCESS_KEY",
  "ANALYTICS_BUCKET",
  "DATALAKE_BUCKET_NAME",
  "R2_BUCKET_NAME",
];

function res(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : (body as BodyInit), { status, headers });
}

describe("r2-node-bucket", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    r2Fetch.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function withCreds() {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CF_R2_ACCESS_KEY_ID = "key";
    process.env.CF_R2_SECRET_ACCESS_KEY = "secret";
  }

  async function load() {
    return import("@/lib/r2-node-bucket");
  }

  it("returns null without S3 credentials and resolves the bucket name cascade", async () => {
    const m = await load();
    expect(m.createNodeDataLakeBucket()).toBeNull();
    expect(m.resolveDataLakeBucketName()).toBe("datalake-bucket");
    process.env.R2_BUCKET_NAME = "custom-b";
    expect(m.resolveDataLakeBucketName()).toBe("custom-b");
    process.env.ANALYTICS_BUCKET = "analytics-b";
    expect(m.resolveDataLakeBucketName()).toBe("analytics-b");
  });

  it("get returns an R2ObjectBody with body/arrayBuffer/text/json/blob", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    const payload = JSON.stringify({ hello: 1 });
    r2Fetch.mockResolvedValueOnce(res(payload, 200, { "content-type": "application/json" }));
    const obj = await b.get("k.json");
    expect(obj).not.toBeNull();
    expect(r2Fetch).toHaveBeenCalledWith("https://r2.test/bkt/k.json", expect.objectContaining({ method: "GET" }));
    expect(obj!.key).toBe("k.json");
    expect(await obj!.text()).toBe(payload);
    expect(await obj!.json()).toEqual({ hello: 1 });
    expect((await obj!.arrayBuffer()).byteLength).toBe(payload.length);
    expect((await obj!.blob()).type).toBe("application/json");
    expect(obj!.httpMetadata.contentType).toBe("application/json");
    const h = new Headers();
    obj!.writeHttpMetadata(h);
    expect(h.get("content-type")).toBe("application/json");
  });

  it("get returns null on 404 and throws on other errors", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket()!;
    r2Fetch.mockResolvedValueOnce(res("nf", 404));
    expect(await b.get("missing")).toBeNull();
    r2Fetch.mockResolvedValueOnce(res("denied", 403));
    await expect(b.get("x")).rejects.toThrow(/R2 GET datalake-bucket\/x → 403/);
  });

  it("head maps response headers to an R2Object stub", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    r2Fetch.mockResolvedValueOnce(
      res("", 200, { "content-length": "42", "content-type": "text/plain", etag: '"e1"', "last-modified": "Thu, 01 Jan 2026 00:00:00 GMT" }),
    );
    const o = await b.head("k");
    expect(o).toMatchObject({ key: "k", size: 42, etag: '"e1"', storageClass: "STANDARD" });
    expect(o!.uploaded).toEqual(new Date("2026-01-01T00:00:00Z"));
    r2Fetch.mockResolvedValueOnce(res("", 404));
    expect(await b.head("gone")).toBeNull();
    r2Fetch.mockResolvedValueOnce(res("", 500));
    await expect(b.head("x")).rejects.toThrow(/R2 HEAD/);
  });

  it("put converts string/Blob/stream bodies and sets content-type", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    r2Fetch.mockResolvedValue(res("", 200, { etag: '"p1"' }));

    const o1 = await b.put("a.txt", "hello", { httpMetadata: { contentType: "text/plain" } });
    expect(o1.size).toBe(5);
    expect(o1.etag).toBe('"p1"');
    let init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect(init.headers).toEqual({ "Content-Type": "text/plain" });

    await b.put("b.bin", new Uint8Array([1, 2, 3]));
    init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect(init.headers).toEqual({ "Content-Type": "application/octet-stream" });
    expect((init.body as ArrayBuffer).byteLength).toBe(3);

    await b.put("c.bin", new Blob([new Uint8Array([9, 9])]));
    init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect((init.body as ArrayBuffer).byteLength).toBe(2);

    await b.put("d.bin", new ReadableStream({ start(c) { c.enqueue(new Uint8Array([7])); c.close(); } }));
    init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect((init.body as ArrayBuffer).byteLength).toBe(1);

    // Headers-instance httpMetadata
    await b.put("e.txt", "x", { httpMetadata: new Headers({ "content-type": "text/csv" }) });
    init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect(init.headers).toEqual({ "Content-Type": "text/csv" });

    // null body → empty
    await b.put("empty", null);
    init = r2Fetch.mock.calls.at(-1)![1] as RequestInit;
    expect((init.body as ArrayBuffer).byteLength).toBe(0);
  });

  it("put throws on non-ok and carries customMetadata on the stub", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    r2Fetch.mockResolvedValueOnce(res("quota", 507));
    await expect(b.put("x", "v")).rejects.toThrow(/R2 PUT bkt\/x → 507/);
    r2Fetch.mockResolvedValueOnce(res("", 200));
    const o = await b.put("x", "v", { customMetadata: { a: "1" } });
    expect(o.customMetadata).toEqual({ a: "1" });
  });

  it("delete accepts a list and tolerates 404", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    r2Fetch.mockResolvedValueOnce(res("", 200)).mockResolvedValueOnce(res("", 404));
    await b.delete(["a", "b"]);
    expect(r2Fetch).toHaveBeenCalledTimes(2);
    r2Fetch.mockResolvedValueOnce(res("", 500));
    await expect(b.delete("c")).rejects.toThrow(/R2 DELETE/);
  });

  it("list builds the S3 ListObjectsV2 URL and parses the XML", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    const xml = `<?xml version="1.0"?><ListBucketResult>
      <Contents><Key>lake/a.json</Key></Contents>
      <Contents><Key>lake/b.json</Key></Contents>
      <IsTruncated>true</IsTruncated>
      <NextContinuationToken>tok-2</NextContinuationToken>
    </ListBucketResult>`;
    r2Fetch.mockResolvedValueOnce(res(xml));
    const out = await b.list({ prefix: "lake/", limit: 5, cursor: "cur1", delimiter: "/" });
    const url = new URL(r2Fetch.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/bkt");
    expect(url.searchParams.get("list-type")).toBe("2");
    expect(url.searchParams.get("prefix")).toBe("lake/");
    expect(url.searchParams.get("continuation-token")).toBe("cur1");
    expect(url.searchParams.get("max-keys")).toBe("5");
    expect(url.searchParams.get("delimiter")).toBe("/");
    expect(out.objects.map((o: { key: string }) => o.key)).toEqual(["lake/a.json", "lake/b.json"]);
    expect(out.truncated).toBe(true);
    expect(out.cursor).toBe("tok-2");
  });

  it("list throws on non-ok and requires the account id", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket("bkt")!;
    r2Fetch.mockResolvedValueOnce(res("err", 503));
    await expect(b.list()).rejects.toThrow(/R2 LIST bkt → 503/);
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    await expect(b.list()).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID required/);
  });

  it("multipart stubs throw not-implemented", async () => {
    withCreds();
    const m = await load();
    const b = m.createNodeDataLakeBucket()!;
    await expect(b.createMultipartUpload("k")).rejects.toThrow(/not implemented/);
    expect(() => b.resumeMultipartUpload("k", "u")).toThrow(/not implemented/);
  });
});
