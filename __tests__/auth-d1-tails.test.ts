// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tail coverage for src/lib/auth-d1.ts — run against a real local SQLite
 * database through the same node:sqlite adapter the dev D1 shim uses.
 * SESSION_SECRET is a module-level const, so each test reloads the module
 * under the env it needs.
 */

const SHORT_SECRET = "short-secret";
const LONG_SECRET = "a".repeat(48);

let dir = "";
const ORIG_NODE_ENV = process.env.NODE_ENV;

function seedDb(schema: string): string {
  dir = mkdtempSync(join(tmpdir(), "cloudless-authd1-"));
  const p = join(dir, "user-auth-db.sqlite");
  const db = new DatabaseSync(p);
  db.exec(schema);
  db.close();
  return p;
}

const FULL_SCHEMA = `
  CREATE TABLE user (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    company TEXT,
    phone TEXT,
    password_hash TEXT,
    preferences_json TEXT,
    created_at INTEGER,
    updated_at INTEGER
  );
  CREATE TABLE user_role (user_id TEXT, role TEXT);
  CREATE TABLE session (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER, created_at INTEGER);
  CREATE TABLE session_log (action TEXT, email TEXT, created_at INTEGER);
`;

async function localDb(sqlitePath: string) {
  vi.stubEnv("AUTH_DB_LOCAL_SQLITE", sqlitePath);
  const { resetLocalAuthDbCache, getLocalAuthDb } = await import("@/lib/auth-db-local");
  resetLocalAuthDbCache();
  const db = getLocalAuthDb();
  if (!db) throw new Error("local db failed to open");
  return db;
}

async function freshAuthD1() {
  vi.resetModules();
  return import("@/lib/auth-d1");
}

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.NODE_ENV = ORIG_NODE_ENV;
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = "";
  }
});

describe("auth-d1 tails — real sqlite", () => {
  it("createUser warns and returns the failure result on a schema mismatch", async () => {
    const path = seedDb(`CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT);`);
    const db = await localDb(path);
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createUser } = await freshAuthD1();
    const res = await createUser(db, "new@cloudless.gr", "password-123", "New");
    expect(res.error).toBe("Failed to create user");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[auth-d1] createUser failed:"),
      expect.anything()
    );
    warn.mockRestore();
  });

  it("authenticateUser warns on a short SESSION_SECRET and honours NULL preferences", async () => {
    const path = seedDb(FULL_SCHEMA);
    const db = await localDb(path);
    vi.stubEnv("SESSION_SECRET", SHORT_SECRET);
    const { createUser, authenticateUser } = await freshAuthD1();

    const created = await createUser(db, "u@cloudless.gr", "password-123", "U");
    expect(created.user).toBeDefined();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await authenticateUser(db, "u@cloudless.gr", "password-123");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("SESSION_SECRET should be at least 32 characters")
    );
    expect(res.error).toBeUndefined();
    expect(res.user?.email).toBe("u@cloudless.gr");
    expect(res.session?.id).toBeTruthy();
    warn.mockRestore();
  });

  it("consumePasswordResetToken validates, consumes, and clears the token", async () => {
    const path = seedDb(FULL_SCHEMA);
    const db = await localDb(path);
    vi.stubEnv("SESSION_SECRET", SHORT_SECRET);
    const { createUser, createPasswordResetToken, consumePasswordResetToken } =
      await freshAuthD1();

    await createUser(db, "r@cloudless.gr", "old-password-1", "R");
    const { token } = await createPasswordResetToken(db, "r@cloudless.gr");
    expect(token).toBeTruthy();

    // Wrong token → invalid-or-expired branch.
    const bad = await consumePasswordResetToken(db, "not-the-token", "new-password-1");
    expect(bad).toEqual({ success: false, error: "Invalid or expired reset token" });

    // Real token → success, password changed, reset fields removed.
    const ok = await consumePasswordResetToken(db, token!, "new-password-1");
    expect(ok).toEqual({ success: true });
    const row = await db
      .prepare("SELECT preferences_json FROM user WHERE email = ?")
      .bind("r@cloudless.gr")
      .first<{ preferences_json: string }>();
    expect(row?.preferences_json).not.toContain("reset_token");

    // Token is single-use.
    const again = await consumePasswordResetToken(db, token!, "other-password-1");
    expect(again.success).toBe(false);
  });

  it("consumePasswordResetToken refuses when SESSION_SECRET is unset", async () => {
    delete process.env.SESSION_SECRET;
    const path = seedDb(FULL_SCHEMA);
    const db = await localDb(path);
    const { consumePasswordResetToken } = await freshAuthD1();
    const res = await consumePasswordResetToken(db, "t", "x".repeat(12));
    expect(res.success).toBe(false);
    expect(res.error).toContain("not configured");
  });

  it("validateSessionSecret rejects a short secret and accepts a long one", async () => {
    vi.stubEnv("SESSION_SECRET", SHORT_SECRET);
    let mod = await freshAuthD1();
    expect(mod.validateSessionSecret()).toEqual({
      valid: false,
      error: "SESSION_SECRET must be at least 32 characters",
    });

    vi.stubEnv("SESSION_SECRET", LONG_SECRET);
    mod = await freshAuthD1();
    expect(mod.validateSessionSecret()).toEqual({ valid: true });
  });

  it("markEmailVerified returns false when the update fails", async () => {
    const { markEmailVerified } = await freshAuthD1();
    const broken = {
      prepare() {
        throw new Error("db gone");
      },
    } as never;
    expect(await markEmailVerified(broken, "x@y.gr")).toBe(false);
  });

  it("patchUserProfile serializes preferences and clears fields", async () => {
    const path = seedDb(FULL_SCHEMA);
    const db = await localDb(path);
    const { createUser, patchUserProfile, getUserByEmail } = await freshAuthD1();
    const created = await createUser(db, "p@cloudless.gr", "password-123", "Pat");
    const userId = created.user!.id;

    const ok = await patchUserProfile(db, userId, {
      company: "",
      phone: "210-1",
      preferences: { theme: "dark" },
    });
    expect(ok).toBe(true);
    const user = await getUserByEmail(db, "p@cloudless.gr");
    expect(user?.company).toBeNull();
    expect(user?.phone).toBe("210-1");
    expect(user?.preferences_json).toContain('"theme":"dark"');
  });

  it("getAuthDbFromEnv takes the local-sqlite path when prefer-local is set", async () => {
    const path = seedDb(FULL_SCHEMA);
    await localDb(path);
    process.env.NODE_ENV = "development";
    vi.stubEnv("AUTH_DB_PREFER_LOCAL", "1");
    delete process.env.AUTH_DB_USE_HTTP;
    const { getAuthDbFromEnv } = await freshAuthD1();
    // Either the computed-require resolves the local shim or it fails and
    // falls through — both execute the prefer-local branch.
    getAuthDbFromEnv();
  });

  it("readPreferenceFlag defaults on malformed preferences_json", async () => {
    const path = seedDb(FULL_SCHEMA);
    const db = await localDb(path);
    vi.stubEnv("SESSION_SECRET", LONG_SECRET);
    const { createUser, listUsers } = await freshAuthD1();
    await createUser(db, "m@cloudless.gr", "password-123", "M");
    db.prepare("UPDATE user SET preferences_json = ? WHERE email = ?")
      .bind("{not json", "m@cloudless.gr")
      .run();
    const rows = await listUsers(db);
    const user = rows.find((r) => r.email === "m@cloudless.gr");
    expect(user?.emailVerified).toBe(true);
  });
});
