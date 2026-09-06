/**
 * Tests for src/lib/ntfy.ts
 *
 * Covers:
 *  - isNtfyConfigured() — true/false based on config
 *  - publishNtfy() — unconfigured, no topic, success, HTTP error, network error,
 *    all optional headers (title, priority, tags, click, token)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetConfig, mockFetch } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));
vi.stubGlobal("fetch", mockFetch);

import { isNtfyConfigured, publishNtfy } from "@/lib/ntfy";

// ---------------------------------------------------------------------------
const BASE_CFG = {
  NTFY_BASE_URL: "https://ntfy.example.com",
  NTFY_TOPIC: "cloudless-ops",
  NTFY_TOKEN: "",
};

function mockOkResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue("ok"),
  };
}

beforeEach(() => {
  mockGetConfig.mockReset();
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
describe("isNtfyConfigured", () => {
  it("returns true when both URL and topic are set", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    await expect(isNtfyConfigured()).resolves.toBe(true);
  });

  it("returns false when URL is missing", async () => {
    mockGetConfig.mockResolvedValue({ NTFY_BASE_URL: "", NTFY_TOPIC: "topic" });
    await expect(isNtfyConfigured()).resolves.toBe(false);
  });

  it("returns false when topic is missing", async () => {
    mockGetConfig.mockResolvedValue({ NTFY_BASE_URL: "https://ntfy.example.com", NTFY_TOPIC: "" });
    await expect(isNtfyConfigured()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("publishNtfy", () => {
  it("returns skipped=ntfy_unconfigured when base URL is empty", async () => {
    mockGetConfig.mockResolvedValue({ NTFY_BASE_URL: "", NTFY_TOPIC: "t" });
    const result = await publishNtfy({ message: "hello" });
    expect(result).toEqual({ ok: false, skipped: "ntfy_unconfigured" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns skipped=no_topic when topic is empty and no override", async () => {
    mockGetConfig.mockResolvedValue({ NTFY_BASE_URL: "https://ntfy.example.com", NTFY_TOPIC: "" });
    const result = await publishNtfy({ message: "hello" });
    expect(result).toEqual({ ok: false, skipped: "no_topic" });
  });

  it("uses topic override from input", async () => {
    mockGetConfig.mockResolvedValue({ NTFY_BASE_URL: "https://ntfy.example.com", NTFY_TOPIC: "" });
    mockFetch.mockResolvedValue(mockOkResponse());
    const result = await publishNtfy({ message: "hello", topic: "custom-topic" });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://ntfy.example.com/custom-topic",
      expect.objectContaining({ method: "POST", body: "hello" })
    );
  });

  it("returns ok:true on successful 200 response", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue(mockOkResponse(200));
    const result = await publishNtfy({ message: "all good" });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with error on non-2xx response", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue("Forbidden"),
    });
    const result = await publishNtfy({ message: "hello" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("403");
  });

  it("returns ok:false with error message on network error", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockRejectedValue(new Error("network timeout"));
    const result = await publishNtfy({ message: "hello" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network timeout");
  });

  it("sets Authorization header when NTFY_TOKEN is present", async () => {
    mockGetConfig.mockResolvedValue({ ...BASE_CFG, NTFY_TOKEN: "tok-secret" });
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hello" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-secret");
  });

  it("sets Title header when title is provided", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi", title: "Alert!" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Title).toBe("Alert!");
  });

  it("sets Priority header when priority is provided", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi", priority: 5 });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Priority).toBe("5");
  });

  it("sets Tags header when tags are provided", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi", tags: ["warning", "server"] });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Tags).toBe("warning,server");
  });

  it("sets Click header when click URL is provided", async () => {
    mockGetConfig.mockResolvedValue(BASE_CFG);
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi", click: "https://cloudless.gr/admin" });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Click).toBe("https://cloudless.gr/admin");
  });

  it("strips trailing slash from base URL", async () => {
    mockGetConfig.mockResolvedValue({
      ...BASE_CFG,
      NTFY_BASE_URL: "https://ntfy.example.com/",
    });
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("https://ntfy.example.com/cloudless-ops");
  });

  it("URL-encodes topic with special characters", async () => {
    mockGetConfig.mockResolvedValue({ ...BASE_CFG, NTFY_TOPIC: "my topic" });
    mockFetch.mockResolvedValue(mockOkResponse());
    await publishNtfy({ message: "hi" });
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("my%20topic");
  });
});
