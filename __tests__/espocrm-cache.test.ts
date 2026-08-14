/**
 * Unit tests for src/lib/espocrm-cache.ts — D1 espocrm_cache read-through.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

type CacheRow = {
  pk: string;
  sk: string;
  result_json: string;
  cached_at: number;
  expires_at: number;
};

function createCacheDb(): AuthDatabase & {
  rows: Map<string, CacheRow>;
  failNext: boolean;
} {
  const state = { rows: new Map<string, CacheRow>(), failNext: false };
  return {
    get rows() {
      return state.rows;
    },
    get failNext() {
      return state.failNext;
    },
    set failNext(v: boolean) {
      state.failNext = v;
    },
    prepare(query: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return stmt;
        },
        async run() {
          if (state.failNext) {
            state.failNext = false;
            throw new Error("d1 down");
          }
          if (query.includes("INSERT OR REPLACE INTO espocrm_cache")) {
            const [pk, sk, result_json, cached_at, expires_at] = binds as [
              string,
              string,
              string,
              number,
              number,
            ];
            state.rows.set(`${pk}|${sk}`, { pk, sk, result_json, cached_at, expires_at });
            return { success: true, meta: { changes: 1 } };
          }
          if (query.includes("DELETE FROM espocrm_cache")) {
            if (query.includes("LIKE")) {
              const exact = String(binds[0]);
              const like = String(binds[1]).replace(/%$/, "");
              for (const key of [...state.rows.keys()]) {
                const pk = key.split("|")[0];
                if (pk === exact || pk.startsWith(like)) state.rows.delete(key);
              }
            } else {
              state.rows.delete(`${binds[0]}|${binds[1]}`);
            }
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { results: [], success: true };
        },
        async first<T = CacheRow>() {
          if (state.failNext) {
            state.failNext = false;
            throw new Error("d1 down");
          }
          if (query.includes("FROM espocrm_cache")) {
            return (state.rows.get(`${binds[0]}|${binds[1]}`) as T) ?? null;
          }
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("espocrm-cache", () => {
  beforeEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });
  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  it("paramsHash is order-invariant", async () => {
    const { paramsHash } = await import("@/lib/espocrm-cache");
    expect(paramsHash({ a: 1, b: 2 })).toBe(paramsHash({ b: 2, a: 1 }));
  });

  it("readThrough serves cache then live", async () => {
    const db = createCacheDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { readThrough, paramsHash } = await import("@/lib/espocrm-cache");
    let calls = 0;
    const first = await readThrough("espocrm:listContacts", { limit: 10 }, async () => {
      calls += 1;
      return [{ id: "1" }];
    });
    expect(first.source).toBe("live");
    expect(calls).toBe(1);
    expect(db.rows.has(`espocrm:listContacts|${paramsHash({ limit: 10 })}`)).toBe(true);

    const second = await readThrough("espocrm:listContacts", { limit: 10 }, async () => {
      calls += 1;
      return [{ id: "2" }];
    });
    expect(second.source).toBe("cache");
    expect(calls).toBe(1);
    expect(second.value).toEqual([{ id: "1" }]);
  });

  it("invalidatePrefix clears list keys", async () => {
    const db = createCacheDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { setCached, invalidatePrefix, getCached, paramsHash } = await import(
      "@/lib/espocrm-cache"
    );
    await setCached("espocrm:listContacts", { limit: 10 }, [{ id: "1" }], 45);
    expect(await getCached("espocrm:listContacts", { limit: 10 }, 45)).not.toBeNull();
    await invalidatePrefix("espocrm:listContacts");
    expect(db.rows.has(`espocrm:listContacts|${paramsHash({ limit: 10 })}`)).toBe(false);
  });

  it("soft-fails when D1 throws", async () => {
    const db = createCacheDb();
    db.failNext = true;
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    const { getCached } = await import("@/lib/espocrm-cache");
    expect(await getCached("espocrm:listContacts", { limit: 10 })).toBeNull();
  });
});
