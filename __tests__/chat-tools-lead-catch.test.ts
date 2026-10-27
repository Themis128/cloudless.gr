import { describe, expect, it, vi } from "vitest";

const { mockBook, mockSlots, mockForward } = vi.hoisted(() => ({
  mockBook: vi.fn(),
  mockSlots: vi.fn(),
  mockForward: vi.fn(),
}));

vi.mock("@/lib/store-products", () => ({ getProducts: vi.fn() }));
vi.mock("@/lib/cal-com", () => ({
  getAvailableSlots: mockSlots,
  bookConsultation: mockBook,
}));
vi.mock("@/lib/slack-notify", () => ({ slackBookingNotify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  notifyTeam: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/admin-notifications", () => ({ recordNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/content-calendar", () => ({ invalidateConsultationCache: vi.fn() }));
vi.mock("@/lib/socialauto-public-leads", () => ({ forwardPlaybookLead: mockForward }));
vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations")>();
  return {
    ...actual,
    isConfigured: vi.fn((...k: string[]) => k.every((x) => Boolean(process.env[x]))),
    isConfiguredAsync: vi.fn(async (...k: string[]) => k.every((x) => Boolean(process.env[x]))),
  };
});

import { runTool } from "@/lib/chat-tools";

const SLOT = { start: "2030-01-05T09:00:00+02:00", end: "2030-01-05T09:30:00+02:00" };

describe("book_slot lead capture catch path", () => {
  it("booking still succeeds when lead forward rejects", async () => {
    process.env.CAL_API_KEY = "test-key";
    mockSlots.mockResolvedValue([SLOT]);
    mockBook.mockResolvedValue({ meetLink: "https://meet.example/x" });
    mockForward.mockRejectedValue(new Error("lead api down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await runTool("book_slot", {
      name: "Ana Test", email: "ana@test.dev", start: SLOT.start, end: SLOT.end,
    });
    expect(out).toContain("confirmed");
    // allow the fire-and-forget .catch to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(mockForward).toHaveBeenCalled();
    warn.mockRestore();
    delete process.env.CAL_API_KEY;
  });
});
