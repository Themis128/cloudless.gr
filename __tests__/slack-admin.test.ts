import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: vi.fn().mockResolvedValue({
    SLACK_BOT_TOKEN: "xoxb-test",
  }),
}));

import {
  SLACK_CHANNELS,
  listChannels,
  createChannel,
  setChannelTopic,
  joinChannel,
  archiveChannel,
  type SlackChannelKey,
} from "@/lib/slack-admin";

describe("slack-admin", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("SLACK_CHANNELS registry", () => {
    it("defines the canonical 7 channels", () => {
      const keys = Object.keys(SLACK_CHANNELS) as SlackChannelKey[];
      expect(keys).toEqual([
        "bookings",
        "orders",
        "errors",
        "deployments",
        "contacts",
        "campaigns",
        "subscribers",
      ]);
    });

    it("every channel has name + topic", () => {
      for (const def of Object.values(SLACK_CHANNELS)) {
        expect(def.name).toBeTruthy();
        expect(def.topic).toBeTruthy();
        expect(def.topic.length).toBeGreaterThan(0);
      }
    });

    it("channel names are unique", () => {
      const names = Object.values(SLACK_CHANNELS).map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe("listChannels", () => {
    it("returns channels from a paginated Slack response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channels: [
            { id: "C1", name: "bookings", is_private: false, is_member: true, is_archived: false },
            { id: "C2", name: "orders", is_private: false, is_member: false, is_archived: false },
          ],
        }),
      });
      const out = await listChannels("xoxb-x");
      expect(out).toHaveLength(2);
      expect(out[0].id).toBe("C1");
    });

    it("throws on non-2xx HTTP", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      await expect(listChannels("xoxb-x")).rejects.toThrow(/HTTP 500/);
    });

    it("throws on Slack-level ok:false", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "invalid_auth" }),
      });
      await expect(listChannels("xoxb-x")).rejects.toThrow(/invalid_auth/);
    });
  });

  describe("createChannel", () => {
    it("posts to conversations.create with the name", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          channel: {
            id: "C1",
            name: "test",
            is_private: false,
            is_member: true,
            is_archived: false,
          },
        }),
      });
      const ch = await createChannel("test", "xoxb-x");
      expect(ch.id).toBe("C1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("conversations.create");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.name).toBe("test");
    });

    it("surfaces Slack ok:false errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "name_taken" }),
      });
      await expect(createChannel("test", "xoxb-x")).rejects.toThrow(/name_taken/);
    });
  });

  describe("setChannelTopic", () => {
    it("calls conversations.setTopic", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      await setChannelTopic("C1", "new topic", "xoxb-x");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("conversations.setTopic");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.channel).toBe("C1");
      expect(body.topic).toBe("new topic");
    });
  });

  describe("joinChannel", () => {
    it("calls conversations.join", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      await joinChannel("C1", "xoxb-x");
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("conversations.join");
    });
  });

  describe("archiveChannel", () => {
    it("calls conversations.archive", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      await archiveChannel("C1", "xoxb-x");
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("conversations.archive");
    });
  });
});
