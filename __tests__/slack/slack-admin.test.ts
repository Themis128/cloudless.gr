import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSlackConfigAsync = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: () => mockGetSlackConfigAsync(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function slackOk(extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({ ok: true, ...extra }),
  };
}

function slackErr(error: string) {
  return {
    ok: true,
    json: async () => ({ ok: false, error }),
  };
}

function makeChannel(
  overrides: Partial<{
    id: string;
    name: string;
    is_private: boolean;
    is_member: boolean;
    is_archived: boolean;
  }> = {}
) {
  return {
    id: "C001",
    name: "general",
    is_private: false,
    is_member: true,
    is_archived: false,
    ...overrides,
  };
}

describe("slack-admin.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackConfigAsync.mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-test" });
  });

  describe("listChannels", () => {
    it("returns all channels across paginated responses", async () => {
      const { listChannels } = await import("@/lib/slack-admin");

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            channels: [makeChannel({ id: "C001", name: "general" })],
            response_metadata: { next_cursor: "cursor1" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            channels: [makeChannel({ id: "C002", name: "random" })],
            response_metadata: { next_cursor: "" },
          }),
        });

      const result = await listChannels("xoxb-test");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toEqual(["general", "random"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws on API error", async () => {
      const { listChannels } = await import("@/lib/slack-admin");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "not_authed" }),
      });

      await expect(listChannels("bad-token")).rejects.toThrow("not_authed");
    });
  });

  describe("createChannel", () => {
    it("returns the created channel", async () => {
      const { createChannel } = await import("@/lib/slack-admin");

      mockFetch.mockResolvedValueOnce(
        slackOk({ channel: makeChannel({ id: "C123", name: "bookings" }) })
      );

      const ch = await createChannel("bookings", "xoxb-test");
      expect(ch.id).toBe("C123");
      expect(ch.name).toBe("bookings");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.name).toBe("bookings");
    });

    it("throws on name_taken", async () => {
      const { createChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackErr("name_taken"));
      await expect(createChannel("bookings", "xoxb-test")).rejects.toThrow("name_taken");
    });
  });

  describe("setChannelTopic", () => {
    it("calls conversations.setTopic with channel and topic", async () => {
      const { setChannelTopic } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackOk({ channel: makeChannel() }));

      await setChannelTopic("C001", "New topic", "xoxb-test");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe("C001");
      expect(body.topic).toBe("New topic");
    });

    it("throws on error", async () => {
      const { setChannelTopic } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackErr("channel_not_found"));
      await expect(setChannelTopic("C999", "x", "xoxb-test")).rejects.toThrow("channel_not_found");
    });
  });

  describe("joinChannel", () => {
    it("calls conversations.join", async () => {
      const { joinChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackOk({ channel: makeChannel() }));

      await joinChannel("C001", "xoxb-test");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe("C001");
    });

    it("does not throw on already_in_channel", async () => {
      const { joinChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackErr("already_in_channel"));
      await expect(joinChannel("C001", "xoxb-test")).resolves.toBeUndefined();
    });

    it("throws on other errors", async () => {
      const { joinChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackErr("channel_not_found"));
      await expect(joinChannel("C999", "xoxb-test")).rejects.toThrow("channel_not_found");
    });
  });

  describe("inviteToChannel", () => {
    it("sends comma-separated user IDs", async () => {
      const { inviteToChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackOk({ channel: makeChannel() }));

      await inviteToChannel("C001", ["U001", "U002"], "xoxb-test");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.users).toBe("U001,U002");
    });

    it("throws on invite error", async () => {
      const { inviteToChannel } = await import("@/lib/slack-admin");
      mockFetch.mockResolvedValueOnce(slackErr("cant_invite_self"));
      await expect(inviteToChannel("C001", ["U001"], "xoxb-test")).rejects.toThrow(
        "cant_invite_self"
      );
    });
  });

  describe("ensureChannel", () => {
    it("returns existing channel without creating if bot is already a member", async () => {
      const { ensureChannel } = await import("@/lib/slack-admin");

      const existing = [makeChannel({ id: "C001", name: "bookings", is_member: true })];
      const result = await ensureChannel("bookings", "topic", "xoxb-test", existing);

      expect(result.created).toBe(false);
      expect(result.joined).toBe(false);
      expect(result.id).toBe("C001");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("joins an existing channel the bot is not a member of", async () => {
      const { ensureChannel } = await import("@/lib/slack-admin");

      mockFetch.mockResolvedValueOnce(slackOk({ channel: makeChannel() })); // join

      const existing = [makeChannel({ id: "C001", name: "bookings", is_member: false })];
      const result = await ensureChannel("bookings", "topic", "xoxb-test", existing);

      expect(result.created).toBe(false);
      expect(result.joined).toBe(true);
    });

    it("creates a new channel and sets topic when not found", async () => {
      const { ensureChannel } = await import("@/lib/slack-admin");

      mockFetch
        .mockResolvedValueOnce(slackOk({ channel: makeChannel({ id: "C999", name: "bookings" }) })) // create
        .mockResolvedValueOnce(slackOk({ channel: makeChannel() })); // setTopic

      const result = await ensureChannel("bookings", "My topic", "xoxb-test", []);

      expect(result.created).toBe(true);
      expect(result.joined).toBe(true);
      expect(result.id).toBe("C999");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("ensureAllChannels", () => {
    it("creates all 6 cloudless channels", async () => {
      const { ensureAllChannels, SLACK_CHANNELS } = await import("@/lib/slack-admin");

      // listChannels returns empty → all need to be created
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [],
          response_metadata: { next_cursor: "" },
        }),
      });

      // For each channel: create + setTopic calls
      const channelKeys = Object.keys(SLACK_CHANNELS);
      let channelIdx = 0;
      mockFetch.mockImplementation(async (url: string, _init?: RequestInit) => {
        const method = (url as string).split("/").pop()?.split("?")[0];
        if (method === "conversations.list") {
          return {
            ok: true,
            json: async () => ({ ok: true, channels: [], response_metadata: { next_cursor: "" } }),
          };
        }
        if (method === "conversations.create") {
          const name = channelKeys[Math.floor(channelIdx / 2)];
          channelIdx++;
          return {
            ok: true,
            json: async () => ({
              ok: true,
              channel: makeChannel({ id: `C00${channelIdx}`, name }),
            }),
          };
        }
        // setTopic
        channelIdx++;
        return { ok: true, json: async () => ({ ok: true, channel: makeChannel() }) };
      });

      const results = await ensureAllChannels();

      expect(Object.keys(results)).toHaveLength(channelKeys.length);
      for (const key of channelKeys) {
        expect(results[key as keyof typeof results]).toBeDefined();
      }
    });

    it("throws when SLACK_BOT_TOKEN is not set", async () => {
      const { ensureAllChannels } = await import("@/lib/slack-admin");
      mockGetSlackConfigAsync.mockResolvedValueOnce({ SLACK_BOT_TOKEN: undefined });

      await expect(ensureAllChannels()).rejects.toThrow("SLACK_BOT_TOKEN is not configured");
    });
  });

  describe("SLACK_CHANNELS registry", () => {
    it("defines all 7 required channels", async () => {
      const { SLACK_CHANNELS } = await import("@/lib/slack-admin");
      const names = Object.values(SLACK_CHANNELS).map((c) => c.name);
      expect(names).toContain("bookings");
      expect(names).toContain("orders");
      expect(names).toContain("errors");
      expect(names).toContain("deployments");
      expect(names).toContain("contacts");
      expect(names).toContain("campaigns");
      expect(names).toContain("subscribers");
    });

    it("every channel has a non-empty topic", async () => {
      const { SLACK_CHANNELS } = await import("@/lib/slack-admin");
      for (const { topic } of Object.values(SLACK_CHANNELS)) {
        expect(topic.length).toBeGreaterThan(0);
      }
    });
  });
});
