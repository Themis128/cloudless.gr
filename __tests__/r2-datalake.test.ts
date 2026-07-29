// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";

describe("getDataLakeBucketFromEnv", () => {
  afterEach(() => {
    delete (globalThis as unknown as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
    delete (globalThis as unknown as { __R2__?: unknown }).__R2__;
  });

  it("returns null when no binding", async () => {
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
});
