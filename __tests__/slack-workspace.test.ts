import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { getSlackConfigAsyncMock } = vi.hoisted(() => ({
  getSlackConfigAsyncMock: vi.fn(),
}));

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: () => getSlackConfigAsyncMock(),
}));

import { getBotInfo, getWorkspaceInfo, getSlackBrandingAudit } from "@/lib/slack-workspace";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

describe("slack-workspace", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getSlackConfigAsyncMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getBotInfo", () => {
    it("returns the bot identity from auth.test", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          user_id: "U_BOT",
          user: "cloudless-bot",
          team: "cloudless",
          team_id: "T_TEAM",
          url: "https://cloudless.slack.com/",
        }),
      });
      const r = await getBotInfo("xoxb-x");
      expect(r.userId).toBe("U_BOT");
      expect(r.botName).toBe("cloudless-bot");
      expect(r.team).toBe("cloudless");
      expect(r.teamId).toBe("T_TEAM");
    });

    it("uses token from integrations when not provided", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({ SLACK_BOT_TOKEN: "xoxb-from-integ" });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, user_id: "U1" }),
      });
      await getBotInfo();
      const [, init] = fetchMock.mock.calls[0];
      expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
        "Bearer xoxb-from-integ"
      );
    });

    it("throws when no token is available", async () => {
      getSlackConfigAsyncMock.mockResolvedValueOnce({ SLACK_BOT_TOKEN: "" });
      await expect(getBotInfo()).rejects.toThrow(/SLACK_BOT_TOKEN/);
    });

    it("throws on Slack-level ok:false", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "invalid_auth" }),
      });
      await expect(getBotInfo("xoxb-x")).rejects.toThrow(/invalid_auth/);
    });

    it("returns empty strings when optional fields are absent", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
      const r = await getBotInfo("xoxb-x");
      expect(r.userId).toBe("");
      expect(r.botName).toBe("");
      expect(r.team).toBe("");
    });
  });

  describe("getWorkspaceInfo", () => {
    it("returns workspace metadata with the highest-res icon", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: {
            id: "T1",
            name: "Cloudless",
            domain: "cloudless",
            email_domain: "cloudless.gr",
            icon: {
              image_88: "https://x/88.png",
              image_132: "https://x/132.png",
              image_230: "https://x/230.png",
            },
          },
        }),
      });
      const r = await getWorkspaceInfo("xoxb-x");
      expect(r.id).toBe("T1");
      expect(r.name).toBe("Cloudless");
      expect(r.iconUrl).toBe("https://x/230.png");
    });

    it("falls back to lower-res icon when 230 is missing", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: {
            id: "T1",
            name: "n",
            domain: "d",
            email_domain: "e",
            icon: { image_88: "https://x/88.png" },
          },
        }),
      });
      const r = await getWorkspaceInfo("xoxb-x");
      expect(r.iconUrl).toBe("https://x/88.png");
    });

    it("returns null icon when image_default is true", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          team: {
            id: "T1",
            name: "n",
            domain: "d",
            email_domain: "e",
            icon: { image_default: true, image_230: "https://x/230.png" },
          },
        }),
      });
      const r = await getWorkspaceInfo("xoxb-x");
      expect(r.iconUrl).toBeNull();
    });

    it("throws when ok:false", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: "missing_scope" }),
      });
      await expect(getWorkspaceInfo("xoxb-x")).rejects.toThrow(/missing_scope/);
    });
  });

  describe("getSlackBrandingAudit", () => {
    it("combines bot + workspace and pins the per-message branding", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            user_id: "U1",
            user: "bot",
            team: "cloudless",
            team_id: "T1",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            team: {
              id: "T1",
              name: "Cloudless",
              domain: "cloudless",
              email_domain: "cloudless.gr",
              icon: { image_230: "https://x/230.png" },
            },
          }),
        });
      const r = await getSlackBrandingAudit("xoxb-x");
      expect(r.bot.userId).toBe("U1");
      expect(r.workspace.name).toBe("Cloudless");
      expect(r.perMessageBranding.username).toBe("Cloudless");
      expect(r.perMessageBranding.iconUrl).toMatch(/icon-512\.png$/);
      expect(r.appLevelBrandingUrl).toBe("https://api.slack.com/apps");
    });
  });
});
