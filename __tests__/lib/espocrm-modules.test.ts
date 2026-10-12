import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCachedFromTable,
  mockSetCachedToTable,
  mockReadThroughTable,
  mockGetAuthDbFromEnv,
  mockAllowWrite,
  mockNotifyContact,
  mockNotifyLead,
  mockNotifyOpp,
  mockNotifyOppStage,
  mockNotifyCase,
  mockNotifyCaseStatus,
  mockGetIntegrations,
  mockTriggerWorkflow,
  mockGetConfig,
} = vi.hoisted(() => ({
  mockGetCachedFromTable: vi.fn(),
  mockSetCachedToTable: vi.fn(),
  mockReadThroughTable: vi.fn(),
  mockGetAuthDbFromEnv: vi.fn(),
  mockAllowWrite: vi.fn(() => true),
  mockNotifyContact: vi.fn(),
  mockNotifyLead: vi.fn(),
  mockNotifyOpp: vi.fn(),
  mockNotifyOppStage: vi.fn(),
  mockNotifyCase: vi.fn(),
  mockNotifyCaseStatus: vi.fn(),
  mockGetIntegrations: vi.fn(),
  mockTriggerWorkflow: vi.fn(),
  mockGetConfig: vi.fn(),
}));

vi.mock("@/lib/d1-json-cache", () => ({
  getCachedFromTable: mockGetCachedFromTable,
  setCachedToTable: mockSetCachedToTable,
  readThroughTable: mockReadThroughTable,
  paramsHash: (p: Record<string, unknown>) => "h:" + JSON.stringify(p),
}));
vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: mockGetAuthDbFromEnv,
}));
vi.mock("@/lib/d1-write-budget", () => ({
  allowDiscretionaryD1Write: mockAllowWrite,
}));
vi.mock("@/lib/espocrm-slack", () => ({
  notifyCaseCreated: mockNotifyCase,
  notifyCaseStatusChanged: mockNotifyCaseStatus,
  notifyContactCreated: mockNotifyContact,
  notifyLeadCreated: mockNotifyLead,
  notifyOpportunityCreated: mockNotifyOpp,
  notifyOpportunityStageChanged: mockNotifyOppStage,
}));
vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: mockGetIntegrations,
}));
vi.mock("@/lib/n8n", () => ({
  triggerWorkflowByWebhookPath: mockTriggerWorkflow,
}));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: mockGetConfig,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getCached,
  invalidateEspoContactCaches,
  invalidateKey,
  invalidatePrefix,
  readThrough,
  setCached,
} from "@/lib/espocrm-cache";
import { dispatchEspoEvent, triggerN8nWorkflow } from "@/lib/espocrm-dispatch";
import { enqueueEspoWebhook, isEspoQueueConfigured } from "@/lib/espocrm-queue";
import {
  parseEspoEvent,
  verifyEspoWebhookSecret,
} from "@/lib/espocrm-webhook";

beforeEach(() => {
  vi.clearAllMocks();
  mockAllowWrite.mockReturnValue(true);
  delete process.env.ESPOCRM_QUEUE_PRODUCER_URL;
  delete process.env.ESPOCRM_QUEUE_PRODUCER_SECRET;
});

// ── espocrm-cache ────────────────────────────────────────────────────

