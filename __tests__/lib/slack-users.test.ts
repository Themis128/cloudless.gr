import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  lookupUserByEmail,
  getUserInfo,
  listUsers,
  resolveEmailToUserId,
} from "@/lib/slack-users";

function jsonResp(data: unknown, httpOk = true) {
  return Promise.resolve({
    ok: httpOk,
    status: httpOk ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

const user: import("@/lib/slack-users").SlackUser = {
  id: "U001",
  name: "alice",
  real_name: "Alice Smith",
  is_bot: false,
  is_app_user: false,
  deleted: false,
  profile: {
    display_name: "alice",
    real_name: "Alice Smith",
    email: "alice@example.com",
  },
};

beforeEach(() => vi.clearAllMocks());

describe("lookupUserByEmail", () => {
  it("returns the user when found", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, user }));
    const result = await lookupUserByEmail("alice@example.com", "xoxb-test");
    expect(result?.id).toBe("U001");
  });

  it("returns null when user is not found", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "users_not_found" }));
    const result = await lookupUserByEmail("nobody@example.com", "xoxb-test");
    expect(result).toBeNull();
  });

  it("throws for unexpected API errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "invalid_auth" }));
    await expect(lookupUserByEmail("a@b.com", "bad-token")).rejects.toThrow("users.lookupByEmail");
  });
});

describe("getUserInfo", () => {
  it("returns user profile by ID", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, user }));
    const result = await getUserInfo("U001", "xoxb-test");
    expect(result.name).toBe("alice");
  });

  it("throws when user not found", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "user_not_found" }));
    await expect(getUserInfo("UBAD", "xoxb-test")).rejects.toThrow("users.info");
  });
});

describe("listUsers", () => {
  it("returns non-deleted members from a single page", async () => {
    const deletedUser = { ...user, id: "U002", deleted: true };
    mockFetch.mockReturnValueOnce(
      jsonResp({ ok: true, members: [user, deletedUser], response_metadata: {} })
    );
    const result = await listUsers("xoxb-test");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("U001");
  });

  it("handles cursor pagination", async () => {
    const user2 = { ...user, id: "U003" };
    mockFetch
      .mockReturnValueOnce(
        jsonResp({ ok: true, members: [user], response_metadata: { next_cursor: "abc" } })
      )
      .mockReturnValueOnce(
        jsonResp({ ok: true, members: [user2], response_metadata: {} })
      );
    const result = await listUsers("xoxb-test");
    expect(result).toHaveLength(2);
  });
});

describe("resolveEmailToUserId", () => {
  it("returns the user ID when user is found", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, user }));
    const id = await resolveEmailToUserId("alice@example.com", "xoxb-test");
    expect(id).toBe("U001");
  });

  it("returns null when user is not found", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "users_not_found" }));
    const id = await resolveEmailToUserId("nobody@example.com", "xoxb-test");
    expect(id).toBeNull();
  });
});
