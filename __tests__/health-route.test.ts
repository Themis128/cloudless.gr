// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";
import { getLocalAuthDb, resetLocalAuthDbCache } from "@/lib/auth-db-local";

describe("GET /api/health", () => {
  const envSnapshot = {
    AUTH_DB_LOCAL_SQLITE: process.env.AUTH_DB_LOCAL_SQLITE,
  };
  let dir = "";

  afterEach(() => {
    resetLocalAuthDbCache();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
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

  it("reports ok when AUTH_DB sqlite answers SELECT 1", async () => {
    dir = mkdtempSync(join(tmpdir(), "cloudless-health-d1-"));
    const sqlitePath = join(dir, "user-auth-db.sqlite");
    const seed = new DatabaseSync(sqlitePath);
    seed.exec("CREATE TABLE user (id TEXT PRIMARY KEY);");
    seed.close();

    process.env.AUTH_DB_LOCAL_SQLITE = sqlitePath;
    resetLocalAuthDbCache();
    const db = getLocalAuthDb();
    expect(db).not.toBeNull();
    (globalThis as { __AUTH_DB__?: NonNullable<typeof db> }).__AUTH_DB__ = db!;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      dbConnected: boolean;
      authProvider: string;
    };
    expect(body.authProvider).toBe("d1");
    expect(body.dbConnected).toBe(true);
    expect(body.status).toBe("ok");
  });

  it("treats integer-as-bigint SELECT 1 as connected", async () => {
    (globalThis as { __AUTH_DB__?: { prepare: (q: string) => unknown } }).__AUTH_DB__ = {
      prepare: () => ({
        bind() {
          return this;
        },
        async first() {
          return { ok: 1n };
        },
        async all() {
          return { results: [], success: true };
        },
        async run() {
          return { success: true };
        },
      }),
    };

    const res = await GET();
    const body = (await res.json()) as { status: string; dbConnected: boolean };
    expect(body.dbConnected).toBe(true);
    expect(body.status).toBe("ok");
  });
});

describe("GET /api/health tails", () => {
  afterEach(() => {
    resetLocalAuthDbCache();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete process.env.AUTH_DB_USE_HTTP;
  });

  it("degraded with no bound or local db", async () => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    const res = await GET();
    const body = (await res.json()) as { status: string; dbConnected: boolean };
    expect(body.dbConnected).toBe(false);
    expect(body.status).toBe("degraded");
  });

  it("d1-http mode reports a diagnostic when the binding is absent", async () => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    process.env.AUTH_DB_USE_HTTP = "1";
    const res = await GET();
    const body = (await res.json()) as { status: string; diagnostic?: string; authDb: string };
    expect(body.authDb).toBe("d1-http");
    expect(body.diagnostic).toContain("getAuthDbFromEnv() returned null");
    expect(body.status).toBe("degraded");
  });

  it("db probe throw → degraded with error diagnostic", async () => {
    (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = {
      prepare: () => {
        throw new Error("bind exploded");
      },
    };
    const res = await GET();
    const body = (await res.json()) as { status: string; diagnostic?: string };
    expect(body.status).toBe("degraded");
    expect(body.diagnostic).toContain("bind exploded");
  });
});
