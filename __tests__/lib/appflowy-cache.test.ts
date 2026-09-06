import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { invalidateCache, invalidateCacheKeys } from "@/lib/appflowy-cache";

describe("appflowy-cache (not configured)", () => {
  it("invalidateCache resolves without throwing", async () => {
    await expect(invalidateCache()).resolves.toBeUndefined();
  });

  it("invalidateCacheKeys resolves without throwing", async () => {
    await expect(invalidateCacheKeys(["key1", "key2"])).resolves.toBeUndefined();
  });
});
