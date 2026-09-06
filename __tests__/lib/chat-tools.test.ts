import { describe, it, expect } from "vitest";
import { CHAT_TOOLS } from "@/lib/chat-tools";

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
