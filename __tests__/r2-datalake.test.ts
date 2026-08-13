// @vitest-environment node
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("aws4fetch", () => ({
  AwsClient: class {
    fetch(...args: unknown[]) {
      return fetchMock(...args);
    }
  },
}));

describe("getDataLakeBucketFromEnv", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CF_R2_ACCESS_KEY_ID;
    delete process.env.CF_R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CF_ACCOUNT_ID;
  });

  afterEach(() => {
    delete (globalThis as unknown as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
    delete (globalThis as unknown as { __R2__?: unknown }).__R2__;
    process.env = { ...envBackup };
    vi.resetModules();
  });

  it("returns null when no binding and no CF_R2_*", async () => {
    const { getDataLakeBucketFromEnv } = await import("@/lib/r2-client");
    expect(getDataLakeBucketFromEnv()).toBeNull();
  });

  it("returns bucket from globalThis.__DATALAKE_BUCKET__", async () => {
    const put = async () => undefined;
    (globalThis as unknown as { __DATALAKE_BUCKET__: { put: typeof put } }).__DATALAKE_BUCKET__ = {
      put,
    };
    const { getDataLakeBucketFromEnv } = await import("@/lib/r2-client");
    expect(getDataLakeBucketFromEnv()?.put).toBe(put);
  });

  it("returns bucket from globalThis.__R2__.DATALAKE_BUCKET", async () => {
    const put = async () => undefined;
    (globalThis as unknown as { __R2__: { DATALAKE_BUCKET: { put: typeof put } } }).__R2__ = {
      DATALAKE_BUCKET: { put },
    };
    const { getDataLakeBucketFromEnv } = await import("@/lib/r2-client");
    expect(getDataLakeBucketFromEnv()?.put).toBe(put);
  });

  it("returns Node S3 shim when CF_R2_* is set", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CF_R2_ACCESS_KEY_ID = "key";
    process.env.CF_R2_SECRET_ACCESS_KEY = "secret";
    process.env.ANALYTICS_BUCKET = "datalake-bucket";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (n: string) => (n === "content-type" ? "text/plain" : null) },
      text: async () => "",
      arrayBuffer: async () => new TextEncoder().encode("snap").buffer,
    });
    const { getDataLakeBucketFromEnv } = await import("@/lib/r2-client");
    const bucket = getDataLakeBucketFromEnv();
    expect(bucket).not.toBeNull();
    const obj = await bucket!.get("lake/snapshots/x.json");
    expect(await obj!.text()).toBe("snap");
  });
});
