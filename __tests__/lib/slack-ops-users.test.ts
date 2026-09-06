import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetConfig } = vi.hoisted(() => ({ mockGetConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

import {
  getSlackOpsUsers,
  getSlackOpsUsersSync,
  resetSlackOpsUsersCache,
  isSlackOpsUser,
} from "@/lib/slack-ops-users";

const ENV_KEY = "SLACK_OPS_USERS";

beforeEach(() => {
  resetSlackOpsUsersCache();
  delete process.env[ENV_KEY];
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("getSlackOpsUsersSync", () => {
  it("returns empty array when env var is not set", () => {
    expect(getSlackOpsUsersSync()).toEqual([]);
  });

  it("parses comma-separated user IDs from env", () => {
    process.env[ENV_KEY] = "U001,U002, U003";
    expect(getSlackOpsUsersSync()).toEqual(["U001", "U002", "U003"]);
  });
});

describe("getSlackOpsUsers (env path)", () => {
  it("returns empty array when no env and SSM returns empty", async () => {
    mockGetConfig.mockResolvedValue({});
    const result = await getSlackOpsUsers();
    expect(result).toEqual([]);
  });

  it("returns env list when SLACK_OPS_USERS is set", async () => {
    process.env[ENV_KEY] = "U001,U002";
    const result = await getSlackOpsUsers();
    expect(result).toEqual(["U001", "U002"]);
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it("falls back to SSM SLACK_OPS_USERS when env is empty", async () => {
    mockGetConfig.mockResolvedValue({ SLACK_OPS_USERS: "U010,U011" });
    const result = await getSlackOpsUsers();
    expect(result).toEqual(["U010", "U011"]);
  });

  it("falls back to SSM SLACK_OPS_USER_ID when plural key is missing", async () => {
    mockGetConfig.mockResolvedValue({ SLACK_OPS_USER_ID: "U099" });
    const result = await getSlackOpsUsers();
    expect(result).toEqual(["U099"]);
  });

  it("returns [] and does not throw when SSM lookup fails", async () => {
    mockGetConfig.mockRejectedValue(new Error("SSM error"));
    const result = await getSlackOpsUsers();
    expect(result).toEqual([]);
  });
});

describe("isSlackOpsUser", () => {
  it("returns true for any user when the list is empty (open workspace)", async () => {
    mockGetConfig.mockResolvedValue({});
    expect(await isSlackOpsUser("U999")).toBe(true);
  });

  it("returns true when userId is in the list", async () => {
    process.env[ENV_KEY] = "U001,U002";
    expect(await isSlackOpsUser("U001")).toBe(true);
  });

  it("returns false when userId is not in the list", async () => {
    process.env[ENV_KEY] = "U001,U002";
    expect(await isSlackOpsUser("U999")).toBe(false);
  });
});
