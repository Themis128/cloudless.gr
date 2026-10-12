/**
 * newsletter-slack/route.ts — public signup → Slack relay:
 * email validation, webhook-secret gate (timing-safe, prod-only),
 * webhook-URL path, SlackClient bot fallback, both-fail tolerance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: (...a: unknown[]) => mockGetConfig(...a) }));

const mockPost = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockPost;
  },
}));

const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/newsletter-slack/route";
import { NextRequest } from "next/server";

const env = { SLACK_WEBHOOK_URL: "", SLACK_BOT_TOKEN: "", APPFLOWY_WEBHOOK_SECRET: "", CONTENT_WEBHOOK_SECRET: "", NEWSLETTER_SLACK_CHANNEL_ID: "" };

function req(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== undefined) headers["x-content-webhook-secret"] = secret;
  return new NextRequest("http://localhost/api/newsletter-slack", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  mockGetConfig.mockResolvedValue({});
  mockFetch.mockResolvedValue(new Response("ok"));
});

describe("POST /api/newsletter-slack (signup relay)", () => {
  it("400 without email", async () => {
    const res = await POST(req({ source: "x" }));
    expect(res.status).toBe(400);
  });

  it("posts signup text to the webhook URL", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/x");
    const res = await POST(req({ email: "a@b.c", source: "links", name: "Ana" }));
    expect(res.status).toBe(200);
    const text = JSON.parse(mockFetch.mock.calls[0][1].body as string).text;
    expect(text).toContain("a@b.c");
    expect(text).toContain("source: links");
    expect(text).toContain("Ana");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("bot-token path used only when no webhook URL", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-x");
    const res = await POST(req({ email: "a@b.c" }));
    expect(res.status).toBe(200);
    expect(mockPost).toHaveBeenCalledWith({ text: expect.stringContaining("a@b.c") });
  });

  it("secret mismatch → 401 in production, allowed in dev", async () => {
    vi.stubEnv("APPFLOWY_WEBHOOK_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(req({ email: "a@b.c" }, "wrong"))).status).toBe(401);
    // correct secret passes
    expect((await POST(req({ email: "a@b.c" }, "s3cret"))).status).toBe(200);

    vi.stubEnv("NODE_ENV", "development");
    expect((await POST(req({ email: "a@b.c" }, "wrong"))).status).toBe(200);
  });

  it("different-length secret → 401 without timingSafeEqual throw", async () => {
    vi.stubEnv("APPFLOWY_WEBHOOK_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(req({ email: "a@b.c" }, "short"))).status).toBe(401);
  });

  it("falls back to CONTENT_WEBHOOK_SECRET then config.APPFLOWY_JWT_SECRET", async () => {
    vi.stubEnv("CONTENT_WEBHOOK_SECRET", "cw-secret");
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(req({ email: "a@b.c" }, "cw-secret"))).status).toBe(200);

    vi.stubEnv("CONTENT_WEBHOOK_SECRET", "");
    mockGetConfig.mockResolvedValue({ APPFLOWY_JWT_SECRET: "jwt-s" });
    expect((await POST(req({ email: "a@b.c" }, "jwt-s"))).status).toBe(200);
    expect((await POST(req({ email: "a@b.c" }, "other"))).status).toBe(401);
  });

  it("webhook fetch failure swallowed → still 200", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/x");
    mockFetch.mockRejectedValue(new Error("slack down"));
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(200);
  });

  it("bot post failure swallowed → still 200", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-x");
    mockPost.mockRejectedValue(new Error("bot down"));
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(200);
  });

  it("no Slack config at all → still 200", async () => {
    expect((await POST(req({ email: "a@b.c" }))).status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
