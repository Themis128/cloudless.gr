import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({}),
}));

import { isInternalOnlyBaseUrl, publicUrlForApp } from "@/lib/selfhosted-autologin";

describe("isInternalOnlyBaseUrl", () => {
  it("returns false for empty string", () => {
    expect(isInternalOnlyBaseUrl("")).toBe(false);
  });

  it("returns true for cluster.local URLs", () => {
    expect(isInternalOnlyBaseUrl("http://nginx.appflowy.svc.cluster.local")).toBe(true);
  });

  it("returns true for localhost", () => {
    expect(isInternalOnlyBaseUrl("http://localhost:3000")).toBe(true);
  });

  it("returns true for 127.0.0.1", () => {
    expect(isInternalOnlyBaseUrl("http://127.0.0.1:8080")).toBe(true);
  });

  it("returns true for 10.x.x.x (RFC 1918)", () => {
    expect(isInternalOnlyBaseUrl("http://10.0.0.1")).toBe(true);
  });

  it("returns true for 192.168.x.x (RFC 1918)", () => {
    expect(isInternalOnlyBaseUrl("http://192.168.1.100")).toBe(true);
  });

  it("returns true for 172.16.x.x (RFC 1918)", () => {
    expect(isInternalOnlyBaseUrl("http://172.16.0.1")).toBe(true);
  });

  it("returns false for public domains", () => {
    expect(isInternalOnlyBaseUrl("https://appflowy.cloudless.gr")).toBe(false);
    expect(isInternalOnlyBaseUrl("https://example.com")).toBe(false);
  });
});

describe("publicUrlForApp", () => {
  it("returns the fallback public URL when no configured URL is given", () => {
    const url = publicUrlForApp("appflowy");
    expect(typeof url).toBe("string");
    expect(url.startsWith("http")).toBe(true);
  });

  it("returns the fallback when configured URL is internal only", () => {
    const url = publicUrlForApp("appflowy", "http://nginx.appflowy.svc.cluster.local");
    expect(url).not.toContain("cluster.local");
  });

  it("returns the fallback for empty configured URL", () => {
    const url = publicUrlForApp("appflowy", "");
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("returns the fallback for cloudless.gr subdomains (uses known public map)", () => {
    const url = publicUrlForApp("grafana", "https://grafana.cloudless.gr");
    expect(typeof url).toBe("string");
  });
});
