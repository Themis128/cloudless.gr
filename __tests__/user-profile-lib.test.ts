/**
 * src/lib/user-profile.ts — DynamoDB-backed profile store.
 *
 * Mocks the DynamoDB client `send` and asserts the command shapes:
 *   - getUserProfile maps the item back, parsing preferences JSON
 *   - putUserProfile builds a partial SET/REMOVE UpdateItem (name is a reserved
 *     word → expression attribute names), and is a no-op when nothing changes
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-dynamodb", () => {
  class Cmd {
    input: Record<string, unknown>;
    _t = "Base";
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  const mk = (t: string) =>
    class extends Cmd {
      _t = t;
    };
  return {
    DynamoDBClient: class {
      send = sendMock;
    },
    GetItemCommand: mk("GetItem"),
    UpdateItemCommand: mk("UpdateItem"),
  };
});

// resolveDynamoEndpoint is imported from stripe-transactions; stub it cheaply.
vi.mock("@/lib/stripe-transactions", () => ({ resolveDynamoEndpoint: () => undefined }));

beforeEach(() => {
  sendMock.mockReset();
  process.env.USER_PROFILE_TABLE = "cloudless-user-profile";
});

describe("getUserProfile", () => {
  it("maps a stored item and parses preferences JSON", async () => {
    sendMock.mockResolvedValue({
      Item: {
        userId: { S: "sub-1" },
        name: { S: "Stored Name" },
        company: { S: "cloudless.gr" },
        phone: { S: "+30123" },
        preferences: { S: JSON.stringify({ theme: "light" }) },
      },
    });
    const { getUserProfile } = await import("@/lib/user-profile");
    const p = await getUserProfile("sub-1");
    expect(p).toEqual({
      name: "Stored Name",
      company: "cloudless.gr",
      phone: "+30123",
      preferences: { theme: "light" },
    });
    const call = sendMock.mock.calls[0][0];
    expect(call._t).toBe("GetItem");
    expect(call.input.Key).toEqual({ userId: { S: "sub-1" } });
  });

  it("returns {} when no record exists", async () => {
    sendMock.mockResolvedValue({});
    const { getUserProfile } = await import("@/lib/user-profile");
    expect(await getUserProfile("sub-x")).toEqual({});
  });

  it("ignores malformed stored preferences", async () => {
    sendMock.mockResolvedValue({ Item: { name: { S: "A" }, preferences: { S: "{not-json" } } });
    const { getUserProfile } = await import("@/lib/user-profile");
    const p = await getUserProfile("sub-1");
    expect(p.name).toBe("A");
    expect(p.preferences).toBeUndefined();
  });
});

describe("putUserProfile", () => {
  it("builds a SET UpdateItem with expression attribute names", async () => {
    sendMock.mockResolvedValue({});
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { name: "N", company: "C", phone: "+30" });

    const call = sendMock.mock.calls[0][0];
    expect(call._t).toBe("UpdateItem");
    expect(call.input.Key).toEqual({ userId: { S: "sub-1" } });
    expect(call.input.UpdateExpression).toContain("SET");
    expect(call.input.ExpressionAttributeNames).toMatchObject({
      "#name": "name",
      "#company": "company",
      "#phone": "phone",
    });
    expect(call.input.ExpressionAttributeValues).toMatchObject({
      ":name": { S: "N" },
      ":company": { S: "C" },
      ":phone": { S: "+30" },
    });
  });

  it("serializes preferences to a JSON string", async () => {
    sendMock.mockResolvedValue({});
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { preferences: { theme: "dark", language: "en" } });
    const call = sendMock.mock.calls[0][0];
    expect(call.input.ExpressionAttributeValues[":preferences"].S).toBe(
      JSON.stringify({ theme: "dark", language: "en" })
    );
  });

  it("REMOVEs a field cleared with an empty string", async () => {
    sendMock.mockResolvedValue({});
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", { phone: "" });
    const call = sendMock.mock.calls[0][0];
    expect(call.input.UpdateExpression).toContain("REMOVE #phone");
  });

  it("is a no-op when no fields are provided (no Dynamo call)", async () => {
    const { putUserProfile } = await import("@/lib/user-profile");
    await putUserProfile("sub-1", {});
    expect(sendMock).not.toHaveBeenCalled();
  });
});
