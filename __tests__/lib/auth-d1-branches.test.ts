// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Branch coverage for src/lib/auth-d1.ts null/blank fallbacks, driven through
 * a recording fake D1 binding so each test can assert the exact bound values.
 */

type Call = { sql: string; args: unknown[] };

function fakeDb(
  opts: {
    first?: unknown;
    all?: unknown;
    run?: unknown;
  } = {}
) {
  const calls: Call[] = [];
  const db = {
    prepare(sql: string) {
      const call: Call = { sql, args: [] };
      calls.push(call);
      const stmt = {
        bind(...args: unknown[]) {
          call.args = args;
          return stmt;
        },
        all: async () => opts.all ?? { results: [], success: true },
        run: async () => opts.run ?? { success: true, meta: { changes: 1 } },
        first: async () => opts.first ?? null,
      };
      return stmt;
    },
  };
  return { db, calls };
}

async function load(secret = "s".repeat(48)) {
  vi.stubEnv("SESSION_SECRET", secret);
  vi.resetModules();
  return import("@/lib/auth-d1");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth-d1 null fallbacks", () => {
  it("logSessionActivity binds null for omitted email, ip and user agent", async () => {
    const { logSessionActivity } = await load();
    const { db, calls } = fakeDb();
    await logSessionActivity(db as never, "sess-1", "logout");
    expect(calls[0].args.slice(0, 5)).toEqual(["sess-1", "logout", null, null, null]);
    expect(typeof calls[0].args[5]).toBe("number");
  });

  it("checkFailedAttempts treats a missing count row as zero attempts", async () => {
    const { checkFailedAttempts } = await load();
    const { db } = fakeDb({ first: null });
    await expect(checkFailedAttempts(db as never, "x@cloudless.gr")).resolves.toEqual({
      locked: false,
      attempts: 0,
    });
  });

  it("checkFailedAttempts locks at the threshold", async () => {
    const { checkFailedAttempts } = await load();
    const { db } = fakeDb({ first: { count: 5 } });
    await expect(checkFailedAttempts(db as never, "x@cloudless.gr")).resolves.toEqual({
      locked: true,
      attempts: 5,
    });
  });

  it("updateUser stores null for blank name, company, phone and missing preferences", async () => {
    const { updateUser } = await load();
    const { db, calls } = fakeDb();
    await updateUser(db as never, "u1", { name: "", company: "", phone: "" });
    expect(calls[0].args.slice(0, 4)).toEqual([null, null, null, null]);
    expect(calls[0].args[5]).toBe("u1");
  });

  it("consumePasswordResetToken handles a user row without preferences_json", async () => {
    const { consumePasswordResetToken } = await load();
    const { db, calls } = fakeDb({
      all: { results: [{ id: "u9", preferences_json: null }], success: true },
    });
    await expect(
      consumePasswordResetToken(db as never, "tok", "new-password-123")
    ).resolves.toEqual({ success: true });
    const update = calls.find((c) => c.sql.startsWith("UPDATE user SET password_hash"));
    expect(update?.args[1]).toBe("{}");
    expect(update?.args[2]).toBe("u9");
    expect(calls.some((c) => c.sql === "DELETE FROM session WHERE user_id = ?")).toBe(true);
  });

  it("cleanupExpiredSessions returns 0 when the driver omits meta", async () => {
    const { cleanupExpiredSessions } = await load();
    const { db } = fakeDb({ run: { success: true } });
    await expect(cleanupExpiredSessions(db as never)).resolves.toBe(0);
  });

  it("markEmailVerified reports false when the driver omits meta", async () => {
    const { markEmailVerified } = await load();
    const { db } = fakeDb({ run: { success: true } });
    await expect(markEmailVerified(db as never, "x@cloudless.gr")).resolves.toBe(false);
  });

  it("listUsers returns [] when the driver omits results", async () => {
    const { listUsers } = await load();
    const { db } = fakeDb({ all: { success: true } });
    await expect(listUsers(db as never)).resolves.toEqual([]);
  });
});

describe("patchUserProfile field resolution", () => {
  it("clears provided blank fields to null", async () => {
    const { patchUserProfile } = await load();
    const { db, calls } = fakeDb({
      first: { id: "u1", name: "Old", company: "Co", phone: "1", preferences_json: null },
    });
    await expect(
      patchUserProfile(db as never, "u1", { name: "", company: "", phone: "" })
    ).resolves.toBe(true);
    const update = calls.find((c) => c.sql.startsWith("UPDATE user SET name"));
    expect(update?.args.slice(0, 4)).toEqual([null, null, null, null]);
  });

  it("keeps null when the stored profile has no name, company or phone", async () => {
    const { patchUserProfile } = await load();
    const { db, calls } = fakeDb({ first: { id: "u2", email: "u2@cloudless.gr" } });
    await expect(patchUserProfile(db as never, "u2", {})).resolves.toBe(true);
    const update = calls.find((c) => c.sql.startsWith("UPDATE user SET name"));
    expect(update?.args.slice(0, 4)).toEqual([null, null, null, null]);
    expect(update?.args[5]).toBe("u2");
  });

  it("writes provided company and phone values", async () => {
    const { patchUserProfile } = await load();
    const { db, calls } = fakeDb({ first: { id: "u3", name: "N", company: null, phone: null } });
    await patchUserProfile(db as never, "u3", { company: "Acme", phone: "+30 210" });
    const update = calls.find((c) => c.sql.startsWith("UPDATE user SET name"));
    expect(update?.args.slice(0, 3)).toEqual(["N", "Acme", "+30 210"]);
  });
});

describe("getAuthDbFromEnv", () => {
  it("never loads the local sqlite shim on the edge runtime", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DB_PREFER_LOCAL", "1");
    vi.stubEnv("AUTH_DB_USE_HTTP", "");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    vi.stubEnv("AUTH_DB_LOCAL_SQLITE", "");
    const { getAuthDbFromEnv } = await load();
    expect(getAuthDbFromEnv()).toBeNull();
  });
});
