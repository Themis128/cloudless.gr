/**
 * Tests for POST /api/slack/inbound-email and
 * GET /api/admin/postiz/analytics/summary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const hoisted = vi.hoisted(() => ({
  rateOk: true,
  slackSecret: "ingest-secret",
  adminSecret: "fallback-secret",
  classify: { cls: "human", channel: "#inbox", score: 1, reasons: ["direct"] },
  slackPosted: true,
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => ({
    SLACK_EMAIL_INGEST_SECRET: hoisted.slackSecret,
    ADMIN_ALERT_SECRET: hoisted.adminSecret,
  })),
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn().mockImplementation(function () {
    return { post: vi.fn(async () => hoisted.slackPosted) };
  }),
}));

vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: vi.fn(() => hoisted.rateOk),
}));

vi.mock("@/lib/mail-to-slack", () => ({
  classifyEmail: vi.fn(() => hoisted.classify),
}));

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const postiz = vi.hoisted(() => ({
  listPostizIntegrations: vi.fn(),
  getIntegrationAnalytics: vi.fn(),
  listPosts: vi.fn(),
  getPostStats: vi.fn(),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return {
    ...actual,
    listPostizIntegrations: postiz.listPostizIntegrations,
    getIntegrationAnalytics: postiz.getIntegrationAnalytics,
    listPosts: postiz.listPosts,
    getPostStats: postiz.getPostStats,
  };
});

import { POST as inboundEmail } from "@/app/api/slack/inbound-email/route";
import { GET as postizSummary } from "@/app/api/admin/postiz/analytics/summary/route";
import { SlackClient } from "@/lib/slack-notify";

const INBOUND = "http://localhost/api/slack/inbound-email";
const SUMMARY = "http://localhost/api/admin/postiz/analytics/summary";

function emailReq(body: unknown, secret = "ingest-secret") {
  return new NextRequest(INBOUND, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mail-to-slack-secret": secret,
      "x-forwarded-for": "1.2.3.4",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/slack/inbound-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.rateOk = true;
    hoisted.slackSecret = "ingest-secret";
    hoisted.adminSecret = "fallback-secret";
    hoisted.classify = { cls: "human", channel: "#inbox", score: 1, reasons: ["direct"] };
    hoisted.slackPosted = true;
  });

  it("429s when rate limited", async () => {
    hoisted.rateOk = false;
    expect((await inboundEmail(emailReq({}))).status).toBe(429);
  });

  it("503s when no ingest secret is configured", async () => {
    hoisted.slackSecret = "";
    hoisted.adminSecret = "";
    const res = await inboundEmail(
      emailReq({}, "")
    );
    expect(res.status).toBe(503);
  });

  it("falls back to ADMIN_ALERT_SECRET", async () => {
    hoisted.slackSecret = "";
    const res = await inboundEmail(emailReq({ from: "a@b" }, "fallback-secret"));
    expect(res.status).toBe(200);
  });

  it("401s on missing/wrong secret (incl. length mismatch)", async () => {
    expect(
      (await inboundEmail(emailReq({}, ""))).status
    ).toBe(401);
    expect(
      (await inboundEmail(emailReq({}, "wrong-length-x"))).status
    ).toBe(401);
    expect(
      (await inboundEmail(emailReq({}, "ingest-secret"))).status
    ).toBe(200);
  });

  it("400s on invalid JSON", async () => {
    const res = await inboundEmail(emailReq("{bad json"));
    expect(res.status).toBe(400);
  });

  it("dedups on message_id", async () => {
    const mid = `mid-${Date.now()}-dedup`;
    const body = { message_id: mid, from: "a@b", subject: "s", text: "t" };
    expect((await inboundEmail(emailReq(body))).status).toBe(200);
    const dup = await (await inboundEmail(emailReq(body))).json();
    expect(dup.duplicate).toBe(true);
  });

  it("evicts expired message_ids from the dedup map on the next insert", async () => {
    const first = { message_id: `mid-${Date.now()}-ttl`, from: "a@b", subject: "s", text: "t" };
    expect((await inboundEmail(emailReq(first))).status).toBe(200);
    // Advance the clock past SEEN_TTL_MS (6h) so the entry expires.
    vi.setSystemTime(Date.now() + 7 * 60 * 60 * 1000);
    try {
      const res = await inboundEmail(
        emailReq({ message_id: `mid-${Date.now()}-new`, from: "c@d", subject: "s", text: "t" })
      );
      expect(res.status).toBe(200);
      // The expired id no longer dedups.
      expect((await inboundEmail(emailReq(first))).status).toBe(200);
      const dup = await (await inboundEmail(emailReq(first))).json();
      expect(dup.duplicate).toBe(true);
    } finally {
      vi.setSystemTime(vi.getRealSystemTime());
    }
  });

  it("suppresses bulk mail without a Slack post", async () => {
    hoisted.classify = { cls: "bulk", channel: "#bulk", score: -1, reasons: [] };
    const j = await (await inboundEmail(emailReq({ from: "n@x" }))).json();
    expect(j.suppressed).toBe(true);
    expect(j.cls).toBe("bulk");
  });

  it("posts human mail and returns its class", async () => {
    const j = await (
      await inboundEmail(
        emailReq({
          from: "a@b",
          to: "slack@cloudless.gr",
          subject: "hi <there> & bye",
          text: "first line\n> quoted reply\n-- \nsig",
          spam_score: 2,
        })
      )
    ).json();
    expect(j.ok).toBe(true);
    expect(j.cls).toBe("human");
    const post = vi.mocked(SlackClient).mock.results[0].value.post;
    const blocks = post.mock.calls[0][0].blocks as Array<Record<string, unknown>>;
    const context = blocks.find((b) => b.type === "context")!;
    const ctxText = (
      context.elements as Array<{ text: string }>
    )[0].text;
    expect(ctxText).toContain("class=human");
    expect(ctxText).toContain("spam 2");
    expect(ctxText).toContain("direct");
  });

  it("omits the excerpt section and context extras when absent", async () => {
    hoisted.classify = { cls: "alert", channel: "#ops", score: 9, reasons: [] };
    const j = await (
      await inboundEmail(emailReq({ from: "mon@x", subject: "cpu" }))
    ).json();
    expect(j.cls).toBe("alert");
    const post = vi.mocked(SlackClient).mock.results[0].value.post;
    const blocks = post.mock.calls[0][0].blocks as Array<Record<string, unknown>>;
    expect(
      blocks.filter((b) => b.type === "section" && !(b as { fields?: unknown }).fields)
    ).toHaveLength(0);
    const header = blocks.find((b) => b.type === "header")!;
    expect(
      (header.text as { text: string }).text
    ).toContain("Mail alert");
    const ctxText = ((
      blocks.find((b) => b.type === "context")!.elements as Array<{
        text: string;
      }>
    )[0].text);
    expect(ctxText).not.toContain("spam");
  });

  it("502s when the Slack post fails", async () => {
    hoisted.slackPosted = false;
    const res = await inboundEmail(emailReq({ from: "a@b" }));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/admin/postiz/analytics/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    postiz.listPostizIntegrations.mockResolvedValue([]);
    postiz.listPosts.mockResolvedValue([]);
    postiz.getIntegrationAnalytics.mockResolvedValue([]);
    postiz.getPostStats.mockResolvedValue([]);
  });

  it("requires admin", async () => {
    apiAuth.ok = false;
    expect((await postizSummary(new NextRequest(SUMMARY))).status).toBe(401);
  });

  it("returns empty when no integrations", async () => {
    const j = await (await postizSummary(new NextRequest(SUMMARY))).json();
    expect(j).toEqual({ channels: [], topPosts: [], totals: {} });
  });

  it("aggregates channel metrics, skipping disabled + failing integrations", async () => {
    postiz.listPostizIntegrations.mockResolvedValue([
      { id: "i1", name: "LI", identifier: "linkedin" },
      { id: "i2", disabled: true },
      { id: "i3", name: "IG", identifier: "instagram" },
    ]);
    postiz.getIntegrationAnalytics.mockImplementation(async (id: string) => {
      if (id === "i3") throw new Error("no analytics");
      return [
        {
          label: "followers",
          percentageChange: 5,
          data: [{ total: 10 }, { total: 20 }],
        },
        { label: "posts", percentageChange: 0, data: [] },
      ];
    });
    const j = await (await postizSummary(new NextRequest(SUMMARY))).json();
    expect(j.channels).toHaveLength(1);
    expect(j.channels[0].metrics).toEqual({ followers: 20, posts: 0 });
    expect(j.totals).toEqual({ followers: 20, posts: 0 });
    expect(j.lookbackDays).toBe(30);
  });

  it("builds topPosts sorted by engagement, honoring caps", async () => {
    postiz.listPostizIntegrations.mockResolvedValue([{ id: "i1" }]);
    postiz.getIntegrationAnalytics.mockResolvedValue([]);
    postiz.listPosts.mockResolvedValue([
      {
        id: "p1",
        state: "PUBLISHED",
        content: "a",
        publishDate: "2026-01-01",
        integration: { providerIdentifier: "linkedin" },
      },
      {
        id: "p2",
        state: "ERROR",
        releaseId: "r",
        content: "b",
        publishDate: "2026-01-02",
        integration: { identifier: "ig" },
      },
      { id: "p3", state: "DRAFT" },
    ]);
    postiz.getPostStats.mockImplementation(async (id: string) =>
      id === "p1"
        ? [
            { label: "likes", data: [{ total: 5 }] },
            { label: "comments", data: [{ total: 1 }] },
            { label: "impressions", data: [{ total: 100 }] },
          ]
        : [
            { label: "likes", data: [{ total: 50 }] },
            { label: "replies", data: [{ total: 0 }] },
            { label: "views", data: [{ total: 200 }] },
          ]
    );
    const j = await (await postizSummary(new NextRequest(SUMMARY))).json();
    expect(j.topPosts).toHaveLength(2);
    expect(j.topPosts[0].id).toBe("p2"); // 50 engagement > 6
    expect(j.topPosts[0].platform).toBe("ig");
    expect(j.topPosts[0].comments).toBe(0); // replies fallback
    expect(j.topPosts[0].impressions).toBe(200); // views fallback
    expect(j.topPosts[1].likes).toBe(5);
  });

  it("clamps the days param at 90 and skips posts whose stats fail", async () => {
    postiz.listPostizIntegrations.mockResolvedValue([{ id: "i1" }]);
    postiz.getIntegrationAnalytics.mockResolvedValue([]);
    postiz.listPosts.mockResolvedValue([
      { id: "p1", state: "PUBLISHED" },
      { id: "p2", state: "PUBLISHED", integration: {} },
    ]);
    postiz.getPostStats.mockImplementation(async (id: string) => {
      if (id === "p1") throw new Error("no stats");
      return [];
    });
    const j = await (
      await postizSummary(new NextRequest(`${SUMMARY}?days=200`))
    ).json();
    expect(j.lookbackDays).toBe(90);
    expect(j.topPosts).toHaveLength(1);
    expect(j.topPosts[0].platform).toBe("");
  });

  it("returns topPosts [] when listPosts itself fails", async () => {
    postiz.listPostizIntegrations.mockResolvedValue([{ id: "i1" }]);
    postiz.getIntegrationAnalytics.mockResolvedValue([]);
    postiz.listPosts.mockRejectedValue(new Error("api down"));
    const j = await (await postizSummary(new NextRequest(SUMMARY))).json();
    expect(j.topPosts).toEqual([]);
  });

  it("503s on PostizNotConfiguredError", async () => {
    const { PostizNotConfiguredError } = await import("@/lib/postiz");
    postiz.listPostizIntegrations.mockRejectedValue(
      new PostizNotConfiguredError("not configured")
    );
    const res = await postizSummary(new NextRequest(SUMMARY));
    expect(res.status).toBe(503);
  });
});
