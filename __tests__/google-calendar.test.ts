import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache, resetIntegrationCacheAsync } from "@/lib/integrations";

const mockGetIntegrationsAsync = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: () => mockGetIntegrationsAsync(),
  resetIntegrationCache: vi.fn(),
  resetIntegrationCacheAsync: vi.fn(),
}));

// Hoist jose mock variables so they're available when vi.mock("jose") factory runs
const { mockImportPKCS8, mockSign } = vi.hoisted(() => ({
  mockImportPKCS8: vi.fn().mockResolvedValue({}),
  mockSign: vi.fn().mockResolvedValue("fake-jwt"),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn(function (this: Record<string, unknown>) {
    this.setProtectedHeader = vi.fn().mockReturnThis();
    this.setIssuedAt = vi.fn().mockReturnThis();
    this.setExpirationTime = vi.fn().mockReturnThis();
    this.sign = mockSign;
  }),
  importPKCS8: mockImportPKCS8,
}));

const CONFIGURED = {
  GOOGLE_CLIENT_EMAIL: "svc@project.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----",
  GOOGLE_CALENDAR_ID: "primary",
};

const NOT_CONFIGURED = { GOOGLE_CLIENT_EMAIL: "", GOOGLE_PRIVATE_KEY: "" };

describe("google-calendar.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    resetIntegrationCache();
    resetIntegrationCacheAsync();
  });

  describe("getAvailableSlots()", () => {
    it("throws when Google Calendar is not configured", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(NOT_CONFIGURED);
      const { getAvailableSlots } = await import("@/lib/google-calendar");
      await expect(getAvailableSlots()).rejects.toThrow("Google Calendar not configured");
    });

    it("returns empty array when freeBusy request fails", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(new Response("error", { status: 500 }));

      const { getAvailableSlots } = await import("@/lib/google-calendar");
      const slots = await getAvailableSlots(1);
      expect(slots).toEqual([]);
    });
  });

  describe("bookConsultation()", () => {
    it("returns null when the calendar API returns an error", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("error", { status: 400 }));

      const { bookConsultation } = await import("@/lib/google-calendar");
      const result = await bookConsultation({
        name: "Test User",
        email: "test@example.com",
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });
      expect(result).toBeNull();
    });

    it("returns eventId and htmlLink on success", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ id: "event-abc", htmlLink: "https://cal.google.com/event/event-abc" }),
            { status: 200 },
          ),
        );

      const { bookConsultation } = await import("@/lib/google-calendar");
      const result = await bookConsultation({
        name: "Test User",
        email: "test@example.com",
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });
      expect(result).not.toBeNull();
      expect(result!.eventId).toBe("event-abc");
    });
  });

  describe("getConsultationsByEmail()", () => {
    it("returns empty array when calendar API fails", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED);

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("error", { status: 500 }));

      const { getConsultationsByEmail } = await import("@/lib/google-calendar");
      const result = await getConsultationsByEmail("test@example.com");
      expect(result).toEqual([]);
    });

    it("filters events to only those with 'consultation' in the title", async () => {
      mockGetIntegrationsAsync.mockResolvedValue(CONFIGURED);

      const events = [
        { id: "e1", summary: "Cloudless Consultation — Alice", start: { dateTime: "2026-05-10T09:00:00Z" }, end: { dateTime: "2026-05-10T09:30:00Z" } },
        { id: "e2", summary: "Random Meeting", start: { dateTime: "2026-05-11T10:00:00Z" }, end: { dateTime: "2026-05-11T10:30:00Z" } },
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ items: events }), { status: 200 }),
        );

      const { getConsultationsByEmail } = await import("@/lib/google-calendar");
      const result = await getConsultationsByEmail("alice@example.com");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("e1");
    });
  });
});
