import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Real-code tests for src/lib/auth-d1.ts.
 *
 * The only fake is the D1 boundary: an in-memory AuthDatabase that executes
 * the module's actual SQL statements against real rows (prepare/bind/first/
 * all/run). All auth logic — PBKDF2 hashing, session expiry, lockout
 * counting, reset-token consume, preference flags — runs for real.
 */

type Row = Record<string, unknown>;

interface Stmt {
  bind: (...args: unknown[]) => Stmt;
  all: <T = Row>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
  first: <T = Row>(col?: string) => Promise<T | null>;
}

class FakeD1 {
  users: Row[] = [];
  sessions: Row[] = [];
  roles: Row[] = [];
  logs: Row[] = [];
  failNext = 0;

  prepare(sql: string): Stmt {
    const norm = sql.replace(/\s+/g, " ").trim();
    let args: unknown[] = [];
    const stmt: Stmt = {
      bind: (...a: unknown[]) => {
        args = a;
        return stmt;
      },
      all: async <T = Row>() => ({ results: this.execAll(norm, args) as T[], success: true }),
      run: async () => this.execRun(norm, args),
      first: async <T = Row>(col?: string) => {
        const rows = this.execAll(norm, args);
        const r = (rows[0] ?? null) as T | null;
        if (r && col) return (r as Row)[col] as T;
        return r;
      },
    };
    return stmt;
  }

  private jsonSet(prefs: string | null, key: string, val: unknown): string {
    const o = prefs ? JSON.parse(prefs) : {};
    o[key] = val;
    return JSON.stringify(o);
  }

