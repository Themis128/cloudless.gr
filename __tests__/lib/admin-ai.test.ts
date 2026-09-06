import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: vi.fn().mockReturnValue(false),
  callWorkersAiChat: vi.fn(),
}));
vi.mock("@/lib/nvidia-proxy-client", () => ({
  isNvidiaProxyConfigured: vi.fn().mockReturnValue(false),
  callNvidiaProxyChat: vi.fn(),
}));
vi.mock("@/lib/ollama-client", () => ({
  isOllamaConfigured: vi.fn().mockReturnValue(false),
  callOllamaChat: vi.fn(),
}));
vi.mock("@/lib/gemini-admin", () => ({
  getGeminiApiKey: vi.fn().mockResolvedValue(null),
  callGemini: vi.fn(),
}));

import { isAdminAiConfigured, isAdminAiConfiguredAsync, adminAiNotConfiguredResponse } from "@/lib/admin-ai";

describe("isAdminAiConfigured", () => {
  it("returns false when no AI backends are configured", () => {
    expect(isAdminAiConfigured()).toBe(false);
  });
});

describe("isAdminAiConfiguredAsync", () => {
  it("returns false when no AI backends are configured", async () => {
    expect(await isAdminAiConfiguredAsync()).toBe(false);
  });
});

describe("adminAiNotConfiguredResponse", () => {
  it("returns a Response with 503 status", () => {
    const res = adminAiNotConfiguredResponse();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(503);
  });
});
