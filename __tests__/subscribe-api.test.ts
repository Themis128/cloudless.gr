import { beforeEach, describe, expect, it, vi } from "vitest";

// Bypass rate limiting in unit tests — we test the limiter separately
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const notifyTeamMock = vi.fn();
vi.mock("@/lib/email", () => ({
  notifyTeam: notifyTeamMock,
}));

const slackSubscriberNotifyMock = vi.fn();
vi.mock("@/lib/slack-notify", () => ({
  slackSubscriberNotify: slackSubscriberNotifyMock,
}));

const addContactToListMock = vi.fn();
vi.mock("@/lib/activecampaign", () => ({
  addContactToList: addContactToListMock,
}));

const getConfigMock = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: getConfigMock,
  resetSsmCache: vi.fn(),
}));

const TEST_LIST_ID = "42";

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
    slackSubscriberNotifyMock.mockResolvedValue(undefined);
    addContactToListMock.mockResolvedValue("ac-contact-id-1");
    getConfigMock.mockResolvedValue({
      ACTIVECAMPAIGN_NEWSLETTER_LIST_ID: TEST_LIST_ID,
    });
  });

  it("returns 400 for invalid email payload", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "not-an-email" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(notifyTeamMock).not.toHaveBeenCalled();
    expect(addContactToListMock).not.toHaveBeenCalled();
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

  it("adds subscriber to the configured ActiveCampaign list", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(addContactToListMock).toHaveBeenCalledTimes(1);
    expect(addContactToListMock).toHaveBeenCalledWith(
      "hello@cloudless.gr",
      TEST_LIST_ID,
    );
  });

  it("skips ActiveCampaign call when newsletter list id is unconfigured", async () => {
    getConfigMock.mockResolvedValueOnce({
      ACTIVECAMPAIGN_NEWSLETTER_LIST_ID: "",
    });
    const { POST } = await import("@/app/api/subscribe/route");
    const response = await POST(makeRequest({ email: "hello@cloudless.gr" }));

    expect(response.status).toBe(200);
    expect(addContactToListMock).not.toHaveBeenCalled();
    // Team still notified so the subscription isn't silently dropped on misconfig
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
