import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { mockDynamoSend, putCalls, queryCalls, updateCalls, batchWriteCalls } = vi.hoisted(() => ({
  mockDynamoSend: vi.fn(),
  putCalls: [] as unknown[],
  queryCalls: [] as unknown[],
  updateCalls: [] as unknown[],
  batchWriteCalls: [] as unknown[],
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(function () {
    return { send: mockDynamoSend };
  }),
  PutItemCommand: vi.fn().mockImplementation(function (input: unknown) {
    putCalls.push(input);
    return { __cmd: "Put", input };
  }),
  QueryCommand: vi.fn().mockImplementation(function (input: unknown) {
    queryCalls.push(input);
    return { __cmd: "Query", input };
  }),
  UpdateItemCommand: vi.fn().mockImplementation(function (input: unknown) {
    updateCalls.push(input);
    return { __cmd: "Update", input };
  }),
  BatchWriteItemCommand: vi.fn().mockImplementation(function (input: unknown) {
    batchWriteCalls.push(input);
    return { __cmd: "BatchWrite", input };
  }),
}));

vi.mock("@/lib/stripe-transactions", () => ({
  resolveDynamoEndpoint: () => "http://localhost:8000",
}));

import {
  recordNotification,
  listNotifications,
  markNotificationsRead,
  notificationAnalytics,
  purgeArchivedOlderThan,
} from "@/lib/admin-notifications";

