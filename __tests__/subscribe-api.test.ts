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

const upsertContactMock = vi.fn();
vi.mock("@/lib/hubspot", () => ({
  upsertContact: upsertContactMock,
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
    upsertContactMock.mockResolvedValue("hs-contact-id-1");
  });

  it("returns 400 for invalid email payload", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "not-an-email" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(notifyTeamMock).not.toHaveBeenCalled();
    expect(upsertContactMock).not.toHaveBeenCalled();
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

  it("upserts the subscriber as a HubSpot contact", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(upsertContactMock).toHaveBeenCalledTimes(1);
    expect(upsertContactMock).toHaveBeenCalledWith({
      email: "hello@cloudless.gr",
      lead_source: "newsletter_signup",
    });
  });

  it("still returns success when the HubSpot upsert fails", async () => {
    upsertContactMock.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(response.status).toBe(200);
    // Team still notified so the subscription isn't silently dropped
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when team notification fails", async () => {
    notifyTeamMock.mockRejectedValueOnce(new Error("ses-down"));
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to subscribe");
  });
});
