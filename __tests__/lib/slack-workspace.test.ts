import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/integrations", () => ({ getSlackConfigAsync: mockGetCfg }));

import { getBotInfo, getWorkspaceInfo } from "@/lib/slack-workspace";

function jsonResp(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCfg.mockResolvedValue({ SLACK_BOT_TOKEN: "xoxb-test" });
});

describe("getBotInfo", () => {
  it("returns bot identity from auth.test", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResp({
        ok: true,
        user_id: "U001",
        user: "cloudless",
        team: "Cloudless",
        team_id: "T001",
        url: "https://cloudless.slack.com/",
      })
    );
    const result = await getBotInfo("xoxb-test");
    expect(result.userId).toBe("U001");
    expect(result.botName).toBe("cloudless");
    expect(result.team).toBe("Cloudless");
  });

  it("throws when SLACK_BOT_TOKEN is not configured", async () => {
    mockGetCfg.mockResolvedValue({ SLACK_BOT_TOKEN: undefined });
    await expect(getBotInfo()).rejects.toThrow("SLACK_BOT_TOKEN is not configured");
  });

  it("throws when auth.test returns ok:false", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "invalid_auth" }));
    await expect(getBotInfo("bad")).rejects.toThrow("auth.test");
  });
});

describe("getWorkspaceInfo", () => {
  const teamResponse = {
    ok: true,
    team: {
      id: "T001",
      name: "Cloudless",
      domain: "cloudless",
      email_domain: "cloudless.gr",
      icon: { image_230: "https://example.com/icon.png" },
    },
  };

  it("returns workspace metadata", async () => {
    mockFetch.mockReturnValueOnce(jsonResp(teamResponse));
    const result = await getWorkspaceInfo("xoxb-test");
    expect(result.id).toBe("T001");
    expect(result.domain).toBe("cloudless");
    expect(result.iconUrl).toBe("https://example.com/icon.png");
  });

  it("returns null iconUrl when image_default is true", async () => {
    const noIcon = {
      ok: true,
      team: {
        ...teamResponse.team,
        icon: { image_default: true, image_230: "https://example.com/default.png" },
      },
    };
    mockFetch.mockReturnValueOnce(jsonResp(noIcon));
    const result = await getWorkspaceInfo("xoxb-test");
    expect(result.iconUrl).toBeNull();
  });

  it("throws when team.info returns ok:false", async () => {
    mockFetch.mockReturnValueOnce(jsonResp({ ok: false, error: "team_not_found" }));
    await expect(getWorkspaceInfo("xoxb-test")).rejects.toThrow("team.info");
  });
});
