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

import { getUserProfile, putUserProfile } from "@/lib/user-profile";

describe("user-profile", () => {
  const fakeDb = { prepare: vi.fn() } as unknown as AuthDatabase;

  beforeEach(() => {
    getUserByIdMock.mockReset();
    patchUserProfileMock.mockReset();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  describe("getUserProfile", () => {
    it("returns {} when AUTH_DB is unbound", async () => {
      expect(await getUserProfile("user-1")).toEqual({});
    });

    it("returns {} when D1 returns no user", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      getUserByIdMock.mockResolvedValueOnce(null);
      expect(await getUserProfile("user-1")).toEqual({});
    });

    it("maps stored fields back", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      getUserByIdMock.mockResolvedValueOnce({
        id: "user-1",
        name: "Themis",
        company: "Cloudless",
        phone: "+30...",
      });
      const r = await getUserProfile("user-1");
      expect(r.name).toBe("Themis");
      expect(r.company).toBe("Cloudless");
      expect(r.phone).toBe("+30...");
    });

    it("parses JSON preferences", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      getUserByIdMock.mockResolvedValueOnce({
        id: "user-1",
        preferences_json: JSON.stringify({ theme: "dark", lang: "en" }),
      });
      const r = await getUserProfile("user-1");
      expect(r.preferences).toEqual({ theme: "dark", lang: "en" });
    });

    it("silently drops malformed JSON preferences", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      getUserByIdMock.mockResolvedValueOnce({
        id: "user-1",
        preferences_json: "{not json",
      });
      const r = await getUserProfile("user-1");
      expect(r.preferences).toBeUndefined();
    });
  });

  describe("putUserProfile", () => {
    it("throws when AUTH_DB is unbound", async () => {
      await expect(putUserProfile("user-1", { name: "Themis" })).rejects.toThrow(/AUTH_DB/);
    });

    it("does not call patch when no fields are provided", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      await putUserProfile("user-1", {});
      expect(patchUserProfileMock).not.toHaveBeenCalled();
    });

    it("passes string fields to patchUserProfile", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      patchUserProfileMock.mockResolvedValueOnce(true);
      await putUserProfile("user-1", { name: "Themis", company: "Cloudless" });
      expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "user-1", {
        name: "Themis",
        company: "Cloudless",
      });
    });

    it("passes empty-string clears through", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      patchUserProfileMock.mockResolvedValueOnce(true);
      await putUserProfile("user-1", { name: "", phone: "" });
      expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "user-1", {
        name: "",
        phone: "",
      });
    });

    it("serializes preferences object through to patch", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = fakeDb;
      patchUserProfileMock.mockResolvedValueOnce(true);
      await putUserProfile("user-1", { preferences: { theme: "dark" } });
      expect(patchUserProfileMock).toHaveBeenCalledWith(fakeDb, "user-1", {
        preferences: { theme: "dark" },
      });
    });
  });
});
