import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (opts: unknown) => mockGetToken(opts) }));

vi.mock("next-intl/middleware", () => ({
  default: () => (_request: NextRequest) => NextResponse.next(),
}));

import { proxy } from "@/proxy";

function makeApiRequest(
  path: string,
  init: { method?: string; origin?: string; xForwardedFor?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {};
  if (init.origin) headers.origin = init.origin;
  if (init.xForwardedFor) headers["x-forwarded-for"] = init.xForwardedFor;
  return new NextRequest(`http://localhost:4000${path}`, {
    method: init.method ?? "GET",
    headers,
  });
}

describe("proxy /api/* route handling", () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue(null);
  });

  it("returns a passthrough response for a public /api/* GET", async () => {
    const res = await proxy(makeApiRequest("/api/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("attaches CORS headers when request origin is cloudless.gr", async () => {
    const res = await proxy(makeApiRequest("/api/health", { origin: "https://cloudless.gr" }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://cloudless.gr");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers").toLowerCase()).toContain(
      "stripe-signature"
    );
  });

  it("does NOT attach CORS headers for an unknown origin", async () => {
    const res = await proxy(makeApiRequest("/api/health", { origin: "https://evil.example.com" }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("returns 204 for an OPTIONS preflight on an allowed origin", async () => {
    const res = await proxy(
      makeApiRequest("/api/health", { method: "OPTIONS", origin: "https://cloudless.gr" })
    );
    expect(res.status).toBe(204);
  });

  it("sets rate-limit headers on rate-limited routes", async () => {
    const res = await proxy(makeApiRequest("/api/admin/users", { method: "POST" }));
    expect(res.headers.get("X-RateLimit-Limit")).not.toBeNull();
  });
});

describe("proxy HTTPS enforcement", () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue(null);
  });

  it("308-redirects http→https for a page route in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new NextRequest("http://localhost:4000/en/", {
      headers: { "x-forwarded-proto": "http" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(308);
    expect(res.headers.get("location")?.startsWith("https://")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("does NOT redirect /api/* over http (CF/Traefik handles them)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new NextRequest("http://localhost:4000/api/health", {
      headers: { "x-forwarded-proto": "http" },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(308);
    vi.unstubAllEnvs();
  });

  it("308 Location uses the site URL, not the 0.0.0.0 listen bind", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://cloudless.gr");
    const req = new NextRequest("http://0.0.0.0:3000/en/", {
      headers: { "x-forwarded-proto": "http", host: "0.0.0.0:3000" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(308);
    const location = res.headers.get("location") ?? "";
    expect(new URL(location).origin).toBe("https://cloudless.gr");
    expect(location).not.toContain("0.0.0.0");
    vi.unstubAllEnvs();
  });
});
