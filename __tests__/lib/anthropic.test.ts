import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

mockGetCfg.mockResolvedValue({ ANTHROPIC_API_KEY: "", ANTHROPIC_CHAT_MODEL: "" });

import {
  getAnthropicApiKey,
  isAnthropicConfigured,
  getAnthropicChatModel,
} from "@/lib/anthropic";

describe("getAnthropicApiKey", () => {
  it("returns null when ANTHROPIC_API_KEY is empty", async () => {
    expect(await getAnthropicApiKey()).toBeNull();
  });
});

describe("isAnthropicConfigured", () => {
  it("returns false when API key is not set", async () => {
    expect(await isAnthropicConfigured()).toBe(false);
  });
});

describe("getAnthropicChatModel", () => {
  it("returns default model when nothing is configured", async () => {
    const model = await getAnthropicChatModel();
    expect(typeof model).toBe("string");
    expect(model.length).toBeGreaterThan(0);
  });
});
