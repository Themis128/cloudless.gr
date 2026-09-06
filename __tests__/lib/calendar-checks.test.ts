import { describe, it, expect, vi } from "vitest";

const { mockIsConfigured } = vi.hoisted(() => ({ mockIsConfigured: vi.fn() }));

vi.mock("@/lib/agent-book", () => ({
  isAgentBookConfigured: mockIsConfigured,
}));

import { isAgentBookConfigured } from "@/lib/calendar-checks";

describe("isAgentBookConfigured", () => {
  it("returns false when agent-book is not configured", async () => {
    mockIsConfigured.mockResolvedValue(false);
    expect(await isAgentBookConfigured()).toBe(false);
  });

  it("returns true when agent-book is configured", async () => {
    mockIsConfigured.mockResolvedValue(true);
    expect(await isAgentBookConfigured()).toBe(true);
  });

  it("ignores the optional request argument", async () => {
    mockIsConfigured.mockResolvedValue(false);
    const req = new Request("https://example.com");
    expect(await isAgentBookConfigured(req)).toBe(false);
  });
});
