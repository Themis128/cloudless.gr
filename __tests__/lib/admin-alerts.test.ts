/**
 * Tests for src/lib/admin-alerts.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPost, mockGetSlackOpsUsers, mockPublishNtfy, mockGetConfig, mockNotifyTeam } =
  vi.hoisted(() => ({
    mockPost: vi.fn(),
    mockGetSlackOpsUsers: vi.fn(),
    mockPublishNtfy: vi.fn(),
    mockGetConfig: vi.fn(),
    mockNotifyTeam: vi.fn(),
  }));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    constructor(public _opts: unknown) {}
    post = mockPost;
  },
}));
vi.mock("@/lib/slack-ops-users", () => ({ getSlackOpsUsers: mockGetSlackOpsUsers }));
vi.mock("@/lib/ntfy", () => ({ publishNtfy: mockPublishNtfy }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.mock("@/lib/email", () => ({ notifyTeam: mockNotifyTeam }));
vi.mock("@/lib/escape-html", () => ({ escapeHtml: (s: string) => s }));

import { notifyAdmin } from "@/lib/admin-alerts";

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue(undefined);
  mockGetSlackOpsUsers.mockReset().mockResolvedValue(["U1", "U2"]);
  mockPublishNtfy.mockReset().mockResolvedValue({ ok: true });
  mockGetConfig.mockReset().mockResolvedValue({});
  mockNotifyTeam.mockReset().mockResolvedValue(undefined);
  delete process.env.ADMIN_PUSH_VIA_NTFY;
});

describe("notifyAdmin — Slack", () => {
  it("posts to Slack for each ops user", async () => {
    const result = await notifyAdmin({ severity: "warning", title: "Alert", message: "Body" });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.slack.ok).toBe(true);
  });

  it("returns error when no ops users configured", async () => {
    mockGetSlackOpsUsers.mockResolvedValue([]);
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result.slack.ok).toBe(false);
    expect(result.slack.error).toContain("no ops users");
  });

  it("reports partial failure when some DMs fail", async () => {
    mockPost.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("DM fail"));
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result.slack.ok).toBe(true); // at least one succeeded
  });

  it("includes severity emoji and title in Slack text", async () => {
    await notifyAdmin({ severity: "critical", title: "Down!", message: "All services down" });
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":fire:");
    expect(msg.text).toContain("Down!");
  });

  it("includes click URL in Slack text when provided", async () => {
    await notifyAdmin({
      severity: "error",
      title: "t",
      message: "m",
      click: "https://incident.example.com",
    });
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("https://incident.example.com");
  });

  it("handles SlackClient constructor error gracefully", async () => {
    mockGetSlackOpsUsers.mockRejectedValue(new Error("SSM error"));
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result.slack.ok).toBe(false);
    expect(result.slack.error).toContain("SSM error");
  });
});

describe("notifyAdmin — ntfy", () => {
  it("skips ntfy when ADMIN_PUSH_VIA_NTFY is not set", async () => {
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(mockPublishNtfy).not.toHaveBeenCalled();
    expect(result.ntfy.skipped).toBe("feature_off");
  });

  it("fires ntfy when env ADMIN_PUSH_VIA_NTFY=1", async () => {
    process.env.ADMIN_PUSH_VIA_NTFY = "1";
    const result = await notifyAdmin({ severity: "high", title: "SEV1", message: "Critical" });
    expect(mockPublishNtfy).toHaveBeenCalledOnce();
    expect(result.ntfy.ok).toBe(true);
  });

  it("fires ntfy when SSM ADMIN_PUSH_VIA_NTFY=1 (env not set)", async () => {
    mockGetConfig.mockResolvedValue({ ADMIN_PUSH_VIA_NTFY: "1" });
    const result = await notifyAdmin({ severity: "error", title: "E", message: "err" });
    expect(mockPublishNtfy).toHaveBeenCalledOnce();
    expect(result.ntfy.ok).toBe(true);
  });

  it("SSM flag takes priority over env when both set", async () => {
    process.env.ADMIN_PUSH_VIA_NTFY = "0";
    mockGetConfig.mockResolvedValue({ ADMIN_PUSH_VIA_NTFY: "1" });
    const result = await notifyAdmin({ severity: "error", title: "E", message: "err" });
    expect(mockPublishNtfy).toHaveBeenCalledOnce();
    expect(result.ntfy.ok).toBe(true);
  });

  it("passes priority and tags based on severity", async () => {
    process.env.ADMIN_PUSH_VIA_NTFY = "1";
    await notifyAdmin({ severity: "critical", title: "t", message: "m" });
    const [args] = mockPublishNtfy.mock.calls[0];
    expect(args.priority).toBe(5);
    expect(args.tags).toContain("fire");
  });

  it("passes topic override when provided", async () => {
    process.env.ADMIN_PUSH_VIA_NTFY = "1";
    await notifyAdmin({ severity: "info", title: "t", message: "m", topic: "custom-topic" });
    const [args] = mockPublishNtfy.mock.calls[0];
    expect(args.topic).toBe("custom-topic");
  });
});

describe("notifyAdmin — email", () => {
  it("sends email notification", async () => {
    const result = await notifyAdmin({ severity: "warning", title: "Warn", message: "Watch out" });
    expect(mockNotifyTeam).toHaveBeenCalledOnce();
    expect(result.email.ok).toBe(true);
  });

  it("returns email error when notifyTeam throws", async () => {
    mockNotifyTeam.mockRejectedValue(new Error("SMTP unavailable"));
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result.email.ok).toBe(false);
    expect(result.email.error).toContain("SMTP unavailable");
  });

  it("includes severity in email subject", async () => {
    await notifyAdmin({ severity: "error", title: "Critical Error", message: "Everything broken" });
    const [subject] = mockNotifyTeam.mock.calls[0];
    expect(subject).toContain("[ERROR]");
    expect(subject).toContain("Critical Error");
  });
});

describe("notifyAdmin — all channels fire in parallel", () => {
  it("returns results for all three channels", async () => {
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result).toHaveProperty("slack");
    expect(result).toHaveProperty("ntfy");
    expect(result).toHaveProperty("email");
  });

  it("email failure does not prevent Slack from succeeding", async () => {
    mockNotifyTeam.mockRejectedValue(new Error("SMTP down"));
    const result = await notifyAdmin({ severity: "info", title: "t", message: "m" });
    expect(result.slack.ok).toBe(true);
    expect(result.email.ok).toBe(false);
  });
});