describe("espocrm-cache", () => {
  it("delegates get/set/readThrough to the shared D1 cache", async () => {
    mockGetCachedFromTable.mockResolvedValue({ payload: { a: 1 } });
    expect(await getCached("route", { x: 1 }, 60)).toEqual({ payload: { a: 1 } });
    expect(mockGetCachedFromTable).toHaveBeenCalledWith(
      "espocrm_cache", "espocrm-cache", "route", { x: 1 }, 60);

    await setCached("route", {}, { v: 2 }, 120);
    expect(mockSetCachedToTable).toHaveBeenCalledWith(
      "espocrm_cache", "espocrm-cache", "route", {}, { v: 2 }, 120);

    mockReadThroughTable.mockResolvedValue({ value: "v", source: "live", ageSeconds: 0 });
    const fetcher = vi.fn();
    const out = await readThrough("r", { p: 1 }, fetcher);
    expect(out.value).toBe("v");
    expect(mockReadThroughTable).toHaveBeenCalledWith(
      "espocrm_cache", "espocrm-cache", "r", { p: 1 }, fetcher,
      { ttlSeconds: 900, acceptStaleSeconds: 1800 });
  });

  it("invalidatePrefix deletes by pk prefix, swallows db errors", async () => {
    const run = vi.fn().mockResolvedValue({});
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    mockGetAuthDbFromEnv.mockReturnValue({ prepare });
    await invalidatePrefix("espocrm:listContacts");
    expect(bind).toHaveBeenCalledWith("espocrm:listContacts", "espocrm:listContacts%");
    expect(run).toHaveBeenCalled();

    run.mockRejectedValue(new Error("d1 gone"));
    await invalidatePrefix("espocrm:x"); // warn + swallow
  });

  it("invalidateKey guards budget and missing db", async () => {
    mockAllowWrite.mockReturnValue(false);
    const prepare = vi.fn();
    mockGetAuthDbFromEnv.mockReturnValue({ prepare });
    await invalidateKey("route");
    expect(prepare).not.toHaveBeenCalled();

    mockAllowWrite.mockReturnValue(true);
    mockGetAuthDbFromEnv.mockReturnValue(null);
    await invalidateKey("route"); // no db → return

    const run = vi.fn().mockRejectedValue("boom");
    mockGetAuthDbFromEnv.mockReturnValue({
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })),
    });
    await invalidateKey("route", { a: 1 }); // error swallowed
  });

  it("invalidateEspoContactCaches clears contact + list keys", async () => {
    mockGetAuthDbFromEnv.mockReturnValue({
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn().mockResolvedValue({}) })) })),
    });
    await invalidateEspoContactCaches("c1"); // exercises all invalidators
  });
});

// ── espocrm-queue ────────────────────────────────────────────────────

describe("espocrm-queue", () => {
  it("isEspoQueueConfigured reflects env", () => {
    expect(isEspoQueueConfigured()).toBe(false);
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://q.example/push";
    expect(isEspoQueueConfigured()).toBe(false);
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "s";
    expect(isEspoQueueConfigured()).toBe(true);
  });

  it("enqueueEspoWebhook posts the payload and handles errors", async () => {
    expect(await enqueueEspoWebhook({ entity: "Contact", action: "create", records: [] }))
      .toBe(false); // not configured → false

    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "https://q.example/push";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "s";
    mockFetch.mockResolvedValue({ ok: true });
    expect(await enqueueEspoWebhook({ entity: "Lead", action: "create", records: [{ id: "1" }] }))
      .toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://q.example/push");
    expect(init.headers.Authorization).toBe("Bearer s");
    expect(JSON.parse(init.body)).toMatchObject({ entity: "Lead", action: "create" });

    mockFetch.mockResolvedValue({ ok: false, status: 502, text: async () => "bad gateway" });
    await expect(
      enqueueEspoWebhook({ entity: "Case", action: "create", records: [] })
    ).rejects.toThrow("Espo queue producer 502");
  });
});

// ── espocrm-webhook ──────────────────────────────────────────────────

describe("verifyEspoWebhookSecret", () => {
  it("rejects missing/mismatched/misconfigured secrets", async () => {
    expect(await verifyEspoWebhookSecret(null)).toBe(false);
    mockGetIntegrations.mockResolvedValue({ ESPOCRM_WEBHOOK_SECRET: "expected-secret" });
    expect(await verifyEspoWebhookSecret("wrong-secret")).toBe(false);
    expect(await verifyEspoWebhookSecret("expected-secret")).toBe(true);
    mockGetIntegrations.mockResolvedValue({});
    expect(await verifyEspoWebhookSecret("anything")).toBe(false);
  });
});

