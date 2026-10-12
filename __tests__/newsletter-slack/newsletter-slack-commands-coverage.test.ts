/**
 * newsletter-slack/commands/route.ts — coverage extension:
 * /newsletter-list, /newsletter-send, /newsletter-unpublish,
 * /newsletter-rerun-draft, /newsletter-stats with real HMAC signing
 * and fakes only at the AppFlowy/EspoCRM/GitHub boundaries.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import { resetNewsletterSlackConfigCache } from "@/lib/newsletter-slack-config";

const mockList = vi.fn();
const mockFind = vi.fn();
const mockSetStatus = vi.fn();
vi.mock("@/lib/appflowy-blog-admin", () => ({
  listEditorialPosts: (...a: unknown[]) => mockList(...a),
  findEditorialPost: (...a: unknown[]) => mockFind(...a),
  setEditorialStatus: (...a: unknown[]) => mockSetStatus(...a),
}));

const mockDispatch = vi.fn();
vi.mock("@/lib/github-dispatch", () => ({
  dispatchWorkflow: (...a: unknown[]) => mockDispatch(...a),
}));

const mockSubs = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  listNewsletterSubscribers: (...a: unknown[]) => mockSubs(...a),
}));

const SECRET = "test-newsletter-signing-secret-32chr";
let POST: (req: Request) => Promise<Response>;

function sign(body: string, ts: number): string {
  return "v0=" + createHmac("sha256", SECRET).update(`v0:${ts}:${body}`, "utf8").digest("hex");
}

let nonce = 0;
function req(command: string, text = "", userId = "U_OPS"): Request {
  const ts = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    command, text, user_id: userId, user_name: "ops",
    channel_id: "C1", response_url: "https://hooks.slack.com/commands/x",
    trigger_id: `t${nonce++}`, team_id: "T1",
  }).toString();
  return new Request("http://localhost/api/newsletter-slack/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(ts),
      "x-slack-signature": sign(body, ts),
    },
    body,
  });
}

const post = { id: "v1", title: "Title T", slug: "slug-1", status: "In Review", category: "c", readTime: "5 min", url: "https://cloudless.gr/en/blog/slug-1", createdAt: "2026-10-09" };

const text = async (res: Response) => JSON.stringify(await res.json());

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  resetNewsletterSlackConfigCache();
  process.env.NEWSLETTER_SLACK_SIGNING_SECRET = SECRET;
  process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-test";
  process.env.SLACK_OPS_USERS = "U_OPS";
  ({ POST } = await import("@/app/api/newsletter-slack/commands/route"));
  mockDispatch.mockResolvedValue({ ok: true });
  mockFind.mockResolvedValue(post);
  mockSetStatus.mockResolvedValue(true);
  mockList.mockResolvedValue([post]);
  mockSubs.mockResolvedValue(["a@x", "b@x", "c@x"]);
});

describe("/newsletter-list", () => {
  it("renders pending drafts with status emoji, dates, slugs, links", async () => {
    const res = await POST(req("/newsletter-list"));
    const body = await text(res);
    expect(body).toContain("Pending Drafts (1)");
    expect(body).toContain(":eyes:");
    expect(body).toContain("Title T");
    expect(body).toContain("slug-1");
    expect(body).toContain("!date^");
  });

  it("empty list → mailbox hint", async () => {
    mockList.mockResolvedValue([]);
    const body = await text(await POST(req("/newsletter-list")));
    expect(body).toContain("No pending drafts");
  });

  it("draft-status post uses :memo: and falls back to id-prefix slug", async () => {
    mockList.mockResolvedValue([{ ...post, status: "Draft", slug: "", url: "", createdAt: "" }]);
    const body = await text(await POST(req("/newsletter-list")));
    expect(body).toContain(":memo:");
    expect(body).toContain("`v1`");
  });
});

describe("/newsletter-send", () => {
  it("flips to In Review, dispatches, returns in_channel card", async () => {
    const res = await POST(req("/newsletter-send", "slug-1"));
    const json = (await res.json()) as { response_type: string };
    expect(json.response_type).toBe("in_channel");
    expect(mockSetStatus).toHaveBeenCalledWith("v1", "In Review");
    expect(mockDispatch).toHaveBeenCalledWith("weekly-newsletter.yml", "main");
    expect(JSON.stringify(json)).toContain("Send Initiated");
  });

  it("denies non-allowlisted user before touching AppFlowy", async () => {
    const body = await text(await POST(req("/newsletter-send", "slug-1", "U_RANDO")));
    expect(body).toContain("not on the ops allowlist");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("guards: unknown slug, already Published, flip failure, dispatch failure", async () => {
    mockFind.mockResolvedValue(null);
    expect(await text(await POST(req("/newsletter-send", "nope")))).toContain("No AppFlowy draft");

    mockFind.mockResolvedValue({ ...post, status: "Published" });
    expect(await text(await POST(req("/newsletter-send", "slug-1")))).toContain("already Published");

    mockFind.mockResolvedValue(post);
    mockSetStatus.mockResolvedValue(false);
    expect(await text(await POST(req("/newsletter-send", "slug-1")))).toContain("Failed to update AppFlowy");

    mockSetStatus.mockResolvedValue(true);
    mockDispatch.mockResolvedValue({ ok: false, status: 422, error: "bad" });
    expect(await text(await POST(req("/newsletter-send", "slug-1")))).toContain("dispatch failed (HTTP 422)");
  });
});

describe("/newsletter-unpublish", () => {
  it("archives and returns in_channel card", async () => {
    const res = await POST(req("/newsletter-unpublish", "slug-1"));
    const json = (await res.json()) as { response_type: string };
    expect(json.response_type).toBe("in_channel");
    expect(mockSetStatus).toHaveBeenCalledWith("v1", "Archived");
    expect(JSON.stringify(json)).toContain("Unpublished");
  });

  it("guards: allowlist, unknown slug, flip failure", async () => {
    expect(await text(await POST(req("/newsletter-unpublish", "s", "U_RANDO")))).toContain("ops allowlist");

    mockFind.mockResolvedValue(null);
    expect(await text(await POST(req("/newsletter-unpublish", "nope")))).toContain("No AppFlowy post");

    mockFind.mockResolvedValue(post);
    mockSetStatus.mockResolvedValue(false);
    expect(await text(await POST(req("/newsletter-unpublish", "s")))).toContain("Failed to update");
  });
});

describe("/newsletter-rerun-draft", () => {
  it("dispatches weekly-article-draft.yml", async () => {
    const body = await text(await POST(req("/newsletter-rerun-draft")));
    expect(mockDispatch).toHaveBeenCalledWith("weekly-article-draft.yml", "main");
    expect(body).toContain("Re-triggered");
  });

  it("guards: allowlist + dispatch failure", async () => {
    expect(await text(await POST(req("/newsletter-rerun-draft", "", "U_RANDO")))).toContain("ops allowlist");
    mockDispatch.mockResolvedValue({ ok: false, status: 403, error: "denied" });
    expect(await text(await POST(req("/newsletter-rerun-draft")))).toContain("Re-run failed (HTTP 403)");
  });
});

describe("/newsletter-stats", () => {
  it("renders subscriber + draft counts", async () => {
    mockList.mockResolvedValue([post, { ...post, id: "v2", status: "Draft" }]);
    const body = await text(await POST(req("/newsletter-stats")));
    expect(body).toContain("*Subscribers*\n3".replace("\n", "\\n"));
    expect(body).toContain("Pending drafts");
  });

  it("subscriber + drafts failures degrade to zeros", async () => {
    mockSubs.mockRejectedValue(new Error("crm down"));
    mockList.mockRejectedValue(new Error("af down"));
    const body = await text(await POST(req("/newsletter-stats")));
    expect(body).toContain("Subscribers");
    expect(body).toContain("\\n0");
  });
});
