/**
 * Tests for src/lib/csrf.ts
 *
 * Covers:
 *  - generateCsrfToken() — format and uniqueness
 *  - storeCsrfToken() — calls db.prepare/bind/run correctly
 *  - validateCsrfToken() — valid/expired/missing/session-filtered
 *  - deleteCsrfToken() — calls delete query
 *  - cleanupExpiredCsrfTokens() — uses meta.changes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
  deleteCsrfToken,
  cleanupExpiredCsrfTokens,
} from "@/lib/csrf";
import type { AuthDatabase } from "@/lib/auth-d1";

// ---------------------------------------------------------------------------
// Helpers to build a minimal AuthDatabase mock
// ---------------------------------------------------------------------------
function makeDb(opts: {
  firstResult?: { session_id: string } | null;
  runMeta?: { changes: number };
}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(opts.firstResult ?? null),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: opts.runMeta ?? { changes: 0 },
    }),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  } as unknown as AuthDatabase & { _stmt: typeof stmt };
}

// ---------------------------------------------------------------------------
describe("generateCsrfToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns unique values on each call", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
describe("storeCsrfToken", () => {
  it("inserts token with expiry 1 hour from now", async () => {
    const db = makeDb({});
    const before = Math.floor(Date.now() / 1000);
    await storeCsrfToken(db as AuthDatabase, "sess-1", "tok-abc");
    const after = Math.floor(Date.now() / 1000);

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO csrf_token")
    );
    const bindCall = db._stmt.bind.mock.calls[0];
    expect(bindCall[0]).toBe("tok-abc");
    expect(bindCall[1]).toBe("sess-1");
    const expiresAt = bindCall[2] as number;
    expect(expiresAt).toBeGreaterThanOrEqual(before + 3600);
    expect(expiresAt).toBeLessThanOrEqual(after + 3600);
  });
});

// ---------------------------------------------------------------------------
describe("validateCsrfToken", () => {
  it("returns true when token found", async () => {
    const db = makeDb({ firstResult: { session_id: "sess-1" } });
    const result = await validateCsrfToken(db as AuthDatabase, "tok-abc");
    expect(result).toBe(true);
  });

  it("returns false when token not found", async () => {
    const db = makeDb({ firstResult: null });
    const result = await validateCsrfToken(db as AuthDatabase, "tok-missing");
    expect(result).toBe(false);
  });

  it("includes session_id filter when provided", async () => {
    const db = makeDb({ firstResult: { session_id: "sess-2" } });
    const result = await validateCsrfToken(db as AuthDatabase, "tok-abc", "sess-2");
    expect(result).toBe(true);
    const bindCall = db._stmt.bind.mock.calls[0];
    expect(bindCall).toHaveLength(3);
    expect(bindCall[2]).toBe("sess-2");
  });

  it("uses simpler query without session filter", async () => {
    const db = makeDb({ firstResult: { session_id: "any" } });
    await validateCsrfToken(db as AuthDatabase, "tok-abc");
    const bindCall = db._stmt.bind.mock.calls[0];
    expect(bindCall).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe("deleteCsrfToken", () => {
  it("runs DELETE query with the token", async () => {
    const db = makeDb({});
    await deleteCsrfToken(db as AuthDatabase, "tok-del");
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM csrf_token WHERE id = ?")
    );
    expect(db._stmt.bind).toHaveBeenCalledWith("tok-del");
  });
});

// ---------------------------------------------------------------------------
describe("cleanupExpiredCsrfTokens", () => {
  it("returns meta.changes from the DELETE run", async () => {
    const db = makeDb({ runMeta: { changes: 7 } });
    const count = await cleanupExpiredCsrfTokens(db as AuthDatabase);
    expect(count).toBe(7);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM csrf_token WHERE expires_at < ?")
    );
  });

  it("returns 0 when meta is absent", async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as AuthDatabase;
    const count = await cleanupExpiredCsrfTokens(db);
    expect(count).toBe(0);
  });
});
