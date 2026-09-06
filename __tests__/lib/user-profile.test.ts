import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
  getUserById: vi.fn(),
  patchUserProfile: vi.fn(),
}));

import { getUserProfile, putUserProfile } from "@/lib/user-profile";

describe("getUserProfile (no D1)", () => {
  it("returns empty object when AUTH_DB is not configured", async () => {
    const profile = await getUserProfile("user-123");
    expect(profile).toEqual({});
  });
});

describe("putUserProfile (no D1)", () => {
  it("throws when AUTH_DB is not configured", async () => {
    await expect(putUserProfile("user-123", { name: "Alice" })).rejects.toThrow(
      "AUTH_DB is not configured"
    );
  });

  it("throws even when no fields are provided (D1 check precedes field check)", async () => {
    await expect(putUserProfile("user-123", {})).rejects.toThrow("AUTH_DB is not configured");
  });
});
