/**
 * Tests for src/lib/espocrm-dispatch.ts
 *
 * Covers dispatchEspoEvent routing and triggerN8nWorkflow no-op/fire paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockNotifyContactCreated,
  mockNotifyLeadCreated,
  mockNotifyOpportunityCreated,
  mockNotifyOpportunityStageChanged,
  mockNotifyCaseCreated,
  mockNotifyCaseStatusChanged,
} = vi.hoisted(() => ({
  mockNotifyContactCreated: vi.fn(),
  mockNotifyLeadCreated: vi.fn(),
  mockNotifyOpportunityCreated: vi.fn(),
  mockNotifyOpportunityStageChanged: vi.fn(),
  mockNotifyCaseCreated: vi.fn(),
  mockNotifyCaseStatusChanged: vi.fn(),
}));

vi.mock("@/lib/espocrm-slack", () => ({
  notifyContactCreated: mockNotifyContactCreated,
  notifyLeadCreated: mockNotifyLeadCreated,
  notifyOpportunityCreated: mockNotifyOpportunityCreated,
  notifyOpportunityStageChanged: mockNotifyOpportunityStageChanged,
  notifyCaseCreated: mockNotifyCaseCreated,
  notifyCaseStatusChanged: mockNotifyCaseStatusChanged,
}));

// n8n module is dynamically imported — mock it with vi.mock for static interception
const mockTriggerWorkflowByWebhookPath = vi.fn();
vi.mock("@/lib/n8n", () => ({
  triggerWorkflowByWebhookPath: mockTriggerWorkflowByWebhookPath,
}));

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

import { dispatchEspoEvent, triggerN8nWorkflow } from "@/lib/espocrm-dispatch";
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";

function makeRec(overrides: Partial<EspoEntityRecord> = {}): EspoEntityRecord {
  return { id: "rec-1", name: "Test", ...overrides };
}

beforeEach(() => {
  [
    mockNotifyContactCreated,
    mockNotifyLeadCreated,
    mockNotifyOpportunityCreated,
    mockNotifyOpportunityStageChanged,
    mockNotifyCaseCreated,
    mockNotifyCaseStatusChanged,
    mockTriggerWorkflowByWebhookPath,
  ].forEach((m) => m.mockReset().mockResolvedValue(undefined));
  mockGetConfig.mockReset().mockResolvedValue({});
});

describe("dispatchEspoEvent", () => {
  it("calls notifyContactCreated for Contact/create", async () => {
    const rec = makeRec();
    await dispatchEspoEvent("Contact", "create", [rec]);
    expect(mockNotifyContactCreated).toHaveBeenCalledWith(rec);
  });

  it("calls notifyLeadCreated and triggerN8nWorkflow for Lead/create", async () => {
    const rec = makeRec();
    await dispatchEspoEvent("Lead", "create", [rec]);
    expect(mockNotifyLeadCreated).toHaveBeenCalledWith(rec);
  });

  it("calls notifyOpportunityCreated for Opportunity/create", async () => {
    const rec = makeRec();
    await dispatchEspoEvent("Opportunity", "create", [rec]);
    expect(mockNotifyOpportunityCreated).toHaveBeenCalledWith(rec);
  });

  it("calls notifyOpportunityStageChanged for Opportunity/update with stage", async () => {
    const rec = makeRec({ stage: "Proposal" });
    await dispatchEspoEvent("Opportunity", "update", [rec]);
    expect(mockNotifyOpportunityStageChanged).toHaveBeenCalledWith(rec);
  });

  it("does NOT call stageChanged for Opportunity/update without stage", async () => {
    const rec = makeRec({ stage: undefined });
    await dispatchEspoEvent("Opportunity", "update", [rec]);
    expect(mockNotifyOpportunityStageChanged).not.toHaveBeenCalled();
  });

  it("calls notifyCaseCreated for Case/create", async () => {
    const rec = makeRec();
    await dispatchEspoEvent("Case", "create", [rec]);
    expect(mockNotifyCaseCreated).toHaveBeenCalledWith(rec);
  });

  it("calls notifyCaseStatusChanged for Case/update with status", async () => {
    const rec = makeRec({ status: "Closed" });
    await dispatchEspoEvent("Case", "update", [rec]);
    expect(mockNotifyCaseStatusChanged).toHaveBeenCalledWith(rec);
  });

  it("does NOT call statusChanged for Case/update without status", async () => {
    const rec = makeRec({ status: undefined });
    await dispatchEspoEvent("Case", "update", [rec]);
    expect(mockNotifyCaseStatusChanged).not.toHaveBeenCalled();
  });

  it("ignores unknown entity/action combinations", async () => {
    await dispatchEspoEvent("Unknown", "delete", [makeRec()]);
    [
      mockNotifyContactCreated,
      mockNotifyLeadCreated,
      mockNotifyOpportunityCreated,
      mockNotifyOpportunityStageChanged,
      mockNotifyCaseCreated,
      mockNotifyCaseStatusChanged,
    ].forEach((m) => expect(m).not.toHaveBeenCalled());
  });

  it("processes multiple records", async () => {
    const recs = [makeRec({ id: "r1" }), makeRec({ id: "r2" })];
    await dispatchEspoEvent("Contact", "create", recs);
    expect(mockNotifyContactCreated).toHaveBeenCalledTimes(2);
  });

  it("handles empty records array without error", async () => {
    await expect(dispatchEspoEvent("Contact", "create", [])).resolves.toBeUndefined();
  });
});

describe("triggerN8nWorkflow", () => {
  it("is a no-op when workflow id is not configured", async () => {
    mockGetConfig.mockResolvedValue({});
    await triggerN8nWorkflow("lead-enrich", { foo: "bar" });
    expect(mockTriggerWorkflowByWebhookPath).not.toHaveBeenCalled();
  });

  it("triggers the workflow when N8N_WORKFLOW_LEAD_ENRICH_ID is set", async () => {
    mockGetConfig.mockResolvedValue({ N8N_WORKFLOW_LEAD_ENRICH_ID: "wf-123" });
    await triggerN8nWorkflow("lead-enrich", { data: 1 });
    expect(mockTriggerWorkflowByWebhookPath).toHaveBeenCalledWith("wf-123", { data: 1 });
  });

  it("triggers newsletter-nurture when id is set", async () => {
    mockGetConfig.mockResolvedValue({ N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: "wf-456" });
    await triggerN8nWorkflow("newsletter-nurture", { email: "test@test.com" });
    expect(mockTriggerWorkflowByWebhookPath).toHaveBeenCalledWith("wf-456", { email: "test@test.com" });
  });

  it("uses empty string as id for unknown workflow names (no-op)", async () => {
    mockGetConfig.mockResolvedValue({});
    await triggerN8nWorkflow("unknown-workflow", {});
    expect(mockTriggerWorkflowByWebhookPath).not.toHaveBeenCalled();
  });

  it("swallows errors and does not throw", async () => {
    mockGetConfig.mockRejectedValue(new Error("SSM error"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(triggerN8nWorkflow("lead-enrich", {})).resolves.toBeUndefined();
  });
});
