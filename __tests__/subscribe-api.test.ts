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

const slackSubscriberNotifyMock = vi.fn();
vi.mock("@/lib/slack-notify", () => ({
  slackSubscriberNotify: slackSubscriberNotifyMock,
}));

const setNewsletterStatusMock = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  setNewsletterStatus: setNewsletterStatusMock,
}));

const removeFromSuppressionListMock = vi.fn();
vi.mock("@/lib/ses-suppression", () => ({
  removeFromSuppressionList: removeFromSuppressionListMock,
}));

function makeRequest(body: unknown): Request {
  return new globalThis.Request("http://localhost:4000/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyTeamMock.mockResolvedValue(undefined);
    sendSubscriberWelcomeMock.mockResolvedValue(undefined);
    slackSubscriberNotifyMock.mockResolvedValue(undefined);
    setNewsletterStatusMock.mockResolvedValue(true);
    removeFromSuppressionListMock.mockResolvedValue(true);
  });

  it("returns 400 for invalid email payload", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "not-an-email" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(notifyTeamMock).not.toHaveBeenCalled();
    expect(setNewsletterStatusMock).not.toHaveBeenCalled();
  });

  it("returns success for valid email", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
    expect(notifyTeamMock.mock.calls[0][0]).toContain("New subscriber");
  });

  it("marks the subscriber as a newsletter signup in EspoCRM", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(setNewsletterStatusMock).toHaveBeenCalledTimes(1);
    expect(setNewsletterStatusMock).toHaveBeenCalledWith("hello@cloudless.gr", "newsletter_signup");
  });

  it("clears SES suppression so a re-subscriber can receive email", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(removeFromSuppressionListMock).toHaveBeenCalledWith("hello@cloudless.gr");
  });

  it("still returns success when the EspoCRM update fails", async () => {
    setNewsletterStatusMock.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(response.status).toBe(200);
    // Team still notified so the subscription isn't silently dropped
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when team notification fails (fire-and-forget)", async () => {
    notifyTeamMock.mockRejectedValueOnce(new Error("ses-down"));
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(response.status).toBe(200);
  });
});
