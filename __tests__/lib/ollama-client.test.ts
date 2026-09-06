import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  delete process.env.OLLAMA_BASE_URL;
});

import { isOllamaConfigured } from "@/lib/ollama-client";

describe("isOllamaConfigured", () => {
  it("returns false when OLLAMA_BASE_URL is not set", () => {
    expect(isOllamaConfigured()).toBe(false);
  });

  it("returns true when OLLAMA_BASE_URL is set", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    expect(isOllamaConfigured()).toBe(true);
  });
});
