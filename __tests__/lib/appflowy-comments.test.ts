import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));

import { listComments, addComment } from "@/lib/appflowy-comments";

describe("appflowy-comments (not configured)", () => {
  it("listComments returns [] when AppFlowy is not configured", async () => {
    expect(await listComments("page-id")).toEqual([]);
  });

  it("addComment returns false when AppFlowy is not configured", async () => {
    expect(await addComment("page-id", "Hello")).toBe(false);
  });
});
