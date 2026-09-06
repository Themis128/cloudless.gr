/**
 * Tests for AppFlowy stub modules:
 *   - appflowy-cache.ts
 *   - appflowy-esp32.ts
 *   - appflowy-reports.ts
 *   - appflowy-analytics.ts
 *
 * All are no-op stubs; tests verify return values and that code paths
 * that depend on isAppFlowyConfigured() branch correctly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock isAppFlowyConfigured
// ---------------------------------------------------------------------------
const mockIsConfigured = vi.hoisted(() => vi.fn<[], Promise<boolean>>());

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: mockIsConfigured,
}));

// ---------------------------------------------------------------------------
// appflowy-cache
// ---------------------------------------------------------------------------
import {
  invalidateCache,
  invalidateCacheKeys,
} from "@/lib/appflowy-cache";

describe("appflowy-cache", () => {
  beforeEach(() => {
    mockIsConfigured.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("invalidateCache: skips when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    await expect(invalidateCache()).resolves.toBeUndefined();
  });

  it("invalidateCache: warns when configured", async () => {
    mockIsConfigured.mockResolvedValue(true);
    await invalidateCache();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalidateCache called")
    );
  });

  it("invalidateCacheKeys: skips when not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    await expect(invalidateCacheKeys(["key1", "key2"])).resolves.toBeUndefined();
  });

  it("invalidateCacheKeys: warns when configured", async () => {
    mockIsConfigured.mockResolvedValue(true);
    await invalidateCacheKeys(["key1"]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalidateCacheKeys"),
      ["key1"],
      "(no-op)"
    );
  });
});

// ---------------------------------------------------------------------------
// appflowy-esp32
// ---------------------------------------------------------------------------
import {
  syncESP32Devices,
  getESP32Alerts,
  acknowledgeESP32Alert,
  createESP32Alert,
} from "@/lib/appflowy-esp32";

describe("appflowy-esp32", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("syncESP32Devices returns empty array", async () => {
    await expect(syncESP32Devices()).resolves.toEqual([]);
  });

  it("getESP32Alerts returns empty array", async () => {
    await expect(getESP32Alerts()).resolves.toEqual([]);
  });

  it("acknowledgeESP32Alert warns and returns false", async () => {
    const result = await acknowledgeESP32Alert("alert-1");
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("acknowledgeESP32Alert"),
      "alert-1",
      "(no-op)"
    );
  });

  it("createESP32Alert warns and returns null", async () => {
    const alert = {
      deviceId: "dev-1",
      type: "temp",
      message: "Too hot",
      severity: "warning" as const,
    };
    const result = await createESP32Alert(alert);
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Would create alert"),
      alert
    );
  });
});

// ---------------------------------------------------------------------------
// appflowy-reports
// ---------------------------------------------------------------------------
import {
  getReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
} from "@/lib/appflowy-reports";

describe("appflowy-reports", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("getReports returns empty array", async () => {
    await expect(getReports()).resolves.toEqual([]);
  });

  it("getReport returns null", async () => {
    await expect(getReport("rpt-1")).resolves.toBeNull();
  });

  it("createReport warns and returns null", async () => {
    const result = await createReport({
      title: "Q1 Report",
      type: "quarterly",
      status: "draft",
      content: "...",
    });
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Would create report"),
      "Q1 Report"
    );
  });

  it("updateReport warns and returns false", async () => {
    const result = await updateReport("rpt-1", { title: "Updated" });
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Would update report"),
      "rpt-1"
    );
  });

  it("deleteReport warns and returns false", async () => {
    const result = await deleteReport("rpt-1");
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Would delete report"),
      "rpt-1"
    );
  });
});

// ---------------------------------------------------------------------------
// appflowy-analytics
// ---------------------------------------------------------------------------
import {
  trackEvent,
  getAnalyticsSummary,
  createWeeklyRollup,
  archiveOldEvents,
} from "@/lib/appflowy-analytics";

describe("appflowy-analytics", () => {
  beforeEach(() => {
    mockIsConfigured.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("trackEvent", () => {
    it("returns true and skips when not configured", async () => {
      mockIsConfigured.mockResolvedValue(false);
      const result = await trackEvent({ event: "page_view", path: "/home" });
      expect(result).toBe(true);
    });

    it("returns true and warns when configured", async () => {
      mockIsConfigured.mockResolvedValue(true);
      const result = await trackEvent({ event: "blog_view", path: "/blog/foo" });
      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Would track event"),
        "blog_view",
        "/blog/foo"
      );
    });

    it("returns true for event with no path", async () => {
      mockIsConfigured.mockResolvedValue(true);
      const result = await trackEvent({ event: "contact_submit" });
      expect(result).toBe(true);
    });
  });

  describe("getAnalyticsSummary", () => {
    it("returns zero summary when not configured", async () => {
      mockIsConfigured.mockResolvedValue(false);
      const result = await getAnalyticsSummary();
      expect(result).toEqual({
        totalEvents: 0,
        uniqueVisitors: 0,
        topPages: [],
        eventsByType: {},
      });
    });

    it("returns zero summary when configured (stub)", async () => {
      mockIsConfigured.mockResolvedValue(true);
      const result = await getAnalyticsSummary(14);
      expect(result).toEqual({
        totalEvents: 0,
        uniqueVisitors: 0,
        topPages: [],
        eventsByType: {},
      });
    });
  });

  describe("createWeeklyRollup", () => {
    it("returns true when not configured", async () => {
      mockIsConfigured.mockResolvedValue(false);
      await expect(createWeeklyRollup()).resolves.toBe(true);
    });

    it("warns and returns true when configured", async () => {
      mockIsConfigured.mockResolvedValue(true);
      await expect(createWeeklyRollup()).resolves.toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("weekly rollup")
      );
    });
  });

  describe("archiveOldEvents", () => {
    it("returns 0 when not configured", async () => {
      mockIsConfigured.mockResolvedValue(false);
      await expect(archiveOldEvents()).resolves.toBe(0);
    });

    it("warns and returns 0 when configured", async () => {
      mockIsConfigured.mockResolvedValue(true);
      await expect(archiveOldEvents(30)).resolves.toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Would archive events older than"),
        30,
        "days"
      );
    });

    it("uses default 90 days", async () => {
      mockIsConfigured.mockResolvedValue(true);
      await archiveOldEvents();
      expect(console.warn).toHaveBeenCalledWith(
        expect.anything(),
        90,
        "days"
      );
    });
  });
});
