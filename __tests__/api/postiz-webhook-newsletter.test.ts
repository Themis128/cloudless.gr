/**
 * Tests for POST /api/webhooks/postiz and GET /api/cron/newsletter-auto.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  sigOk: true,
  cronOk: true,
}));

vi.mock("@/lib/postiz-webhook", () => ({
  verifyPostizWebhookSignature: vi.fn(async () => hoisted.sigOk),
}));

const calendar = vi.hoisted(() => ({
  getCalendarItems: vi.fn(),
  updateCalendarItem: vi.fn(),
}));
vi.mock("@/lib/content-calendar", () => calendar);

const slack = vi.hoisted(() => ({
  notifyPostErrored: vi.fn(),
  notifyPostPublished: vi.fn(),
}));
vi.mock("@/lib/postiz-slack", () => slack);

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: vi.fn(async () => hoisted.cronOk),
}));

const ai = vi.hoisted(() => ({ callWorkersAiChat: vi.fn() }));
vi.mock("@/lib/workers-ai-client", () => ai);

const espocrm = vi.hoisted(() => ({ listNewsletterSubscribers: vi.fn() }));
vi.mock("@/lib/espocrm", () => espocrm);

const emailLib = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email", () => emailLib);

const notifs = vi.hoisted(() => ({ recordNotification: vi.fn() }));
vi.mock("@/lib/admin-notifications", () => notifs);

const slackPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn().mockImplementation(function () {
    return { post: slackPost };
  }),
}));

const r2 = vi.hoisted(() => ({ bucket: null as { put: ReturnType<typeof vi.fn> } | null }));
vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn(() => r2.bucket),
}));

const cover = vi.hoisted(() => ({ fetchNewsletterCover: vi.fn() }));
vi.mock("@/lib/newsletter-cover", () => cover);

import { POST as postizWebhook } from "@/app/api/webhooks/postiz/route";
import { GET as newsletterAuto } from "@/app/api/cron/newsletter-auto/route";

const WEBHOOK = "http://localhost/api/webhooks/postiz";
const NEWS = "http://localhost/api/cron/newsletter-auto";

function hook(body: unknown): NextRequest {
  return new NextRequest(WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const postFields = { id: "pz1", integration: { providerIdentifier: "linkedin" } };

describe("POST /api/webhooks/postiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.sigOk = true;
    calendar.getCalendarItems.mockResolvedValue([]);
    calendar.updateCalendarItem.mockResolvedValue(undefined);
    slack.notifyPostErrored.mockResolvedValue(undefined);
    slack.notifyPostPublished.mockResolvedValue(undefined);
  });

  it("401s on bad signature", async () => {
    hoisted.sigOk = false;
    expect((await postizWebhook(hook({}))).status).toBe(401);
  });

  it("400s on invalid JSON", async () => {
    expect((await postizWebhook(hook("{nope"))).status).toBe(400);
  });

  it("202s when post fields are missing", async () => {
    const res = await postizWebhook(hook({ event: "post.published", post: {} }));
    expect(res.status).toBe(202);
    expect((await res.json()).reason).toBe("missing_post_fields");
  });

  it("202s on unhandled events", async () => {
    const res = await postizWebhook(
      hook({ event: "post.draft", post: postFields })
    );
    expect(res.status).toBe(202);
    expect((await res.json()).reason).toBe("unhandled_event");
  });

  it("verification probes skip all side effects (any level)", async () => {
    for (const body of [
      { event: "post.published", post: postFields, verification: true },
      { event: "post.published", post: { ...postFields, verification: true } },
      {
        event: "post.errored",
        data: { ...postFields, verification: true },
      },
    ]) {
      const j = await (await postizWebhook(hook(body))).json();
      expect(j.verification).toBe(true);
    }
    expect(calendar.updateCalendarItem).not.toHaveBeenCalled();
    expect(slack.notifyPostPublished).not.toHaveBeenCalled();
  });

  it("post.published marks the calendar item + notifies slack", async () => {
    calendar.getCalendarItems.mockResolvedValue([
      { id: "cal-1", postizPostIds: ["other"] },
      { id: "cal-2", postizPostIds: ["pz1", "pz2"] },
    ]);
    const j = await (
      await postizWebhook(
        hook({ event: "post.published", post: { ...postFields, content: "c" } })
      )
    ).json();
    expect(j.accepted).toBe(true);
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("cal-2", {
      status: "published",
    });
    expect(slack.notifyPostPublished).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pz1", state: "PUBLISHED" })
    );
  });

  it("post.publish synonym works; unmatched item still notifies", async () => {
    calendar.getCalendarItems.mockResolvedValue([
      { id: "cal-1", postizPostIds: ["other"] },
    ]);
    const j = await (
      await postizWebhook(hook({ event: "post.publish", post: postFields }))
    ).json();
    expect(j.accepted).toBe(true);
    expect(calendar.updateCalendarItem).not.toHaveBeenCalled();
    expect(slack.notifyPostPublished).toHaveBeenCalled();
  });

  it("post.errored → draft + reason from payload.error or data.error", async () => {
    calendar.getCalendarItems.mockResolvedValue([
      { id: "cal-9", postizPostIds: ["pz1"] },
    ]);
    await postizWebhook(
      hook({
        event: "post.errored",
        post: { ...postFields, state: "ERROR" },
        error: "upstream 500",
      })
    );
    expect(calendar.updateCalendarItem).toHaveBeenCalledWith("cal-9", {
      status: "draft",
    });
    expect(slack.notifyPostErrored).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pz1" }),
      "upstream 500"
    );

    slack.notifyPostErrored.mockClear();
    await postizWebhook(
      hook({
        event: "post.failed",
        data: { ...postFields, error: "nested err" },
      })
    );
    expect(slack.notifyPostErrored).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pz1" }),
      "nested err"
    );
  });

  it("swallows Slack failures", async () => {
    slack.notifyPostPublished.mockRejectedValue(new Error("slack down"));
    const res = await postizWebhook(
      hook({ event: "post.published", post: postFields })
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/cron/newsletter-auto", () => {
  const article = {
    title: "Weekly News",
    excerpt: "ex",
    category: "Analytics",
    readTime: "3 min",
    contentHTML: "<p>hi</p><h2>sub</h2>",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.cronOk = true;
    ai.callWorkersAiChat.mockResolvedValue(JSON.stringify(article));
    espocrm.listNewsletterSubscribers.mockResolvedValue(["a@b", "c@d"]);
    emailLib.sendEmail.mockResolvedValue(undefined);
    notifs.recordNotification.mockResolvedValue(undefined);
    slackPost.mockResolvedValue(true);
    cover.fetchNewsletterCover.mockResolvedValue({ buffer: new Uint8Array([1]) });
    r2.bucket = { put: vi.fn(async () => undefined) };
  });

  it("401s when unauthorized", async () => {
    hoisted.cronOk = false;
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(401);
  });

  it("502s when AI generation throws or returns unusable content", async () => {
    ai.callWorkersAiChat.mockRejectedValue(new Error("cf down"));
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(502);

    ai.callWorkersAiChat.mockResolvedValue("no json here");
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(502);

    ai.callWorkersAiChat.mockResolvedValue('{"title":"t"}');
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(502);
  });

  it("503s when R2 is not configured", async () => {
    r2.bucket = null;
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(503);
  });

  it("500s when the article put fails", async () => {
    r2.bucket!.put.mockRejectedValue(new Error("r2 down"));
    expect((await newsletterAuto(new NextRequest(NEWS))).status).toBe(500);
  });

  it("generates, stores, emails all subscribers and reports", async () => {
    const res = await newsletterAuto(new NextRequest(NEWS));
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.sent).toBe(2);
    expect(j.total).toBe(2);
    expect(j.slug).toContain("weekly-news");

    // cover uploaded then article stored
    const keys = r2.bucket!.put.mock.calls.map((c) => c[0]);
    expect(keys[0]).toMatch(/^newsletter\/covers\/.*\.png$/);
    expect(keys[1]).toMatch(/^newsletter\/articles\/.*\.json$/);
    const stored = JSON.parse(r2.bucket!.put.mock.calls[1][1]);
    expect(stored.category).toBe("Analytics");
    expect(stored.cover).toContain("/api/newsletter/covers/");
    expect(stored.content).not.toContain("<p>");

    // unsubscribe link substituted per-recipient
    const html = vi.mocked(emailLib.sendEmail).mock.calls[0][0] as {
      html: string;
      listUnsubscribeUrl: string;
    };
    expect(html.html).toContain("unsubscribe?email=a%40b");
    expect(html.html).not.toContain("%UNSUBSCRIBELINK%");
    expect(html.listUnsubscribeUrl).toContain("a%40b");

    expect(notifs.recordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ category: "subscribe" })
    );
    expect(slackPost).toHaveBeenCalled();
  });

  it("falls back to Cloud category + survives cover/email failures", async () => {
    ai.callWorkersAiChat.mockResolvedValue(
      JSON.stringify({ ...article, category: "Bogus", readTime: undefined })
    );
    cover.fetchNewsletterCover.mockResolvedValue(null);
    emailLib.sendEmail
      .mockRejectedValueOnce(new Error("smtp 1"))
      .mockResolvedValueOnce(undefined);
    const j = await (await newsletterAuto(new NextRequest(NEWS))).json();
    expect(j.sent).toBe(1);
    expect(j.failed).toBe(1);
    const stored = JSON.parse(r2.bucket!.put.mock.calls[0][1]);
    expect(stored.category).toBe("Cloud");
    expect(stored.readTime).toBe("5 min read");
    expect(stored.cover).toBeNull();
  });
});
