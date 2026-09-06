import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

const mockFetch = vi.fn();

import { dispatchWorkflow } from "@/lib/github-dispatch";

beforeEach(() => {
  mockFetch.mockClear();
  mockGetConfig.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dispatchWorkflow", () => {
  it("returns error when no token is configured", async () => {
    mockGetConfig.mockResolvedValue({});
    const result = await dispatchWorkflow("weekly-article-draft.yml");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toContain("not configured");
    }
  });

  it("dispatches to GitHub API with correct URL", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_DISPATCH_TOKEN: "ghp_test" });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await dispatchWorkflow("my-workflow.yml");
    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toContain("my-workflow.yml");
    expect(url).toContain("dispatches");
    const body = JSON.parse(init.body as string);
    expect(body.ref).toBe("main");
  });

  it("includes inputs when provided", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_DISPATCH_TOKEN: "ghp_test" });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await dispatchWorkflow("my-workflow.yml", "main", { pr_number: "42" });
    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.inputs).toEqual({ pr_number: "42" });
  });

  it("uses custom ref when provided", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_DISPATCH_TOKEN: "ghp_test" });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await dispatchWorkflow("my-workflow.yml", "feat/test");
    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.ref).toBe("feat/test");
  });

  it("returns error on non-ok response", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_DISPATCH_TOKEN: "ghp_test" });
    mockFetch.mockResolvedValue({ ok: false, status: 422, text: async () => "Validation failed" });

    const result = await dispatchWorkflow("bad.yml");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  it("returns error when fetch throws", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_DISPATCH_TOKEN: "ghp_test" });
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await dispatchWorkflow("my-workflow.yml");
    expect(result.ok).toBe(false);
  });

  it("uses GITHUB_TOKEN as fallback", async () => {
    mockGetConfig.mockResolvedValue({ GITHUB_TOKEN: "ghp_fallback" });
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    const result = await dispatchWorkflow("my-workflow.yml");
    expect(result.ok).toBe(true);
    const [, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toContain("ghp_fallback");
  });
});