  execAll(sql: string, args: unknown[]): Row[] {
    if (sql === "SELECT id FROM user WHERE email = ?") {
      return this.users.filter((u) => u.email === args[0]).map((u) => ({ id: u.id }));
    }
    if (sql === "SELECT * FROM user WHERE email = ?") {
      return this.users.filter((u) => u.email === args[0]);
    }
    if (sql === "SELECT * FROM session WHERE id = ? AND expires_at > ?") {
      return this.sessions.filter((s) => s.id === args[0] && (s.expires_at as number) > (args[1] as number));
    }
    if (sql.startsWith("SELECT id, email, name, company, phone, preferences_json, created_at, updated_at FROM user WHERE id = ?")) {
      return this.users.filter((u) => u.id === args[0]);
    }
    if (sql === "SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'") {
      return this.roles.filter((r) => r.user_id === args[0] && r.role === "admin");
    }
    if (sql.startsWith("SELECT id, preferences_json FROM user WHERE json_extract")) {
      const [token, now] = args as [string, number];
      return this.users
        .filter((u) => {
          const p = JSON.parse((u.preferences_json as string) || "{}");
          return p.reset_token === token && (p.reset_expires as number) > now;
        })
        .map((u) => ({ id: u.id, preferences_json: u.preferences_json }));
    }
    if (sql.startsWith("SELECT COUNT(*) as count FROM session_log")) {
      const [email, since] = args as [string, number];
      const count = this.logs.filter(
        (l) => l.action === "failed_attempt" && l.email === email && (l.created_at as number) > since,
      ).length;
      return [{ count }];
    }
    if (sql.startsWith("SELECT u.id, u.email, u.name, u.company, u.phone, u.created_at")) {
      const prefixed = sql.includes("WHERE lower(u.email) LIKE ?");
      const limit = args[prefixed ? 1 : 0] as number;
      let rows = this.users.slice();
      if (prefixed) {
        const prefix = String(args[0]).replace(/%$/, "");
        rows = rows.filter((u) => String(u.email).toLowerCase().startsWith(prefix));
      }
      rows.sort((a, b) => (b.created_at as number) - (a.created_at as number));
      return rows.slice(0, limit).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        company: u.company,
        phone: u.phone,
        created_at: u.created_at,
        preferences_json: u.preferences_json ?? null,
        role: this.roles.some((r) => r.user_id === u.id && r.role === "admin") ? "admin" : "user",
      }));
    }
    if (sql.includes("FROM user WHERE lower(email) = ?")) {
      return this.users.filter((u) => String(u.email).toLowerCase() === args[0]);
    }
    throw new Error(`FakeD1 unhandled query: ${sql}`);
  }

  execRun(sql: string, args: unknown[]): { success: boolean; meta?: { changes: number } } {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("simulated D1 failure");
    }
    if (sql.startsWith("INSERT INTO user (")) {
      const [id, username, email, name, password_hash, created_at, updated_at] = args;
      this.users.push({ id, username, email, name, password_hash, created_at, updated_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO user_role")) {
      const [user_id, role] = args;
      const i = this.roles.findIndex((r) => r.user_id === user_id);
      if (i >= 0) this.roles[i] = { user_id, role };
      else this.roles.push({ user_id, role });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT OR REPLACE INTO user_role")) {
      // `VALUES (?, 'admin')` — the role literal is inline, args carry only the id.
      const [user_id, role = "admin"] = args;
      const i = this.roles.findIndex((r) => r.user_id === user_id);
      if (i >= 0) this.roles[i] = { user_id, role };
      else this.roles.push({ user_id, role });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO session (")) {
      const [id, user_id, expires_at, created_at] = args;
      this.sessions.push({ id, user_id, expires_at, created_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO session_log")) {
      const [session_id, action, email, ip, user_agent, created_at] = args;
      this.logs.push({ session_id, action, email, ip, user_agent, created_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql === "DELETE FROM session WHERE id = ?") {
      const n = this.sessions.length;
      this.sessions = this.sessions.filter((s) => s.id !== args[0]);
      return { success: true, meta: { changes: n - this.sessions.length } };
    }
    if (sql === "DELETE FROM session WHERE user_id = ?") {
      const n = this.sessions.length;
      this.sessions = this.sessions.filter((s) => s.user_id !== args[0]);
      return { success: true, meta: { changes: n - this.sessions.length } };
    }
    if (sql === "DELETE FROM session WHERE expires_at < ?") {
      const n = this.sessions.length;
      this.sessions = this.sessions.filter((s) => (s.expires_at as number) >= (args[0] as number));
      return { success: true, meta: { changes: n - this.sessions.length } };
    }
    if (sql === "DELETE FROM user_role WHERE user_id = ? AND role = 'admin'") {
      const n = this.roles.length;
      this.roles = this.roles.filter((r) => !(r.user_id === args[0] && r.role === "admin"));
      return { success: true, meta: { changes: n - this.roles.length } };
    }
    if (sql === "DELETE FROM user_role WHERE user_id = ?") {
      const n = this.roles.length;
      this.roles = this.roles.filter((r) => r.user_id !== args[0]);
      return { success: true, meta: { changes: n - this.roles.length } };
    }
    if (sql === "DELETE FROM user WHERE id = ?") {
      const n = this.users.length;
      this.users = this.users.filter((u) => u.id !== args[0]);
      return { success: true, meta: { changes: n - this.users.length } };
    }
    if (sql.startsWith("UPDATE user SET name = ?, company = ?, phone = ?, preferences_json = ?, updated_at = ?")) {
      const [name, company, phone, prefs, updated_at, id] = args;
      const u = this.users.find((x) => x.id === id);
      if (!u) return { success: true, meta: { changes: 0 } };
      Object.assign(u, { name, company, phone, preferences_json: prefs, updated_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE user SET preferences_json = json_set") && sql.includes("reset_token")) {
      const [token, expires, id] = args;
      const u = this.users.find((x) => x.id === id);
      if (!u) return { success: true, meta: { changes: 0 } };
      let p = this.jsonSet(u.preferences_json as string | null, "reset_token", token);
      p = this.jsonSet(p, "reset_expires", expires);
      u.preferences_json = p;
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE user SET preferences_json = json_set") && sql.includes("'$.disabled'")) {
      const [flag, updated_at, id] = args;
      const u = this.users.find((x) => x.id === id);
      if (!u) return { success: true, meta: { changes: 0 } };
      u.preferences_json = this.jsonSet(u.preferences_json as string | null, "disabled", flag);
      u.updated_at = updated_at;
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE user SET preferences_json = json_set") && sql.includes("email_verified")) {
      const u = this.users.find((x) => x.email === args[0]);
      if (!u) return { success: true, meta: { changes: 0 } };
      u.preferences_json = this.jsonSet(u.preferences_json as string | null, "email_verified", "true");
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE user SET password_hash = ?, preferences_json = ?")) {
      const [hash, prefs, id] = args;
      const u = this.users.find((x) => x.id === id);
      if (!u) return { success: true, meta: { changes: 0 } };
      u.password_hash = hash;
      u.preferences_json = prefs;
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error(`FakeD1 unhandled run: ${sql}`);
  }
}

const SECRET = "test-session-secret-at-least-32-chars!!";

async function loadModule() {
  vi.resetModules();
  process.env.SESSION_SECRET = SECRET;
  return import("@/lib/auth-d1");
}

describe("auth-d1 with real D1 boundary", () => {
  let db: FakeD1;
  let auth: Awaited<ReturnType<typeof loadModule>>;

  beforeEach(async () => {
    db = new FakeD1();
    auth = await loadModule();
  });

  it("createUser stores a PBKDF2 hash and default role; duplicate email rejected", async () => {
    const res = await auth.createUser(db as never, "a@b.co", "SecurePass1!", "Ana");
    expect(res.error).toBeUndefined();
    expect(res.user?.password_hash).toMatch(/^[A-Za-z0-9+/=]+:[0-9a-f]{64}$/);
    const dup = await auth.createUser(db as never, "a@b.co", "SecurePass1!", "Ana");
    expect(dup.error).toBe("User already exists");
    expect(db.roles[0]).toEqual({ user_id: res.user!.id, role: "user" });
  });

  it("createUser maps DB failure to a generic error", async () => {
    db.failNext = 1;
    const res = await auth.createUser(db as never, "b@b.co", "SecurePass1!");
    expect(res.error).toBe("Failed to create user");
  });

  it("authenticateUser round-trips createUser credentials and creates a session", async () => {
    const { user } = await auth.createUser(db as never, "c@b.co", "SecurePass1!");
    const res = await auth.authenticateUser(db as never, "c@b.co", "SecurePass1!");
    expect(res.error).toBeUndefined();
    expect(res.user?.id).toBe(user!.id);
    expect(res.session?.user_id).toBe(user!.id);
    // ~30 days default
    expect(res.session!.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 25 * 86400);
  });

  it("authenticateUser rememberMe extends the session to ~60 days", async () => {
    await auth.createUser(db as never, "d@b.co", "SecurePass1!");
    const res = await auth.authenticateUser(db as never, "d@b.co", "SecurePass1!", true);
    expect(res.session!.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 55 * 86400);
  });

  it("authenticateUser rejects wrong password and unknown email identically", async () => {
    await auth.createUser(db as never, "e@b.co", "SecurePass1!");
    expect((await auth.authenticateUser(db as never, "e@b.co", "WrongPass1!")).error).toBe("Invalid credentials");
    expect((await auth.authenticateUser(db as never, "no@b.co", "SecurePass1!")).error).toBe("Invalid credentials");
  });

  it("authenticateUser rejects a disabled account", async () => {
    const { user } = await auth.createUser(db as never, "f@b.co", "SecurePass1!");
    db.users.find((u) => u.id === user!.id)!.preferences_json = JSON.stringify({ disabled: "true" });
    const res = await auth.authenticateUser(db as never, "f@b.co", "SecurePass1!");
    expect(res.error).toBe("Account disabled");
    expect(db.sessions).toHaveLength(0);
  });

  it("verifyPassword supports legacy unsalted SHA-256 hashes", async () => {
    const legacy = new TextEncoder().encode("SecurePass1!" + SECRET);
    const digest = await crypto.subtle.digest("SHA-256", legacy);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await auth.verifyPassword("SecurePass1!", hex)).toBe(true);
    expect(await auth.verifyPassword("Other1!", hex)).toBe(false);
  });

  it("getUserBySession returns the user for a live session and null for expired/missing", async () => {
    const { user } = await auth.createUser(db as never, "g@b.co", "SecurePass1!");
    const { session } = await auth.authenticateUser(db as never, "g@b.co", "SecurePass1!");
    const found = await auth.getUserBySession(db as never, session!.id);
    expect(found?.id).toBe(user!.id);
    expect(await auth.getUserBySession(db as never, "nope")).toBeNull();
    db.sessions[0]!.expires_at = Math.floor(Date.now() / 1000) - 10;
    expect(await auth.getUserBySession(db as never, session!.id)).toBeNull();
  });

  it("deleteSession removes the session", async () => {
    await auth.createUser(db as never, "h@b.co", "SecurePass1!");
    const { session } = await auth.authenticateUser(db as never, "h@b.co", "SecurePass1!");
    await auth.deleteSession(db as never, session!.id);
    expect(db.sessions).toHaveLength(0);
  });

  it("updateUser writes profile fields and preferences", async () => {
    const { user } = await auth.createUser(db as never, "i@b.co", "SecurePass1!");
    await auth.updateUser(db as never, user!.id, { name: "New", company: "C", phone: "1", preferences: { theme: "dark" } });
    const row = db.users.find((u) => u.id === user!.id)!;
    expect(row.name).toBe("New");
    expect(JSON.parse(row.preferences_json as string)).toEqual({ theme: "dark" });
  });

  it("isAdmin reflects user_role membership", async () => {
    const { user } = await auth.createUser(db as never, "j@b.co", "SecurePass1!");
    expect(await auth.isAdmin(db as never, user!.id)).toBe(false);
    await auth.createAdminUser(db as never, "j@b.co");
    expect(await auth.isAdmin(db as never, user!.id)).toBe(true);
  });

  it("createAdminUser errors for unknown users", async () => {
    const res = await auth.createAdminUser(db as never, "ghost@b.co");
    expect(res.success).toBe(false);
    expect(res.error).toBe("User not found");
  });

  it("password reset flow: token stored, consumed, sessions invalidated", async () => {
    await auth.createUser(db as never, "k@b.co", "OldPass1!");
    await auth.authenticateUser(db as never, "k@b.co", "OldPass1!");
    const { token } = await auth.createPasswordResetToken(db as never, "k@b.co");
    expect(token).toBeTruthy();

    const consumed = await auth.consumePasswordResetToken(db as never, token!, "NewPass1!");
    expect(consumed.success).toBe(true);
    expect(db.sessions).toHaveLength(0);

    // Old password dead, new password works
    expect((await auth.authenticateUser(db as never, "k@b.co", "OldPass1!")).error).toBe("Invalid credentials");
    expect((await auth.authenticateUser(db as never, "k@b.co", "NewPass1!")).error).toBeUndefined();

    // Token can't be reused
    expect((await auth.consumePasswordResetToken(db as never, token!, "X1!aaaa")).success).toBe(false);
  });

  it("createPasswordResetToken returns no token for unknown email (no enumeration)", async () => {
    const res = await auth.createPasswordResetToken(db as never, "ghost@b.co");
    expect(res.error).toBeUndefined();
    expect(res.token).toBeUndefined();
  });

  it("consumePasswordResetToken rejects expired tokens", async () => {
    const { user } = await auth.createUser(db as never, "l@b.co", "OldPass1!");
    const { token } = await auth.createPasswordResetToken(db as never, "l@b.co");
    const u = db.users.find((x) => x.id === user!.id)!;
    const p = JSON.parse(u.preferences_json as string);
    p.reset_expires = Math.floor(Date.now() / 1000) - 1;
    u.preferences_json = JSON.stringify(p);
    const res = await auth.consumePasswordResetToken(db as never, token!, "NewPass1!");
    expect(res.error).toBe("Invalid or expired reset token");
  });

  it("cleanupExpiredSessions returns the deleted count", async () => {
    const now = Math.floor(Date.now() / 1000);
    db.sessions.push(
      { id: "s1", user_id: "u", expires_at: now - 5, created_at: now - 100 },
      { id: "s2", user_id: "u", expires_at: now + 500, created_at: now },
      { id: "s3", user_id: "u", expires_at: now - 1, created_at: now - 50 },
    );
    expect(await auth.cleanupExpiredSessions(db as never)).toBe(2);
    expect(db.sessions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("validateSessionSecret passes with the configured secret", () => {
    expect(auth.validateSessionSecret().valid).toBe(true);
  });

  it("logSessionActivity + checkFailedAttempts enforce the 5-strike/15min lockout", async () => {
    for (let i = 0; i < 5; i++) {
      await auth.logSessionActivity(db as never, `s${i}`, "failed_attempt", "m@b.co", "1.2.3.4", "ua");
    }
    const res = await auth.checkFailedAttempts(db as never, "m@b.co");
    expect(res.locked).toBe(true);
    expect(res.attempts).toBe(5);
    expect((await auth.checkFailedAttempts(db as never, "other@b.co")).locked).toBe(false);
  });

  it("listUsers maps roles, preference flags, and email prefix filter", async () => {
    await auth.createUser(db as never, "admin@b.co", "SecurePass1!", "A");
    await auth.createUser(db as never, "user@b.co", "SecurePass1!");
    await auth.createAdminUser(db as never, "admin@b.co");
    const u = db.users.find((x) => x.email === "user@b.co")!;
    u.preferences_json = JSON.stringify({ disabled: "true", email_verified: "true" });

    const all = await auth.listUsers(db as never);
    expect(all).toHaveLength(2);
    const admin = all.find((x) => x.email === "admin@b.co")!;
    const plain = all.find((x) => x.email === "user@b.co")!;
    expect(admin.role).toBe("admin");
    expect(plain.role).toBe("user");
    expect(plain.disabled).toBe(true);
    expect(plain.emailVerified).toBe(true);

    const filtered = await auth.listUsers(db as never, { emailPrefix: "ADM" });
    expect(filtered.map((x) => x.email)).toEqual(["admin@b.co"]);
  });

  it("setUserAdminRole toggles admin on and off", async () => {
    const { user } = await auth.createUser(db as never, "n@b.co", "SecurePass1!");
    expect(await auth.setUserAdminRole(db as never, "missing", true)).toBe(false);
    expect(await auth.setUserAdminRole(db as never, user!.id, true)).toBe(true);
    expect(await auth.isAdmin(db as never, user!.id)).toBe(true);
    expect(await auth.setUserAdminRole(db as never, user!.id, false)).toBe(true);
    expect(await auth.isAdmin(db as never, user!.id)).toBe(false);
  });

  it("setUserDisabled kills sessions when disabling", async () => {
    const { user } = await auth.createUser(db as never, "o@b.co", "SecurePass1!");
    await auth.authenticateUser(db as never, "o@b.co", "SecurePass1!");
    expect(await auth.setUserDisabled(db as never, "missing", true)).toBe(false);
    expect(await auth.setUserDisabled(db as never, user!.id, true)).toBe(true);
    expect(db.sessions).toHaveLength(0);
    expect(JSON.parse(db.users[0]!.preferences_json as string).disabled).toBe("true");
    await auth.setUserDisabled(db as never, user!.id, false);
    expect(JSON.parse(db.users[0]!.preferences_json as string).disabled).toBe("false");
  });

  it("deleteUserAccount erases sessions, roles, and the user row", async () => {
    const { user } = await auth.createUser(db as never, "p@b.co", "SecurePass1!");
    await auth.authenticateUser(db as never, "p@b.co", "SecurePass1!");
    await auth.createAdminUser(db as never, "p@b.co");
    expect(await auth.deleteUserAccount(db as never, "missing")).toBe(false);
    expect(await auth.deleteUserAccount(db as never, user!.id)).toBe(true);
    expect(db.users).toHaveLength(0);
    expect(db.sessions).toHaveLength(0);
    expect(db.roles).toHaveLength(0);
  });

  it("markEmailVerified sets the flag; getUserByEmail is case-insensitive", async () => {
    const { user } = await auth.createUser(db as never, "Mixed@B.co", "SecurePass1!");
    expect(await auth.markEmailVerified(db as never, "Mixed@B.co")).toBe(true);
    expect(JSON.parse(db.users[0]!.preferences_json as string).email_verified).toBe("true");
    expect((await auth.getUserByEmail(db as never, "  MIXED@b.co "))?.id).toBe(user!.id);
    expect(await auth.getUserByEmail(db as never, "   ")).toBeNull();
  });

  it("patchUserProfile updates only provided fields; empty string clears to null", async () => {
    const { user } = await auth.createUser(db as never, "q@b.co", "SecurePass1!", "Orig");
    await auth.updateUser(db as never, user!.id, { company: "Co", phone: "9" });
    expect(await auth.patchUserProfile(db as never, "missing", { name: "X" })).toBe(false);
    expect(await auth.patchUserProfile(db as never, user!.id, { name: "", company: "Co2" })).toBe(true);
    const row = db.users[0]!;
    expect(row.name).toBeNull(); // cleared
    expect(row.company).toBe("Co2"); // changed
    expect(row.phone).toBe("9"); // untouched
  });

  it("getAuthDbFromEnv resolves globalThis.__AUTH_DB__ and the cloudflare context", () => {
    const fakeDb = { prepare: () => ({}) };
    (globalThis as Record<string, unknown>).__AUTH_DB__ = fakeDb;
    try {
      expect(auth.getAuthDbFromEnv()).toBe(fakeDb);
    } finally {
      delete (globalThis as Record<string, unknown>).__AUTH_DB__;
    }
    (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] = {
      env: { AUTH_DB: fakeDb },
    };
    try {
      expect(auth.getAuthDbFromEnv()).toBe(fakeDb);
    } finally {
      delete (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")];
    }
  });

  it("unconfigured module reports not-configured errors instead of authenticating", async () => {
    vi.resetModules();
    delete process.env.SESSION_SECRET;
    const unauth = await import("@/lib/auth-d1");
    expect((await unauth.authenticateUser(db as never, "x@y.z", "p")).error).toBe("Authentication not configured");
    expect((await unauth.createAdminUser(db as never, "x@y.z")).error).toBe("Authentication not configured");
    expect((await unauth.createPasswordResetToken(db as never, "x@y.z")).error).toBe("Authentication not configured");
    expect(unauth.validateSessionSecret().valid).toBe(false);
    process.env.SESSION_SECRET = SECRET;
  });
});
