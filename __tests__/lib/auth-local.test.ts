import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword, createUser, getUserByEmail } from "@/lib/auth-local";

// Minimal D1Database mock — only the `prepare` chain we use
function makeD1Mock(firstResult: unknown = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({}),
    first: vi.fn().mockResolvedValue(firstResult),
  };
  return { prepare: vi.fn().mockReturnValue(stmt), stmt };
}

describe("hashPassword", () => {
  it("returns a 64-char hex SHA-256 digest", async () => {
    const h = await hashPassword("hunter2");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", async () => {
    const h1 = await hashPassword("hello");
    const h2 = await hashPassword("hello");
    expect(h1).toBe(h2);
  });

  it("produces different digests for different inputs", async () => {
    const h1 = await hashPassword("hello");
    const h2 = await hashPassword("world");
    expect(h1).not.toBe(h2);
  });

  it("empty string hashes without error", async () => {
    const h = await hashPassword("");
    expect(h).toHaveLength(64);
  });
});

describe("verifyPassword", () => {
  it("returns true for matching password and hash", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("wrong-horse", hash)).toBe(false);
  });

  it("is case-sensitive", async () => {
    const hash = await hashPassword("Password");
    expect(await verifyPassword("password", hash)).toBe(false);
  });
});

describe("createUser", () => {
  it("returns a user with the correct email (lowercased)", async () => {
    const { db } = makeD1Mock() as { db: ReturnType<typeof makeD1Mock>["stmt"] & { prepare: ReturnType<typeof vi.fn> } };
    const { stmt } = makeD1Mock();
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof createUser>[0];
    const { user, error } = await createUser(mockDb, "Test@Example.COM", "pass");
    expect(error).toBeUndefined();
    expect(user.email).toBe("test@example.com");
  });

  it("stores a hashed password, not the plain text", async () => {
    const { stmt } = makeD1Mock();
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof createUser>[0];
    await createUser(mockDb, "a@b.com", "mysecret");
    // bind(userId, email, passwordHash, name, now, now) — 3rd arg is the hash
    const bindArgs = stmt.bind.mock.calls[0];
    expect(bindArgs[2]).not.toBe("mysecret");
    expect(bindArgs[2]).toHaveLength(64); // SHA-256 hex
  });

  it("returns an error object when db.run throws", async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockRejectedValue(new Error("UNIQUE constraint")),
    };
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof createUser>[0];
    const { error } = await createUser(mockDb, "dup@example.com", "pass");
    expect(error).toBe("Failed to create user");
  });

  it("sets emailVerified to false by default", async () => {
    const { stmt } = makeD1Mock();
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof createUser>[0];
    const { user } = await createUser(mockDb, "x@y.com", "pass");
    expect(user.emailVerified).toBe(false);
  });
});

describe("getUserByEmail", () => {
  it("returns the user when found", async () => {
    const fakeUser = { id: "u1", email: "a@b.com", emailVerified: true };
    const { stmt } = makeD1Mock(fakeUser);
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof getUserByEmail>[0];
    const result = await getUserByEmail(mockDb, "A@B.com");
    expect(result).toEqual(fakeUser);
    // email should have been lowercased before query
    expect(stmt.bind.mock.calls[0][0]).toBe("a@b.com");
  });

  it("returns null when not found", async () => {
    const { stmt } = makeD1Mock(null);
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof getUserByEmail>[0];
    const result = await getUserByEmail(mockDb, "nobody@example.com");
    expect(result).toBeNull();
  });

  it("returns null on db error", async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockRejectedValue(new Error("DB down")),
    };
    const mockDb = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as Parameters<typeof getUserByEmail>[0];
    const result = await getUserByEmail(mockDb, "x@y.com");
    expect(result).toBeNull();
  });
});
