import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

const { getConsultationsByEmailMock } = vi.hoisted(() => ({
  getConsultationsByEmailMock: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/google-calendar", () => ({
  getConsultationsByEmail: getConsultationsByEmailMock,
}));

function makeUserToken(email = "user@example.com"): string {
  const payload = {
    sub: "user-sub",
    email,
    aud: "test-client-id",
    iss: "https://auth.cloudless.gr/realms/cloudless",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function authReq(email?: string): NextRequest {
  return new NextRequest("http://localhost/api/user/consultations", {
    headers: { Authorization: `Bearer ${makeUserToken(email)}` },
  });
}

function unauthReq(): NextRequest {
  return new NextRequest("http://localhost/api/user/consultations");
}

const BASE = "http://localhost/api/user/consultations";

describe("GET /api/user/consultations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@project.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = "fake-key";
    process.env.GOOGLE_CALENDAR_ID = "calendar-id";
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/user/consultations/route");
    const res = await GET(unauthReq());
    expect(res.status).toBe(401);
  });

  it("returns empty list with configured:false when Google Calendar is not configured", async () => {
    // GOOGLE_SERVICE_ACCOUNT_EMAIL falls back to GOOGLE_CLIENT_EMAIL — clear GOOGLE_CALENDAR_ID
    // which has no fallback, to reliably mark calendar as not configured.
    vi.stubEnv("GOOGLE_CALENDAR_ID", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/user/consultations/route");
    const res = await GET(authReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.consultations).toEqual([]);
    expect(data.configured).toBe(false);
    expect(getConsultationsByEmailMock).not.toHaveBeenCalled();
  });

  it("returns consultations when configured", async () => {
    const fakeConsultations = [
      { id: "evt1", summary: "Intro call", start: "2026-06-01T10:00:00Z" },
      { id: "evt2", summary: "Follow-up", start: "2026-06-15T14:00:00Z" },
    ];
    getConsultationsByEmailMock.mockResolvedValueOnce(fakeConsultations);
    const { GET } = await import("@/app/api/user/consultations/route");
    const res = await GET(authReq("user@example.com"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.consultations).toHaveLength(2);
    expect(data.configured).toBe(true);
    expect(getConsultationsByEmailMock).toHaveBeenCalledWith("user@example.com");
  });

  it("returns 500 when getConsultationsByEmail throws", async () => {
    getConsultationsByEmailMock.mockRejectedValueOnce(new Error("Calendar API error"));
    const { GET } = await import("@/app/api/user/consultations/route");
    const res = await GET(authReq());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/failed to fetch/i);
  });

  it("passes the authenticated user email to getConsultationsByEmail", async () => {
    getConsultationsByEmailMock.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/user/consultations/route");
    await GET(authReq("specific@example.com"));
    expect(getConsultationsByEmailMock).toHaveBeenCalledWith("specific@example.com");
  });
});
