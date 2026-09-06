/**
 * Tests for src/lib/analytics-engine.ts
 *
 * Covers writeAnalyticsEvent, queryAnalyticsEngine, and ANALYTICS_QUERIES.
 */
import { describe, it, expect, vi } from "vitest";
import {
  writeAnalyticsEvent,
  queryAnalyticsEngine,
  ANALYTICS_QUERIES,
} from "@/lib/analytics-engine";

// ---------------------------------------------------------------------------
// Build a mock AnalyticsEngineEnv
// ---------------------------------------------------------------------------
function makeEnv(queryResults: Record<string, unknown>[] = []) {
  const bound = {
    run: vi.fn().mockResolvedValue(undefined),
    all: vi.fn().mockResolvedValue({ results: queryResults }),
  };
  const stmt = {
    bind: vi.fn().mockReturnValue(bound),
  };
  const analytics = {
    prepare: vi.fn().mockReturnValue(stmt),
  };
  return {
    env: { ANALYTICS: analytics } as unknown as Parameters<typeof writeAnalyticsEvent>[0],
    analytics,
    stmt,
    bound,
  };
}

// ---------------------------------------------------------------------------
describe("writeAnalyticsEvent", () => {
  it("calls prepare with INSERT SQL", async () => {
    const { env, analytics } = makeEnv();
    await writeAnalyticsEvent(env, { index1: "/home", metric1: 42 });
    expect(analytics.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO analytics_events")
    );
  });

  it("binds all index and metric fields", async () => {
    const { env, stmt } = makeEnv();
    const ts = new Date("2026-06-01T00:00:00Z");
    await writeAnalyticsEvent(env, {
      timestamp: ts,
      index1: "ep1",
      index2: "200",
      index3: "uid",
      index4: "GET",
      index5: "/path",
      metric1: 100,
      metric2: 200,
      metric3: 300,
      metric4: 400,
      metric5: 1,
    });
    const bindArgs = stmt.bind.mock.calls[0];
    expect(bindArgs[0]).toBe(ts.toISOString());
    expect(bindArgs[1]).toBe("ep1");
    expect(bindArgs[2]).toBe("200");
    expect(bindArgs[3]).toBe("uid");
    expect(bindArgs[4]).toBe("GET");
    expect(bindArgs[5]).toBe("/path");
    expect(bindArgs[6]).toBe(100);
    expect(bindArgs[7]).toBe(200);
    expect(bindArgs[8]).toBe(300);
    expect(bindArgs[9]).toBe(400);
    expect(bindArgs[10]).toBe(1);
  });

  it("defaults timestamp to now when omitted", async () => {
    const { env, stmt } = makeEnv();
    const before = Date.now();
    await writeAnalyticsEvent(env, {});
    const after = Date.now();
    const isoArg = stmt.bind.mock.calls[0][0] as string;
    const ts = new Date(isoArg).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("passes undefined for missing fields", async () => {
    const { env, stmt } = makeEnv();
    await writeAnalyticsEvent(env, { metric1: 99 });
    const bindArgs = stmt.bind.mock.calls[0];
    expect(bindArgs[1]).toBeUndefined(); // index1
    expect(bindArgs[6]).toBe(99); // metric1
  });
});

// ---------------------------------------------------------------------------
describe("queryAnalyticsEngine", () => {
  it("prepares and executes the provided SQL", async () => {
    const rows = [{ endpoint: "/api", hits: 10 }];
    const { env, analytics } = makeEnv(rows);
    const results = await queryAnalyticsEngine(env, "SELECT * FROM x WHERE y = ?", ["val"]);
    expect(analytics.prepare).toHaveBeenCalledWith("SELECT * FROM x WHERE y = ?");
    expect(results).toEqual(rows);
  });

  it("passes binds to the statement", async () => {
    const { env, stmt } = makeEnv();
    await queryAnalyticsEngine(env, "SELECT 1", ["a", 42]);
    expect(stmt.bind).toHaveBeenCalledWith("a", 42);
  });

  it("defaults binds to empty array", async () => {
    const { env, stmt } = makeEnv([{ count: 5 }]);
    await queryAnalyticsEngine(env, "SELECT COUNT(*) as count");
    expect(stmt.bind).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
describe("ANALYTICS_QUERIES", () => {
  it("has all expected keys", () => {
    expect(Object.keys(ANALYTICS_QUERIES)).toEqual(
      expect.arrayContaining(["dailyRollup", "statusBreakdown", "topEndpoints", "latencyHeatmap"])
    );
  });

  it("each query is a non-empty SQL string", () => {
    for (const [key, sql] of Object.entries(ANALYTICS_QUERIES)) {
      expect(typeof sql).toBe("string");
      expect(sql.trim().length).toBeGreaterThan(0);
      expect(sql.toUpperCase()).toContain("SELECT");
    }
  });
});
