/**
 * Tests for src/lib/analytics-engine-query.ts
 *
 * Covers:
 *  - isAnalyticsEngineQueryConfigured()
 *  - queryAnalyticsEngineSql() — unconfigured, success, non-JSON response, API error
 *  - defaultEdgeLatencySql() — uses env var or fallback dataset name
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal("fetch", mockFetch);

import {
  isAnalyticsEngineQueryConfigured,
  queryAnalyticsEngineSql,
  defaultEdgeLatencySql,
} from "@/lib/analytics-engine-query";

beforeEach(() => {
  mockFetch.mockReset();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ANALYTICS_DATASET;
});

// ---------------------------------------------------------------------------
describe("isAnalyticsEngineQueryConfigured", () => {
  it("returns false when both env vars are absent", () => {
    expect(isAnalyticsEngineQueryConfigured()).toBe(false);
  });

  it("returns false when only ACCOUNT_ID is set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct-1";
    expect(isAnalyticsEngineQueryConfigured()).toBe(false);
  });

  it("returns false when only API_TOKEN is set", () => {
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(isAnalyticsEngineQueryConfigured()).toBe(false);
  });

  it("returns true when both are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct-1";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(isAnalyticsEngineQueryConfigured()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("queryAnalyticsEngineSql", () => {
  it("throws when not configured", async () => {
    await expect(queryAnalyticsEngineSql("SELECT 1")).rejects.toThrow(
      "Analytics Engine not configured"
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts to the correct CF endpoint with auth headers", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct-123";
    process.env.CLOUDFLARE_API_TOKEN = "tok-abc";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: vi.fn().mockResolvedValue({ data: [{ endpoint: "/", hits: 10 }] }),
    });

    const result = await queryAnalyticsEngineSql("SELECT * FROM t");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acct-123/analytics_engine/sql",
      expect.objectContaining({
        method: "POST",
        body: "SELECT * FROM t",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-abc",
          "Content-Type": "text/plain",
        }),
      })
    );
    expect(result.rows).toEqual([{ endpoint: "/", hits: 10 }]);
  });

  it("returns empty rows when data field is absent", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_API_TOKEN = "t";
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: vi.fn().mockResolvedValue({}),
    });
    const result = await queryAnalyticsEngineSql("SELECT 1");
    expect(result.rows).toEqual([]);
  });

  it("includes raw response", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_API_TOKEN = "t";
    const raw = { data: [], meta: { count: 0 } };
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: vi.fn().mockResolvedValue(raw),
    });
    const result = await queryAnalyticsEngineSql("SELECT 1");
    expect(result.raw).toEqual(raw);
  });

  it("throws on non-JSON content type", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_API_TOKEN = "t";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => "text/plain" },
      json: vi.fn().mockResolvedValue({}),
    });
    await expect(queryAnalyticsEngineSql("SELECT 1")).rejects.toThrow(
      "Analytics Engine SQL returned 403"
    );
  });

  it("throws on API error with error message from response", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_API_TOKEN = "t";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: vi.fn().mockResolvedValue({ errors: [{ message: "invalid SQL" }] }),
    });
    await expect(queryAnalyticsEngineSql("BAD")).rejects.toThrow("invalid SQL");
  });

  it("throws generic error when errors array is empty", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_API_TOKEN = "t";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "application/json" },
      json: vi.fn().mockResolvedValue({ errors: [] }),
    });
    await expect(queryAnalyticsEngineSql("SELECT 1")).rejects.toThrow("HTTP 500");
  });
});

// ---------------------------------------------------------------------------
describe("defaultEdgeLatencySql", () => {
  it("uses the default dataset name when env var is absent", () => {
    const sql = defaultEdgeLatencySql();
    expect(sql).toContain("cloudless_analytics");
    expect(sql).toContain("SELECT");
    expect(sql).toContain("latency_ms");
  });

  it("uses CLOUDFLARE_ANALYTICS_DATASET env var when set", () => {
    process.env.CLOUDFLARE_ANALYTICS_DATASET = "my_custom_dataset";
    const sql = defaultEdgeLatencySql();
    expect(sql).toContain("my_custom_dataset");
  });

  it("accepts explicit dataset parameter that takes lower priority than env var", () => {
    const sql = defaultEdgeLatencySql("explicit_dataset");
    // When env var is NOT set, explicit param is used
    expect(sql).toContain("explicit_dataset");
  });

  it("env var overrides explicit parameter", () => {
    process.env.CLOUDFLARE_ANALYTICS_DATASET = "env_dataset";
    const sql = defaultEdgeLatencySql("param_dataset");
    expect(sql).toContain("env_dataset");
    expect(sql).not.toContain("param_dataset");
  });
});
