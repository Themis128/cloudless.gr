/**
 * Deep coverage for ssm-config.ts (D1 merge + env defaults + cache),
 * ssm-config-d1.ts (workers merge path), r2-client.ts (env bucket
 * resolution, serveStaticAsset, listR2Objects).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => ({
  getAuthDbFromEnv: vi.fn((): unknown => null),
  createNodeDataLakeBucket: vi.fn((): unknown => null),
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return { ...actual, getAuthDbFromEnv: () => libs.getAuthDbFromEnv() };
});
vi.mock("@/lib/r2-node-bucket", () => ({
  createNodeDataLakeBucket: () => libs.createNodeDataLakeBucket(),
}));

import { getConfig, resetSsmCache } from "@/lib/ssm-config";
import { getConfig as getD1ConfigMerged } from "@/lib/ssm-config-d1";
import {
  getDataLakeBucketFromEnv,
  serveStaticAsset,
  listR2Objects,
} from "@/lib/r2-client";

const origEnv = { ...process.env };
const cleanEnv = () => {
  for (const k of Object.keys(process.env)) delete process.env[k];
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanEnv();
  resetSsmCache();
  delete (globalThis as Record<string, unknown>).caches;
  delete (globalThis as Record<string, unknown>).__DATALAKE_BUCKET__;
  delete (globalThis as Record<string, unknown>).__R2__;
});

afterEach(() => {
  cleanEnv();
  Object.assign(process.env, origEnv);
  delete (globalThis as Record<string, unknown>).caches;
});

const d1Db = (rows: { key: string; value: string }[]) => ({
  prepare: () => ({ all: async () => ({ results: rows }) }),
});

describe("ssm-config getConfig", () => {
  it("env-only path with defaults + private-key unescaping + cache", async () => {
    process.env.GOOGLE_PRIVATE_KEY = "line1\\nline2";
    process.env.ESPOCRM_API_USER = "svc";
    const cfg = await getConfig();
    expect(cfg.GOOGLE_PRIVATE_KEY).toBe("line1\nline2");
    expect(cfg.GSC_SITE_URL).toBe("sc-domain:cloudless.gr");
    expect(cfg.SENTRY_ORG).toBe("baltzakisthemiscom");
    expect(cfg.ESPOCRM_API_USER).toBe("svc");
    expect(cfg.SES_FROM_EMAIL).toBe("noreply@cloudless.gr");
    expect(cfg.SES_TO_EMAIL).toBe("tbaltzakis@cloudless.gr");

    // cached: env change not picked up until reset
    process.env.STRIPE_SECRET_KEY = "sk2";
    expect((await getConfig()).STRIPE_SECRET_KEY).toBe("");
    resetSsmCache();
    expect((await getConfig()).STRIPE_SECRET_KEY).toBe("sk2");
  });

  it("D1 merge: D1 fills gaps, non-empty env wins, EMAIL aliases synced", async () => {
    libs.getAuthDbFromEnv.mockReturnValue(
      d1Db([
        { key: "STRIPE_SECRET_KEY", value: "sk_from_d1" },
        { key: "EMAIL_FROM", value: "d1@cloudless.gr" },
        { key: "POSTIZ_API_KEY", value: "pz_d1" },
      ])
    );
    process.env.STRIPE_SECRET_KEY = "sk_env_wins";
    const cfg = await getConfig();
    expect(cfg.STRIPE_SECRET_KEY).toBe("sk_env_wins");
    expect(cfg.POSTIZ_API_KEY).toBe("pz_d1");
    expect(cfg.EMAIL_FROM).toBe("d1@cloudless.gr");
    expect(cfg.SES_FROM_EMAIL).toBe("d1@cloudless.gr");
    expect(cfg.EMAIL_TO).toBe("tbaltzakis@cloudless.gr");
  });

  it("falls back to env when D1 lookup throws", async () => {
    libs.getAuthDbFromEnv.mockImplementation(() => {
      throw new Error("auth-d1 boom");
    });
    process.env.CRON_SECRET = "cs";
    expect((await getConfig()).CRON_SECRET).toBe("cs");
  });

  it("workers env short-circuits the cache", async () => {
    (globalThis as Record<string, unknown>).caches = {};
    process.env.N8N_API_KEY = "n1";
    await getConfig();
    process.env.N8N_API_KEY = "n2";
    expect((await getConfig()).N8N_API_KEY).toBe("n2");
  });
});

describe("ssm-config-d1 getConfig", () => {
  it("env-only when not workers / no db; merged when both", async () => {
    process.env.META_PAGE_ID = "pg1";
    const cfg = await getD1ConfigMerged<Record<string, string>>();
    expect(cfg.META_PAGE_ID).toBe("pg1");
    expect(cfg.GSC_SITE_URL).toBe("sc-domain:cloudless.gr");

    (globalThis as Record<string, unknown>).caches = {};
    process.env.META_PIXEL_ID = "env_px";
    const merged = await getD1ConfigMerged<Record<string, string>>(
      d1Db([
        { key: "META_PIXEL_ID", value: "d1_px" },
        { key: "META_PAGE_ID", value: "d1_page" },
      ]) as never
    );
    expect(merged.META_PIXEL_ID).toBe("env_px"); // non-empty env wins
    expect(merged.META_PAGE_ID).toBe("pg1"); // non-empty env wins over d1
    expect(merged.N8N_API_URL).toBe(""); // env gap stays empty
  });
});

describe("r2-client", () => {
  it("getDataLakeBucketFromEnv: globals → node fallback → null", () => {
    const fake = { get: () => {}, put: () => {} };
    (globalThis as Record<string, unknown>).__DATALAKE_BUCKET__ = fake;
    expect(getDataLakeBucketFromEnv()).toBe(fake);

    delete (globalThis as Record<string, unknown>).__DATALAKE_BUCKET__;
    (globalThis as Record<string, unknown>).__R2__ = { DATALAKE_BUCKET: fake };
    expect(getDataLakeBucketFromEnv()).toBe(fake);

    delete (globalThis as Record<string, unknown>).__R2__;
    const nodeBucket = { get: () => {} };
    libs.createNodeDataLakeBucket.mockReturnValue(nodeBucket);
    expect(getDataLakeBucketFromEnv()).toBe(nodeBucket);

    libs.createNodeDataLakeBucket.mockReturnValue(null);
    expect(getDataLakeBucketFromEnv()).toBeNull();
  });

  it("serveStaticAsset: workers-bound bucket, mime map, cache header", async () => {
    (globalThis as Record<string, unknown>).caches = {};
    const asset = {
      body: new ReadableStream({ start: (c) => c.close() }),
      writeHttpMetadata: (h: Headers) => h.set("Content-Type", "text/css"),
    };
    const bucket = { get: vi.fn(async () => asset) };
    const res2 = await serveStaticAsset(
      { ASSETS_BUCKET: bucket as never },
      "file.css",
      { cacheSeconds: 60 }
    );
    expect(res2!.headers.get("Cache-Control")).toBe(
      "public, max-age=60, immutable"
    );
    expect(res2!.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res2!.headers.get("Content-Type")).toBe("text/css");

    bucket.get.mockResolvedValue({
      body: new ReadableStream({ start: (c) => c.close() }),
      writeHttpMetadata: () => {},
    });
    const res3 = await serveStaticAsset({ ASSETS_BUCKET: bucket as never }, "a.png");
    expect(res3!.headers.get("Content-Type")).toBe("image/png");

    bucket.get.mockResolvedValue(null);
    expect(
      await serveStaticAsset({ ASSETS_BUCKET: bucket as never }, "m.css")
    ).toBeNull();

    // no workers → null bucket → null
    delete (globalThis as Record<string, unknown>).caches;
    expect(await serveStaticAsset({}, "x")).toBeNull();
  });

  it("listR2Objects routes by bucket type + maps keys", async () => {
    (globalThis as Record<string, unknown>).caches = {};
    const mk = (keys: string[]) => ({
      list: vi.fn(async () => ({ objects: keys.map((k) => ({ key: k })) })),
      get: () => {},
    });
    const env = {
      ASSETS_BUCKET: mk(["a1"]),
      MEDIA_BUCKET: mk(["m1", "m2"]),
      DATALAKE_BUCKET: mk(["l1"]),
    };
    expect(await listR2Objects(env as never, "assets")).toEqual(["a1"]);
    expect(await listR2Objects(env as never, "media", "pref")).toEqual([
      "m1",
      "m2",
    ]);
    expect(await listR2Objects(env as never, "lake")).toEqual(["l1"]);
    expect(env.MEDIA_BUCKET.list).toHaveBeenCalledWith({
      prefix: "pref",
      limit: 1000,
    });

    delete (globalThis as Record<string, unknown>).caches;
    expect(await listR2Objects({}, "lake")).toEqual([]);
  });
});
