import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
  getUserByUsername: vi.fn().mockResolvedValue(null),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  verifyPassword: vi.fn().mockResolvedValue(false),
  createSession: vi.fn().mockResolvedValue(""),
  getSessionByToken: vi.fn().mockResolvedValue(null),
  deleteSession: vi.fn().mockResolvedValue(undefined),
}));

import { getAuthProvider } from "@/lib/auth";

describe("getAuthProvider", () => {
  it("returns d1", () => {
    expect(getAuthProvider()).toBe("d1");
  });
});
