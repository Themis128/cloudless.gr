import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getN8nSummary,
  isN8nConfigured,
  listRecentExecutions,
  listWorkflows,
  N8nApiError,
  N8nNotConfiguredError,
  pingN8nHealth,
  triggerWorkflowByWebhookPath,
} from "@/lib/n8n";

const CONFIG = { N8N_API_URL: "https://n8n.example", N8N_API_KEY: "n8n_api_x" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue(CONFIG);
});

const jsonRes = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("n8n config + health", () => {
  it("isN8nConfigured / errors", async () => {
    expect(await isN8nConfigured()).toBe(true);
    mockGetConfig.mockResolvedValue({});
    expect(await isN8nConfigured()).toBe(false);
    const err = new N8nNotConfiguredError();
    expect(err.name).toBe("N8nNotConfiguredError");
    const apiErr = new N8nApiError(500, "x".repeat(500));
    expect(apiErr.message).toContain("500");
    expect(apiErr.status).toBe(500);
  });

  it("pingN8nHealth", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    expect(await pingN8nHealth()).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("https://n8n.example/healthz");
    mockFetch.mockResolvedValue({ ok: false });
    expect(await pingN8nHealth()).toBe(false);
    mockFetch.mockRejectedValue(new Error("down"));
    expect(await pingN8nHealth()).toBe(false);
    mockGetConfig.mockResolvedValue({});
    expect(await pingN8nHealth()).toBe(false);
  });
});

describe("n8n list endpoints", () => {
  it("listWorkflows success + not-configured → []", async () => {
    mockFetch.mockResolvedValue(jsonRes({ data: [{ id: "w1", active: true }] }));
    expect(await listWorkflows()).toEqual([{ id: "w1", active: true }]);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v1/workflows?active=false");
    expect(mockFetch.mock.calls[0][1].headers["X-N8N-API-KEY"]).toBe("n8n_api_x");

    mockFetch.mockResolvedValue(jsonRes({}));
    expect(await listWorkflows(true)).toEqual([]); // missing data → []
    expect(mockFetch.mock.calls.at(-1)![0]).toContain("active=true");

    mockGetConfig.mockResolvedValue({});
    expect(await listWorkflows()).toEqual([]); // not configured → []

    // real API error propagates
    mockGetConfig.mockResolvedValue(CONFIG);
    mockFetch.mockResolvedValue(jsonRes("boom", false, 500));
    await expect(listWorkflows()).rejects.toThrow(N8nApiError);
  });

  it("listRecentExecutions clamps limit", async () => {
    mockFetch.mockResolvedValue(jsonRes({ data: [{ id: "e1" }] }));
    await listRecentExecutions(9999);
    expect(mockFetch.mock.calls[0][0]).toContain("limit=250");
    await listRecentExecutions(0);
    expect(mockFetch.mock.calls.at(-1)![0]).toContain("limit=1");
    mockGetConfig.mockResolvedValue({});
    expect(await listRecentExecutions()).toEqual([]);

    // non-config API error rethrows
    mockGetConfig.mockResolvedValue(CONFIG);
    mockFetch.mockResolvedValue(jsonRes("err", false, 502));
    await expect(listRecentExecutions()).rejects.toThrow(N8nApiError);
  });
});

describe("triggerWorkflowByWebhookPath", () => {
  it("webhook path succeeds", async () => {
    mockFetch.mockResolvedValue(jsonRes({ ok: true }));
    const out = await triggerWorkflowByWebhookPath("wf-1", { a: 1 });
    expect(out.webhook).toEqual({ ok: true });
    expect(mockFetch.mock.calls[0][0]).toBe("https://n8n.example/webhook/wf-1");
  });

  it("404 falls back to public-API execute", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonRes("nf", false, 404))
      .mockResolvedValueOnce(jsonRes({ data: { executionId: "e9" } }));
    const out = await triggerWorkflowByWebhookPath("wf-2", {});
    expect(out.execution).toEqual({ data: { executionId: "e9" } });
    expect(mockFetch.mock.calls[1][0]).toContain("/api/v1/workflows/wf-2/execute");
  });

  it("network error also falls back; non-404 api error propagates", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("dns fail"))
      .mockResolvedValueOnce(jsonRes({ data: {} }));
    expect((await triggerWorkflowByWebhookPath("wf-3", {})).execution).toEqual({ data: {} });

    mockFetch.mockReset().mockResolvedValue(jsonRes("forbidden", false, 403));
    await expect(triggerWorkflowByWebhookPath("wf-4", {})).rejects.toThrow(N8nApiError);
  });
});

describe("getN8nSummary", () => {
  it("unconfigured → zeros", async () => {
    mockGetConfig.mockResolvedValue({});
    expect(await getN8nSummary()).toEqual({
      configured: false, healthy: false, workflowCount: 0,
      activeWorkflowCount: 0, recentExecutionCount: 0, recentFailureCount: 0,
    });
  });

  it("configured → counts workflows/executions/failures", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // healthz
      .mockResolvedValueOnce(jsonRes({ data: [{ id: "w1", active: true }, { id: "w2", active: false }] }))
      .mockResolvedValueOnce(jsonRes({ data: [{ status: "success" }, { status: "error" }] }));
    const out = await getN8nSummary();
    expect(out).toMatchObject({
      configured: true, healthy: true, workflowCount: 2,
      activeWorkflowCount: 1, recentExecutionCount: 2, recentFailureCount: 1,
    });
  });

  it("swallows list failures → still reports healthy/counts=0", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true }) // healthz
      .mockResolvedValue(jsonRes("err", false, 500)); // both list calls 500
    const out = await getN8nSummary();
    expect(out).toMatchObject({
      configured: true, healthy: true, workflowCount: 0, recentExecutionCount: 0,
    });
  });
});
