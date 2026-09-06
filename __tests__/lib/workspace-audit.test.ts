import { describe, it, expect, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockPost;
  },
}));

import { auditWorkspaceEvent } from "@/lib/workspace-audit";

describe("auditWorkspaceEvent", () => {
  it("posts a Slack message for created event", async () => {
    await auditWorkspaceEvent("created", { id: "ws-1", name: "My WS", slug: "my-ws" }, "admin@example.com");
    expect(mockPost).toHaveBeenCalledTimes(1);
    const args = mockPost.mock.calls[0][0];
    expect(args.text).toContain("created");
    expect(args.text).toContain("My WS");
  });

  it("posts a Slack message for updated event", async () => {
    mockPost.mockClear();
    await auditWorkspaceEvent("updated", { id: "ws-2", name: "Other", slug: "other" }, null);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const args = mockPost.mock.calls[0][0];
    expect(args.text).toContain("updated");
  });

  it("posts a Slack message for deleted event with null actor", async () => {
    mockPost.mockClear();
    await auditWorkspaceEvent("deleted", { id: "ws-3", name: "Gone", slug: "gone" }, undefined);
    expect(mockPost).toHaveBeenCalledTimes(1);
    const args = mockPost.mock.calls[0][0];
    const block = args.blocks[0] as { text: { text: string } };
    expect(block.text.text).toContain("unknown");
  });
});
