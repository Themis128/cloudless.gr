/**
 * Tests for src/lib/gsc-weekly-archive.ts
 *
 * Covers:
 *  - getGscReports() — no bucket, missing object, bad JSON, empty reports,
 *    valid data, limit clamping, R2 error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetBucket } = vi.hoisted(() => ({
  mockGetBucket: vi.fn(),
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: mockGetBucket,
}));

import { getGscReports, type GscWeeklyReport } from "@/lib/gsc-weekly-archive";

// ---------------------------------------------------------------------------
const WEEK_REPORT: GscWeeklyReport = {
  id: "2026-06-08",
  week: "Week of 2026-06-08",
  date: "2026-06-08",
  clicks: 500,
  impressions: 12000,
  ctrPct: 4.16,
  avgPosition: 9.2,
  keywords: 120,
  topKeywords: [{ q: "cloudless hosting", clicks: 40, ctr: 8 }],
  topCountry: "GR",
  mobilePct: 55,
  ctrOpportunities: 12,
};

function makeR2Object(text: string) {
  return { text: vi.fn().mockResolvedValue(text) };
}

beforeEach(() => {
  mockGetBucket.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
describe("getGscReports", () => {
  it("returns null when bucket is not configured", async () => {
    mockGetBucket.mockReturnValue(null);
    await expect(getGscReports()).resolves.toBeNull();
  });

  it("returns null when object does not exist in bucket", async () => {
    mockGetBucket.mockReturnValue({ get: vi.fn().mockResolvedValue(null) });
    await expect(getGscReports()).resolves.toBeNull();
  });

  it("returns null when parsed reports array is empty", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ reports: [] }))) };
    mockGetBucket.mockReturnValue(bucket);
    await expect(getGscReports()).resolves.toBeNull();
  });

  it("returns null when reports field is missing", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ generated_at: "2026-06-09" }))) };
    mockGetBucket.mockReturnValue(bucket);
    await expect(getGscReports()).resolves.toBeNull();
  });

  it("returns null and warns on JSON parse error", async () => {
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object("not-valid-json{")) };
    mockGetBucket.mockReturnValue(bucket);
    await expect(getGscReports()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("R2 snapshot read failed"),
      expect.anything()
    );
  });

  it("returns null and warns on R2 .get() throw", async () => {
    const bucket = { get: vi.fn().mockRejectedValue(new Error("R2 connection refused")) };
    mockGetBucket.mockReturnValue(bucket);
    await expect(getGscReports()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("R2 snapshot read failed"),
      "R2 connection refused"
    );
  });

  it("returns the reports array when valid", async () => {
    const snapshot = { reports: [WEEK_REPORT] };
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify(snapshot))) };
    mockGetBucket.mockReturnValue(bucket);
    const result = await getGscReports();
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe("2026-06-08");
  });

  it("limits to default 26 reports", async () => {
    const reports = Array.from({ length: 30 }, (_, i) => ({ ...WEEK_REPORT, id: `2026-${i}` }));
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ reports }))) };
    mockGetBucket.mockReturnValue(bucket);
    const result = await getGscReports();
    expect(result).toHaveLength(26);
  });

  it("respects custom limit", async () => {
    const reports = Array.from({ length: 10 }, (_, i) => ({ ...WEEK_REPORT, id: `2026-${i}` }));
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ reports }))) };
    mockGetBucket.mockReturnValue(bucket);
    const result = await getGscReports(5);
    expect(result).toHaveLength(5);
  });

  it("clamps limit to max 52", async () => {
    const reports = Array.from({ length: 60 }, (_, i) => ({ ...WEEK_REPORT, id: `w-${i}` }));
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ reports }))) };
    mockGetBucket.mockReturnValue(bucket);
    const result = await getGscReports(100);
    expect(result).toHaveLength(52);
  });

  it("clamps limit to min 1", async () => {
    const reports = [WEEK_REPORT, { ...WEEK_REPORT, id: "w-2" }];
    const bucket = { get: vi.fn().mockResolvedValue(makeR2Object(JSON.stringify({ reports }))) };
    mockGetBucket.mockReturnValue(bucket);
    const result = await getGscReports(0);
    expect(result).toHaveLength(1);
  });
});
