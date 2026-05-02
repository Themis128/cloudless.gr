import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetProducts, mockGetAvailableSlots } = vi.hoisted(() => ({
  mockGetProducts: vi.fn(),
  mockGetAvailableSlots: vi.fn(),
}));

vi.mock("@/lib/store-products", () => ({
  getProducts: mockGetProducts,
}));
vi.mock("@/lib/google-calendar", () => ({
  getAvailableSlots: mockGetAvailableSlots,
}));
vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/integrations")>();
  return {
    ...actual,
    isConfigured: vi.fn(
      (...keys: string[]) =>
        keys.every((k) => Boolean(process.env[k])),
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
    process.env.GOOGLE_CLIENT_EMAIL = "svc@example.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nABC\n";
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
    expect(out).toContain("Available slots");
    expect(out).toContain("Athens");
    expect(out).toContain("https://cloudless.gr/book");
  });

  it("check_calendar_availability returns a graceful message when calendar isn't configured", async () => {
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
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
