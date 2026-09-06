import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: mockGetCfg,
}));

import {
  SLACK_CHANNELS,
  listChannels,
  createChannel,
  setChannelTopic,
  joinChannel,
  ensureChannel,
  ensureAllChannels,
} from "@/lib/slack-admin";

function jsonResp(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SLACK_CHANNELS", () => {
  it("defines all 6 expected channels", () => {
    const keys = Object.keys(SLACK_CHANNELS);
    expect(keys).toContain("bookings");
    expect(keys).toContain("orders");
    expect(keys).toContain("errors");
    expect(keys).toContain("deployments");
    expect(keys).toContain("contacts");
    expect(keys).toContain("subscribers");
    expect(keys).toHaveLength(6);
  });

  it("each channel has a non-empty name and topic string", () => {
    for (const ch of Object.values(SLACK_CHANNELS)) {
      expect(typeof ch.name).toBe("string");
      expect(ch.name.length).toBeGreaterThan(0);
      expect(typeof ch.topic).toBe("string");
      expect(ch.topic.length).toBeGreaterThan(0);
    }
  });
});

describe("listChannels", () => {
  it("returns channels from a single-page response", async () => {
    const ch = { id: "C1", name: "bookings", is_private: false, is_member: true, is_archived: false };
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, channels: [ch], response_metadata: {} }));
    const result = await listChannels("xoxb-test");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("C1");
  });

  it("throws when the API returns ok:false", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "invalid_auth" }));
    await expect(listChannels("xoxb-bad")).rejects.toThrow("conversations.list");
  });
});

describe("createChannel", () => {
  it("returns the created channel", async () => {
    const ch = { id: "C2", name: "orders", is_private: false, is_member: true, is_archived: false };
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true, channel: ch }));
    const result = await createChannel("orders", "xoxb-test");
    expect(result.id).toBe("C2");
    expect(result.name).toBe("orders");
  });

  it("throws when creation fails", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "name_taken" }));
    await expect(createChannel("errors", "xoxb-test")).rejects.toThrow("conversations.create");
  });
});

describe("setChannelTopic", () => {
  it("resolves without error on success", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true }));
    await expect(setChannelTopic("C1", "My topic", "xoxb-test")).resolves.toBeUndefined();
  });
});

describe("joinChannel", () => {
  it("resolves without error on success", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true }));
    await expect(joinChannel("C1", "xoxb-test")).resolves.toBeUndefined();
  });

  it("tolerates already_in_channel", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "already_in_channel" }));
    await expect(joinChannel("C1", "xoxb-test")).resolves.toBeUndefined();
  });
});

describe("ensureChannel", () => {
  const ch = { id: "C10", name: "bookings", is_private: false, is_member: true, is_archived: false };

  it("returns existing channel without joining when already a member", async () => {
    const result = await ensureChannel("bookings", "topic", "xoxb-test", [ch]);
    expect(result).toEqual({ id: "C10", name: "bookings", created: false, joined: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("joins channel when not a member", async () => {
    const notMember = { ...ch, is_member: false };
    mockFetch.mockReturnValueOnce(jsonResp({ ok: true })); // join
    const result = await ensureChannel("bookings", "topic", "xoxb-test", [notMember]);
    expect(result.joined).toBe(true);
    expect(result.created).toBe(false);
  });

  it("creates and sets topic when channel doesn't exist", async () => {
    const created = { id: "C99", name: "new-ch", is_private: false, is_member: true, is_archived: false };
    mockFetch
      .mockReturnValueOnce(jsonResp({ ok: true, channel: created })) // create
      .mockReturnValueOnce(jsonResp({ ok: true })); // setTopic
    const result = await ensureChannel("new-ch", "Some topic", "xoxb-test", []);
    expect(result).toEqual({ id: "C99", name: "new-ch", created: true, joined: true });
  });
});

describe("ensureAllChannels", () => {
  it("throws when SLACK_BOT_TOKEN is not configured", async () => {
    mockGetCfg.mockResolvedValue({ SLACK_BOT_TOKEN: undefined });
    await expect(ensureAllChannels()).rejects.toThrow("SLACK_BOT_TOKEN is not configured");
  });
});
