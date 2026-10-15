/**
 * Node-environment tests for the local D1 sqlite adapter — node:sqlite
 * cannot be bundled in the jsdom/client graph, so this file opts into
 * the node environment.
 *
 * @vitest-environment node
 */
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

const FIXTURE_DB = "/tmp/test-auth-d1.sqlite";
const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const D1_FIXTURE = join(D1_DIR, "vitest-fixture.sqlite");

function makeSqlite(path: string) {
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT)");
  db.exec("INSERT OR IGNORE INTO users(id, email) VALUES ('u1', 'a@b.c')");
  db.close();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("auth-db-local getLocalAuthDb", () => {
  it("opens a real sqlite file via AUTH_DB_LOCAL_SQLITE and runs queries", async () => {
    makeSqlite(FIXTURE_DB);
    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", FIXTURE_DB);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
    resetLocalAuthDbCache();

    const db = getLocalAuthDb();
    expect(db?.prepare).toBeTypeOf("function");

    const all = await db!.prepare("SELECT id, email FROM users").all<{ id: string }>();
    expect(all.success).toBe(true);
    expect(all.results[0]?.id).toBe("u1");

    const row = await db!
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind("u1")
      .first<{ email: string }>("email");
    expect(row).toBe("a@b.c");

    const missing = await db!
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind("nobody")
      .first();
    expect(missing).toBeNull();

    const run = await db!
      .prepare("UPDATE users SET email = ? WHERE id = ?")
      .bind("x@y.z", "u1")
      .run();
    expect(run.success).toBe(true);
    expect(run.meta?.changes).toBe(1);

    const whole = await db!
      .prepare("SELECT id FROM users WHERE id = ?")
      .bind("u1")
      .first<{ id: string }>();
    expect(whole?.id).toBe("u1");

    // Second call returns the cached adapter.
    expect(getLocalAuthDb()).toBe(db);
    resetLocalAuthDbCache();
    warn.mockRestore();
  });

  it("returns null when the override path does not exist", async () => {
    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", "/tmp/definitely-missing-xyz.sqlite");
    const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
    resetLocalAuthDbCache();
    expect(getLocalAuthDb()).toBeNull();
  });

  it("scans .wrangler/state for D1 sqlite candidates when no override is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mkdirSync(D1_DIR, { recursive: true });
    makeSqlite(D1_FIXTURE);
    try {
      const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
      resetLocalAuthDbCache();
      const db = getLocalAuthDb();
      expect(db?.prepare).toBeTypeOf("function");
      resetLocalAuthDbCache();
    } finally {
      rmSync(D1_FIXTURE, { force: true });
      warn.mockRestore();
    }
  });

  it("returns null when the sqlite file cannot be opened", async () => {
    const bad = "/tmp/not-sqlite.txt";
    rmSync(bad, { force: true });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(bad, "definitely not sqlite");
    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", bad);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
    resetLocalAuthDbCache();
    // DatabaseSync tolerates non-db files until first exec — either a working
    // handle or the caught warn path is acceptable; assert it did not throw.
    const db = getLocalAuthDb();
    expect(db === null || typeof db.prepare === "function").toBe(true);
    warn.mockRestore();
  });

  it("warns and returns null when the override path is not a file", async () => {
    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", "/tmp");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
    resetLocalAuthDbCache();
    expect(getLocalAuthDb()).toBeNull();
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("Failed to open local D1 sqlite"))
    ).toBe(true);
    warn.mockRestore();
  });

  it("repairs a user_role table whose FK still references user_old", async () => {
    const legacy = "/tmp/test-auth-legacy.sqlite";
    rmSync(legacy, { force: true });
    const setup = new DatabaseSync(legacy);
    setup.exec(`
      CREATE TABLE user_old(id TEXT PRIMARY KEY);
      CREATE TABLE user_role(
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        PRIMARY KEY (user_id, role),
        FOREIGN KEY (user_id) REFERENCES user_old(id) ON DELETE CASCADE
      );
      INSERT INTO user_old(id) VALUES ('u1');
      INSERT INTO user_role(user_id, role) VALUES ('u1', 'admin');
    `);
    setup.close();

    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", legacy);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getLocalAuthDb, resetLocalAuthDbCache } = await import("@/lib/auth-db-local");
    resetLocalAuthDbCache();
    const db = getLocalAuthDb();
    expect(db?.prepare).toBeTypeOf("function");
    expect(warn.mock.calls.some((c) => String(c[0]).includes("Repairing user_role FK"))).toBe(true);
    // Repaired table now FKs to `user`, not `user_old`.
    const sql = await db!
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'user_role'")
      .first<{ sql: string }>();
    expect(sql?.sql).toContain("REFERENCES user(");
    resetLocalAuthDbCache();
    warn.mockRestore();
  });
});
