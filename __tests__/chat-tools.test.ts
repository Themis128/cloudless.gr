import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetProducts,
  mockGetAvailableSlots,
  mockBookConsultation,
  mockSlackBookingNotify,
  mockSendBookingConfirmation,
  mockNotifyTeam,
  mockRecordNotification,
  mockInvalidateConsultationCache,
} = vi.hoisted(() => ({
  mockGetProducts: vi.fn(),
  mockGetAvailableSlots: vi.fn(),
  mockBookConsultation: vi.fn(),
  mockSlackBookingNotify: vi.fn(),
  mockSendBookingConfirmation: vi.fn(),
  mockNotifyTeam: vi.fn(),
  mockRecordNotification: vi.fn(),
  mockInvalidateConsultationCache: vi.fn(),
}));

vi.mock("@/lib/store-products", () => ({
  getProducts: mockGetProducts,
}));
vi.mock("@/lib/cal-com", () => ({
  getAvailableSlots: mockGetAvailableSlots,
  bookConsultation: mockBookConsultation,
}));
vi.mock("@/lib/slack-notify", () => ({
  slackBookingNotify: mockSlackBookingNotify,
}));
vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: mockSendBookingConfirmation,
  notifyTeam: mockNotifyTeam,
}));
vi.mock("@/lib/admin-notifications", () => ({
  recordNotification: mockRecordNotification,
}));
vi.mock("@/lib/content-calendar", () => ({
  invalidateConsultationCache: mockInvalidateConsultationCache,
}));
vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations")>();
  return {
    ...actual,
    isConfigured: vi.fn((...keys: string[]) => keys.every((k) => Boolean(process.env[k]))),
    isConfiguredAsync: vi.fn(async (...keys: string[]) =>
      keys.every((k) => Boolean(process.env[k]))
    ),
  };
});

import { runTool } from "@/lib/chat-tools";

const SAMPLE_PRODUCTS = [
  {
    id: "srv-cloud",
    name: "Cloud Architecture Audit",
    description: "Comprehensive AWS/GCP/Azure review.",
    price: 200000,
    currency: "eur",
    category: "service",
    image: "/store/cloud-audit.svg",
    features: ["Migration roadmap"],
  },
  {
    id: "dig-serverless-course",
    name: "Serverless Masterclass",
    description: "Video course on serverless patterns.",
    price: 14900,
    currency: "eur",
    category: "digital",
    image: "/store/serverless-course.svg",
  },
];

describe("chat-tools.runTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_API_KEY = "cal_live_test_key";
    mockGetProducts.mockResolvedValue(SAMPLE_PRODUCTS);
  });

  it("lookup_product returns the matching product with name, price, and URL", async () => {
    const out = await runTool("lookup_product", { query: "serverless" });
    expect(out).toContain("Serverless Masterclass");
    expect(out).toContain("https://cloudless.gr/store/dig-serverless-course");
    expect(out).toMatch(/€\d+/);
  });

  it("lookup_product returns a no-match nudge when nothing matches", async () => {
    const out = await runTool("lookup_product", {
      query: "completely-unrelated-thing",
    });
    expect(out.toLowerCase()).toContain("no products");
  });

  it("lookup_product handles a non-string query gracefully", async () => {
    const out = await runTool("lookup_product", { query: 42 });
    expect(out).toBe("No query provided.");
  });

  it("check_calendar_availability returns formatted slots", async () => {
    mockGetAvailableSlots.mockResolvedValueOnce([
      { start: "2026-06-03T11:00:00.000Z", end: "2026-06-03T11:30:00.000Z" },
      { start: "2026-06-04T08:00:00.000Z", end: "2026-06-04T08:30:00.000Z" },
    ]);
    const out = await runTool("check_calendar_availability", {
      days_ahead: 7,
    });
    expect(out).toContain("30-min consultation slots");
    expect(out).toContain("Themistoklis Baltzakis");
    expect(out).toContain("Cloudless.gr");
    expect(out).toContain("Athens");
    expect(out).toContain("BOOKING_ISO_DATA");
  });

  it("check_calendar_availability returns a graceful message when calendar isn't configured", async () => {
    delete process.env.CAL_API_KEY;
    const out = await runTool("check_calendar_availability", {});
    expect(out.toLowerCase()).toContain("not yet wired");
  });

  it("check_calendar_availability returns a no-slots nudge when none are open", async () => {
    mockGetAvailableSlots.mockResolvedValueOnce([]);
    const out = await runTool("check_calendar_availability", {
      days_ahead: 3,
    });
    expect(out.toLowerCase()).toContain("no open");
  });

  it("check_calendar_availability clamps days_ahead to [1, 14]", async () => {
    mockGetAvailableSlots.mockResolvedValue([]);
    await runTool("check_calendar_availability", { days_ahead: 99 });
    await runTool("check_calendar_availability", { days_ahead: -5 });
    expect(mockGetAvailableSlots).toHaveBeenNthCalledWith(1, 14);
    expect(mockGetAvailableSlots).toHaveBeenNthCalledWith(2, 1);
  });

  it("returns an unknown-tool message for an unrecognised name", async () => {
    const out = await runTool("not_a_tool", {});
    expect(out).toContain("Unknown tool");
  });

  it("converts an unhandled tool throw into a contact-page nudge", async () => {
    mockGetAvailableSlots.mockRejectedValueOnce(new Error("boom"));
    const out = await runTool("check_calendar_availability", {});
    expect(out.toLowerCase()).toContain("contact page");
  });
});

