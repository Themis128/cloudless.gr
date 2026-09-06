import { describe, it, expect } from "vitest";
import { recordAdminAiCall, getAdminAiUsageSnapshot } from "@/lib/admin-ai-usage";

describe("getAdminAiUsageSnapshot", () => {
  it("returns an object with total, ok, errors, recent", () => {
    const snap = getAdminAiUsageSnapshot();
    expect(typeof snap.total).toBe("number");
    expect(typeof snap.ok).toBe("number");
    expect(typeof snap.errors).toBe("number");
    expect(Array.isArray(snap.recent)).toBe(true);
  });
});

describe("recordAdminAiCall", () => {
  it("increments the total count", () => {
    const before = getAdminAiUsageSnapshot().total;
    recordAdminAiCall({ ok: true, model: "test-model", viaGateway: false, latencyMs: 100 });
    const after = getAdminAiUsageSnapshot();
    expect(after.total).toBe(before + 1);
    expect(after.ok).toBeGreaterThan(0);
  });

  it("records an error call", () => {
    const before = getAdminAiUsageSnapshot().errors;
    recordAdminAiCall({ ok: false, model: "test-model", viaGateway: false, latencyMs: 50, error: "timeout" });
    expect(getAdminAiUsageSnapshot().errors).toBe(before + 1);
  });
});
