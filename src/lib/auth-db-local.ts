/**
 * Sync local AUTH_DB for `next dev` — wraps the wrangler/miniflare D1 sqlite
 * file with a D1-compatible prepare/bind/all/run/first surface so
 * getAuthDbFromEnv() works without Cognito or a cross-process workerd proxy.
 *
 * Only used when NODE_ENV=development and no Workers binding is present.
 * Must never be imported from edge/proxy or client graphs (loaded via
 * webpackIgnore require from auth-d1.ts).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error — node:sqlite added in Node 22.5; @types/node lags behind
import { DatabaseSync } from "node:sqlite";
import type { AuthDatabase } from "./auth-d1";

const D1_OBJECT_DIRS = [
  join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"),
  join(process.cwd(), ".wrangler/state/d1"),
];

function findLocalD1Sqlite(): string | null {
  const override = process.env.AUTH_DB_LOCAL_SQLITE?.trim();
  if (override) {
    return existsSync(override) ? override : null;
  }

  const candidates: Array<{ path: string; size: number }> = [];
  for (const dir of D1_OBJECT_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".sqlite") || name === "metadata.sqlite") continue;
      const path = join(dir, name);
      candidates.push({ path, size: statSync(path).size });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.size - a.size);
  return candidates[0]!.path;
}

class LocalPreparedStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: DatabaseSync,
    private readonly query: string
  ) {}

  bind(...args: unknown[]): LocalPreparedStatement {
    this.params = args;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
    const stmt = this.db.prepare(this.query);
    const rows = stmt.all(...(this.params as never[])) as T[];
    return { results: rows ?? [], success: true };
  }

  async run(): Promise<{ success: boolean; meta?: { changes: number } }> {
    const stmt = this.db.prepare(this.query);
    const info = stmt.run(...(this.params as never[])) as {
      changes?: number;
    };
    return { success: true, meta: { changes: Number(info?.changes ?? 0) } };
  }

  async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.query);
    const row = stmt.get(...(this.params as never[])) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (col) return (row[col] as T) ?? null;
    return row as T;
  }
}

let cached: AuthDatabase | null = null;

/** Test hook — drop the cached adapter so a new sqlite path can be picked up. */
export function resetLocalAuthDbCache(): void {
  cached = null;
}

export function getLocalAuthDb(): AuthDatabase | null {
  if (cached) return cached;
  const allow =
    process.env.NODE_ENV === "development" || Boolean(process.env.AUTH_DB_LOCAL_SQLITE?.trim());
  if (!allow) return null;

  const path = findLocalD1Sqlite();
  if (!path) {
    console.warn(
      "[auth-db-local] No local D1 sqlite under .wrangler/state — run: pnpm d1:migrate:local"
    );
    return null;
  }

  try {
    const db = new DatabaseSync(path);
    // Allow concurrent readers while wrangler/workerd may also hold the file.
    db.exec("PRAGMA busy_timeout = 5000;");
    repairUserRoleForeignKey(db);
    const adapter: AuthDatabase = {
      prepare: (query: string) => new LocalPreparedStatement(db, query),
    };
    cached = adapter;
    console.warn(`[auth-db-local] Using local D1 sqlite (${path})`);
    return adapter;
  } catch (err) {
    console.warn("[auth-db-local] Failed to open local D1 sqlite:", err);
    return null;
  }
}

/**
 * Some local D1 files still have `user_role` FK → `user_old` after a rename.
 * Signup then fails on INSERT INTO user_role. Rebuild the table in-place.
 */
function repairUserRoleForeignKey(db: DatabaseSync): void {
  try {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_role'")
      .get() as { sql?: string } | undefined;
    const sql = row?.sql ?? "";
    if (!sql.includes("user_old")) return;

    console.warn("[auth-db-local] Repairing user_role FK (user_old → user)");
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_role__new (
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        PRIMARY KEY (user_id, role),
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO user_role__new SELECT user_id, role FROM user_role;
      DROP TABLE user_role;
      ALTER TABLE user_role__new RENAME TO user_role;
    `);
    db.exec("PRAGMA foreign_keys = ON;");
  } catch (err) {
    console.warn("[auth-db-local] user_role FK repair failed:", err);
  }
}
