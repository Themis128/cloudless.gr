import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn().mockReturnValue(null),
}));

import {
  recordNotification,
  listNotifications,
  markNotificationsRead,
  notificationAnalytics,
  purgeArchivedOlderThan,
} from "@/lib/admin-notifications";

describe("admin-notifications (no AUTH_DB)", () => {
  it("listNotifications returns [] when AUTH_DB is not configured", async () => {
    const result = await listNotifications();
    expect(result).toEqual([]);
  });

  it("listNotifications accepts filters without throwing", async () => {
    const result = await listNotifications({ category: "contact", unreadOnly: true });
    expect(result).toEqual([]);
  });

  it("recordNotification returns null when AUTH_DB is absent", async () => {
    const result = await recordNotification({
      category: "contact",
      type: "info",
      title: "Test",
      message: "Test message",
    });
    expect(result).toBeNull();
  });

  it("markNotificationsRead throws when AUTH_DB is not configured", async () => {
    await expect(markNotificationsRead(["n_123"])).rejects.toThrow("AUTH_DB is not configured");
  });

  it("notificationAnalytics returns zeroed totals when AUTH_DB is absent", async () => {
    const result = await notificationAnalytics();
    expect(result.total).toBe(0);
    expect(result.byDay).toEqual({});
    expect(Object.keys(result.byCategory)).toContain("contact");
  });

  it("purgeArchivedOlderThan throws when AUTH_DB is not configured", async () => {
    await expect(purgeArchivedOlderThan("2026-01-01")).rejects.toThrow(
      "AUTH_DB is not configured"
    );
  });
});
