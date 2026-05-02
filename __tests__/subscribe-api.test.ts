import { beforeEach, describe, expect, it, vi } from "vitest";

// Bypass rate limiting in unit tests — we test the limiter separately
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const notifyTeamMock = vi.fn();
const sendSubscriberWelcomeMock = vi.fn();

vi.mock("@/lib/email", () => ({
  notifyTeam: notifyTeamMock,
  sendSubscriberWelcome: sendSubscriberWelcomeMock,

}));

vi.mock("@/lib/slack-notify", () => ({
  slackSubscriberNotify: vi.fn().mockResolvedValue(undefined),
}));

const CONTENT_TYPE_JSON = "application/json";
const HEADER_CONTENT_TYPE = "Content-Type";
const SUBSCRIBE_URL = "http://localhost:4000/api/subscribe";

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyTeamMock.mockResolvedValue(undefined);
    sendSubscriberWelcomeMock.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid email payload", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request(SUBSCRIBE_URL, {
      method: "POST",
      headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(notifyTeamMock).not.toHaveBeenCalled();
  });

  it("returns success for valid email", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request(SUBSCRIBE_URL, {
      method: "POST",
      headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
      body: JSON.stringify({ email: "hello@cloudless.gr" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
    expect(notifyTeamMock.mock.calls[0][0]).toContain("New subscriber");
  });

  it("returns 500 when team notification fails", async () => {
    notifyTeamMock.mockRejectedValueOnce(new Error("ses-down"));
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request(SUBSCRIBE_URL, {
      method: "POST",
      headers: { HEADER_CONTENT_TYPE: CONTENT_TYPE_JSON },
      body: JSON.stringify({ email: "hello@cloudless.gr" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to subscribe");
  });
});
