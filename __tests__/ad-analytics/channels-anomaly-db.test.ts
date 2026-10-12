/**
 * Tests for ad-analytics channels (slack + email renderers) and the
 * D1-backed paths of anomaly-log (listFromLog / listFromBookmarks /
 * recordAnomalyEvents insert path).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const libs = vi.hoisted(() => ({
  getAuthDbFromEnv: vi.fn(() => null),
  allowDiscretionaryD1Write: vi.fn(() => true),
  sendEmail: vi.fn(async () => {}),
  isResendConfigured: vi.fn(() => false),
  isCloudflareEmailConfigured: vi.fn(() => false),
  slackPost: vi.fn(),
  slackClientCtor: vi.fn(),
}));
vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => libs.getAuthDbFromEnv(),
}));
vi.mock("@/lib/d1-write-budget", () => ({
  allowDiscretionaryD1Write: (n: number) => libs.allowDiscretionaryD1Write(n),
}));
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendEmail: libs.sendEmail };
});
vi.mock("@/lib/email-resend", () => ({
  isResendConfigured: () => libs.isResendConfigured(),
}));
vi.mock("@/lib/email-cloudflare", () => ({
  isCloudflareEmailConfigured: () => libs.isCloudflareEmailConfigured(),
}));
vi.mock("@/lib/slack-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slack-notify")>();
  return {
    ...actual,
    SlackClient: function MockSlackClient(opts: unknown) {
      libs.slackClientCtor(opts);
      return { post: libs.slackPost };
    } as never,
  };
});

import { slackChannel, _resetSlackChannelCache } from "@/lib/ad-analytics/channels/slack";
import { emailChannel } from "@/lib/ad-analytics/channels/email";
import {
  _resetAnomalyLogMemory,
  listAnomalyHistory,
  recordAnomalyEvents,
} from "@/lib/ad-analytics/anomaly-log";
import type { AdMetrics } from "@/lib/ad-analytics/types";

beforeEach(() => {
  vi.clearAllMocks();
  _resetSlackChannelCache();
  _resetAnomalyLogMemory();
  libs.getAuthDbFromEnv.mockReturnValue(null);
  libs.allowDiscretionaryD1Write.mockReturnValue(true);
});

describe("slackChannel", () => {
  it("isConfigured true; sendBlock translates every block type", async () => {
    expect(await slackChannel.isConfigured()).toBe(true);

    libs.slackPost.mockResolvedValue(true);
    const { messageId } = await slackChannel.sendBlock({
      target: "#ads-digest",
      blocks: [
        { type: "header", text: "Digest" },
        { type: "section", text: "plain text" },
        {
          type: "section",
          fields: [{ title: "Spend", value: "€42" }],
        },
        { type: "context", text: "window 1h" },
        { type: "divider" },
        { type: "actions", text: "action fallback" },
        { type: "section", slackRaw: { type: "rich_text" } },
      ],
    });
    expect(messageId).toContain("slack:#ads-digest:");
    expect(libs.slackClientCtor).toHaveBeenCalledWith({
      channel: "#ads-digest",
    });
    const blocks = libs.slackPost.mock.calls[0][0].blocks;
    expect(blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "Digest", emoji: true },
    });
    expect(blocks[1].text.text).toBe("plain text");
    expect(blocks[2].fields[0].text).toBe("*Spend*\n€42");
    expect(blocks[3].elements[0].text).toBe("window 1h");
    expect(blocks[4]).toEqual({ type: "divider" });
    expect(blocks[5].text.text).toBe("action fallback");
    expect(blocks[6]).toEqual({ type: "rich_text" });

    // client cache: second send to same channel reuses the client
    await slackChannel.sendBlock({ target: "#ads-digest", blocks: [] });
    expect(libs.slackClientCtor).toHaveBeenCalledTimes(1);
    await slackChannel.sendBlock({ target: "#other", blocks: [] });
    expect(libs.slackClientCtor).toHaveBeenCalledTimes(2);
  });

  it("not-sent when post fails; default preview; reply no-op", async () => {
    libs.slackPost.mockResolvedValue(false);
    const { messageId } = await slackChannel.sendBlock({
      target: "#x",
      blocks: [{ type: "divider" }],
    });
    expect(messageId).toBe("slack:not-sent");
    expect(libs.slackPost.mock.calls[0][0].text).toBe(
      "Ad analytics notification"
    );

    await expect(
      slackChannel.reply({ threadKey: "t", blocks: [] })
    ).resolves.toBeUndefined();
  });
});

describe("emailChannel", () => {
  it("isConfigured across providers; render+send via sendEmail", async () => {
    expect(await emailChannel.isConfigured()).toBe(false);
    libs.isCloudflareEmailConfigured.mockReturnValue(true);
    expect(await emailChannel.isConfigured()).toBe(true);
    libs.isCloudflareEmailConfigured.mockReturnValue(false);
    libs.isResendConfigured.mockReturnValue(true);
    expect(await emailChannel.isConfigured()).toBe(true);

    const { messageId } = await emailChannel.sendBlock({
      target: "ops@cloudless.gr",
      blocks: [
        { type: "header", text: "*CTR* Alert" },
        {
          type: "section",
          fields: [{ title: "*Spend*", value: "€42 _today_" }],
        },
        { type: "section", text: "see <https://x.gr|dashboard> now" },
        { type: "context", text: "`1h` window" },
        { type: "divider" },
        { type: "actions", text: "fallback text" },
      ],
    });
    expect(messageId).toContain("email-");
    const sent = libs.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("ops@cloudless.gr");
    expect(sent.subject).toBe("CTR Alert");
    expect(sent.text).toContain("Spend: €42 today");
    expect(sent.text).toContain("dashboard (https://x.gr)");
    expect(sent.text).toContain("— 1h window");
    expect(sent.text).toContain("---");
    expect(sent.html).toContain("<h2");
    expect(sent.html).toContain("<strong>Spend</strong>");
    expect(sent.html).toContain("<hr");
    expect(sent.html).toContain("fallback text");

    await expect(
      emailChannel.reply({ threadKey: "t", blocks: [] })
    ).resolves.toBeUndefined();
  });

  it("escapes HTML and defaults subject when header empty", async () => {
    await emailChannel.sendBlock({
      target: "a@b",
      blocks: [
        { type: "header", text: "" },
        { type: "section", text: "<img> & <b>" },
      ],
    });
    const sent = libs.sendEmail.mock.calls[0][0];
    expect(sent.subject).toBe("Cloudless Ads notification");
    // stripMrkdwn removes <...> spans before escapeHtml runs
    expect(sent.html).toContain("img &amp; b");
  });
});

describe("anomaly-log D1 paths", () => {
  const snapshot: AdMetrics = {
    platform: "linkedin",
    campaignId: "c1",
    windowStart: "2026-08-14T10:00:00.000Z",
    windowEnd: "2026-08-14T10:15:00.000Z",
    spendEur: 42.5,
    impressions: 1000,
    clicks: 20,
    conversions: 0,
    cpcEur: 2.1,
    ctr: 0.02,
  };
  const findings = [
    {
      rule: "cpc_spike" as const,
      severity: "warning" as const,
      message: "CPC spiked",
      detail: { metric: "cpc" },
    },
  ];

  const fakeDb = (handlers: {
    run?: () => Promise<unknown>;
    all?: () => Promise<{ results: unknown[] }>;
  }) => ({ prepare: vi.fn(() => ({ bind: () => handlers })) });

  it("inserts rows when D1 bound; skips when budget exhausted; swallows errors", async () => {
    const db = fakeDb({ run: async () => ({ ok: true }) });
    libs.getAuthDbFromEnv.mockReturnValue(db);

    await recordAnomalyEvents({
      campaignSlug: "s",
      platform: "linkedin",
      windowEnd: "2026-08-14T10:15:00.000Z",
      snapshot,
      findings,
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO ad_analytics_anomaly_event")
    );

    libs.allowDiscretionaryD1Write.mockReturnValue(false);
    await recordAnomalyEvents({
      campaignSlug: "s",
      platform: "linkedin",
      windowEnd: "2026-08-14T10:15:00.000Z",
      snapshot,
      findings,
    });
    expect(db.prepare).toHaveBeenCalledTimes(1);

    const badDb = fakeDb({ run: async () => Promise.reject(new Error("d1")) });
    libs.getAuthDbFromEnv.mockReturnValue(badDb);
    await expect(
      recordAnomalyEvents({
        campaignSlug: "s",
        platform: "linkedin",
        windowEnd: "x",
        snapshot,
        findings,
      })
    ).resolves.toBeUndefined();
  });

  it("lists from event log (with detail parse + corrupt json)", async () => {
    const db = fakeDb({
      all: async () => ({
        results: [
          {
            id: "1",
            fired_at: "t1",
            campaign_slug: "s",
            platform: "linkedin",
            rule: "cpc_spike",
            severity: "warning",
            message: "m",
            detail_json: '{"metric":"cpc"}',
          },
          {
            id: "2",
            fired_at: "t2",
            campaign_slug: "s",
            platform: "x",
            rule: "ctr_floor",
            severity: "warning",
            message: "m2",
            detail_json: "{corrupt",
          },
        ],
      }),
    });
    libs.getAuthDbFromEnv.mockReturnValue(db);
    const rows = await listAnomalyHistory(10);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "1", source: "log" });
    expect(rows[0].detail).toEqual({ metric: "cpc" });
    expect(rows[1].detail).toBeNull();
  });

  it("falls back to bookmark rows when log empty", async () => {
    let calls = 0;
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({
          all: async () => {
            calls++;
            if (sql.includes("anomaly_event")) return { results: [] };
            return {
              results: [
                {
                  pk: "ad-analytics:anomaly:slug1:linkedin:ctr_floor:2026-08-14",
                  last_posted_at: "2026-08-14T10:00:00Z",
                  snapshot_json: JSON.stringify(snapshot),
                },
                {
                  pk: "ad-analytics:anomaly:s2:x:bogus_rule:2026-08-15",
                  last_posted_at: null,
                  snapshot_json: "{bad",
                },
                { pk: "ad-analytics:other:x:y:z", last_posted_at: null, snapshot_json: null },
              ],
            };
          },
        }),
      })),
    };
    libs.getAuthDbFromEnv.mockReturnValue(db);
    const rows = await listAnomalyHistory();
    expect(calls).toBe(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      campaignSlug: "slug1",
      rule: "ctr_floor",
      severity: "warning",
      source: "bookmark",
      firedAt: "2026-08-14T10:00:00Z",
    });
    expect(rows[0].message).toContain("€42.50");
    expect(rows[1]).toMatchObject({
      campaignSlug: "s2",
      severity: "warning", // unknown rule → warning default
      firedAt: "2026-08-15T00:00:00.000Z",
    });
    expect(rows[1].message).not.toContain("€");
  });

  it("returns [] when both queries fail; caps limit", async () => {
    const db = fakeDb({ all: async () => Promise.reject(new Error("down")) });
    libs.getAuthDbFromEnv.mockReturnValue(db);
    expect(await listAnomalyHistory()).toEqual([]);

    // memory path: respects the cap
    libs.getAuthDbFromEnv.mockReturnValue(null);
    for (let i = 0; i < 3; i++) {
      await recordAnomalyEvents({
        campaignSlug: `c${i}`,
        platform: "x",
        windowEnd: `w${i}`,
        snapshot,
        findings,
      });
    }
    expect(await listAnomalyHistory(0)).toHaveLength(1);
    expect(await listAnomalyHistory(500)).toHaveLength(3);
  });
});
