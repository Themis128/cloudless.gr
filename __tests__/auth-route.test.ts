import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock @/lib/auth so the route doesn't boot real next-auth.
const realGet = vi.fn(() => new Response("real", { status: 200 }));
const realPost = vi.fn(() => new Response("real", { status: 200 }));
vi.mock("@/lib/auth", () => ({ handlers: { GET: realGet, POST: realPost } }));

describe("auth route GET guard (ServerlessErrors hardening)", () => {
  beforeEach(() => realGet.mockClear());

  it("redirects a bare GET /api/auth/signin/<provider> to the login page", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const res = await GET(new NextRequest("https://cloudless.gr/api/auth/signin/cognito"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/auth/login");
    // The real next-auth handler (which logs error=Configuration) is NOT invoked.
    expect(realGet).not.toHaveBeenCalled();
  });

  it("passes provider callbacks (GET /api/auth/callback/*) to the real handler", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    await GET(new NextRequest("https://cloudless.gr/api/auth/callback/cognito?code=abc"));
    expect(realGet).toHaveBeenCalledTimes(1);
  });

  it("passes the providers/session endpoints to the real handler", async () => {
    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    await GET(new NextRequest("https://cloudless.gr/api/auth/providers"));
    expect(realGet).toHaveBeenCalledTimes(1);
  });
});
