import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import {
  addToSuppressionList,
  removeFromSuppressionList,
  isSuppressed,
  getSuppressedEmails,
  setD1Binding,
} from "@/lib/ses-suppression-d1";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__AUTH_DB__;
  delete (process.env as unknown as Record<string, unknown>).AUTH_DB;
});

describe("ses-suppression-d1 (no D1 binding)", () => {
  it("addToSuppressionList returns false when no DB", async () => {
    const result = await addToSuppressionList("test@example.com");
    expect(result).toBe(false);
  });

  it("removeFromSuppressionList returns false when no DB", async () => {
    const result = await removeFromSuppressionList("test@example.com");
    expect(result).toBe(false);
  });

  it("isSuppressed returns false when no DB", async () => {
    const result = await isSuppressed("test@example.com");
    expect(result).toBe(false);
  });

  it("getSuppressedEmails returns empty array when no DB", async () => {
    const result = await getSuppressedEmails();
    expect(result).toEqual([]);
  });
});


function fakeDb(overrides: Partial<{
  run: () => Promise<unknown>;
  first: () => Promise<unknown>;
  all: () => Promise<unknown>;
}> = {}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: overrides.run ?? vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    first: overrides.first ?? vi.fn(async () => null),
    all: overrides.all ?? vi.fn(async () => ({ results: [] })),
  };
  return { prepare: vi.fn(() => stmt), stmt };
}

describe("ses-suppression-d1 (bound D1)", () => {
  it("setD1Binding exposes the binding via process.env", () => {
    const db = fakeDb();
    setD1Binding(db as never);
    expect(
      (process.env as unknown as Record<string, unknown>).AUTH_DB
    ).toBeDefined();
    delete (process.env as unknown as Record<string, unknown>).AUTH_DB;
  });

  it("addToSuppressionList upserts and reports failures", async () => {
    const db = fakeDb();
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    expect(await addToSuppressionList("a@b.c")).toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(email)"));

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const db2 = fakeDb({ run: vi.fn(async () => { throw new Error("write fail"); }) });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db2;
    expect(await addToSuppressionList("a@b.c")).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Failed to suppress"), "write fail");
    err.mockRestore();
  });

  it("removeFromSuppressionList deletes and reports failures", async () => {
    const db = fakeDb();
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    expect(await removeFromSuppressionList("a@b.c")).toBe(true);
    expect(db.prepare).toHaveBeenCalledWith("DELETE FROM email_suppression WHERE email = ?");

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const db2 = fakeDb({ run: vi.fn(async () => { throw new Error("del fail"); }) });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db2;
    expect(await removeFromSuppressionList("a@b.c")).toBe(false);
    err.mockRestore();
  });

  it("isSuppressed reflects row presence and swallows errors", async () => {
    const present = fakeDb({ first: vi.fn(async () => ({ "?": 1 })) });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = present;
    expect(await isSuppressed("a@b.c")).toBe(true);

    const absent = fakeDb();
    (globalThis as Record<string, unknown>).__AUTH_DB__ = absent;
    expect(await isSuppressed("a@b.c")).toBe(false);

    const broken = fakeDb({ first: vi.fn(async () => { throw new Error("x"); }) });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = broken;
    expect(await isSuppressed("a@b.c")).toBe(false);
  });

  it("getSuppressedEmails maps rows and swallows errors", async () => {
    const db = fakeDb({
      all: vi.fn(async () => ({ results: [{ email: "e1@x" }, { email: "e2@x" }] })),
    });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = db;
    expect(await getSuppressedEmails(5)).toEqual(["e1@x", "e2@x"]);
    const broken = fakeDb({ all: vi.fn(async () => { throw new Error("x"); }) });
    (globalThis as Record<string, unknown>).__AUTH_DB__ = broken;
    expect(await getSuppressedEmails()).toEqual([]);
  });
});
