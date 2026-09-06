import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ssm-config", () => ({ getConfig: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: vi.fn().mockReturnValue(null) }));

import { ASSISTANT_TOOLS } from "@/lib/admin-assistant-tools";

describe("ASSISTANT_TOOLS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ASSISTANT_TOOLS)).toBe(true);
    expect(ASSISTANT_TOOLS.length).toBeGreaterThan(0);
  });

  it("each tool has name, description, and input_schema", () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.input_schema).toBeTruthy();
    }
  });

  it("includes search_notion tool", () => {
    const tool = ASSISTANT_TOOLS.find((t) => t.name === "search_notion");
    expect(tool).toBeTruthy();
  });
});
