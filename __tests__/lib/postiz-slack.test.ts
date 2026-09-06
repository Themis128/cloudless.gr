import { describe, it, expect, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockPost;
  },
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({ POSTIZ_SLACK_CHANNEL: "" }) }));

import { notifyPostPublished, notifyPostErrored, notifyOauthExpiry } from "@/lib/postiz-slack";
import type { PostizPost, PostizIntegration } from "@/lib/postiz";

const fakePost: PostizPost = {
  id: "post-1",
  title: "Hello World",
  content: "Test post",
  status: "QUEUE",
  integration: { id: "int-1", name: "Twitter", identifier: "twitter", picture: "" },
  createdAt: new Date().toISOString(),
};

const fakeIntegration: PostizIntegration = {
  id: "int-1",
  name: "Twitter",
  identifier: "twitter",
  picture: "",
};

describe("notifyPostPublished", () => {
  it("resolves without throwing when Slack is not configured", async () => {
    await expect(notifyPostPublished(fakePost)).resolves.toBeUndefined();
  });
});

describe("notifyPostErrored", () => {
  it("resolves without throwing when Slack is not configured", async () => {
    await expect(notifyPostErrored(fakePost, "API error")).resolves.toBeUndefined();
  });
});

describe("notifyOauthExpiry", () => {
  it("resolves without throwing when Slack is not configured", async () => {
    await expect(notifyOauthExpiry(fakeIntegration)).resolves.toBeUndefined();
  });
});