describe("parseEspoEvent", () => {
  it("parses Entity.action and tolerates malformed input", () => {
    expect(parseEspoEvent("Contact.create")).toEqual(["Contact", "create"]);
    expect(parseEspoEvent(undefined)).toEqual([null, null]);
    expect(parseEspoEvent("")).toEqual([null, null]);
    expect(parseEspoEvent(".create")).toEqual([null, null]);
    expect(parseEspoEvent("Contact.")).toEqual([null, null]);
    expect(parseEspoEvent("nodots")).toEqual([null, null]);
  });
});

// ── espocrm-dispatch ─────────────────────────────────────────────────

describe("dispatchEspoEvent", () => {
  it("routes each entity/action to the right notifiers", async () => {
    await dispatchEspoEvent("Contact", "create", [{ id: "1" }]);
    expect(mockNotifyContact).toHaveBeenCalledWith({ id: "1" });

    mockGetConfig.mockResolvedValue({ N8N_WORKFLOW_LEAD_ENRICH_ID: "wf-1" });
    await dispatchEspoEvent("Lead", "create", [{ id: "2" }]);
    expect(mockNotifyLead).toHaveBeenCalledWith({ id: "2" });
    expect(mockTriggerWorkflow).toHaveBeenCalledWith(
      "wf-1", { entity: "Lead", action: "create", record: { id: "2" } });

    await dispatchEspoEvent("Opportunity", "create", [{ id: "3" }]);
    expect(mockNotifyOpp).toHaveBeenCalledWith({ id: "3" });
    await dispatchEspoEvent("Opportunity", "update", [{ id: "4", stage: "Won" }]);
    expect(mockNotifyOppStage).toHaveBeenCalledWith({ id: "4", stage: "Won" });
    await dispatchEspoEvent("Opportunity", "update", [{ id: "5" }]); // no stage → ignored
    expect(mockNotifyOppStage).toHaveBeenCalledTimes(1);

    await dispatchEspoEvent("Case", "create", [{ id: "6" }]);
    expect(mockNotifyCase).toHaveBeenCalledWith({ id: "6" });
    await dispatchEspoEvent("Case", "update", [{ id: "7", status: "Closed" }]);
    expect(mockNotifyCaseStatus).toHaveBeenCalledWith({ id: "7", status: "Closed" });
  });

  it("ignores unknown combos and survives a failing notifier", async () => {
    await dispatchEspoEvent("Note", "create", [{ id: "1" }]); // no route → silent
    mockNotifyContact.mockRejectedValue(new Error("slack down"));
    await expect(
      dispatchEspoEvent("Contact", "create", [{ id: "a" }, { id: "b" }])
    ).resolves.toBeUndefined(); // allSettled — one failure doesn't drop rest
    expect(mockNotifyContact).toHaveBeenCalledTimes(2);
  });
});

describe("triggerN8nWorkflow", () => {
  it("triggers by alias or no-ops on missing id; never throws", async () => {
    mockGetConfig.mockResolvedValue({ N8N_WORKFLOW_LEAD_ENRICH_ID: "wf-1" });
    await triggerN8nWorkflow("lead-enrich", { a: 1 });
    expect(mockTriggerWorkflow).toHaveBeenCalledWith("wf-1", { a: 1 });

    mockGetConfig.mockResolvedValue({}); // no ids → early return
    await triggerN8nWorkflow("newsletter-nurture", {});
    await triggerN8nWorkflow("other-alias", {});
    expect(mockTriggerWorkflow).toHaveBeenCalledTimes(1);

    mockGetConfig.mockRejectedValue(new Error("ssm down")); // caught + logged
    await expect(triggerN8nWorkflow("lead-enrich", {})).resolves.toBeUndefined();
  });
});
