import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/workers-ai-client", () => ({
  isWorkersAiConfigured: vi.fn().mockReturnValue(false),
}));

import { searchAiDocs } from "@/lib/ai-search";

describe("searchAiDocs", () => {
  it("returns null in a non-Workers Node.js environment", async () => {
    const result = await searchAiDocs("cloud services");
    expect(result).toBeNull();
  });
});
