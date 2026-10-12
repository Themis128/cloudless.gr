// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getLocalAuthDb, resetLocalAuthDbCache } from "@/lib/auth-db-local";

const d1ScanDir = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");

describe("getLocalAuthDb", () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_DB_LOCAL_SQLITE: process.env.AUTH_DB_LOCAL_SQLITE,
  };
  let dir = "";

  afterEach(() => {
    resetLocalAuthDbCache();
    process.env.NODE_ENV = envSnapshot.NODE_ENV;
    if (envSnapshot.AUTH_DB_LOCAL_SQLITE === undefined) {
      delete process.env.AUTH_DB_LOCAL_SQLITE;
    } else {
      process.env.AUTH_DB_LOCAL_SQLITE = envSnapshot.AUTH_DB_LOCAL_SQLITE;
    }
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = "";
    }
    rmSync(join(process.cwd(), ".wrangler/state/v3/d1"), {
      recursive: true,
      force: true,
    });
    vi.restoreAllMocks();
  });

  it("opens a wrangler-style sqlite and answers SELECT 1", async () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-d1-"));
    const sqlitePath = join(dir, "user-auth-db.sqlite");
    const seed = new DatabaseSync(sqlitePath);
    seed.exec("CREATE TABLE user (id TEXT PRIMARY KEY);");
    seed.close();

    process.env.AUTH_DB_LOCAL_SQLITE = sqlitePath;
    resetLocalAuthDbCache();
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    const row = await db!.prepare("SELECT 1 as ok").first<{ ok: number }>();
    expect(Number(row?.ok)).toBe(1);
  });

  it("returns null when the sqlite path does not exist", () => {
    process.env.AUTH_DB_LOCAL_SQLITE = join(tmpdir(), "missing-cloudless-d1.sqlite");
    resetLocalAuthDbCache();
    expect(getLocalAuthDb()).toBeNull();
  });

  it("returns null outside development with no override", () => {
    expect(getLocalAuthDb()).toBeNull();
  });

  it("warns and returns null in development with no sqlite files", () => {
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getLocalAuthDb()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("No local D1 sqlite")
    );
  });

  it("adapts all/run/first/col against a real sqlite file", async () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-d1-"));
    const sqlitePath = join(dir, "db.sqlite");
    const seed = new DatabaseSync(sqlitePath);
    seed.exec(
      "CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);" +
        "INSERT INTO users VALUES ('u1','a@b.c','Ana'),('u2','d@e.f','Dan');"
    );
    seed.close();

    process.env.AUTH_DB_LOCAL_SQLITE = sqlitePath;
    resetLocalAuthDbCache();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Using local D1 sqlite")
    );

    const all = await db!
      .prepare("SELECT id FROM users ORDER BY id")
      .bind()
      .all<{ id: string }>();
    expect(all).toEqual({ results: [{ id: "u1" }, { id: "u2" }], success: true });

    const one = await db!
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind("u1")
      .first<{ id: string; email: string }>();
    expect(one?.email).toBe("a@b.c");

    const col = await db!
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind("u2")
      .first<string>("email");
    expect(col).toBe("d@e.f");

    expect(
      await db!.prepare("SELECT * FROM users WHERE id = ?").bind("ghost").first()
    ).toBeNull();

    const run = await db!
      .prepare("UPDATE users SET name = ? WHERE id = ?")
      .bind("Ana2", "u1")
      .run();
    expect(run).toEqual({ success: true, meta: { changes: 1 } });

    expect(getLocalAuthDb()).toBe(db); // cached adapter
  });

  it("repairs a stale user_role FK pointing at user_old", async () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-d1-"));
    const sqlitePath = join(dir, "broken.sqlite");
    const seed = new DatabaseSync(sqlitePath);
    seed.exec(
      "CREATE TABLE user_old (id TEXT PRIMARY KEY);" +
        "CREATE TABLE user (id TEXT PRIMARY KEY);" +
        "CREATE TABLE user_role (user_id TEXT, role TEXT, " +
        "FOREIGN KEY(user_id) REFERENCES user_old(id));" +
        "PRAGMA foreign_keys = OFF;" +
        "INSERT INTO user_role VALUES('u1','admin');"
    );
    seed.close();

    process.env.AUTH_DB_LOCAL_SQLITE = sqlitePath;
    resetLocalAuthDbCache();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Repairing user_role FK")
    );
    const ddl = await db!
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_role'"
      )
      .first<{ sql: string }>();
    expect(ddl?.sql).toContain("REFERENCES user(id)");
    const rows = await db!
      .prepare("SELECT * FROM user_role")
      .all<{ role: string }>();
    expect(rows.results[0]?.role).toBe("admin"); // data preserved
  });

  it("survives a non-sqlite file — repair warns, adapter still returned", () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-d1-"));
    const junk = join(dir, "junk.sqlite");
    writeFileSync(junk, "not sqlite");
    process.env.AUTH_DB_LOCAL_SQLITE = junk;
    resetLocalAuthDbCache();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("user_role FK repair failed"),
      expect.anything()
    );
  });

  it("returns null when the path cannot be opened as a database", () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-d1-"));
    process.env.AUTH_DB_LOCAL_SQLITE = dir; // a directory
    resetLocalAuthDbCache();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getLocalAuthDb()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to open local D1 sqlite"),
      expect.anything()
    );
  });

  it("scans .wrangler D1 dirs when no override is set", () => {
    process.env.NODE_ENV = "development";
    dir = d1ScanDir;
    mkdirSync(d1ScanDir, { recursive: true });
    writeFileSync(join(d1ScanDir, "metadata.sqlite"), "x"); // skipped by name
    writeFileSync(join(d1ScanDir, "b.sqlite"), "x"); // picked by scan
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(join(d1ScanDir, "b.sqlite"))
    );
  });
});
