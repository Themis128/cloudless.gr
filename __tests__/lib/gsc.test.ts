import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({
  GOOGLE_CLIENT_EMAIL: "",
  GOOGLE_PRIVATE_KEY: "",
  GSC_SITE_URL: "",
});

import {
  getSeoSnapshot,
  getTopKeywords,
  getPerformanceHistory,
  getTopPages,
  getWebAnalytics,
  getCtrOpportunities,
  getDeviceBreakdown,
  getTrafficByCountry,
} from "@/lib/gsc";

describe("gsc (not configured)", () => {
  it("getSeoSnapshot returns null when GSC is not configured", async () => {
    const result = await getSeoSnapshot();
    expect(result).toBeNull();
  });

  it("getTopKeywords returns [] when not configured", async () => {
    const result = await getTopKeywords();
    expect(result).toEqual([]);
  });

  it("getPerformanceHistory returns [] when not configured", async () => {
    const result = await getPerformanceHistory();
    expect(result).toEqual([]);
  });

  it("getTopPages returns [] when not configured", async () => {
    const result = await getTopPages();
    expect(result).toEqual([]);
  });

  it("getWebAnalytics returns null when not configured", async () => {
    const result = await getWebAnalytics();
    expect(result).toBeNull();
  });

  it("getCtrOpportunities returns [] when not configured", async () => {
    const result = await getCtrOpportunities();
    expect(result).toEqual([]);
  });

  it("getDeviceBreakdown returns [] when not configured", async () => {
    const result = await getDeviceBreakdown();
    expect(result).toEqual([]);
  });

  it("getTrafficByCountry returns [] when not configured", async () => {
    const result = await getTrafficByCountry();
    expect(result).toEqual([]);
  });
});
