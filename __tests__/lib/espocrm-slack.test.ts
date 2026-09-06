/**
 * Tests for src/lib/espocrm-slack.ts
 *
 * Covers all notifyXxx functions: contact, lead, opportunity created/stage-changed,
 * case created/status-changed. Also covers deepLinkFor and fmtMoney helpers
 * indirectly via the generated Slack block content.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock SlackClient before espocrm-slack is imported (module-level singletons)
// ---------------------------------------------------------------------------
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockPost;
  },
}));

import {
  notifyContactCreated,
  notifyLeadCreated,
  notifyOpportunityCreated,
  notifyOpportunityStageChanged,
  notifyCaseCreated,
  notifyCaseStatusChanged,
} from "@/lib/espocrm-slack";
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";

const BASE_URL = "https://espocrm.cloudless.gr";

function makeRec(overrides: Partial<EspoEntityRecord> = {}): EspoEntityRecord {
  return {
    id: "rec-1",
    name: "Acme Corp",
    emailAddress: "acme@example.com",
    phoneNumber: "+30-21-0000-0000",
    assignedUserName: "Themis",
    ...overrides,
  };
}

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
describe("notifyContactCreated", () => {
  it("posts to Slack with contact name in text", async () => {
    await notifyContactCreated(makeRec(), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("Acme Corp");
  });

  it("includes the EspoCRM deep link URL", async () => {
    await notifyContactCreated(makeRec({ id: "c-42" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    const json = JSON.stringify(msg);
    expect(json).toContain("Contact/view/c-42");
  });

  it("falls back to emailAddress when name is absent", async () => {
    await notifyContactCreated(makeRec({ name: undefined, emailAddress: "fallback@test.com" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("fallback@test.com");
  });

  it("omits optional fields when absent", async () => {
    await notifyContactCreated(makeRec({ phoneNumber: undefined, assignedUserName: undefined }), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
  });

  it("uses default base URL when not provided", async () => {
    await notifyContactCreated(makeRec({ id: "c-99" }));
    const [msg] = mockPost.mock.calls[0];
    expect(JSON.stringify(msg)).toContain("espocrm.cloudless.gr");
  });
});

// ---------------------------------------------------------------------------
describe("notifyLeadCreated", () => {
  it("posts with lead name", async () => {
    await notifyLeadCreated(makeRec({ id: "l-1" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("Acme Corp");
    expect(JSON.stringify(msg)).toContain("Lead/view/l-1");
  });

  it("omits email block when absent", async () => {
    await notifyLeadCreated(makeRec({ emailAddress: undefined }), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("notifyOpportunityCreated", () => {
  it("posts with opportunity name and amount", async () => {
    await notifyOpportunityCreated(
      makeRec({ id: "opp-1", amount: 5000, amountCurrency: "EUR", stage: "Proposal" }),
      BASE_URL
    );
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("Acme Corp");
    const json = JSON.stringify(msg);
    expect(json).toContain("Opportunity/view/opp-1");
    expect(json).toContain("5,000");
    expect(json).toContain("Proposal");
  });

  it("omits amount block when absent", async () => {
    await notifyOpportunityCreated(makeRec({ amount: undefined }), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("notifyOpportunityStageChanged", () => {
  it("uses tada emoji for Closed Won", async () => {
    await notifyOpportunityStageChanged(
      makeRec({ id: "opp-2", stage: "Closed Won", amount: 2000, amountCurrency: "EUR" }),
      BASE_URL
    );
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":tada:");
    expect(msg.text).toContain("Closed Won");
  });

  it("uses x emoji for Closed Lost", async () => {
    await notifyOpportunityStageChanged(makeRec({ stage: "Closed Lost" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":x:");
  });

  it("uses arrow emoji for other stages", async () => {
    await notifyOpportunityStageChanged(makeRec({ stage: "Negotiation" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":arrow_right:");
  });

  it("includes formatted amount when present", async () => {
    await notifyOpportunityStageChanged(
      makeRec({ stage: "Closed Won", amount: 9999, amountCurrency: "USD" }),
      BASE_URL
    );
    const [msg] = mockPost.mock.calls[0];
    const json = JSON.stringify(msg);
    expect(json).toContain("9,999");
  });

  it("skips amount when absent", async () => {
    await notifyOpportunityStageChanged(makeRec({ stage: "Proposal", amount: undefined }), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("notifyCaseCreated", () => {
  it("posts case subject and status", async () => {
    await notifyCaseCreated(
      makeRec({ id: "case-1", name: "Login broken", status: "New" }),
      BASE_URL
    );
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("Login broken");
    const json = JSON.stringify(msg);
    expect(json).toContain("Case/view/case-1");
    expect(json).toContain("New");
  });

  it("omits optional fields gracefully", async () => {
    await notifyCaseCreated(makeRec({ status: undefined, assignedUserName: undefined }), BASE_URL);
    expect(mockPost).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
describe("notifyCaseStatusChanged", () => {
  it("uses check mark emoji for Closed status", async () => {
    await notifyCaseStatusChanged(makeRec({ status: "Closed" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":white_check_mark:");
  });

  it("uses arrows emoji for non-Closed status", async () => {
    await notifyCaseStatusChanged(makeRec({ status: "In Progress" }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain(":arrows_counterclockwise:");
  });

  it("falls back to ? when status is absent", async () => {
    await notifyCaseStatusChanged(makeRec({ status: undefined }), BASE_URL);
    const [msg] = mockPost.mock.calls[0];
    expect(msg.text).toContain("?");
  });
});
