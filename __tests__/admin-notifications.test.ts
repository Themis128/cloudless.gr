import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

import {
  recordNotification,
  listNotifications,
  markNotificationsRead,
  notificationAnalytics,
  purgeArchivedOlderThan,
} from "@/lib/admin-notifications";

describe("admin-notifications", () => {
  beforeEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  type Row = Record<string, unknown>;
  function createMemoryDb() {
    const rows: Row[] = [];
    return {
      rows,
      prepare(query: string) {
        const binds: unknown[] = [];
        const stmt = {
          bind(...args: unknown[]) {
            binds.push(...args);
            return stmt;
          },
          async run() {
            if (query.includes("INSERT INTO admin_notification")) {
              rows.push({
                pk: binds[0],
                sk: binds[1],
                category: binds[2],
                id: binds[3],
                type: binds[4],
                title: binds[5],
                message: binds[6],
                actor: binds[7],
                route: binds[8],
                read: binds[9],
                archived_at: binds[10],
                cat_pk: binds[11],
                cat_sk: binds[12],
                payload_json: binds[13],
                created_at: binds[14],
              });
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes("UPDATE admin_notification SET read")) {
              const id = binds[0];
              for (const r of rows) {
                if (r.id === id) r.read = 1;
              }
              return { success: true, meta: { changes: 1 } };
            }
            if (query.includes("DELETE FROM admin_notification")) {
              const cutoff = String(binds[0]);
              let changes = 0;
              for (let i = rows.length - 1; i >= 0; i--) {
                const archived = rows[i].archived_at;
                if (typeof archived === "string" && archived && archived < cutoff) {
                  rows.splice(i, 1);
                  changes++;
                }
              }
              return { success: true, meta: { changes } };
            }
            return { success: true, meta: { changes: 0 } };
          },
          async all<T = Row>() {
            let filtered = [...rows];
            if (query.includes("FROM admin_notification")) {
              let bi = 0;
              if (query.includes("category = ?")) {
                const cat = binds[bi++];
                filtered = filtered.filter((r) => r.category === cat);
              } else if (query.includes("pk = ?")) {
                const pk = binds[bi++];
                filtered = filtered.filter((r) => r.pk === pk);
              }
              if (query.includes("sk >= ?")) {
                const since = String(binds[bi++]);
                filtered = filtered.filter((r) => String(r.sk) >= since);
              }
              if (query.includes("sk < ?")) {
                const until = String(binds[bi++]);
                filtered = filtered.filter((r) => String(r.sk) < until);
              }
              if (query.includes("archived_at IS NULL")) {
                filtered = filtered.filter((r) => !r.archived_at);
              }
              const limit = Number(binds[binds.length - 1] ?? 50);
              filtered.sort((a, b) => String(b.sk).localeCompare(String(a.sk)));
              filtered = filtered.slice(0, limit);
            }
            return { results: filtered as T[], success: true };
          },
          async first() {
            return null;
          },
        };
        return stmt;
      },
    };
  }

  describe("without AUTH_DB", () => {
    it("throws on recordNotification", async () => {
      await expect(
        recordNotification({ category: "contact", title: "T", message: "M" })
      ).rejects.toThrow(/AUTH_DB/);
    });

    it("returns [] from listNotifications", async () => {
      expect(await listNotifications()).toEqual([]);
    });

    it("throws on markNotificationsRead", async () => {
      await expect(markNotificationsRead(["n_1"])).rejects.toThrow(/AUTH_DB/);
    });

    it("is a no-op when markNotificationsRead ids are empty", async () => {
      await expect(markNotificationsRead([])).resolves.toBeUndefined();
    });

    it("throws on purgeArchivedOlderThan", async () => {
      await expect(purgeArchivedOlderThan("2026-01-01")).rejects.toThrow(/AUTH_DB/);
    });

    it("notificationAnalytics returns zeros when list is empty", async () => {
      const r = await notificationAnalytics({ since: "2026-06-01" });
      expect(r.total).toBe(0);
      expect(r.byCategory.contact).toBe(0);
      expect(r.byDay).toEqual({});
    });
  });

  describe("D1 path", () => {
    it("records and lists via D1", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      const r = await recordNotification({
        category: "contact",
        title: "Hi",
        message: "There",
        actor: "a@b.c",
        route: "/api/contact",
        metadata: { ua: "curl" },
      });
      expect(r).not.toBeNull();
      expect(r!.title).toBe("Hi");
      expect(r!.type).toBe("info");
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].category).toBe("contact");
      expect(db.rows[0].actor).toBe("a@b.c");
      expect(db.rows[0].route).toBe("/api/contact");
      expect(JSON.parse(String(db.rows[0].payload_json))).toEqual({ ua: "curl" });
      expect(String(db.rows[0].sk)).toContain("#");

      const listed = await listNotifications({ limit: 10 });
      expect(listed).toHaveLength(1);
      expect(listed[0].title).toBe("Hi");
      expect(listed[0].actor).toBe("a@b.c");
      expect(listed[0].metadata).toEqual({ ua: "curl" });
    });

    it("defaults type to info and omits optional fields", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      await recordNotification({ category: "order", title: "T", message: "M" });
      expect(db.rows[0].type).toBe("info");
      expect(db.rows[0].actor).toBeNull();
      expect(db.rows[0].route).toBeNull();
      expect(db.rows[0].payload_json).toBeNull();
    });

    it("returns null when D1 insert throws", async () => {
      const db = createMemoryDb();
      const originalPrepare = db.prepare.bind(db);
      db.prepare = (query: string) => {
        if (query.includes("INSERT INTO admin_notification")) {
          return {
            bind() {
              return this;
            },
            async run() {
              throw new Error("constraint");
            },
            async all() {
              return { results: [], success: true };
            },
            async first() {
              return null;
            },
          };
        }
        return originalPrepare(query);
      };
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      const r = await recordNotification({ category: "error", title: "T", message: "M" });
      expect(r).toBeNull();
    });

    it("generates unique ids across calls", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      const a = await recordNotification({ category: "auth", title: "T", message: "M" });
      const b = await recordNotification({ category: "auth", title: "T", message: "M" });
      expect(a?.id).not.toBe(b?.id);
    });

    it("filters by category and clamps limit", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      await recordNotification({ category: "contact", title: "C", message: "M" });
      await recordNotification({ category: "order", title: "O", message: "M" });
      const orders = await listNotifications({ category: "order", limit: 5000 });
      expect(orders).toHaveLength(1);
      expect(orders[0].category).toBe("order");
      const clamped = await listNotifications({ limit: -10 });
      expect(clamped.length).toBeLessThanOrEqual(1);
    });

    it("filters out archived rows by default", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      await recordNotification({ category: "contact", title: "Live", message: "M" });
      await recordNotification({ category: "contact", title: "Old", message: "M" });
      db.rows[1].archived_at = "2020-01-01T00:00:00.000Z";
      const live = await listNotifications();
      expect(live.map((n) => n.title)).toEqual(["Live"]);
      const all = await listNotifications({ includeArchived: true });
      expect(all).toHaveLength(2);
    });

    it("drops malformed metadata JSON silently", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      await recordNotification({ category: "contact", title: "T", message: "M" });
      db.rows[0].payload_json = "{not json";
      const r = await listNotifications();
      expect(r[0].metadata).toBeUndefined();
    });

    it("marks read and purges archived on D1", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      const r = await recordNotification({ category: "order", title: "T", message: "M" });
      expect(r?.id).toBeTruthy();
      await markNotificationsRead([r!.id]);
      expect(db.rows[0].read).toBe(1);
      db.rows[0].archived_at = "2020-01-01T00:00:00.000Z";
      const purged = await purgeArchivedOlderThan("2021-01-01");
      expect(purged).toBe(1);
      expect(db.rows).toHaveLength(0);
    });

    it("counts by category and by day", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      const a = await recordNotification({ category: "contact", title: "T", message: "M" });
      const b = await recordNotification({ category: "order", title: "T", message: "M" });
      const c = await recordNotification({ category: "contact", title: "T", message: "M" });
      // Force deterministic createdAt days via sk/created_at for analytics
      db.rows[0].sk = `2026-06-12T10:00:00.000Z#${a!.id}`;
      db.rows[1].sk = `2026-06-12T11:00:00.000Z#${b!.id}`;
      db.rows[2].sk = `2026-06-11T10:00:00.000Z#${c!.id}`;
      const stats = await notificationAnalytics({ since: "2026-06-01" });
      expect(stats.total).toBe(3);
      expect(stats.byCategory.contact).toBe(2);
      expect(stats.byCategory.order).toBe(1);
      expect(stats.byDay["2026-06-12"]).toBe(2);
      expect(stats.byDay["2026-06-11"]).toBe(1);
    });

    it("returns 0 when no archived rows match purge", async () => {
      const db = createMemoryDb();
      (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = db;
      await recordNotification({ category: "contact", title: "T", message: "M" });
      const n = await purgeArchivedOlderThan("2026-01-01");
      expect(n).toBe(0);
    });
  });
});
