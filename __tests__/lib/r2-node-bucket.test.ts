import { describe, it, expect, afterEach } from "vitest";

import { resolveDataLakeBucketName, createNodeDataLakeBucket } from "@/lib/r2-node-bucket";

afterEach(() => {
  delete process.env.ANALYTICS_BUCKET;
  delete process.env.DATALAKE_BUCKET_NAME;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CF_R2_ACCESS_KEY_ID;
  delete process.env.CF_R2_SECRET_ACCESS_KEY;
});

describe("resolveDataLakeBucketName", () => {
  it("returns default bucket name when no env var is set", () => {
    expect(resolveDataLakeBucketName()).toBe("datalake-bucket");
  });

  it("prefers ANALYTICS_BUCKET over other env vars", () => {
    process.env.ANALYTICS_BUCKET = "analytics-r2";
    process.env.DATALAKE_BUCKET_NAME = "data-lake";
    expect(resolveDataLakeBucketName()).toBe("analytics-r2");
  });

  it("falls back to DATALAKE_BUCKET_NAME when ANALYTICS_BUCKET is unset", () => {
    process.env.DATALAKE_BUCKET_NAME = "data-lake-fallback";
    expect(resolveDataLakeBucketName()).toBe("data-lake-fallback");
  });

  it("falls back to R2_BUCKET_NAME when others are unset", () => {
    process.env.R2_BUCKET_NAME = "r2-bucket-name";
    expect(resolveDataLakeBucketName()).toBe("r2-bucket-name");
  });
});

describe("createNodeDataLakeBucket", () => {
  it("returns null when R2 S3 credentials are not configured", () => {
    const bucket = createNodeDataLakeBucket();
    expect(bucket).toBeNull();
  });
});