describe("admin-notifications", () => {
  const originalTable = process.env.ADMIN_NOTIFICATIONS_TABLE;

  beforeEach(() => {
    mockDynamoSend.mockReset();
    putCalls.length = 0;
    queryCalls.length = 0;
    updateCalls.length = 0;
    batchWriteCalls.length = 0;
    process.env.ADMIN_NOTIFICATIONS_TABLE = "test-notifs";
  });

  afterEach(() => {
    if (originalTable === undefined) delete process.env.ADMIN_NOTIFICATIONS_TABLE;
    else process.env.ADMIN_NOTIFICATIONS_TABLE = originalTable;
  });

  describe("recordNotification", () => {
    it("returns null when ADMIN_NOTIFICATIONS_TABLE is not set (safe no-op)", async () => {
      delete process.env.ADMIN_NOTIFICATIONS_TABLE;
      const r = await recordNotification({
        category: "contact",
        title: "T",
        message: "M",
      });
      // Lake-only mode: returns the notification (written to S3) but skips DynamoDB.
      expect(r).not.toBeNull();
      expect(r!.title).toBe("T");
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });

    it("writes a row with the documented shape on success", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      const r = await recordNotification({
        category: "contact",
        title: "New contact",
        message: "Themis says hi",
        actor: "t@x",
        route: "/api/contact",
        metadata: { ua: "curl" },
      });
      expect(r).not.toBeNull();
      expect(putCalls).toHaveLength(1);
      const input = putCalls[0] as {
        TableName: string;
        Item: Record<string, { S?: string; BOOL?: boolean }>;
      };
      expect(input.TableName).toBe("test-notifs");
      expect(input.Item.pk.S).toBe("NOTIF");
      expect(input.Item.catPk.S).toBe("CAT#contact");
      expect(input.Item.category.S).toBe("contact");
      expect(input.Item.title.S).toBe("New contact");
      expect(input.Item.message.S).toBe("Themis says hi");
      expect(input.Item.actor.S).toBe("t@x");
      expect(input.Item.route.S).toBe("/api/contact");
      expect(input.Item.read.BOOL).toBe(false);
      expect(JSON.parse(input.Item.metadata.S ?? "{}")).toEqual({ ua: "curl" });
    });

    it("defaults type to 'info' when not provided", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await recordNotification({ category: "subscribe", title: "T", message: "M" });
      const input = putCalls[0] as { Item: Record<string, { S?: string }> };
      expect(input.Item.type.S).toBe("info");
    });

    it("omits optional fields when not provided", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await recordNotification({ category: "order", title: "T", message: "M" });
      const input = putCalls[0] as { Item: Record<string, unknown> };
      expect(input.Item.actor).toBeUndefined();
      expect(input.Item.route).toBeUndefined();
      expect(input.Item.metadata).toBeUndefined();
    });

    it("returns null when Dynamo throws (producer paths must not crash)", async () => {
      mockDynamoSend.mockRejectedValueOnce(new Error("ThrottlingException"));
      const r = await recordNotification({ category: "error", title: "T", message: "M" });
      expect(r).toBeNull();
    });

    it("generates unique ids across calls", async () => {
      mockDynamoSend.mockResolvedValue({});
      const a = await recordNotification({ category: "auth", title: "T", message: "M" });
      const b = await recordNotification({ category: "auth", title: "T", message: "M" });
      expect(a?.id).not.toBe(b?.id);
    });

    it("encodes the sort key as <createdAt>#<id>", async () => {
      mockDynamoSend.mockResolvedValueOnce({});
      await recordNotification({ category: "portal", title: "T", message: "M" });
      const input = putCalls[0] as { Item: Record<string, { S?: string }> };
      const sk = input.Item.sk.S ?? "";
      const createdAt = input.Item.createdAt.S ?? "";
      expect(sk.startsWith(createdAt + "#")).toBe(true);
    });
  });

  describe("listNotifications", () => {
    it("queries the main partition newest-first by default", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications();
      const q = queryCalls[0] as {
        IndexName?: string;
        ScanIndexForward: boolean;
        Limit: number;
        ExpressionAttributeValues: Record<string, { S: string }>;
      };
      expect(q.IndexName).toBeUndefined();
      expect(q.ScanIndexForward).toBe(false);
      expect(q.Limit).toBe(50);
      expect(q.ExpressionAttributeValues[":pk"].S).toBe("NOTIF");
    });

    it("uses the category GSI when category filter is set", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications({ category: "order" });
      const q = queryCalls[0] as {
        IndexName?: string;
        ExpressionAttributeValues: Record<string, { S: string }>;
      };
      expect(q.IndexName).toBe("categoryIndex");
      expect(q.ExpressionAttributeValues[":cpk"].S).toBe("CAT#order");
    });

    it("clamps limit to the 1–200 range", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications({ limit: 5000 });
      expect((queryCalls[0] as { Limit: number }).Limit).toBe(200);

      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications({ limit: -10 });
      expect((queryCalls[1] as { Limit: number }).Limit).toBe(1);
    });

    it("filters out archived rows by default", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications();
      const q = queryCalls[0] as { FilterExpression?: string };
      expect(q.FilterExpression).toContain("attribute_not_exists(#archivedAt)");
    });

    it("includes archived rows when includeArchived=true", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await listNotifications({ includeArchived: true });
      const q = queryCalls[0] as { FilterExpression?: string };
      expect(q.FilterExpression).toBeUndefined();
    });

    it("maps Dynamo items back into AdminNotification shape", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          {
            id: { S: "n_1" },
            createdAt: { S: "2026-06-12T10:00:00Z" },
            category: { S: "contact" },
            type: { S: "info" },
            title: { S: "T" },
            message: { S: "M" },
            actor: { S: "a@b" },
            route: { S: "/r" },
            metadata: { S: '{"x":1}' },
            read: { BOOL: false },
          },
        ],
      });
      const r = await listNotifications();
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({
        id: "n_1",
        category: "contact",
        title: "T",
        actor: "a@b",
        route: "/r",
        metadata: { x: 1 },
      });
    });

    it("drops malformed metadata JSON silently", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          {
            id: { S: "n_1" },
            createdAt: { S: "2026-06-12T10:00:00Z" },
            category: { S: "contact" },
            type: { S: "info" },
            title: { S: "T" },
            message: { S: "M" },
            metadata: { S: "{not json" },
            read: { BOOL: false },
          },
        ],
      });
      const r = await listNotifications();
      expect(r[0].metadata).toBeUndefined();
    });
  });

  describe("markNotificationsRead", () => {
    it("is a no-op when ids array is empty", async () => {
      await markNotificationsRead([]);
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });

    it("looks up each row then updates its read flag", async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Items: [{ pk: { S: "NOTIF" }, sk: { S: "2026#n_1" } }],
        })
        .mockResolvedValueOnce({}); // UpdateItem
      await markNotificationsRead(["n_1"]);
      expect(queryCalls).toHaveLength(1);
      expect(updateCalls).toHaveLength(1);
      const u = updateCalls[0] as {
        UpdateExpression: string;
        ExpressionAttributeValues: Record<string, { BOOL?: boolean }>;
      };
      expect(u.UpdateExpression).toContain("SET");
      expect(u.ExpressionAttributeValues[":true"].BOOL).toBe(true);
    });

    it("skips ids that don't exist (Items empty)", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      await markNotificationsRead(["missing"]);
      expect(updateCalls).toHaveLength(0);
    });
  });

  describe("notificationAnalytics", () => {
    it("returns zero counts when no rows", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      const r = await notificationAnalytics({ since: "2026-06-01" });
      expect(r.total).toBe(0);
      expect(r.byCategory.contact).toBe(0);
      expect(r.byCategory.order).toBe(0);
      expect(r.byDay).toEqual({});
    });

    it("counts by category and by day", async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          {
            id: { S: "1" },
            createdAt: { S: "2026-06-12T10:00:00Z" },
            category: { S: "contact" },
            type: { S: "info" },
            title: { S: "T" },
            message: { S: "M" },
            read: { BOOL: false },
          },
          {
            id: { S: "2" },
            createdAt: { S: "2026-06-12T11:00:00Z" },
            category: { S: "order" },
            type: { S: "success" },
            title: { S: "T" },
            message: { S: "M" },
            read: { BOOL: false },
          },
          {
            id: { S: "3" },
            createdAt: { S: "2026-06-11T10:00:00Z" },
            category: { S: "contact" },
            type: { S: "info" },
            title: { S: "T" },
            message: { S: "M" },
            read: { BOOL: false },
          },
        ],
      });
      const r = await notificationAnalytics({ since: "2026-06-01" });
      expect(r.total).toBe(3);
      expect(r.byCategory.contact).toBe(2);
      expect(r.byCategory.order).toBe(1);
      expect(r.byDay["2026-06-12"]).toBe(2);
      expect(r.byDay["2026-06-11"]).toBe(1);
    });
  });

  describe("purgeArchivedOlderThan", () => {
    it("returns 0 when no archived rows match", async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });
      const n = await purgeArchivedOlderThan("2026-01-01");
      expect(n).toBe(0);
      expect(batchWriteCalls).toHaveLength(0);
    });

    it("batches deletes for matched archived rows", async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Items: [
            { pk: { S: "NOTIF" }, sk: { S: "2025#a" } },
            { pk: { S: "NOTIF" }, sk: { S: "2025#b" } },
          ],
        })
        .mockResolvedValueOnce({}); // BatchWrite
      const n = await purgeArchivedOlderThan("2026-01-01");
      expect(n).toBe(2);
      expect(batchWriteCalls).toHaveLength(1);
      const bw = batchWriteCalls[0] as {
        RequestItems: Record<string, Array<{ DeleteRequest: { Key: unknown } }>>;
      };
      expect(bw.RequestItems["test-notifs"]).toHaveLength(2);
    });

    it("walks LastEvaluatedKey across multiple pages", async () => {
      mockDynamoSend
        .mockResolvedValueOnce({
          Items: [{ pk: { S: "NOTIF" }, sk: { S: "2025#a" } }],
          LastEvaluatedKey: { pk: { S: "NOTIF" }, sk: { S: "2025#a" } },
        })
        .mockResolvedValueOnce({}) // BatchWrite 1
        .mockResolvedValueOnce({
          Items: [{ pk: { S: "NOTIF" }, sk: { S: "2025#b" } }],
        })
        .mockResolvedValueOnce({}); // BatchWrite 2
      const n = await purgeArchivedOlderThan("2026-01-01");
      expect(n).toBe(2);
      expect(batchWriteCalls).toHaveLength(2);
    });
  });
});
