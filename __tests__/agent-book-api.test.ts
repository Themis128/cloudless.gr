/**
 * Tests for POST /api/agent/book (Phase 2b booking agent).
 *
 * Auth fallback: api-auth uses a decode-only path when COGNITO_USER_POOL_ID
 * is absent (jsdom default), so fake JWTs with a valid `exp` are accepted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});
// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockProposeBookingSlot,
  mockIsAgentBookConfigured,
  mockBookConsultation,
  mockGetAvailableSlots,
  mockSendBookingConfirmation,
  mockSlackBookingNotify,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockProposeBookingSlot: vi.fn(),
  mockIsAgentBookConfigured: vi.fn(),
  mockBookConsultation: vi.fn(),
  mockGetAvailableSlots: vi.fn(),
  mockSendBookingConfirmation: vi.fn(),
  mockSlackBookingNotify: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/agent-book", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    proposeBookingSlot: (...args: unknown[]) => mockProposeBookingSlot(...args),
    isAgentBookConfigured: (...args: unknown[]) => mockIsAgentBookConfigured(...args),
  };
});

vi.mock("@/lib/google-calendar", () => ({
  bookConsultation: (...args: unknown[]) => mockBookConsultation(...args),
  getAvailableSlots: (...args: unknown[]) => mockGetAvailableSlots(...args),
}));

vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: (...args: unknown[]) => mockSendBookingConfirmation(...args),
}));

vi.mock("@/lib/slack-notify", () => ({
  slackBookingNotify: (...args: unknown[]) => mockSlackBookingNotify(...args),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  };
});

// ---------------------------------------------------------------------------
// Lazily-imported route module (dynamic import is required by vitest module
// isolation; extracting the path constant silences sonarjs/no-duplicate-string).
// ---------------------------------------------------------------------------

const BOOK_ROUTE = "@/app/api/agent/book/route";

// ---------------------------------------------------------------------------
// Token + request helpers
// ---------------------------------------------------------------------------

function makeUserToken(email = "user@example.com"): string {
  return `user-session:${email}`;
}

function authPost(body?: unknown, email?: string): NextRequest {
  return new NextRequest("http://localhost/api/agent/book", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeUserToken(email)}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function unauthPost(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agent/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/agent/book", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the auth issuer/pool so api-auth uses the dev decode-only fallback
    // (these fixtures use fake-signed tokens, so JWKS verification would 401).
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    mockIsAgentBookConfigured.mockResolvedValue(true);
    mockRateLimit.mockReturnValue({ ok: true, remaining: 10 });
    // Default the fire-and-forget side effects to resolved promises so the
    // route's `.catch(...)` chain doesn't blow up.
    mockSlackBookingNotify.mockResolvedValue(undefined);
    mockSendBookingConfirmation.mockResolvedValue(undefined);
  });

  it("returns 401 when no token is provided", async () => {
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(unauthPost({ intent: "tomorrow morning" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when calendar is not configured", async () => {
    mockIsAgentBookConfigured.mockResolvedValueOnce(false);
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ intent: "tomorrow morning" }));
    expect(res.status).toBe(503);
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import(BOOK_ROUTE);
    const req = new NextRequest("http://localhost/api/agent/book", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${makeUserToken()}`,
        "Content-Type": "application/json",
      },
      body: "{not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body matches neither propose nor confirm shape", async () => {
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ random: "field" }));
    expect(res.status).toBe(400);
  });

  it("propose: returns a proposed slot from the agent", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();
    mockProposeBookingSlot.mockResolvedValueOnce({
      status: "proposed",
      proposed: { start, end, formatted: "Wed Aug 12 10:00–10:30 Athens" },
      reasoning: "Visitor asked for next-day morning.",
    });

    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ intent: "tomorrow morning, 30 min" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("proposed");
    expect(data.proposed.start).toBe(start);
    expect(mockProposeBookingSlot).toHaveBeenCalledWith("tomorrow morning, 30 min");
  });

  it("propose: returns no_match when the agent finds nothing", async () => {
    mockProposeBookingSlot.mockResolvedValueOnce({
      status: "no_match",
      reasoning: "No Tuesday slots available.",
    });
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ intent: "Tuesday at 3am" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("no_match");
  });

  it("propose: 503 when Bedrock access is denied", async () => {
    const err = Object.assign(new Error("denied"), {
      name: "AccessDeniedException",
    });
    mockProposeBookingSlot.mockRejectedValueOnce(err);
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ intent: "anything" }));
    expect(res.status).toBe(503);
  });

  it("propose: rate-limited on 6th attempt", async () => {
    mockRateLimit.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "rate limit" }), {
        status: 429,
      }),
    });
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ intent: "tomorrow" }));
    expect(res.status).toBe(429);
  });

  it("confirm: books on the authenticated user's email regardless of body", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();
    mockGetAvailableSlots.mockResolvedValueOnce([{ start, end }]);
    mockBookConsultation.mockResolvedValueOnce({
      eventId: "evt_1",
      htmlLink: "https://meet.google.com/abc",
    });

    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(
      authPost({ confirm: true, start, end, notes: "audit prep" }, "auth@cloudless.gr")
    );
    expect(res.status).toBe(200);
    expect(mockBookConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "auth@cloudless.gr",
        start,
        end,
        notes: "audit prep",
      })
    );
    const data = await res.json();
    expect(data.status).toBe("confirmed");
    expect(data.eventId).toBe("evt_1");
  });

  it("confirm: rejects slots in the past", async () => {
    const start = new Date(Date.now() - 86_400_000).toISOString();
    const end = new Date(Date.now() - 86_400_000 + 1_800_000).toISOString();
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ confirm: true, start, end }));
    expect(res.status).toBe(400);
    expect(mockBookConsultation).not.toHaveBeenCalled();
  });

  it("confirm: 409 when slot no longer free", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();
    mockGetAvailableSlots.mockResolvedValueOnce([]); // no slots free anymore
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ confirm: true, start, end }));
    expect(res.status).toBe(409);
    expect(mockBookConsultation).not.toHaveBeenCalled();
  });

  it("confirm: 400 when end <= start", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = start;
    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ confirm: true, start, end }));
    expect(res.status).toBe(400);
  });

  it("confirm: fires email + slack notifications after booking", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 86_400_000 + 1_800_000).toISOString();
    mockGetAvailableSlots.mockResolvedValueOnce([{ start, end }]);
    mockBookConsultation.mockResolvedValueOnce({
      eventId: "evt_2",
      htmlLink: "https://meet.google.com/xyz",
    });
    mockSlackBookingNotify.mockResolvedValue(undefined);
    mockSendBookingConfirmation.mockResolvedValue(undefined);

    const { POST } = await import(BOOK_ROUTE);
    const res = await POST(authPost({ confirm: true, start, end }));
    expect(res.status).toBe(200);
    // Fire-and-forget — wait a microtask for the void chains.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSlackBookingNotify).toHaveBeenCalled();
    expect(mockSendBookingConfirmation).toHaveBeenCalled();
  });
});
