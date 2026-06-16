import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the entire DynamoDB module at the lowest level
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-dynamodb", () => ({
  // When a constructor returns an object, `new` uses that object as the instance.
  // This ensures `dynamoClient.send === mockSend` at module level.
  DynamoDBClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  GetItemCommand: vi.fn(),
  PutItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn(),
  QueryCommand: vi.fn(),
  ScanCommand: vi.fn(),
}));

vi.mock("@aws-sdk/util-dynamodb", () => ({
  marshall: vi.fn((v: unknown) => v),
  unmarshall: vi.fn((v: Record<string, unknown>) => v),
}));

import {
  PLAN_LABELS,
  readPendingClients,
  writePendingClients,
  upsertPendingClient,
  findPendingByEmail,
  approvePendingClient,
} from "@/lib/pending-clients";

/** Build a ConditionalCheckFailedException that passes `err instanceof Error` */
function ccf(): Error {
  const e = new Error("The conditional request failed");
  e.name = "ConditionalCheckFailedException";
  return e;
}

const sampleClients = [
  {
    email: "alice@example.com",
    type: "pending" as const,
    name: "Alice",
    plan: "cloud",
    planLabel: "Cloud Architecture & Migration",
    submittedAt: "2026-01-01T00:00:00.000Z",
    status: "waiting" as const,
    version: 1,
  },
  {
    email: "bob@example.com",
    type: "pending" as const,
    plan: "serverless",
    planLabel: "Serverless Development",
    submittedAt: "2026-01-02T00:00:00.000Z",
    status: "approved" as const,
    portalToken: "tok_bob",
    approvedAt: "2026-01-03T00:00:00.000Z",
    version: 1,
  },
];

describe("PLAN_LABELS", () => {
  it("contains expected plan keys", () => {
    expect(PLAN_LABELS.cloud).toBeDefined();
    expect(PLAN_LABELS.serverless).toBeDefined();
    expect(PLAN_LABELS.bundle).toBeDefined();
  });

  it("all labels are non-empty strings", () => {
    for (const label of Object.values(PLAN_LABELS)) {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("readPendingClients()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed clients from DynamoDB query", async () => {
    mockSend.mockResolvedValue({ Items: sampleClients });
    const result = await readPendingClients();
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("alice@example.com");
  });

  it("returns empty array when query returns no items", async () => {
    mockSend.mockResolvedValue({ Items: [] });
    expect(await readPendingClients()).toEqual([]);
  });

  it("returns empty array when both query and scan throw", async () => {
    mockSend.mockRejectedValue(new Error("DynamoDB error"));
    expect(await readPendingClients()).toEqual([]);
  });
});

describe("writePendingClients()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls PutItem for each client; falls back to UpdateItem on collision", async () => {
    // alice: PutItem succeeds
    // bob: PutItem fails ConditionalCheckFailed → UpdateItem
    mockSend
      .mockResolvedValueOnce({}) // PutItem alice
      .mockRejectedValueOnce(ccf()) // PutItem bob
      .mockResolvedValueOnce({}); // UpdateItem bob
    await writePendingClients(sampleClients);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});

describe("upsertPendingClient()", () => {
  beforeEach(() => mockSend.mockReset());

  it("creates a new client when email does not exist", async () => {
    mockSend.mockResolvedValueOnce({});
    const r = await upsertPendingClient({ email: "new@example.com", plan: "cloud" });
    expect(r.email).toBe("new@example.com");
    expect(r.status).toBe("waiting");
    expect(r.planLabel).toBe(PLAN_LABELS.cloud);
  });

  it("returns existing approved record unchanged", async () => {
    mockSend.mockRejectedValueOnce(ccf()).mockRejectedValueOnce(ccf());
    const r = await upsertPendingClient({ email: "approved@example.com", plan: "cloud" });
    expect(r.email).toBe("approved@example.com");
  });

  it("updates plan for a waiting client", async () => {
    mockSend
      .mockRejectedValueOnce(ccf())
      .mockResolvedValueOnce({
        Attributes: {
          email: "waiting@example.com",
          plan: "serverless",
          planLabel: PLAN_LABELS.serverless,
          submittedAt: "2026-01-01T00:00:00.000Z",
          status: "waiting",
          version: 2,
        },
      });
    const r = await upsertPendingClient({ email: "waiting@example.com", plan: "serverless" });
    expect(r.plan).toBe("serverless");
    expect(r.planLabel).toBe(PLAN_LABELS.serverless);
  });

  it("uses provided planLabel when given", async () => {
    mockSend.mockResolvedValueOnce({});
    const r = await upsertPendingClient({
      email: "custom@example.com",
      plan: "custom",
      planLabel: "Custom Plan",
    });
    expect(r.planLabel).toBe("Custom Plan");
  });
});

describe("findPendingByEmail()", () => {
  beforeEach(() => mockSend.mockReset());

  it("returns the matching client (case-insensitive)", async () => {
    mockSend.mockResolvedValue({
      Item: { email: "alice@example.com", type: "pending", plan: "cloud", status: "waiting" },
    });
    const r = await findPendingByEmail("ALICE@EXAMPLE.COM");
    expect(r?.email).toBe("alice@example.com");
  });

  it("returns null when no client matches", async () => {
    mockSend.mockResolvedValue({ Item: undefined });
    expect(await findPendingByEmail("nobody@example.com")).toBeNull();
  });

  it("returns null when item type is not pending", async () => {
    mockSend.mockResolvedValue({
      Item: { email: "x@y.com", type: "portal", plan: "cloud", status: "approved" },
    });
    expect(await findPendingByEmail("x@y.com")).toBeNull();
  });
});

describe("approvePendingClient()", () => {
  beforeEach(() => mockSend.mockReset());

  it("sets status to approved and stores portalToken", async () => {
    mockSend.mockResolvedValueOnce({
      Attributes: {
        email: "client@example.com",
        plan: "cloud",
        planLabel: "Cloud Architecture & Migration",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "approved",
        portalToken: "tok_newportal",
        approvedAt: "2026-01-15T00:00:00.000Z",
        version: 2,
      },
    });
    const r = await approvePendingClient("client@example.com", "tok_newportal");
    expect(r?.status).toBe("approved");
    expect(r?.portalToken).toBe("tok_newportal");
    expect(r?.approvedAt).toBeDefined();
  });

  it("returns null when client does not exist", async () => {
    mockSend.mockRejectedValue(ccf());
    const r = await approvePendingClient("nobody@example.com", "tok_x");
    expect(r).toBeNull();
  });
});