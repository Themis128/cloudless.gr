import { beforeEach, describe, expect, it, vi } from "vitest";

const getConfig = vi.fn();
const reindexProductsWithEmbeddings = vi.fn();

vi.mock("@/lib/ssm-config", () => ({
  getConfig,
}));

vi.mock("@/lib/product-search", () => ({
  reindexProductsWithEmbeddings,
}));

async function callReindex(headers?: HeadersInit) {
  const { POST } = await import("@/app/api/admin/search/reindex/route");

  return POST(
    new Request("https://cloudless.gr/api/admin/search/reindex", {
      method: "POST",
      headers,
    }),
  );
}

describe("/api/admin/search/reindex route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;

    getConfig.mockResolvedValue({
      CRON_SECRET: "expected-secret",
    });

    reindexProductsWithEmbeddings.mockResolvedValue({
      indexed: 3,
      taskUid: 42,
    });
  });

  it("rejects requests when no expected secret is configured", async () => {
    getConfig.mockResolvedValue({
      CRON_SECRET: "",
    });
    delete process.env.CRON_SECRET;

    const response = await callReindex({
      "x-cron-secret": "expected-secret",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(reindexProductsWithEmbeddings).not.toHaveBeenCalled();
  });

  it("rejects requests with a missing secret header", async () => {
    const response = await callReindex();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(reindexProductsWithEmbeddings).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong secret", async () => {
    const response = await callReindex({
      "x-cron-secret": "wrong-secret",
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(reindexProductsWithEmbeddings).not.toHaveBeenCalled();
  });

  it("accepts the configured x-cron-secret and reindexes products", async () => {
    const response = await callReindex({
      "x-cron-secret": "expected-secret",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      indexed: 3,
      taskUid: 42,
    });
    expect(reindexProductsWithEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("accepts x-admin-secret as a compatibility header", async () => {
    const response = await callReindex({
      "x-admin-secret": "expected-secret",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      indexed: 3,
      taskUid: 42,
    });
    expect(reindexProductsWithEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("falls back to process.env.CRON_SECRET when config secret is empty", async () => {
    getConfig.mockResolvedValue({
      CRON_SECRET: "",
    });
    process.env.CRON_SECRET = "env-secret";

    const response = await callReindex({
      "x-cron-secret": "env-secret",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      indexed: 3,
      taskUid: 42,
    });
    expect(reindexProductsWithEmbeddings).toHaveBeenCalledTimes(1);
  });
});
