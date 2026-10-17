/** api/cron/newsletter-auto — AI/R2/email/Slack boundaries faked. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  cronAuth: vi.fn(),
  aiChat: vi.fn(),
  subscribers: vi.fn(async () => ["a@b.c", "c@d.e"]),
  sendEmail: vi.fn(async () => {}),
  recordNotif: vi.fn(async () => {}),
  getBucket: vi.fn(),
  fetchCover: vi.fn(async () => ({ buffer: new Uint8Array([1, 2]) })),
  slackPost: vi.fn(async () => {}),
}));

vi.mock("@/lib/cron-auth", () => ({ isCronAuthorized: m.cronAuth }));
vi.mock("@/lib/workers-ai-client", () => ({ callWorkersAiChat: m.aiChat }));
vi.mock("@/lib/espocrm", () => ({ listNewsletterSubscribers: m.subscribers }));
vi.mock("@/lib/email", () => ({ sendEmail: m.sendEmail }));
vi.mock("@/lib/admin-notifications", () => ({ recordNotification: m.recordNotif }));
vi.mock("@/lib/r2-client", () => ({ getDataLakeBucketFromEnv: m.getBucket }));
vi.mock("@/lib/newsletter-cover", () => ({ fetchNewsletterCover: m.fetchCover }));
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = m.slackPost;
  },
}));

import { GET } from "@/app/api/cron/newsletter-auto/route";

const req = () => new NextRequest("http://x/api/cron/newsletter-auto");
const ARTICLE = JSON.stringify({
  title: "Cloud Wins",
  excerpt: "An excerpt.",
  category: "Serverless",
  contentHTML: "<p>Body</p>",
});
const bucket = {
  put: vi.fn(async () => {}),
  get: vi.fn(),
  list: vi.fn(async () => ({ objects: [] })),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.cronAuth.mockResolvedValue(true);
  m.aiChat.mockResolvedValue(ARTICLE);
  m.getBucket.mockReturnValue(bucket);
});

describe("GET /api/cron/newsletter-auto", () => {
  it("unauthorized → 401", async () => {
    m.cronAuth.mockResolvedValue(false);
    expect((await GET(req())).status).toBe(401);
  });

  it("AI failure → 502; bad JSON/missing fields → 502", async () => {
    m.aiChat.mockRejectedValueOnce(new Error("ai down"));
    expect((await GET(req())).status).toBe(502);
    m.aiChat.mockResolvedValueOnce("no json here");
    expect((await GET(req())).status).toBe(502);
    m.aiChat.mockResolvedValueOnce(JSON.stringify({ title: "t" })); // missing excerpt+html
    expect((await GET(req())).status).toBe(502);
  });

  it("no R2 bucket → 503 before any AI call; bucket.put throws → 500", async () => {
    m.getBucket.mockReturnValue(null);
    expect((await GET(req())).status).toBe(503);
    expect(m.aiChat).not.toHaveBeenCalled();
    m.getBucket.mockReturnValue(bucket);
    bucket.put.mockRejectedValue(new Error("r2 down"));
    expect((await GET(req())).status).toBe(500);
    bucket.put.mockResolvedValue(undefined);
  });

  it("happy path → article saved, emails sent, slack+notif fired", async () => {
    const r = await GET(req());
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(2);
    expect(body.slug).toMatch(/^\d{4}-\d{2}-\d{2}-cloud-wins$/);
    expect(bucket.put).toHaveBeenCalledWith(
      expect.stringContaining("newsletter/articles/"),
      expect.any(String)
    );
    // cover uploaded too
    expect(bucket.put).toHaveBeenCalledWith(
      expect.stringContaining("newsletter/covers/"),
      expect.any(Uint8Array),
      expect.any(Object)
    );
    expect(m.sendEmail).toHaveBeenCalledTimes(2);
    expect(m.recordNotif).toHaveBeenCalled();
    expect(m.slackPost).toHaveBeenCalled();
  });

  it("email failure counted; invalid category → Cloud; no cover → no cover put", async () => {
    m.sendEmail.mockRejectedValueOnce(new Error("smtp"));
    m.aiChat.mockResolvedValueOnce(
      JSON.stringify({
        title: "T",
        excerpt: "E",
        category: "bogus",
        contentHTML: "<p>x</p>",
      })
    );
    m.fetchCover.mockResolvedValueOnce(null);
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(1);
    const articlePut = bucket.put.mock.calls.find((c) => String(c[0]).includes("articles/"))!;
    expect(JSON.parse(articlePut[1]).category).toBe("Cloud");
    expect(bucket.put.mock.calls.filter((c) => String(c[0]).includes("covers/"))).toHaveLength(0);
  });

  it("duplicate title vs existing articles → retried once, then 409, nothing saved", async () => {
    bucket.list.mockResolvedValue({
      objects: [{ key: "newsletter/articles/2026-10-12-cloud-wins.json" }],
    });
    bucket.get.mockResolvedValue({ text: async () => JSON.stringify({ title: "Cloud Wins" }) });
    // Both attempts return the duplicate title.
    const r = await GET(req());
    expect(r.status).toBe(409);
    expect(m.aiChat).toHaveBeenCalledTimes(2);
    expect(bucket.put.mock.calls.filter((c) => String(c[0]).includes("articles/"))).toHaveLength(0);
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("first attempt duplicate, retry fresh → saves the fresh article", async () => {
    bucket.list.mockResolvedValue({
      objects: [{ key: "newsletter/articles/2026-10-12-cloud-wins.json" }],
    });
    bucket.get.mockResolvedValue({ text: async () => JSON.stringify({ title: "Cloud Wins" }) });
    m.aiChat
      .mockResolvedValueOnce(ARTICLE) // "Cloud Wins" — dup
      .mockResolvedValueOnce(
        JSON.stringify({
          title: "Zero-Trust on a Budget",
          excerpt: "E",
          category: "Cloud",
          contentHTML: "<p>x</p>",
        })
      );
    const body = await (await GET(req())).json();
    expect(body.ok).toBe(true);
    expect(m.aiChat).toHaveBeenCalledTimes(2);
    expect(body.slug).toContain("zero-trust-on-a-budget");
  });

  it("existing-article list fails → 503, fails closed: nothing generated, saved or mailed", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    bucket.list.mockRejectedValueOnce(new Error("r2 list down"));
    const r = await GET(req());
    expect(r.status).toBe(503);
    expect(m.aiChat).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(m.sendEmail).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("unreadable or title-less stored articles still dedupe on the slug stem", async () => {
    bucket.list.mockResolvedValue({
      objects: [
        { key: "newsletter/articles/2026-10-05-cloud-wins.json" },
        { key: "newsletter/articles/2026-10-12-other.json" },
      ],
    });
    bucket.get
      .mockRejectedValueOnce(new Error("get failed")) // cloud-wins: unreadable
      .mockResolvedValueOnce({ text: async () => "{}" }); // other: no title
    const r = await GET(req());
    expect(r.status).toBe(409);
    expect(m.aiChat).toHaveBeenCalledTimes(2);
  });

  it("HTML-escapes the AI title and excerpt in the email (only contentHTML is raw)", async () => {
    m.aiChat.mockResolvedValueOnce(
      JSON.stringify({
        title: 'Cloud <script>alert(1)</script> & "Edge"',
        excerpt: "<img src=x onerror=alert(1)> it's",
        category: "Cloud",
        contentHTML: "<p>Body</p>",
      })
    );
    const body = await (await GET(req())).json();
    expect(body.ok).toBe(true);
    const html = (m.sendEmail.mock.calls[0] as unknown as [{ html: string; text: string }])[0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(
      '<h1 style="color: #00fff5; margin-top: 0;">Cloud &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Edge&quot;</h1>'
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; it&#39;s</p>");
    expect(html).toContain(
      'alt="Cloud &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Edge&quot;"'
    );
    expect(html).toContain("<p>Body</p>");
  });
});
