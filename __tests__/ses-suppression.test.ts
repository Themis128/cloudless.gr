import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockDb = {
  prepare: mockPrepare,
};

interface WorkersGlobal {
  __AUTH_DB__?: typeof mockDb;
}

function bindMockDb(): void {
  (globalThis as WorkersGlobal).__AUTH_DB__ = mockDb;
}

function clearMockDb(): void {
  delete (globalThis as WorkersGlobal).__AUTH_DB__;
}

describe("ses-suppression.ts (D1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({});
    bindMockDb();
  });

  afterEach(() => {
    clearMockDb();
  });

  it("returns true when D1 insert succeeds", async () => {
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    const result = await addToSuppressionList("unsubscribed@example.com");
    expect(result).toBe(true);
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockBind).toHaveBeenCalledWith(
      "unsubscribed@example.com",
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("uses INSERT with ON CONFLICT for upsert", async () => {
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    await addToSuppressionList("user@test.com");
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT"));
  });

  it("returns false when D1 throws an error", async () => {
    mockRun.mockRejectedValueOnce(new Error("D1 error"));
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    const result = await addToSuppressionList("fail@example.com");
    expect(result).toBe(false);
  });

  it("returns false when AUTH_DB is not bound", async () => {
    clearMockDb();
    const { addToSuppressionList } = await import("@/lib/ses-suppression");
    const result = await addToSuppressionList("test@example.com");
    expect(result).toBe(false);
  });
});
