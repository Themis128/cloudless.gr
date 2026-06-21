import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okUser(overrides: Partial<{ id: string; name: string; email: string }> = {}) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      user: {
        id: overrides.id ?? "U001",
        name: overrides.name ?? "jane",
        real_name: "Jane Doe",
        is_bot: false,
        is_app_user: false,
        deleted: false,
        profile: {
          display_name: "jane",
          real_name: "Jane Doe",
          email: overrides.email ?? "jane@example.com",
        },
      },
    }),
  };
}

describe("slack-users.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lookupUserByEmail", () => {
    it("returns a user when found", async () => {
      const { lookupUserByEmail } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce(okUser({ id: "U42", email: "jane@example.com" }));

      const user = await lookupUserByEmail("jane@example.com", "xoxb-test");
      expect(user?.id).toBe("U42");
      expect(user?.profile.email).toBe("jane@example.com");

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("users.lookupByEmail");
      expect(call[1].headers["Content-Type"]).toContain("application/x-www-form-urlencoded");
    });

    it("returns null when user is not found", async () => {
      const { lookupUserByEmail } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "users_not_found" }),
      });

      const user = await lookupUserByEmail("nobody@example.com", "xoxb-test");
      expect(user).toBeNull();
    });

    it("throws on other API errors", async () => {
      const { lookupUserByEmail } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "missing_scope" }),
      });

      await expect(lookupUserByEmail("x@y.com", "xoxb-test")).rejects.toThrow("missing_scope");
    });
  });

  describe("getUserInfo", () => {
    it("returns user by ID", async () => {
      const { getUserInfo } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce(okUser({ id: "U99" }));

      const user = await getUserInfo("U99", "xoxb-test");
      expect(user.id).toBe("U99");

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("users.info");
      expect(call[0]).toContain("user=U99");
    });

    it("throws on error", async () => {
      const { getUserInfo } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "user_not_found" }),
      });

      await expect(getUserInfo("UBAD", "xoxb-test")).rejects.toThrow("user_not_found");
    });
  });

  describe("listUsers", () => {
    it("returns all non-deleted users across pages", async () => {
      const { listUsers } = await import("@/lib/slack-users");

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            members: [
              {
                ...okUser({ id: "U001" })
                  .json()
                  .then(() => {}),
                id: "U001",
                name: "alice",
                is_bot: false,
                is_app_user: false,
                deleted: false,
                profile: { display_name: "alice", real_name: "Alice" },
              },
              {
                id: "U002",
                name: "deleted-user",
                is_bot: false,
                is_app_user: false,
                deleted: true,
                profile: { display_name: "", real_name: "" },
              },
            ],
            response_metadata: { next_cursor: "cursor1" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            members: [
              {
                id: "U003",
                name: "bob",
                is_bot: false,
                is_app_user: false,
                deleted: false,
                profile: { display_name: "bob", real_name: "Bob" },
              },
            ],
            response_metadata: { next_cursor: "" },
          }),
        });

      const users = await listUsers("xoxb-test");
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.id)).toEqual(["U001", "U003"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws on API error", async () => {
      const { listUsers } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "not_authed" }),
      });

      await expect(listUsers("bad-token")).rejects.toThrow("not_authed");
    });
  });

  describe("resolveEmailToUserId", () => {
    it("returns user ID on match", async () => {
      const { resolveEmailToUserId } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce(okUser({ id: "U777" }));

      const id = await resolveEmailToUserId("jane@example.com", "xoxb-test");
      expect(id).toBe("U777");
    });

    it("returns null when user not found", async () => {
      const { resolveEmailToUserId } = await import("@/lib/slack-users");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "users_not_found" }),
      });

      const id = await resolveEmailToUserId("ghost@example.com", "xoxb-test");
      expect(id).toBeNull();
    });
  });
});
