import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/r2-node-bucket", () => ({
  createNodeDataLakeBucket: vi.fn(() => null),
}));

import {
  isCloudflareWorkers,
  getAssetsBucket,
  getMediaBucket,
  getDataLakeBucket,
} from "@/lib/r2-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCloudflareWorkers", () => {
  it("returns false in a Node environment (no caches global)", () => {
    expect(isCloudflareWorkers()).toBe(false);
  });
});

describe("getAssetsBucket", () => {
  it("returns null when not in Workers", () => {
    const env = { ASSETS_BUCKET: {} as never };
    expect(getAssetsBucket(env)).toBeNull();
  });

  it("returns null when env has no ASSETS_BUCKET", () => {
    expect(getAssetsBucket({})).toBeNull();
  });
});

describe("getMediaBucket", () => {
  it("returns null when not in Workers", () => {
    const env = { MEDIA_BUCKET: {} as never };
    expect(getMediaBucket(env)).toBeNull();
  });
});

describe("getDataLakeBucket", () => {
  it("returns null when env has no DATALAKE_BUCKET", () => {
    expect(getDataLakeBucket({})).toBeNull();
  });

  it("returns bucket when it has put/get methods", () => {
    const bucket = { put: vi.fn(), get: vi.fn() } as never;
    const result = getDataLakeBucket({ DATALAKE_BUCKET: bucket });
    expect(result).toBe(bucket);
  });

  it("returns null when bucket lacks put and get", () => {
    const bucket = {} as never;
    const result = getDataLakeBucket({ DATALAKE_BUCKET: bucket });
    expect(result).toBeNull();
  });
});
