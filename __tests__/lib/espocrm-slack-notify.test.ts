import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockPost;
  },
}));

import {
  notifyCaseCreated,
  notifyCaseStatusChanged,
  notifyContactCreated,
  notifyLeadCreated,
  notifyOpportunityCreated,
  notifyOpportunityStageChanged,
} from "@/lib/espocrm-slack";

beforeEach(() => vi.clearAllMocks());

describe("espocrm-slack notifications", () => {
  it("contact created posts blocks with deep link + fields", async () => {
    await notifyContactCreated({
      id: "c1", name: "Ada", emailAddress: "a@x", phoneNumber: "1",
      assignedUserName: "themis",
    });
    const msg = mockPost.mock.calls[0][0];
    expect(msg.text).toContain("Ada");
    expect(msg.blocks.find((b: { type: string }) => b.type === "actions")!
      .elements[0].url).toBe("https://espocrm.cloudless.gr/#Contact/view/c1");
  });

  it("lead created minimal record", async () => {
    await notifyLeadCreated({ id: "l1" });
    const msg = mockPost.mock.calls[0][0];
    expect(msg.text).toContain("New lead");
    expect(msg.blocks[1].fields[0].text).toContain("Lead/view/l1");
  });

  it("opportunity created includes amount + baseUrl override", async () => {
    await notifyOpportunityCreated(
      { id: "o1", name: "Deal", amount: 5000, amountCurrency: "EUR" },
      "https://crm.example",
    );
    const msg = mockPost.mock.calls[0][0];
    expect(JSON.stringify(msg.blocks)).toContain("crm.example");
    expect(JSON.stringify(msg.blocks)).toContain("5,000");
  });

  it("opportunity stage + case create/status", async () => {
    await notifyOpportunityStageChanged({ id: "o2", stage: "Closed Won" });
    await notifyCaseCreated({ id: "k1", name: "Ticket", status: "New" });
    await notifyCaseStatusChanged({ id: "k2", status: "Resolved" });
    expect(mockPost).toHaveBeenCalledTimes(3);
    const texts = mockPost.mock.calls.map((c) => c[0].text).join(" ");
    expect(texts).toContain("Closed Won");
    expect(texts).toContain("Ticket");
    expect(texts).toContain("Resolved");
  });
});
