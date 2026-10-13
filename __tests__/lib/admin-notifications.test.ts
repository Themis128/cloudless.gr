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

describe("admin-notifications tails", () => {
  it("builds the until/includeArchived clauses", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const binds: unknown[] = [];
    const sqls: string[] = [];
    const db = {
      prepare: (sql: string) => {
        sqls.push(sql);
        return {
          bind: (...args: unknown[]) => {
            binds.push(...args);
            return { all: async () => ({ results: [] }), run: async () => ({}) };
          },
        };
      },
    };
    vi.mocked(getAuthDbFromEnv).mockReturnValueOnce(db as never);
    await listNotifications({
      category: "contact",
      since: "2026-10-01",
      until: "2026-10-31",
      includeArchived: true,
      limit: 10,
    });
    expect(sqls[0]).toContain("sk < ?");
    expect(sqls[0]).not.toContain("archived_at IS NULL");
    expect(binds).toContain("2026-10-31~");
    expect(binds).toContain("2026-10-01#");
    expect(binds).toContain(10);
  });

  it("sinks the notification record to the data lake bucket", async () => {
    const { getDataLakeBucketFromEnv } = await import("@/lib/r2-client");
    const put = vi.fn(async () => undefined);
    vi.mocked(getDataLakeBucketFromEnv).mockReturnValueOnce({ put } as never);
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    vi.mocked(getAuthDbFromEnv).mockReturnValueOnce(null);

    await recordNotification({
      category: "contact",
      type: "info",
      title: "Test Notif",
      message: "body",
      actor: "a@b.com",
      metadata: { k: "v" },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(put).toHaveBeenCalledOnce();
    const [key, record, meta] = put.mock.calls[0] as [
      string,
      string,
      { httpMetadata: { contentType: string } },
    ];
    expect(key).toMatch(/^lake\/notifications\/year=\d{4}\/month=\d{2}\//);
    const parsed = JSON.parse(record);
    expect(parsed.title).toBe("Test Notif");
    expect(parsed.email).toBe("a@b.com");
    expect(parsed.channel).toBe("system");
    expect(parsed.metadata).toBe(JSON.stringify({ k: "v" }));
    expect(meta.httpMetadata.contentType).toBe("application/json");
  });
});
