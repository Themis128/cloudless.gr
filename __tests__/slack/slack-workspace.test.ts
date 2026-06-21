import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSlackConfigAsync = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getSlackConfigAsync: () => mockGetSlackConfigAsync(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const AUTH_TEST_OK = {
  ok: true,
  url: "https://cloudless.slack.com/",
  team: "Cloudless",
  user: "cloudless-bot",
  team_id: "T001",
  user_id: "U001",
  bot_id: "B001",
};

const TEAM_INFO_OK = {
  ok: true,
  team: {
    id: "T001",
    name: "Cloudless",
    domain: "cloudless",
    email_domain: "cloudless.gr",
    icon: {
      image_132: "https://slack-imgs.com/icon-132.png",
      image_230: "https://slack-imgs.com/icon-230.png",
      image_default: false,
    },
  },
};

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data };
}

describe("slack-workspace.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSlackConfigAsync.mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-test" });
  });

  describe("getBotInfo", () => {
    it("returns bot identity from auth.test", async () => {
      const { getBotInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(jsonResponse(AUTH_TEST_OK));

      const info = await getBotInfo("xoxb-test");
      expect(info.botName).toBe("cloudless-bot");
      expect(info.team).toBe("Cloudless");
      expect(info.teamId).toBe("T001");
      expect(info.userId).toBe("U001");
      expect(info.url).toBe("https://cloudless.slack.com/");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://slack.com/api/auth.test",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("resolves token from integrations when not passed directly", async () => {
      const { getBotInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(jsonResponse(AUTH_TEST_OK));

      await getBotInfo(); // no token arg
      expect(mockGetSlackConfigAsync).toHaveBeenCalled();
    });

    it("throws on auth.test error", async () => {
      const { getBotInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: "invalid_auth" }));

      await expect(getBotInfo("bad-token")).rejects.toThrow("invalid_auth");
    });

    it("throws when token is not configured", async () => {
      const { getBotInfo } = await import("@/lib/slack-workspace");
      mockGetSlackConfigAsync.mockResolvedValueOnce({ SLACK_BOT_TOKEN: undefined });

      await expect(getBotInfo()).rejects.toThrow("SLACK_BOT_TOKEN is not configured");
    });
  });

  describe("getWorkspaceInfo", () => {
    it("returns workspace metadata and icon URL", async () => {
      const { getWorkspaceInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(jsonResponse(TEAM_INFO_OK));

      const info = await getWorkspaceInfo("xoxb-test");
      expect(info.name).toBe("Cloudless");
      expect(info.domain).toBe("cloudless");
      expect(info.emailDomain).toBe("cloudless.gr");
      expect(info.iconUrl).toBe("https://slack-imgs.com/icon-230.png");
    });

    it("returns null iconUrl when workspace has the default Slack icon", async () => {
      const { getWorkspaceInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          team: {
            ...TEAM_INFO_OK.team,
            icon: { image_default: true },
          },
        })
      );

      const info = await getWorkspaceInfo("xoxb-test");
      expect(info.iconUrl).toBeNull();
    });

    it("throws on API error", async () => {
      const { getWorkspaceInfo } = await import("@/lib/slack-workspace");
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: "missing_scope" }));

      await expect(getWorkspaceInfo("xoxb-test")).rejects.toThrow("missing_scope");
    });
  });

  describe("getSlackBrandingAudit", () => {
    it("returns combined bot, workspace, and branding config", async () => {
      const { getSlackBrandingAudit } = await import("@/lib/slack-workspace");

      mockFetch
        .mockResolvedValueOnce(jsonResponse(AUTH_TEST_OK)) // auth.test
        .mockResolvedValueOnce(jsonResponse(TEAM_INFO_OK)); // team.info

      const audit = await getSlackBrandingAudit("xoxb-test");
      expect(audit.bot.team).toBe("Cloudless");
      expect(audit.workspace.domain).toBe("cloudless");
      expect(audit.perMessageBranding.username).toBe("Cloudless");
      expect(audit.perMessageBranding.iconUrl).toContain("cloudless.gr");
      expect(audit.appLevelBrandingUrl).toContain("api.slack.com/apps");
    });
  });
});
