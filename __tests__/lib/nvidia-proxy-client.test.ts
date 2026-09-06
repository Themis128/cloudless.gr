import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  delete process.env.NVIDIA_PROXY_URL;
  delete process.env.NVIDIA_PROXY_TOKEN;
});

import { isNvidiaProxyConfigured } from "@/lib/nvidia-proxy-client";

describe("isNvidiaProxyConfigured", () => {
  it("returns false when env vars are not set", () => {
    expect(isNvidiaProxyConfigured()).toBe(false);
  });

  it("returns true when both NVIDIA_PROXY_URL and NVIDIA_PROXY_TOKEN are set", () => {
    process.env.NVIDIA_PROXY_URL = "https://proxy.example.com";
    process.env.NVIDIA_PROXY_TOKEN = "token123";
    expect(isNvidiaProxyConfigured()).toBe(true);
  });
});
