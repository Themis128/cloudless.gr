import { describe, it, expect, vi, beforeEach } from "vitest";

// SSMClient is instantiated at module level in pending-clients.ts, so mockSend
// must be hoisted to be available when the vi.mock factory executes at module init.
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(function (this: { send: typeof mockSend }) {
    this.send = mockSend;
  }),
  GetParameterCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
  PutParameterCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

// Static import — works with the module-level ssmClient singleton
import {
  PLAN_LABELS,
  readPendingClients,
  writePendingClients,
  upsertPendingClient,
  findPendingByEmail,
  approvePendingClient,
} from "@/lib/pending-clients";

const sampleClients = [
  {
    email: "alice@example.com",
    name: "Alice",
    plan: "cloud",
    planLabel: "Cloud Architecture & Migration",
    submittedAt: "2026-01-01T00:00:00.000Z",
    status: "waiting" as const,
  },
  {
    email: "bob@example.com",
    plan: "serverless",
    planLabel: "Serverless Development",
    submittedAt: "2026-01-02T00:00:00.000Z",
    status: "approved" as const,
    portalToken: "tok_bob",
    approvedAt: "2026-01-03T00:00:00.000Z",
  },
];

describe("PLAN_LABELS", () => {
  it("contains expected plan keys", () => {
    expect(Object.keys(PLAN_LABELS).length).toBeGreaterThan(0);
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed clients from SSM", async () => {
    mockSend.mockResolvedValue({
      Parameter: { Value: JSON.stringify(sampleClients) },
    });
    const result = await readPendingClients();
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("alice@example.com");
  });

  it("returns empty array when SSM has no value", async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: undefined } });
    const result = await readPendingClients();
    expect(result).toEqual([]);
  });

  it("returns empty array when SSM throws", async () => {
    mockSend.mockRejectedValue(new Error("SSM error"));
    const result = await readPendingClients();
    expect(result).toEqual([]);
  });
});

describe("writePendingClients()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls SSM PutParameterCommand with serialized clients", async () => {
    mockSend.mockResolvedValue({});
    await writePendingClients(sampleClients);
    expect(mockSend).toHaveBeenCalledOnce();
  });
});

describe("upsertPendingClient()", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("creates a new client when email does not exist", async () => {
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: "[]" } }) // read
      .mockResolvedValueOnce({}); // write
    const result = await upsertPendingClient({ email: "new@example.com", plan: "cloud" });
    expect(result.email).toBe("new@example.com");
    expect(result.status).toBe("waiting");
    expect(result.planLabel).toBe(PLAN_LABELS.cloud);
  });

  it("does not reset status when client is already approved", async () => {
    const existing = [
      {
        email: "approved@example.com",
        plan: "serverless",
        planLabel: "Serverless Development",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "approved" as const,
        portalToken: "tok_123",
      },
    ];
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(existing) } })
      .mockResolvedValueOnce({});
    const result = await upsertPendingClient({ email: "approved@example.com", plan: "cloud" });
    expect(result.status).toBe("approved");
  });

  it("updates plan for a waiting client", async () => {
    const existing = [
      {
        email: "waiting@example.com",
        plan: "cloud",
        planLabel: "Cloud Architecture & Migration",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "waiting" as const,
      },
    ];
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(existing) } })
      .mockResolvedValueOnce({});
    const result = await upsertPendingClient({ email: "waiting@example.com", plan: "serverless" });
    expect(result.plan).toBe("serverless");
    expect(result.planLabel).toBe(PLAN_LABELS.serverless);
  });

  it("uses provided planLabel when given", async () => {
    mockSend.mockResolvedValueOnce({ Parameter: { Value: "[]" } }).mockResolvedValueOnce({});
    const result = await upsertPendingClient({
      email: "custom@example.com",
      plan: "custom",
      planLabel: "Custom Plan",
    });
    expect(result.planLabel).toBe("Custom Plan");
  });
});

describe("findPendingByEmail()", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("returns the matching client (case-insensitive)", async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(sampleClients) } });
    const result = await findPendingByEmail("ALICE@EXAMPLE.COM");
    expect(result?.email).toBe("alice@example.com");
  });

  it("returns null when no client matches", async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(sampleClients) } });
    const result = await findPendingByEmail("nobody@example.com");
    expect(result).toBeNull();
  });
});

describe("approvePendingClient()", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("sets status to approved and stores portalToken", async () => {
    const existing = [
      {
        email: "client@example.com",
        plan: "cloud",
        planLabel: "Cloud Architecture & Migration",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "waiting" as const,
      },
    ];
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(existing) } })
      .mockResolvedValueOnce({});
    const result = await approvePendingClient("client@example.com", "tok_newportal");
    expect(result?.status).toBe("approved");
    expect(result?.portalToken).toBe("tok_newportal");
    expect(result?.approvedAt).toBeDefined();
  });

  it("returns null when client does not exist", async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: "[]" } });
    const result = await approvePendingClient("nobody@example.com", "tok_x");
    expect(result).toBeNull();
  });
});
