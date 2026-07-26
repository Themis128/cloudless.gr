import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  lookupUserByEmail,
  getUserInfo,
  listUsers,
  resolveEmailToUserId,
  type SlackUser,
} from "@/lib/slack-users";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function userFixture(id: string, email?: string, deleted = false): SlackUser {
  return {
    id,
    name: id.toLowerCase(),
    real_name: id,
    is_bot: false,
    is_app_user: false,
    deleted,
    profile: {
      display_name: id,
      real_name: id,
      ...(email ? { email } : {}),
    },
  };
}

describe("slack-users", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("lookupUserByEmail", () => {
    it("returns the user on success", async () => {
      const user = userFixture("U1", "x@y");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, user }),
      });
      const r = await lookupUserByEmail("x@y", "xoxb-x");
      expect(r?.id).toBe("U1");
    });

    it("returns null on users_not_found", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "users_not_found" }),
      });
      expect(await lookupUserByEmail("nobody@x", "xoxb-x")).toBeNull();
    });

    it("throws on other Slack errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "missing_scope" }),
      });
      await expect(lookupUserByEmail("x@y", "xoxb-x")).rejects.toThrow(/missing_scope/);
    });

    it("throws on HTTP error", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
      await expect(lookupUserByEmail("x@y", "xoxb-x")).rejects.toThrow(/HTTP 503/);
    });

    it("uses form-encoded POST", async () => {
      const user = userFixture("U1", "x@y");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, user }),
      });
      await lookupUserByEmail("x@y", "xoxb-x");
      const [, init] = fetchMock.mock.calls[0];
      expect((init as { method: string }).method).toBe("POST");
      expect((init as { headers: Record<string, string> }).headers["Content-Type"]).toBe(
        "application/x-www-form-urlencoded"
      );
    });
  });

  describe("getUserInfo", () => {
    it("returns the user on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, user: userFixture("U2") }),
      });
      const r = await getUserInfo("U2", "xoxb-x");
      expect(r.id).toBe("U2");
    });

    it("throws when the user is missing in the response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      await expect(getUserInfo("U2", "xoxb-x")).rejects.toThrow();
    });

    it("throws on Slack-level error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "user_not_found" }),
      });
      await expect(getUserInfo("U2", "xoxb-x")).rejects.toThrow(/user_not_found/);
    });
  });

  describe("listUsers", () => {
    it("filters out deleted members", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          members: [userFixture("U1"), userFixture("U2", undefined, true)],
        }),
      });
      const r = await listUsers("xoxb-x");
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe("U1");
    });

    it("walks the response_metadata.next_cursor pagination", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            members: [userFixture("U1")],
            response_metadata: { next_cursor: "cur-2" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            members: [userFixture("U2")],
          }),
        });
      const r = await listUsers("xoxb-x");
      expect(r.map((u) => u.id)).toEqual(["U1", "U2"]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws on Slack-level error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "ratelimited" }),
      });
      await expect(listUsers("xoxb-x")).rejects.toThrow(/ratelimited/);
    });
  });

  describe("resolveEmailToUserId", () => {
    it("returns the id when the user exists", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, user: userFixture("U99", "x@y") }),
      });
      expect(await resolveEmailToUserId("x@y", "xoxb-x")).toBe("U99");
    });

    it("returns null when the user does not exist", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "users_not_found" }),
      });
      expect(await resolveEmailToUserId("nope@y", "xoxb-x")).toBeNull();
    });
  });
});
