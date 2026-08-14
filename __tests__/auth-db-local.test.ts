// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { getLocalAuthDb, resetLocalAuthDbCache } from "@/lib/auth-db-local";

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
});
