import { describe, it, expect } from "vitest";
import { resetLocalAuthDbCache, getLocalAuthDb } from "@/lib/auth-db-local";

describe("auth-db-local", () => {
  it("getLocalAuthDb returns null in test env (no AUTH_DB_LOCAL_SQLITE set)", () => {
    resetLocalAuthDbCache();
    const db = getLocalAuthDb();
    expect(db).toBeNull();
  });

  it("resetLocalAuthDbCache does not throw", () => {
    expect(() => resetLocalAuthDbCache()).not.toThrow();
  });
});
