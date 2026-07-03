/**
 * Tests for /api/newsletter-slack/commands - Slack slash commands
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock Slack verification and newsletter generation
vi.mock("@/lib/newsletter-slack-verify", () => ({
  verifyNewsletterSlackRequest: vi.fn(),
  unauthorizedNewsletterSlack: vi.fn((reason: string) => 
    new Response(JSON.stringify({ error: reason }), { status: 401 })
  ),
}));

vi.mock("@/lib/slack-rate-limit", () => ({
  checkSlackRateLimit: vi.fn(() => true),
}));

vi.mock("@/lib/notion-blog-admin", () => ({
  listEditorialPosts: vi.fn(),
  findEditorialPost: vi.fn(),
  setEditorialStatus: vi.fn(),
}));

vi.mock("@/lib/github-dispatch", () => ({
  dispatchWorkflow: vi.fn(),
}));

vi.mock("@/lib/espocrm", () => ({
  listNewsletterSubscribers: vi.fn(),
}));

vi.mock("@/lib/newsletter-slack-config", () => ({
  getNewsletterSlackConfigAsync: vi.fn().mockResolvedValue({
    botToken: "test-token",
    channelId: "test-channel",
  }),
}));

const COMMANDS_URL = "http://localhost/api/newsletter-slack/commands";

function createSlackRequest(command: string, text: string = ""): NextRequest {
  const body = new URLSearchParams({
    command,
    text,
    user_id: "U123456",
    user_name: "testuser",
    channel_id: "C123456",
    response_url: "https://hooks.slack.com/commands/test",
    trigger_id: "trigger123",
  });
  
  return new NextRequest(COMMANDS_URL, {
    method: "POST",
    headers: { 
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "127.0.0.1",
    },
    body,
  });
}

describe("POST /api/newsletter-slack/commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if signature verification fails", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: false, 
      reason: "Invalid signature" 
    });

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-help"));

    expect(res.status).toBe(401);
  });

  it("returns 200 for /newsletter-help command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-help&text=&user_id=U123456" 
    });

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-help"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response_type).toBe("ephemeral");
  });

  it("returns 200 for /newsletter-list command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-list&text=&user_id=U123456" 
    });

    const { listEditorialPosts } = await import("@/lib/notion-blog-admin");
    (listEditorialPosts as vi.Mock).mockResolvedValue([]);

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-list"));

    expect(res.status).toBe(200);
    expect(listEditorialPosts).toHaveBeenCalled();
  });

  it("returns 200 for /newsletter-stats command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-stats&text=&user_id=U123456" 
    });

    const { listNewsletterSubscribers } = await import("@/lib/espocrm");
    (listNewsletterSubscribers as vi.Mock).mockResolvedValue([]);

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-stats"));

    expect(res.status).toBe(200);
  });

  it("returns 200 for /newsletter-gates command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-gates&text=&user_id=U123456" 
    });

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-gates"));

    expect(res.status).toBe(200);
  });

  it("handles unknown command gracefully", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-unknown&text=&user_id=U123456" 
    });

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-unknown"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("Unknown command");
  });

  it("rate limits excessive requests", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-help&text=&user_id=U123456" 
    });

    const { checkSlackRateLimit } = await import("@/lib/slack-rate-limit");
    (checkSlackRateLimit as vi.Mock).mockReturnValue(false);

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-help"));

    expect(res.status).toBe(429);
  });

  it("handles /newsletter-send command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-send&text=test-slug&user_id=U123456" 
    });

    const { checkSlackRateLimit } = await import("@/lib/slack-rate-limit");
    (checkSlackRateLimit as vi.Mock).mockReturnValue(true);

    const { findEditorialPost, setEditorialStatus } = await import("@/lib/notion-blog-admin");
    (findEditorialPost as vi.Mock).mockResolvedValue({
      id: "test-id",
      title: "Test Post",
      slug: "test-slug",
      status: "In Review",
      url: "https://notion.so/test",
      category: "Tech",
      readTime: "5 min",
      createdAt: "2026-07-03T00:00:00.000Z",
    });
    (setEditorialStatus as vi.Mock).mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-send", "test-slug"));

    expect(res.status).toBe(200);
  });

  it("handles /newsletter-rerun-draft command", async () => {
    const { verifyNewsletterSlackRequest } = await import("@/lib/newsletter-slack-verify");
    (verifyNewsletterSlackRequest as vi.Mock).mockResolvedValue({ 
      ok: true, 
      body: "command=/newsletter-rerun-draft&text=&user_id=U123456" 
    });

    const { checkSlackRateLimit } = await import("@/lib/slack-rate-limit");
    (checkSlackRateLimit as vi.Mock).mockReturnValue(true);

    const { dispatchWorkflow } = await import("@/lib/github-dispatch");
    (dispatchWorkflow as vi.Mock).mockResolvedValue({ ok: true });

    const { POST } = await import("@/app/api/newsletter-slack/commands/route");
    const res = await POST(createSlackRequest("/newsletter-rerun-draft"));

    expect(res.status).toBe(200);
  });
});