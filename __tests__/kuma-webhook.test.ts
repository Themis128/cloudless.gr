import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetConfig = vi.fn();
const mockPost = vi.fn();

vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = (...a: unknown[]) => mockPost(...a);
  },
}));

describe("POST /api/webhooks/kuma", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockGetConfig.mockResolvedValue({
      ADMIN_ALERT_SECRET: "test-secret",
      NOTION_WEBHOOK_SECRET: "",
    });
    mockPost.mockResolvedValue(true);
    const mod = await import("@/app/api/webhooks/kuma/route");
    mod.__resetKumaDnsCoalescerForTests();
  });

  it("returns 401 without token", async () => {
    const { POST } = await import("@/app/api/webhooks/kuma/route");
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/kuma", {
        method: "POST",
        body: JSON.stringify({ msg: "down" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("posts to Slack on valid Bearer token", async () => {
    const { POST } = await import("@/app/api/webhooks/kuma/route");
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/kuma", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
        body: JSON.stringify({
          msg: "[cloudless.gr] [DOWN] timeout",
          monitor: { name: "cloudless.gr /api/health", url: "https://cloudless.gr/api/health" },
          heartbeat: { status: 0 },
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(mockPost).toHaveBeenCalled();
    const payload = mockPost.mock.calls[0][0];
    expect(payload.text).toContain("DOWN");
  });

  it("buffers DNS EAI_AGAIN downs instead of posting per monitor", async () => {
    vi.useFakeTimers();
    const { POST } = await import("@/app/api/webhooks/kuma/route");

    const mk = (name: string, host: string) =>
      POST(
        new NextRequest("http://localhost/api/webhooks/kuma", {
          method: "POST",
          headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
          body: JSON.stringify({
            msg: `getaddrinfo EAI_AGAIN ${host}`,
            monitor: { name, url: `https://${host}/` },
            heartbeat: { status: 0 },
          }),
        })
      );

    const a = await mk("EspoCRM", "espocrm.cloudless.gr");
    const b = await mk("AppFlowy", "appflowy.cloudless.gr");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(mockPost).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(90_000);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0].text).toContain("DNS flap");
    vi.useRealTimers();
  });
});