describe("chat-tools.runTool book_slot", () => {
  const SLOT = { start: "2026-06-03T11:00:00.000Z", end: "2026-06-03T11:30:00.000Z" };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAL_API_KEY = "cal_live_test_key";
    mockGetAvailableSlots.mockResolvedValue([SLOT]);
    mockBookConsultation.mockResolvedValue({ meetLink: "https://meet.google.com/abc" });
    mockSlackBookingNotify.mockResolvedValue(undefined);
    mockSendBookingConfirmation.mockResolvedValue(true);
    mockNotifyTeam.mockResolvedValue(true);
    mockRecordNotification.mockResolvedValue("n1");
  });

  it("short-circuits when booking isn't configured", async () => {
    delete process.env.CAL_API_KEY;
    const out = await runTool("book_slot", { name: "A", email: "a@b.co" });
    expect(out.toLowerCase()).toContain("not yet configured");
  });

  it("validates name and email before touching the calendar", async () => {
    expect(await runTool("book_slot", { email: "a@b.co" })).toContain("visitor name");
    expect(await runTool("book_slot", { name: "A", email: "nope" })).toContain("email");
    expect(await runTool("book_slot", { name: "A", email: "a@b.co" })).toContain(
      "check_calendar_availability"
    );
    expect(mockGetAvailableSlots).not.toHaveBeenCalled();
  });

  it("reports a calendar re-check failure", async () => {
    mockGetAvailableSlots.mockRejectedValueOnce(new Error("down"));
    const out = await runTool("book_slot", {
      name: "A",
      email: "a@b.co",
      start: SLOT.start,
      end: SLOT.end,
    });
    expect(out.toLowerCase()).toContain("could not re-check");
  });

  it("rejects an ISO start that is no longer available", async () => {
    const out = await runTool("book_slot", {
      name: "A",
      email: "a@b.co",
      start: "2026-06-05T09:00:00.000Z",
      end: "2026-06-05T09:30:00.000Z",
    });
    expect(out).toContain("no longer available");
  });

  it("falls back to row index when ISO times are missing", async () => {
    const out = await runTool("book_slot", { name: "Jane", email: "j@x.co", row: 1 });
    expect(out).toContain("confirmed");
    expect(mockBookConsultation).toHaveBeenCalledWith({
      name: "Jane",
      email: "j@x.co",
      start: SLOT.start,
      end: SLOT.end,
      notes: undefined,
    });
    expect(mockInvalidateConsultationCache).toHaveBeenCalled();
  });

  it("reports a row that points past the slot list", async () => {
    const out = await runTool("book_slot", { name: "A", email: "a@b.co", row: 3 });
    expect(out).toContain("Row 3 is no longer available");
  });

  it("reports a booking failure from the calendar service", async () => {
    mockBookConsultation.mockResolvedValueOnce(null);
    const out = await runTool("book_slot", {
      name: "A",
      email: "a@b.co",
      start: SLOT.start,
      end: SLOT.end,
    });
    expect(out).toContain("Booking failed");
  });

  it("confirms with meet link, notes, and fires notifications", async () => {
    const out = await runTool("book_slot", {
      name: "Jane Smith",
      email: "JANE@X.CO",
      start: SLOT.start,
      end: SLOT.end,
      notes: "interested in an audit",
    });
    expect(out).toContain("confirmed");
    expect(out).toContain("meet.google.com/abc");
    expect(mockBookConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@x.co", notes: "interested in an audit" })
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSlackBookingNotify).toHaveBeenCalled();
    expect(mockSendBookingConfirmation).toHaveBeenCalled();
    expect(mockNotifyTeam).toHaveBeenCalled();
    expect(mockRecordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ category: "booking", actor: "jane@x.co" })
    );
  });

  it("swallows notification failures (fire-and-forget)", async () => {
    mockSlackBookingNotify.mockRejectedValue(new Error("slack"));
    mockSendBookingConfirmation.mockRejectedValue(new Error("email"));
    mockNotifyTeam.mockRejectedValue(new Error("team"));
    mockRecordNotification.mockRejectedValue(new Error("notif"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await runTool("book_slot", {
      name: "A",
      email: "a@b.co",
      start: SLOT.start,
      end: SLOT.end,
    });
    expect(out).toContain("confirmed");
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
