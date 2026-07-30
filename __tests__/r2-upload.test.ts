// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    fetch(...args: unknown[]) {
      return fetchMock(...args);
    }
  },
}));

describe("r2-upload (aws4fetch)", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CF_R2_ACCESS_KEY_ID = "key";
    process.env.CF_R2_SECRET_ACCESS_KEY = "secret";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
    });
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("r2PutObject PUTs to path-style R2 URL", async () => {
    const { r2PutObject } = await import("@/lib/r2-upload");
    await r2PutObject({
      bucket: "datalake-bucket",
      key: "lake/x.parquet",
      body: Buffer.from("abc"),
      contentType: "application/octet-stream",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://acct123.r2.cloudflarestorage.com/datalake-bucket/lake/x.parquet");
    expect(init.method).toBe("PUT");
  });

  it("r2GetObject returns buffer bytes", async () => {
    const { r2GetObject } = await import("@/lib/r2-upload");
    const buf = await r2GetObject({ bucket: "datalake-bucket", key: "a/b.txt" });
    expect(buf.toString()).toBe("hello");
  });

  it("throws when credentials missing", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_R2_ACCESS_KEY_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    vi.resetModules();
    const { r2PutObject } = await import("@/lib/r2-upload");
    await expect(r2PutObject({ bucket: "b", key: "k", body: "x" })).rejects.toThrow(
      /Missing R2 credentials/
    );
  });
});
