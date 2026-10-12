/**
 * /api/user/profile — provider-agnostic profile store on DynamoDB.
 *
 * The route reads/writes name/company/phone/preferences keyed by the OIDC
 * `sub`, decoupled from the IdP (works for any OIDC provider). These tests
 * mock @/lib/user-profile so no AWS call is made, and verify the auth gate,
 * the session fallback for name/email, and the upsert payload.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: authMock }));

const { getUserProfileMock, putUserProfileMock } = vi.hoisted(() => ({
  getUserProfileMock: vi.fn(),
  putUserProfileMock: vi.fn(),
}));
vi.mock("@/lib/user-profile", () => ({
  getUserProfile: getUserProfileMock,
  putUserProfile: putUserProfileMock,
}));

const { getAuthDbMock, getUserBySessionMock } = vi.hoisted(() => ({
  getAuthDbMock: vi.fn(),
  getUserBySessionMock: vi.fn(),
}));
vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: getAuthDbMock,
  getUserBySession: getUserBySessionMock,
}));

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/user/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  getUserProfileMock.mockReset();
  putUserProfileMock.mockReset();
});

describe("POST /api/user/profile", () => {
  it("401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ name: "A B" }));
    expect(res.status).toBe(401);
    expect(putUserProfileMock).not.toHaveBeenCalled();
  });

  it("401 when the session has no user id (sub)", async () => {
    authMock.mockResolvedValue({ user: { email: "u@x.gr" } });
    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ name: "A B" }));
    expect(res.status).toBe(401);
  });

  it("400 on invalid JSON body", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const { POST } = await import("@/app/api/user/profile/route");
    const bad = new NextRequest("http://localhost/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("upserts the provided fields keyed by sub", async () => {
    authMock.mockResolvedValue({ user: { id: "sub-123" } });
    putUserProfileMock.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(
      makeReq({ name: "Baltzakis Themistoklis", company: "cloudless.gr", phone: "+30123" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(putUserProfileMock).toHaveBeenCalledWith("sub-123", {
      name: "Baltzakis Themistoklis",
      company: "cloudless.gr",
      phone: "+30123",
      preferences: undefined,
    });
  });

  it("502 when the store write fails", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    putUserProfileMock.mockRejectedValue(new Error("dynamo down"));
    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ company: "x" }));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/user/profile", () => {
  it("401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("@/app/api/user/profile/route");
    const res = await GET(new NextRequest("http://localhost/api/user/profile"));
    expect(res.status).toBe(401);
  });

  it("returns the stored profile merged with session name/email", async () => {
    authMock.mockResolvedValue({ user: { id: "sub-1", email: "u@x.gr", name: "Session Name" } });
    getUserProfileMock.mockResolvedValue({
      name: "Stored Name",
      company: "cloudless.gr",
      phone: "+30123",
      preferences: { theme: "light", language: "el" },
    });
    const { GET } = await import("@/app/api/user/profile/route");
    const res = await GET(new NextRequest("http://localhost/api/user/profile"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: "Stored Name",
      email: "u@x.gr",
      company: "cloudless.gr",
      phone: "+30123",
      preferences: { theme: "light", language: "el" },
    });
  });

  it("falls back to the session name/email when no record exists", async () => {
    authMock.mockResolvedValue({ user: { id: "sub-1", email: "u@x.gr", name: "Session Name" } });
    getUserProfileMock.mockResolvedValue({});
    const { GET } = await import("@/app/api/user/profile/route");
    const res = await GET(new NextRequest("http://localhost/api/user/profile"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Session Name");
    expect(body.email).toBe("u@x.gr");
    expect(body.company).toBeUndefined();
  });

  it("502 when the store read fails", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    getUserProfileMock.mockRejectedValue(new Error("dynamo down"));
    const { GET } = await import("@/app/api/user/profile/route");
    const res = await GET(new NextRequest("http://localhost/api/user/profile"));
    expect(res.status).toBe(502);
  });


  it("resolves the user from the D1 session cookie when bound", async () => {
    getAuthDbMock.mockReturnValue({ fake: "db" });
    getUserBySessionMock.mockResolvedValue({
      id: "d1-user-1",
      email: "d1@x.gr",
      name: "D1 User",
    });
    putUserProfileMock.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/user/profile/route");
    const req = new NextRequest("http://localhost/api/user/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "session_token=tok-1",
      },
      body: JSON.stringify({ name: "N" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(getUserBySessionMock).toHaveBeenCalledWith({ fake: "db" }, "tok-1");
    expect(putUserProfileMock).toHaveBeenCalledWith(
      "d1-user-1",
      expect.objectContaining({ name: "N" })
    );
  });

  it("401 when the D1 session lookup throws", async () => {
    getAuthDbMock.mockReturnValue({ fake: "db" });
    getUserBySessionMock.mockRejectedValue(new Error("d1 down"));
    authMock.mockResolvedValue({ user: { id: "should-not-reach" } });
    const { POST } = await import("@/app/api/user/profile/route");
    const req = new NextRequest("http://localhost/api/user/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "session_token=tok-1",
      },
      body: JSON.stringify({ name: "N" }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it("503 when the profile store is unbound (AUTH_DB error)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    putUserProfileMock.mockRejectedValue(new Error("AUTH_DB binding missing"));
    const { POST } = await import("@/app/api/user/profile/route");
    const res = await POST(makeReq({ name: "x" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("Profile storage not available");
  });
});
