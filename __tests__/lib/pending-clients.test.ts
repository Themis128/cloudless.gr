import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn(() => { throw new Error("no db"); }),
}));

import {
  readPendingClients,
  writePendingClients,
  upsertPendingClient,
  findPendingByEmail,
  approvePendingClient,
  type PendingClient,
} from "@/lib/pending-clients";
import { resetJsonConfigMemory } from "@/lib/app-config-json";

beforeEach(() => {
  resetJsonConfigMemory();
});

describe("readPendingClients", () => {
  it("returns empty array when no data stored", async () => {
    const result = await readPendingClients();
    expect(result).toEqual([]);
  });
});

describe("writePendingClients / readPendingClients", () => {
  it("round-trips client data", async () => {
    const clients: PendingClient[] = [
      { email: "user@example.com", plan: "cloud", submittedAt: "2026-09-01T00:00:00.000Z", status: "waiting" },
    ];
    await writePendingClients(clients);
    const result = await readPendingClients();
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("user@example.com");
  });
});

describe("upsertPendingClient", () => {
  it("creates a new client when not found", async () => {
    const client = await upsertPendingClient({ email: "new@example.com", plan: "cloud" });
    expect(client.email).toBe("new@example.com");
    expect(client.plan).toBe("cloud");
    expect(client.status).toBe("waiting");
    expect(client.submittedAt).toBeDefined();
  });

  it("updates plan when client already exists and is not approved", async () => {
    await upsertPendingClient({ email: "user@example.com", plan: "cloud" });
    const updated = await upsertPendingClient({ email: "user@example.com", plan: "serverless" });
    expect(updated.plan).toBe("serverless");
    expect(updated.status).toBe("waiting");
  });

  it("does not reset an already-approved client", async () => {
    await upsertPendingClient({ email: "approved@example.com", plan: "cloud" });
    await approvePendingClient("approved@example.com", "tok-123");
    const result = await upsertPendingClient({ email: "approved@example.com", plan: "serverless" });
    expect(result.status).toBe("approved");
    expect(result.plan).toBe("cloud"); // unchanged
  });

  it("sets planLabel from PLAN_LABELS for known plans", async () => {
    const client = await upsertPendingClient({ email: "x@example.com", plan: "bundle" });
    expect(typeof client.planLabel).toBe("string");
    expect(client.planLabel!.length).toBeGreaterThan(0);
  });

  it("is case-insensitive for email matching", async () => {
    await upsertPendingClient({ email: "User@Example.COM", plan: "cloud" });
    const result = await findPendingByEmail("user@example.com");
    expect(result?.email).toBe("User@Example.COM");
  });
});

describe("findPendingByEmail", () => {
  it("returns null when not found", async () => {
    const result = await findPendingByEmail("missing@example.com");
    expect(result).toBeNull();
  });

  it("finds by email case-insensitively", async () => {
    await upsertPendingClient({ email: "Find@Test.COM", plan: "cloud" });
    const result = await findPendingByEmail("find@test.com");
    expect(result?.email).toBe("Find@Test.COM");
  });
});

describe("approvePendingClient", () => {
  it("returns null when client not found", async () => {
    const result = await approvePendingClient("nobody@example.com", "tok");
    expect(result).toBeNull();
  });

  it("marks client as approved with portal token", async () => {
    await upsertPendingClient({ email: "approve@example.com", plan: "cloud" });
    const result = await approvePendingClient("approve@example.com", "portal-abc");
    expect(result?.status).toBe("approved");
    expect(result?.portalToken).toBe("portal-abc");
    expect(result?.approvedAt).toBeDefined();
  });
});
