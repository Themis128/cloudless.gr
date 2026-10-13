import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createUser,
  getUserByEmail,
  createSession,
  getUserBySession,
  deleteSession,
  isAdmin,
} from "@/lib/auth-local";

type Row = Record<string, unknown>;

function fakeD1(rows: Record<string, Row> = {}, opts: { throwOn?: string[] } = {}) {
  const calls: { sql: string; args: unknown[] }[] = [];
  const tables = rows;
  const db = {
    calls,
    tables,
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (opts.throwOn?.includes("run")) throw new Error("d1 run");
            calls.push({ sql, args });
            const m = sql.match(/INSERT INTO (\w+)/);
            if (m) {
              tables[m[1]] = tables[m[1]] ?? {};
              tables[m[1]][String(args[0])] = { args };
            }
            if (sql.startsWith("DELETE FROM sessions")) {
              delete tables.sessions?.[String(args[0])];
            }
            return { success: true };
          },
          first: async () => {
            if (opts.throwOn?.includes("first")) throw new Error("d1 first");
            calls.push({ sql, args });
            if (sql.includes("FROM users WHERE email")) {
              const u = Object.values(tables.users ?? {}).find(
                (r) => (r.args as unknown[])[1] === args[0]
              );
              if (!u) return null;
              const a = u.args as unknown[];
              return { id: a[0], email: a[1], passwordHash: a[2], name: a[3] };
            }
            if (sql.includes("JOIN sessions")) {
              const s = tables.sessions?.[String(args[0])];
              if (!s) return null;
              const uid = (s.args as unknown[])[1];
              const u = tables.users?.[String(uid)];
              if (!u) return null;
              const a = u.args as unknown[];
              return { id: a[0], email: a[1] };
            }
            if (sql.includes("isAdmin FROM users")) {
              return tables.users?.[String(args[0])] ? { isAdmin: true } : null;
            }
            return null;
          },
        }),
      };
    },
  };
  return db;
}

describe("password hashing", () => {
  it("hashes and verifies via SHA-256", async () => {
    const h = await hashPassword("s3cret");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPassword("s3cret", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("D1 user/session store", () => {
  let db: ReturnType<typeof fakeD1>;
  beforeEach(() => {
    db = fakeD1();
  });

  it("createUser inserts a lowercased user and returns it", async () => {
    const { user, error } = await createUser(db as never, "A@B.CO", "pw", "Ann");
    expect(error).toBeUndefined();
    expect(user.email).toBe("a@b.co");
    expect(user.emailVerified).toBe(false);
    expect(db.calls[0].sql).toContain("INSERT INTO users");
  });

  it("createUser reports the error instead of throwing", async () => {
    const bad = fakeD1({}, { throwOn: ["run"] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { error } = await createUser(bad as never, "a@b.c", "pw");
    expect(error).toBe("Failed to create user");
    spy.mockRestore();
  });

  it("getUserByEmail finds the user and returns null on miss/throw", async () => {
    await createUser(db as never, "A@B.CO", "pw");
    expect((await getUserByEmail(db as never, "a@b.co"))?.email).toBe("a@b.co");
    expect(await getUserByEmail(db as never, "no@b.co")).toBeNull();
    const bad = fakeD1({}, { throwOn: ["first"] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getUserByEmail(bad as never, "a@b.co")).toBeNull();
    spy.mockRestore();
  });

  it("createSession/getUserBySession/deleteSession round-trip", async () => {
    const { user } = await createUser(db as never, "a@b.co", "pw");
    const sid = await createSession(db as never, user.id);
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);
    expect((await getUserBySession(db as never, sid))?.id).toBe(user.id);
    await deleteSession(db as never, sid);
    expect(await getUserBySession(db as never, sid)).toBeNull();
  });

  it("createSession throws when the insert fails", async () => {
    const bad = fakeD1({}, { throwOn: ["run"] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createSession(bad as never, "u1")).rejects.toThrow("Failed to create session");
    spy.mockRestore();
  });

  it("getUserBySession/deleteSession tolerate db errors", async () => {
    const bad = fakeD1({}, { throwOn: ["first", "run"] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getUserBySession(bad as never, "s")).toBeNull();
    await deleteSession(bad as never, "s"); // swallowed
    spy.mockRestore();
  });

  it("isAdmin reads the flag and defaults false on miss/throw", async () => {
    const { user } = await createUser(db as never, "a@b.co", "pw");
    expect(await isAdmin(db as never, user.id)).toBe(true);
    expect(await isAdmin(db as never, "ghost")).toBe(false);
    const bad = fakeD1({}, { throwOn: ["first"] });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await isAdmin(bad as never, user.id)).toBe(false);
    spy.mockRestore();
  });
});
