import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/store-products", () => ({
  getProducts: vi.fn().mockRejectedValue(new Error("store down")),
}));
vi.mock("@/lib/cal-com", () => ({
  getAvailableSlots: vi.fn().mockResolvedValue([]),
  bookConsultation: vi.fn(),
}));
vi.mock("@/lib/content-calendar", () => ({ invalidateConsultationCache: vi.fn() }));
vi.mock("@/lib/integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations")>()),
  isConfiguredAsync: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/slack-notify", () => ({ slackBookingNotify: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn(),
  notifyTeam: vi.fn(),
}));
vi.mock("@/lib/admin-notifications", () => ({ recordNotification: vi.fn() }));

import { CHAT_TOOLS, runTool } from "@/lib/chat-tools";

describe("CHAT_TOOLS", () => {
  it("is a non-empty array", () => {
    expect(CHAT_TOOLS.length).toBeGreaterThan(0);
  });

  it("includes lookup_product, check_calendar_availability, and book_slot", () => {
    const names = CHAT_TOOLS.map((t) => t.name);
    expect(names).toContain("lookup_product");
    expect(names).toContain("check_calendar_availability");
    expect(names).toContain("book_slot");
  });

  it("each tool has name, description, and input_schema", () => {
    for (const tool of CHAT_TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.input_schema).toBeTruthy();
    }
  });
});

describe("runTool tails", () => {
  it("reports a missing slot when the row is out of range", async () => {
    const msg = await runTool("book_slot", {
      name: "Jane Smith",
      email: "jane@example.com",
      row: 99,
    });
    expect(msg).toContain("Missing slot");
  });

  it("converts a throwing tool into a friendly failure string", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const msg = await runTool("lookup_product", { query: "audit" });
    expect(msg).toContain("Tool lookup_product failed");
    spy.mockRestore();
  });
});
