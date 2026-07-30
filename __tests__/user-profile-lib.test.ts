/**
 * src/lib/user-profile.ts — D1-backed profile store.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

const { getUserByIdMock, patchUserProfileMock } = vi.hoisted(() => ({
  getUserByIdMock: vi.fn(),
  patchUserProfileMock: vi.fn(),
}));

vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: () =>
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ ?? null,
    getUserById: (...args: unknown[]) => getUserByIdMock(...args),
    patchUserProfile: (...args: unknown[]) => patchUserProfileMock(...args),
  };
});

beforeEach(() => {
  getUserByIdMock.mockReset();
  patchUserProfileMock.mockReset();
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
});

const fakeDb = { prepare: vi.fn() } as unknown as AuthDatabase;

describe("getUserProfile", () => {
  it("returns {} when AUTH_DB is unbound", async () => {
    const { getUserProfile } = await import("@/lib/user-profile");
    expect(await getUserProfile("sub-1")).toEqual({});
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it("maps a stored D1 user and parses preferences JSON", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    getUserByIdMock.mockResolvedValue({
      id: "sub-1",
      name: "Stored Name",
      company: "cloudless.gr",
      phone: "+30123",
      preferences_json: JSON.stringify({ theme: "light" }),
    });
    const { getUserProfile } = await import("@/lib/user-profile");
    const p = await getUserProfile("sub-1");
    expect(p).toEqual({
      name: "Stored Name",
      company: "cloudless.gr",
      phone: "+30123",
      preferences: { theme: "light" },
    });
    expect(getUserByIdMock).toHaveBeenCalledWith(fakeDb, "sub-1");
  });

  it("returns {} when no user exists", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    getUserByIdMock.mockResolvedValue(null);
    const { getUserProfile } = await import("@/lib/user-profile");
    expect(await getUserProfile("sub-x")).toEqual({});
  });

  it("ignores malformed stored preferences", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    getUserByIdMock.mockResolvedValue({
      id: "sub-1",
      name: "A",
      preferences_json: "{not-json",
    });
    const { getUserProfile } = await import("@/lib/user-profile");
    const p = await getUserProfile("sub-1");
    expect(p.name).toBe("A");
    expect(p.preferences).toBeUndefined();
  });
});

describe("putUserProfile", () => {
  it("throws when AUTH_DB is unbound", async () => {
    const { putUserProfile } = await import("@/lib/user-profile");
    await expect(putUserProfile("sub-1", { name: "N" })).rejects.toThrow(/AUTH_DB/);
  });

  it("calls patchUserProfile with fields", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    patchUserProfileMock.mockResolvedValue(true);
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { name: "N", company: "C", phone: "+30" });
    expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "sub-1", {
      name: "N",
      company: "C",
      phone: "+30",
    });
  });

  it("serializes preferences via patchUserProfile", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    patchUserProfileMock.mockResolvedValue(true);
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { preferences: { theme: "dark", language: "en" } });
    expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "sub-1", {
      preferences: { theme: "dark", language: "en" },
    });
  });

  it("clears a field with an empty string", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    patchUserProfileMock.mockResolvedValue(true);
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { phone: "" });
    expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "sub-1", { phone: "" });
  });

  it("is a no-op when no fields are provided", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", {});
    expect(patchUserProfileMock).not.toHaveBeenCalled();
  });

  it("throws when user is not found", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
    patchUserProfileMock.mockResolvedValue(false);
    const { putUserProfile } = await import("@/lib/user-profile");
    await expect(putUserProfile("sub-1", { name: "N" })).rejects.toThrow(/User not found/);
  });
});
