import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

import { isMetaAdsConfigured, listMetaCampaigns, getMetaInsights } from "@/lib/campaigns/meta-ads";

const CONFIGURED = {
  META_ACCESS_TOKEN: "EAAtoken",
  META_AD_ACCOUNT_ID: "1234567890",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue(CONFIGURED);
});

describe("isMetaAdsConfigured", () => {
  it("is true with token and ad account id", async () => {
    await expect(isMetaAdsConfigured()).resolves.toBe(true);
  });

  it("is false when either value is missing", async () => {
    mockGetConfig.mockResolvedValue({ META_ACCESS_TOKEN: "", META_AD_ACCOUNT_ID: "1" });
    await expect(isMetaAdsConfigured()).resolves.toBe(false);
    mockGetConfig.mockResolvedValue({ META_ACCESS_TOKEN: "t", META_AD_ACCOUNT_ID: "" });
    await expect(isMetaAdsConfigured()).resolves.toBe(false);
  });
});

describe("listMetaCampaigns", () => {
  it("prefixes the account id with act_ and appends the access token", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await listMetaCampaigns();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/act_1234567890/campaigns");
    expect(url).toContain("access_token=EAAtoken");
  });

  it("does not double-prefix an already-prefixed account id", async () => {
    mockGetConfig.mockResolvedValue({
      META_ACCESS_TOKEN: "t",
      META_AD_ACCOUNT_ID: "act_42",
    });
    mockFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await listMetaCampaigns();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/act_42/campaigns");
    expect(url).not.toContain("act_act_");
  });

  it("returns campaigns from the data envelope", async () => {
    const campaigns = [
      {
        id: "c1",
        name: "Spring",
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        created_time: "2026-05-01T00:00:00+0000",
        updated_time: "2026-06-01T00:00:00+0000",
      },
    ];
    mockFetch.mockResolvedValue(jsonResponse({ data: campaigns }));
    await expect(listMetaCampaigns()).resolves.toEqual(campaigns);
  });

  it("returns [] on HTTP error and network failure", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: {} }, 400));
    await expect(listMetaCampaigns()).resolves.toEqual([]);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    await expect(listMetaCampaigns()).resolves.toEqual([]);
  });
});

describe("getMetaInsights", () => {
  it("parses numeric strings and sums lead action types", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: [
          {
            impressions: "12345",
            clicks: "678",
            spend: "90.12",
            ctr: "5.49",
            actions: [
              { action_type: "lead", value: "7" },
              { action_type: "onsite_conversion.lead_grouped", value: "3" },
              { action_type: "link_click", value: "500" },
            ],
          },
        ],
      })
    );
    const insights = await getMetaInsights("2026-05-12", "2026-06-12");
    expect(insights).toEqual({
      impressions: 12345,
      clicks: 678,
      spend: 90.12,
      leads: 10,
      ctr: 5.49,
    });
  });

  it("passes the date range as a time_range JSON param", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await getMetaInsights("2026-01-01", "2026-01-31");
    const url = decodeURIComponent(mockFetch.mock.calls[0][0] as string);
    expect(url).toContain('"since":"2026-01-01"');
    expect(url).toContain('"until":"2026-01-31"');
  });

  it("returns zeros when there is no data row, on HTTP error, and on network failure", async () => {
    const empty = { impressions: 0, clicks: 0, spend: 0, leads: 0, ctr: 0 };
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await expect(getMetaInsights("2026-01-01", "2026-01-31")).resolves.toEqual(empty);
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: {} }, 500));
    await expect(getMetaInsights("2026-01-01", "2026-01-31")).resolves.toEqual(empty);
    mockFetch.mockRejectedValueOnce(new Error("down"));
    await expect(getMetaInsights("2026-01-01", "2026-01-31")).resolves.toEqual(empty);
  });
});
