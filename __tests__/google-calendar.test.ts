import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist jose mock variables so they're available when vi.mock("jose") factory runs
const { mockImportPKCS8, mockSign } = vi.hoisted(() => ({
  mockImportPKCS8: vi.fn().mockResolvedValue({}),
  mockSign: vi.fn().mockResolvedValue("fake-jwt"),
}));

vi.mock("@/lib/google-sa-key", () => ({
  loadGooglePrivateKey: vi.fn().mockReturnValue({ type: "private" }),
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

async function importGcal() {
  return import("@/lib/google-calendar");
}

function mockAuthOk() {
  return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
}

const TEST_EMAIL = "test@example.com";

describe("google-calendar.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("getAvailableSlots()", () => {
    it("throws when Google credentials are not configured", async () => {
      vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
      vi.stubEnv("GOOGLE_PRIVATE_KEY", "");
      const { getAvailableSlots } = await importGcal();
      await expect(getAvailableSlots()).rejects.toThrow("Google service account not configured");
    });

    it("throws when freeBusy request fails", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(new Response("error", { status: 500 }));

      const { getAvailableSlots } = await importGcal();
      await expect(getAvailableSlots(1)).rejects.toThrow("Google Calendar freeBusy failed (500)");
    });

    it("generates slots at correct UTC time for Athens summer (UTC+3)", async () => {
      // Fixed date: 2026-06-15 (summer, Athens = UTC+3)
      const summerMonday = new Date("2026-06-15T00:00:00Z"); // Monday
      vi.setSystemTime(summerMonday);

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ calendars: { primary: { busy: [] } } }), { status: 200 })
        );

      const { getAvailableSlots } = await importGcal();
      const slots = await getAvailableSlots(1);

      // 09:00 Athens = 06:00 UTC in summer (UTC+3)
      expect(slots[0]?.start).toBe("2026-06-15T06:00:00.000Z");
      // 16:30 Athens = 13:30 UTC
      expect(slots.at(-1)?.start).toBe("2026-06-15T13:30:00.000Z");

      vi.useRealTimers();
    });

    it("generates slots at correct UTC time for Athens winter (UTC+2)", async () => {
      // Fixed date: 2026-01-05 (winter, Athens = UTC+2)
      const winterMonday = new Date("2026-01-05T00:00:00Z"); // Monday
      vi.setSystemTime(winterMonday);

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ calendars: { primary: { busy: [] } } }), { status: 200 })
        );

      const { getAvailableSlots } = await importGcal();
      const slots = await getAvailableSlots(1);

      // 09:00 Athens = 07:00 UTC in winter (UTC+2)
      expect(slots[0]?.start).toBe("2026-01-05T07:00:00.000Z");
      // 16:30 Athens = 14:30 UTC
      expect(slots.at(-1)?.start).toBe("2026-01-05T14:30:00.000Z");

      vi.useRealTimers();
    });
  });

  describe("bookConsultation()", () => {
    it("returns null when the calendar API returns an error", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(new Response("error", { status: 400 }));

      const { bookConsultation } = await importGcal();
      const result = await bookConsultation({
        name: "Test User",
        email: TEST_EMAIL,
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });
      expect(result).toBeNull();
    });

    it("passes sendUpdates=all in the request URL", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "e1", htmlLink: "https://cal.google.com/e/e1" }), {
            status: 200,
          })
        );

      const { bookConsultation } = await importGcal();
      await bookConsultation({
        name: "Test User",
        email: TEST_EMAIL,
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });

      const calendarCall = vi.mocked(globalThis.fetch).mock.calls[1];
      expect(String(calendarCall?.[0])).toContain("sendUpdates=all");
    });

    it("returns eventId, htmlLink and meetLink on success", async () => {
      const meetUrl = "https://meet.google.com/abc-defg-hij";
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "event-abc",
              htmlLink: "https://cal.google.com/event/event-abc",
              conferenceData: {
                entryPoints: [{ entryPointType: "video", uri: meetUrl }],
              },
            }),
            { status: 200 }
          )
        );

      const { bookConsultation } = await importGcal();
      const result = await bookConsultation({
        name: "Test User",
        email: TEST_EMAIL,
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });
      expect(result).not.toBeNull();
      expect(result!.eventId).toBe("event-abc");
      expect(result!.meetLink).toBe(meetUrl);
    });

    it("returns meetLink undefined when conferenceData is absent", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ id: "event-abc", htmlLink: "https://cal.google.com/event/event-abc" }),
            { status: 200 }
          )
        );

      const { bookConsultation } = await importGcal();
      const result = await bookConsultation({
        name: "Test User",
        email: TEST_EMAIL,
        start: "2026-05-10T09:00:00Z",
        end: "2026-05-10T09:30:00Z",
      });
      expect(result).not.toBeNull();
      expect(result!.meetLink).toBeUndefined();
    });
  });

  describe("getConsultationsByEmail()", () => {
    it("returns empty array when calendar API fails", async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(new Response("error", { status: 500 }));

      const { getConsultationsByEmail } = await importGcal();
      const result = await getConsultationsByEmail(TEST_EMAIL);
      expect(result).toEqual([]);
    });

    it("filters events to only those with 'consultation' in the title", async () => {
      const events = [
        {
          id: "e1",
          summary: "Cloudless Consultation — Alice",
          start: { dateTime: "2026-05-10T09:00:00Z" },
          end: { dateTime: "2026-05-10T09:30:00Z" },
        },
        {
          id: "e2",
          summary: "Random Meeting",
          start: { dateTime: "2026-05-11T10:00:00Z" },
          end: { dateTime: "2026-05-11T10:30:00Z" },
        },
      ];

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(mockAuthOk())
        .mockResolvedValueOnce(new Response(JSON.stringify({ items: events }), { status: 200 }));

      const { getConsultationsByEmail } = await importGcal();
      const result = await getConsultationsByEmail("alice@example.com");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("e1");
    });
  });
});
