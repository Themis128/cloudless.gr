import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ GEMINI_API_KEY: "" });

import { getGeminiApiKey, isGeminiConfigured } from "@/lib/gemini-admin";

describe("getGeminiApiKey", () => {
  it("returns null when GEMINI_API_KEY is not configured", async () => {
    expect(await getGeminiApiKey()).toBeNull();
  });
});

describe("isGeminiConfigured", () => {
  it("returns false when GEMINI_API_KEY is not configured", async () => {
    expect(await isGeminiConfigured()).toBe(false);
  });
});
