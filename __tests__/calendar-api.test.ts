/**
 * Contract tests for the Calendar API routes.
 *
 * Covers:
 *   GET  /api/calendar/availability — 503 when unconfigured, slot array shape
 *   POST /api/calendar/book         — 503 when unconfigured, 400 validation, 200 success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetIntegrationCache } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Bypass rate limiting in unit tests — we test the limiter separately
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

const mockGetAvailableSlots = vi.fn();
vi.mock("@/lib/google-calendar", () => ({
  getAvailableSlots: mockGetAvailableSlots,
  bookConsultation: vi.fn(),
}));

const mockSlackNotify = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/slack-notify", () => ({
  slackNotify: mockSlackNotify,
}));

// ---------------------------------------------------------------------------
// GET /api/calendar/availability
// ---------------------------------------------------------------------------

describe("GET /api/calendar/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    mockGetAvailableSlots.mockResolvedValue([
      {
        start: "2026-05-01T10:00:00Z",
        end: "2026-05-01T10:30:00Z",
        label: "Thu 1 May, 10:00",
      },
      {
        start: "2026-05-01T11:00:00Z",
        end: "2026-05-01T11:30:00Z",
        label: "Thu 1 May, 11:00",
      },
    ]);
  });

  it("returns 503 when Google Calendar is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/calendar/availability/route");
    const res = await GET(
      new Request("http://localhost/api/calendar/availability"),
    );
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns slots array when configured", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    const res = await GET(
      new Request("http://localhost/api/calendar/availability"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.slots)).toBe(true);
  });

  it("slot objects have start and end fields", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    const res = await GET(
      new Request("http://localhost/api/calendar/availability"),
    );
    const data = await res.json();
    const slot = data.slots[0];
    expect(typeof slot.start).toBe("string");
    expect(typeof slot.end).toBe("string");
  });

  it("respects days query param (capped at 30)", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    await GET(
      new Request("http://localhost/api/calendar/availability?days=60"),
    );
    expect(mockGetAvailableSlots).toHaveBeenCalledWith(30);
  });

  it("defaults to 7 days when no param provided", async () => {
    const { GET } = await import("@/app/api/calendar/availability/route");
    await GET(
      new Request("http://localhost/api/calendar/availability"),
    );
    expect(mockGetAvailableSlots).toHaveBeenCalledWith(7);
  });

  it("returns 500 when getAvailableSlots throws", async () => {
    mockGetAvailableSlots.mockRejectedValue(new Error("Google API error"));
    const { GET } = await import("@/app/api/calendar/availability/route");
    const res = await GET(
      new Request("http://localhost/api/calendar/availability"),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/calendar/book
// ---------------------------------------------------------------------------

const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const futureEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

function bookRequest(body: object) {
  return new Request("http://localhost/api/calendar/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/calendar/book", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetIntegrationCache();

    const { bookConsultation } = vi.mocked(
      await vi.importMock<typeof import("@/lib/google-calendar")>(
        "@/lib/google-calendar",
      ),
    );
    (bookConsultation as ReturnType<typeof vi.fn>).mockResolvedValue({
      eventId: "evt_abc123",
      htmlLink: "https://calendar.google.com/event?eid=abc",
    });
  });

  it("returns 503 when Google Calendar is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "");
    resetIntegrationCache();
    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(
      bookRequest({
        name: "Test User",
        email: "test@example.com",
        start: futureStart,
        end: futureEnd,
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(bookRequest({ name: "Test User" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  it("returns 400 for invalid email address", async () => {
    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(
      bookRequest({
        name: "Test User",
        email: "not-an-email",
        start: futureStart,
        end: futureEnd,
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 400 when booking a slot in the past", async () => {
    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(
      bookRequest({
        name: "Test User",
        email: "test@example.com",
        start: "2020-01-01T10:00:00Z",
        end: "2020-01-01T10:30:00Z",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/past/i);
  });

  it("returns 200 with eventId and meetingLink on success", async () => {
    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(
      bookRequest({
        name: "Test User",
        email: "test@example.com",
        start: futureStart,
        end: futureEnd,
        notes: "Looking forward to the call",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.eventId).toBe("string");
    expect(typeof data.meetingLink).toBe("string");
  });

  it("fires a Slack notification on successful booking", async () => {
    const { POST } = await import("@/app/api/calendar/book/route");
    await POST(
      bookRequest({
        name: "Notify Test",
        email: "notify@example.com",
        start: futureStart,
        end: futureEnd,
      }),
    );
    // Give the fire-and-forget promise a tick to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSlackNotify).toHaveBeenCalledOnce();
    expect(mockSlackNotify.mock.calls[0][0].text).toContain("Notify Test");
  });

  it("returns 500 when bookConsultation returns null", async () => {
    const { bookConsultation } = vi.mocked(
      await vi.importMock<typeof import("@/lib/google-calendar")>(
        "@/lib/google-calendar",
      ),
    );
    (bookConsultation as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("@/app/api/calendar/book/route");
    const res = await POST(
      bookRequest({
        name: "Test User",
        email: "test@example.com",
        start: futureStart,
        end: futureEnd,
      }),
    );
    expect(res.status).toBe(500);
  });
});
