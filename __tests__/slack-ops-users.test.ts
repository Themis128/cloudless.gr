import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
}));

vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => getConfigMock(),
}));

import {
  getSlackOpsUsers,
  getSlackOpsUsersSync,
  isSlackOpsUser,
  resetSlackOpsUsersCache,
} from "@/lib/slack-ops-users";

const ENV_KEY = "SLACK_OPS_USERS";

describe("slack-ops-users", () => {
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
    getConfigMock.mockReset();
    resetSlackOpsUsersCache();
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = origEnv;
  });

  describe("getSlackOpsUsersSync", () => {
    it("returns [] when env var is unset", () => {
      expect(getSlackOpsUsersSync()).toEqual([]);
    });

    it("parses comma-separated env var", () => {
      process.env[ENV_KEY] = "U01ABC,U02DEF , U03GHI";
      expect(getSlackOpsUsersSync()).toEqual(["U01ABC", "U02DEF", "U03GHI"]);
    });

    it("filters empty entries from a trailing comma", () => {
      process.env[ENV_KEY] = "U01ABC,,U02DEF,";
      expect(getSlackOpsUsersSync()).toEqual(["U01ABC", "U02DEF"]);
    });
  });

  describe("getSlackOpsUsers (async)", () => {
    it("prefers env over SSM when env is set", async () => {
      process.env[ENV_KEY] = "U01ENV";
      getConfigMock.mockResolvedValue({ SLACK_OPS_USERS: "U99SSM" });
      const list = await getSlackOpsUsers();
      expect(list).toEqual(["U01ENV"]);
      // SSM not consulted because env was already populated
      expect(getConfigMock).not.toHaveBeenCalled();
    });

    it("falls back to SSM when env is unset", async () => {
      getConfigMock.mockResolvedValue({ SLACK_OPS_USERS: "U01SSM,U02SSM" });
      const list = await getSlackOpsUsers();
      expect(list).toEqual(["U01SSM", "U02SSM"]);
      expect(getConfigMock).toHaveBeenCalledOnce();
    });

    it("returns [] when neither env nor SSM is set", async () => {
      getConfigMock.mockResolvedValue({});
      const list = await getSlackOpsUsers();
      expect(list).toEqual([]);
    });

    it("falls back to SLACK_OPS_USER_ID (singular) when SLACK_OPS_USERS is empty", async () => {
      getConfigMock.mockResolvedValue({ SLACK_OPS_USERS: "", SLACK_OPS_USER_ID: "U09AF5VU7LY" });
      const list = await getSlackOpsUsers();
      expect(list).toEqual(["U09AF5VU7LY"]);
    });

    it("prefers SLACK_OPS_USERS (plural) over SLACK_OPS_USER_ID when both set", async () => {
      getConfigMock.mockResolvedValue({
        SLACK_OPS_USERS: "U01NEW,U02NEW",
        SLACK_OPS_USER_ID: "U99OLD",
      });
      const list = await getSlackOpsUsers();
      expect(list).toEqual(["U01NEW", "U02NEW"]);
    });

    it("returns [] and warns when SSM lookup throws", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      getConfigMock.mockRejectedValue(new Error("ssm down"));
      const list = await getSlackOpsUsers();
      expect(list).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it("caches results across calls (env path)", async () => {
      process.env[ENV_KEY] = "U01CACHED";
      const a = await getSlackOpsUsers();
      const b = await getSlackOpsUsers();
      expect(a).toBe(b);
    });
  });

  describe("isSlackOpsUser", () => {
    it("returns true for everyone when list is empty (open semantics)", async () => {
      getConfigMock.mockResolvedValue({});
      expect(await isSlackOpsUser("U_RANDOM")).toBe(true);
    });

    it("returns true when user is in the list", async () => {
      process.env[ENV_KEY] = "U01ABC,U02DEF";
      expect(await isSlackOpsUser("U02DEF")).toBe(true);
    });

    it("returns false when user is not in the list", async () => {
      process.env[ENV_KEY] = "U01ABC,U02DEF";
      expect(await isSlackOpsUser("U99XYZ")).toBe(false);
    });
  });
});
