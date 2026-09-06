/**
 * Tests for src/lib/auth-audit.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logAuthAction,
  queryAuditLog,
  getAuditLogCount,
  cleanupAuditLog,
  type AuditLogEntry,
} from "@/lib/auth-audit";
import type { AuthDatabase } from "@/lib/auth-d1";

function makeDb(firstResult?: unknown, allResults?: unknown[], changes = 0) {
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes }, success: true });
  const mockFirst = vi.fn().mockResolvedValue(firstResult ?? null);
  const mockAll = vi.fn().mockResolvedValue({ results: allResults ?? [], success: true });
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst, all: mockAll });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
  return {
    db: { prepare: mockPrepare } as unknown as AuthDatabase,
    mockPrepare,
    mockBind,
    mockRun,
    mockFirst,
    mockAll,
  };
}

const FULL_ENTRY: AuditLogEntry = {
  adminUserId: "admin-1",
  action: "promote_admin",
  targetUserId: "user-2",
  targetEmail: "user@example.com",
  ip: "1.2.3.4",
  userAgent: "Mozilla/5.0",
  requestPath: "/api/admin/users",
  requestMethod: "POST",
  metadata: { reason: "promotion" },
};

describe("logAuthAction", () => {
  it("calls prepare with INSERT SQL", async () => {
    const { db, mockPrepare } = makeDb();
    await logAuthAction(db, FULL_ENTRY);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("INSERT INTO admin_audit_log");
  });

  it("binds all fields in order", async () => {
    const { db, mockBind } = makeDb();
    await logAuthAction(db, FULL_ENTRY);
    const args = mockBind.mock.calls[0];
    expect(args[0]).toBe("admin-1");
    expect(args[1]).toBe("promote_admin");
    expect(args[2]).toBe("user-2");
    expect(args[3]).toBe("user@example.com");
    expect(args[4]).toBe("1.2.3.4");
    expect(args[5]).toBe("Mozilla/5.0");
    expect(args[6]).toBe("/api/admin/users");
    expect(args[7]).toBe("POST");
    expect(args[8]).toBe(JSON.stringify({ reason: "promotion" }));
    expect(typeof args[9]).toBe("number");
  });

  it("passes null for all optional fields when absent", async () => {
    const { db, mockBind } = makeDb();
    await logAuthAction(db, { adminUserId: "a1", action: "login" });
    const args = mockBind.mock.calls[0];
    expect(args[2]).toBeNull(); // targetUserId
    expect(args[3]).toBeNull(); // targetEmail
    expect(args[4]).toBeNull(); // ip
    expect(args[5]).toBeNull(); // userAgent
    expect(args[6]).toBeNull(); // requestPath
    expect(args[7]).toBeNull(); // requestMethod
    expect(args[8]).toBeNull(); // metadata_json
  });

  it("calls run() to execute the statement", async () => {
    const { db, mockRun } = makeDb();
    await logAuthAction(db, FULL_ENTRY);
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("queryAuditLog", () => {
  it("returns results with default limit=100 offset=0", async () => {
    const rows = [{ id: 1, action: "login", admin_user_id: "a1" }];
    const { db, mockAll, mockBind } = makeDb(null, rows);
    const result = await queryAuditLog(db);
    expect(result).toEqual(rows);
    const args = mockBind.mock.calls[0];
    expect(args).toContain(100);
    expect(args).toContain(0);
  });

  it("appends action filter to SQL", async () => {
    const { db, mockPrepare, mockBind } = makeDb(null, []);
    await queryAuditLog(db, { action: "failed_login" });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("action = ?");
    expect(mockBind.mock.calls[0]).toContain("failed_login");
  });

  it("appends adminUserId filter", async () => {
    const { db, mockPrepare, mockBind } = makeDb(null, []);
    await queryAuditLog(db, { adminUserId: "admin-xyz" });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("admin_user_id = ?");
    expect(mockBind.mock.calls[0]).toContain("admin-xyz");
  });

  it("appends targetUserId filter", async () => {
    const { db, mockPrepare, mockBind } = makeDb(null, []);
    await queryAuditLog(db, { targetUserId: "user-99" });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("target_user_id = ?");
    expect(mockBind.mock.calls[0]).toContain("user-99");
  });

  it("appends date range filters", async () => {
    const { db, mockPrepare, mockBind } = makeDb(null, []);
    await queryAuditLog(db, { startDate: 1000, endDate: 9999 });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("created_at >= ?");
    expect(sql).toContain("created_at <= ?");
    expect(mockBind.mock.calls[0]).toContain(1000);
    expect(mockBind.mock.calls[0]).toContain(9999);
  });

  it("uses custom limit and offset", async () => {
    const { db, mockBind } = makeDb(null, []);
    await queryAuditLog(db, { limit: 25, offset: 50 });
    expect(mockBind.mock.calls[0]).toContain(25);
    expect(mockBind.mock.calls[0]).toContain(50);
  });

  it("orders by created_at DESC", async () => {
    const { db, mockPrepare } = makeDb(null, []);
    await queryAuditLog(db);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY created_at DESC");
  });
});

describe("getAuditLogCount", () => {
  it("returns count from DB", async () => {
    const { db } = makeDb({ count: 15 });
    expect(await getAuditLogCount(db)).toBe(15);
  });

  it("returns 0 when result is null", async () => {
    const { db } = makeDb(null);
    expect(await getAuditLogCount(db)).toBe(0);
  });

  it("applies action filter", async () => {
    const { db, mockPrepare, mockBind } = makeDb({ count: 3 });
    await getAuditLogCount(db, { action: "lockout" });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("action = ?");
    expect(mockBind.mock.calls[0]).toContain("lockout");
  });

  it("applies adminUserId filter", async () => {
    const { db, mockPrepare } = makeDb({ count: 0 });
    await getAuditLogCount(db, { adminUserId: "a1" });
    expect(mockPrepare.mock.calls[0][0]).toContain("admin_user_id = ?");
  });

  it("applies date range filters", async () => {
    const { db, mockPrepare, mockBind } = makeDb({ count: 7 });
    await getAuditLogCount(db, { startDate: 500, endDate: 1000 });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("created_at >= ?");
    expect(mockBind.mock.calls[0]).toContain(500);
  });
});

describe("cleanupAuditLog", () => {
  it("deletes entries older than cutoff and returns count", async () => {
    const { db, mockRun, mockBind } = makeDb(null, [], 12);
    const deleted = await cleanupAuditLog(db, 30);
    expect(deleted).toBe(12);
    expect(mockRun).toHaveBeenCalled();
    const cutoff = mockBind.mock.calls[0][0] as number;
    const expected = Math.floor(Date.now() / 1000) - 30 * 86400;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5);
  });

  it("uses 365-day default retention", async () => {
    const { db, mockBind } = makeDb(null, [], 0);
    await cleanupAuditLog(db);
    const cutoff = mockBind.mock.calls[0][0] as number;
    const expected = Math.floor(Date.now() / 1000) - 365 * 86400;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5);
  });

  it("returns 0 when meta is absent", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const db = {
      prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ run: mockRun }) }),
    } as unknown as AuthDatabase;
    expect(await cleanupAuditLog(db)).toBe(0);
  });
});
