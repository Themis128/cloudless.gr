import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockDynamoSend, getCalls, updateCalls } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
  getCalls: [] as unknown[],
  updateCalls: [] as unknown[],
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(function () {
    return { send: mockDynamoSend };
  }),
  GetItemCommand: vi.fn().mockImplementation(function (input: unknown) {
    getCalls.push(input);
    return { __cmd: "Get", input };
  }),
  UpdateItemCommand: vi.fn().mockImplementation(function (input: unknown) {
    updateCalls.push(input);
    return { __cmd: "Update", input };
  }),
}));

vi.mock("@/lib/stripe-transactions", () => ({
  resolveDynamoEndpoint: () => "http://localhost:8000",
}));

import { getUserProfile, putUserProfile } from "@/lib/user-profile";

describe("user-profile", () => {
  const originalTable = process.env.USER_PROFILE_TABLE;

  beforeEach(() => {
    mockDynamoSend.mockReset();
    getCalls.length = 0;
    updateCalls.length = 0;
    process.env.USER_PROFILE_TABLE = "test-user-profile-table";
  });

  afterEach(() => {
    if (originalTable === undefined) delete process.env.USER_PROFILE_TABLE;
    else process.env.USER_PROFILE_TABLE = originalTable;
  });

  describe("getUserProfile", () => {
    it("returns {} when DynamoDB returns no item", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      const r = await getUserProfile("user-1");
      expect(r).toEqual({});
    });

    it("maps stored String attributes back to fields", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: {
          name: { S: "Themis" },
          company: { S: "Cloudless" },
          phone: { S: "+30..." },
        },
      });
      const r = await getUserProfile("user-1");
      expect(r.name).toBe("Themis");
      expect(r.company).toBe("Cloudless");
      expect(r.phone).toBe("+30...");
    });

    it("parses JSON preferences out of the stored String", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: {
          preferences: { S: JSON.stringify({ theme: "dark", lang: "en" }) },
        },
      });
      const r = await getUserProfile("user-1");
      expect(r.preferences).toEqual({ theme: "dark", lang: "en" });
    });

    it("silently drops malformed JSON preferences (fallback to undefined)", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Item: { preferences: { S: "{not json" } },
      });
      const r = await getUserProfile("user-1");
      expect(r.preferences).toBeUndefined();
    });

    it("throws when USER_PROFILE_TABLE is unset", async () => {
      delete process.env.USER_PROFILE_TABLE;
      await expect(getUserProfile("user-1")).rejects.toThrow(/USER_PROFILE_TABLE/);
    });

    it("treats whitespace-only USER_PROFILE_TABLE as unset", async () => {
      process.env.USER_PROFILE_TABLE = "   ";
      await expect(getUserProfile("user-1")).rejects.toThrow(/USER_PROFILE_TABLE/);
    });
  });

  describe("putUserProfile", () => {
    it("does not call DynamoDB when no fields are provided", async () => {
      await putUserProfile("user-1", {});
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });

    it("builds a SET clause for provided string fields", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await putUserProfile("user-1", { name: "Themis", company: "Cloudless" });
      expect(updateCalls).toHaveLength(1);
      const input = updateCalls[0] as {
        UpdateExpression: string;
        ExpressionAttributeNames: Record<string, string>;
        ExpressionAttributeValues: Record<string, { S: string }>;
      };
      expect(input.UpdateExpression.startsWith("SET")).toBe(true);
      expect(input.UpdateExpression).toContain("#name = :name");
      expect(input.UpdateExpression).toContain("#company = :company");
      expect(input.ExpressionAttributeNames["#name"]).toBe("name");
      expect(input.ExpressionAttributeValues[":name"]).toEqual({ S: "Themis" });
    });

    it("converts empty-string fields to REMOVE clauses", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await putUserProfile("user-1", { name: "", phone: "" });
      const input = updateCalls[0] as { UpdateExpression: string };
      expect(input.UpdateExpression).toContain("REMOVE");
      expect(input.UpdateExpression).toContain("#name");
      expect(input.UpdateExpression).toContain("#phone");
    });

    it("combines SET and REMOVE in a single update", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await putUserProfile("user-1", { name: "Themis", phone: "" });
      const input = updateCalls[0] as { UpdateExpression: string };
      expect(input.UpdateExpression).toContain("SET");
      expect(input.UpdateExpression).toContain("REMOVE");
    });

    it("serializes preferences as JSON in a String attribute", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await putUserProfile("user-1", { preferences: { theme: "dark" } });
      const input = updateCalls[0] as {
        ExpressionAttributeValues: Record<string, { S: string }>;
      };
      expect(JSON.parse(input.ExpressionAttributeValues[":preferences"].S)).toEqual({
        theme: "dark",
      });
    });

    it("skips ExpressionAttributeValues when only REMOVE is needed", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await putUserProfile("user-1", { name: "" });
      const input = updateCalls[0] as {
        UpdateExpression: string;
        ExpressionAttributeValues?: Record<string, unknown>;
      };
      expect(input.UpdateExpression).toContain("REMOVE");
      expect(input.UpdateExpression).not.toContain("SET");
      expect(input.ExpressionAttributeValues).toBeUndefined();
    });
  });
});
