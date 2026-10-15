/**
 * newsletter-slack/interactions/route.ts — Block Kit button payloads:
 * home_open_* no-ops, home_send / home_unpublish / home_rerun_draft
 * deferred handlers replying via response_url, ops-allowlist gating.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/newsletter-slack-verify", () => ({
  verifyNewsletterSlackRequest: (...a: unknown[]) => mockVerify(...a),
  unauthorizedNewsletterSlack: vi.fn((_r: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));
vi.mock("@/lib/slack-rate-limit", () => ({ checkSlackRateLimit: vi.fn().mockReturnValue(true) }));

const mockDispatch = vi.fn();
vi.mock("@/lib/github-dispatch", () => ({
  dispatchWorkflow: (...a: unknown[]) => mockDispatch(...a),
}));

const mockFind = vi.fn();
const mockSetStatus = vi.fn();
vi.mock("@/lib/appflowy-blog-admin", () => ({
  findEditorialPost: (...a: unknown[]) => mockFind(...a),
  setEditorialStatus: (...a: unknown[]) => mockSetStatus(...a),
}));

const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
vi.stubGlobal("fetch", mockFetch);

let POST: (req: Request) => Promise<Response>;

function req(payload: Record<string, unknown>): Request {
  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  mockVerify.mockResolvedValue({ ok: true, body });
  return new Request("http://localhost/api/newsletter-slack/interactions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

const act = (action_id: string, value = "slug-1", user = "U_OPS") => ({
  type: "block_actions",
  user: { id: user },
  response_url: "https://hooks.slack.com/actions/T/A/x",
  actions: [{ action_id, value }],
});

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

const replyTexts = () =>
  mockFetch.mock.calls.map((c) => JSON.parse(c[1].body as string).text as string);

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SLACK_OPS_USERS = "U_OPS";
  ({ POST } = await import("@/app/api/newsletter-slack/interactions/route"));
  mockDispatch.mockResolvedValue({ ok: true });
  mockFind.mockResolvedValue({ id: "v1", title: "Post T", slug: "slug-1", status: "In Review" });
  mockSetStatus.mockResolvedValue(true);
});

describe("request envelope", () => {
  it("401 unsigned, 429 rate-limited, 400 missing/invalid payload", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: "bad" });
    expect((await POST(new Request("http://x/", { method: "POST" }))).status).toBe(401);

    const { checkSlackRateLimit } = await import("@/lib/slack-rate-limit");
    (checkSlackRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    mockVerify.mockResolvedValue({ ok: true, body: "payload={}" });
    expect((await POST(req({}))).status).toBe(429);

    const raw = () => new Request("http://x/", { method: "POST" });
    mockVerify.mockResolvedValue({ ok: true, body: "nopayload=1" });
    expect((await POST(raw())).status).toBe(400);

    mockVerify.mockResolvedValue({ ok: true, body: "payload=not-json" });
    expect((await POST(raw())).status).toBe(400);
  });

  it("200 ok for non-block_actions, missing actions, link-only and unknown ids", async () => {
    for (const p of [
      { type: "view_submission" },
      { type: "block_actions", user: { id: "U_OPS" }, actions: [] },
      act("home_open_blog_index"),
      act("mystery_button"),
    ]) {
      const res = await POST(req(p));
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    }
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("home_send", () => {
  it("flips to In Review and dispatches weekly-newsletter.yml", async () => {
    await POST(req(act("home_send")));
    await flush();
    expect(mockFind).toHaveBeenCalledWith("slug-1");
    expect(mockSetStatus).toHaveBeenCalledWith("v1", "In Review");
    expect(mockDispatch).toHaveBeenCalledWith("weekly-newsletter.yml", "main");
    expect(replyTexts()[0]).toContain("queued *Post T* for send");
  });

  it("rejects non-allowlisted user", async () => {
    await POST(req(act("home_send", "slug-1", "U_RANDO")));
    await flush();
    expect(replyTexts()[0]).toContain("not on the ops allowlist");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("empty allowlist → everyone allowed", async () => {
    process.env.SLACK_OPS_USERS = "";
    vi.resetModules();
    ({ POST } = await import("@/app/api/newsletter-slack/interactions/route"));
    await POST(req(act("home_send", "slug-1", "U_ANYONE")));
    await flush();
    expect(mockDispatch).toHaveBeenCalled();
  });

  it("guards: no target, no post, already-Published, flip failure, dispatch failure", async () => {
    await POST(req(act("home_send", "")));
    await flush();
    expect(replyTexts()[0]).toContain("No target slug");

    mockFetch.mockClear();
    mockFind.mockResolvedValue(null);
    await POST(req(act("home_send")));
    await flush();
    expect(replyTexts()[0]).toContain("No AppFlowy draft matching");

    mockFetch.mockClear();
    mockFind.mockResolvedValue({ id: "v1", title: "T", slug: "s", status: "Published" });
    await POST(req(act("home_send")));
    await flush();
    expect(replyTexts()[0]).toContain("already Published");

    mockFetch.mockClear();
    mockFind.mockResolvedValue({ id: "v1", title: "T", slug: "s", status: "Draft" });
    mockSetStatus.mockResolvedValue(false);
    await POST(req(act("home_send")));
    await flush();
    expect(replyTexts()[0]).toContain("Failed to update AppFlowy status");

    mockFetch.mockClear();
    mockSetStatus.mockResolvedValue(true);
    mockDispatch.mockResolvedValue({ ok: false, status: 422, error: "bad inputs" });
    await POST(req(act("home_send")));
    await flush();
    expect(replyTexts()[0]).toContain("dispatch failed (HTTP 422)");
  });
});

describe("home_unpublish", () => {
  it("archives the post and confirms via response_url", async () => {
    await POST(req(act("home_unpublish")));
    await flush();
    expect(mockSetStatus).toHaveBeenCalledWith("v1", "Archived");
    expect(replyTexts()[0]).toContain("archived *Post T*");
  });

  it("guards: allowlist, no target, no post, flip failure", async () => {
    await POST(req(act("home_unpublish", "s", "U_RANDO")));
    await flush();
    expect(replyTexts()[0]).toContain("not on the ops allowlist");

    mockFetch.mockClear();
    await POST(req(act("home_unpublish", "")));
    await flush();
    expect(replyTexts()[0]).toContain("No target slug");

    mockFetch.mockClear();
    mockFind.mockResolvedValue(null);
    await POST(req(act("home_unpublish")));
    await flush();
    expect(replyTexts()[0]).toContain("No AppFlowy post matching");

    mockFetch.mockClear();
    mockFind.mockResolvedValue({ id: "v1", title: "T", slug: "s" });
    mockSetStatus.mockResolvedValue(false);
    await POST(req(act("home_unpublish")));
    await flush();
    expect(replyTexts()[0]).toContain("Failed to update AppFlowy status");
  });
});

describe("home_rerun_draft", () => {
  it("dispatches weekly-article-draft.yml and confirms", async () => {
    await POST(req(act("home_rerun_draft")));
    await flush();
    expect(mockDispatch).toHaveBeenCalledWith("weekly-article-draft.yml", "main");
    expect(replyTexts()[0]).toContain("Re-triggered `weekly-article-draft.yml`");
  });

  it("guards: allowlist + dispatch failure", async () => {
    await POST(req(act("home_rerun_draft", "", "U_RANDO")));
    await flush();
    expect(replyTexts()[0]).toContain("not on the ops allowlist");

    mockFetch.mockClear();
    mockDispatch.mockResolvedValue({ ok: false, status: 403, error: "forbidden" });
    await POST(req(act("home_rerun_draft")));
    await flush();
    expect(replyTexts()[0]).toContain("Re-run failed (HTTP 403)");
  });
});

describe("replyEphemeral edges", () => {
  it("empty response_url → no fetch; fetch throw swallowed", async () => {
    const p = act("home_send");
    delete (p as Record<string, unknown>).response_url;
    await POST(req(p));
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockRejectedValueOnce(new Error("net down"));
    await POST(req(act("home_send")));
    await flush(); // no throw
  });
});

describe("deferred handler error callbacks", () => {
  it("logs home_send handler rejections", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFind.mockRejectedValue(new Error("appflowy down"));
    await POST(req(act("home_send")));
    await flush();
    expect(errSpy).toHaveBeenCalledWith(
      "[NewsletterSlack interactions] home_send error:",
      expect.any(Error)
    );
    errSpy.mockRestore();
  });

  it("logs home_unpublish handler rejections", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFind.mockRejectedValue(new Error("appflowy down"));
    await POST(req(act("home_unpublish")));
    await flush();
    expect(errSpy).toHaveBeenCalledWith(
      "[NewsletterSlack interactions] home_unpublish error:",
      expect.any(Error)
    );
    errSpy.mockRestore();
  });

  it("logs home_rerun_draft handler rejections", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDispatch.mockRejectedValue(new Error("github down"));
    await POST(req(act("home_rerun_draft")));
    await flush();
    expect(errSpy).toHaveBeenCalledWith(
      "[NewsletterSlack interactions] home_rerun_draft error:",
      expect.any(Error)
    );
    errSpy.mockRestore();
  });
});
