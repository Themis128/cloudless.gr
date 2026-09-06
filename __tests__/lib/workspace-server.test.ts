import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadJson, mockWriteJson } = vi.hoisted(() => ({
  mockReadJson: vi.fn(),
  mockWriteJson: vi.fn(),
}));

vi.mock("@/lib/app-config-json", () => ({
  readJsonConfig: mockReadJson,
  writeJsonConfig: mockWriteJson,
}));

vi.mock("@/lib/api-auth", () => ({
  isAdmin: vi.fn().mockReturnValue(false),
  requireAuth: vi.fn().mockResolvedValue({ ok: false, response: {} }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}));

import {
  WORKSPACE_COOKIE,
  WORKSPACES_CONFIG_KEY,
  SSM_KEY,
  resetWorkspaceCache,
  readWorkspaces,
  writeWorkspaces,
  type Workspace,
} from "@/lib/workspace-server";

const sampleWorkspace: Workspace = {
  id: "ws-1",
  name: "Test Workspace",
  slug: "test",
  description: "A workspace",
  adminEmails: ["admin@test.com"],
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  resetWorkspaceCache();
  mockReadJson.mockReset();
  mockWriteJson.mockReset();
});

describe("constants", () => {
  it("WORKSPACE_COOKIE is a non-empty string", () => {
    expect(typeof WORKSPACE_COOKIE).toBe("string");
    expect(WORKSPACE_COOKIE.length).toBeGreaterThan(0);
  });

  it("WORKSPACES_CONFIG_KEY is the primary key", () => {
    expect(typeof WORKSPACES_CONFIG_KEY).toBe("string");
  });

  it("SSM_KEY is an alias for WORKSPACES_CONFIG_KEY", () => {
    expect(SSM_KEY).toBe(WORKSPACES_CONFIG_KEY);
  });
});

describe("readWorkspaces", () => {
  it("returns empty array when no config", async () => {
    mockReadJson.mockResolvedValue(null);
    const result = await readWorkspaces();
    expect(result).toEqual([]);
  });

  it("returns workspaces from config", async () => {
    mockReadJson.mockResolvedValue([sampleWorkspace]);
    const result = await readWorkspaces();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ws-1");
  });

  it("uses cache on second call", async () => {
    mockReadJson.mockResolvedValue([sampleWorkspace]);
    await readWorkspaces();
    await readWorkspaces();
    expect(mockReadJson).toHaveBeenCalledTimes(1);
  });
});

describe("writeWorkspaces", () => {
  it("calls writeJsonConfig and updates cache", async () => {
    mockWriteJson.mockResolvedValue(undefined);
    await writeWorkspaces([sampleWorkspace]);
    expect(mockWriteJson).toHaveBeenCalledWith(
      WORKSPACES_CONFIG_KEY,
      [sampleWorkspace],
      expect.any(String)
    );
  });
});

describe("resetWorkspaceCache", () => {
  it("forces a re-read on next readWorkspaces call", async () => {
    mockReadJson.mockResolvedValue([sampleWorkspace]);
    await readWorkspaces();
    resetWorkspaceCache();
    await readWorkspaces();
    expect(mockReadJson).toHaveBeenCalledTimes(2);
  });
});
