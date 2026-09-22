/**
 * Tests for src/lib/canonical-origin.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { canonicalOrigin } from "@/lib/canonical-origin";

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("canonicalOrigin", () => {
  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr";
    const req = makeReq("http://localhost:3000/api/test");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("strips trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr///";
    const req = makeReq("http://localhost:3000/api/test");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("uses x-forwarded-host when env var is not set", () => {
    const req = makeReq("http://localhost:3000/api/test", {
      "x-forwarded-host": "myapp.example.com",
      "x-forwarded-proto": "https",
    });
    expect(canonicalOrigin(req)).toBe("https://myapp.example.com");
  });

  it("uses https when x-forwarded-proto is absent", () => {
    const req = makeReq("http://localhost:3000/api/test", {
      "x-forwarded-host": "myapp.example.com",
    });
    expect(canonicalOrigin(req)).toBe("https://myapp.example.com");
  });

  it("ignores x-forwarded-host when it is a CloudFront host", () => {
    // CloudFront leak — should fall through to request origin or hardcoded fallback
    const req = makeReq("http://d3k7muo3c6lw6s.cloudfront.net/api/test", {
      "x-forwarded-host": "d3k7muo3c6lw6s.cloudfront.net",
    });
    const result = canonicalOrigin(req);
    // Should NOT echo back the CloudFront host
    expect(result).not.toContain(".cloudfront.net");
  });

  it("does NOT exclude localhost from x-forwarded-host", () => {
    // localhost is not a private origin host per the implementation
    const req = makeReq("http://localhost:3000/test", {
      "x-forwarded-host": "localhost:3000",
    });
    const result = canonicalOrigin(req);
    expect(result).toContain("localhost");
  });

  it("falls through to hardcoded fallback when request origin is CloudFront", () => {
    const req = makeReq("https://d3k7muo3c6lw6s.cloudfront.net/api/test");
    const result = canonicalOrigin(req);
    expect(result).toBe("https://cloudless.gr");
  });

  it("uses request nextUrl.origin for local dev", () => {
    const req = makeReq("http://localhost:3000/api/test");
    const result = canonicalOrigin(req);
    expect(result).toBe("http://localhost:3000");
  });

  it("falls back to the apex when Host is a bare k8s pod name", () => {
    // Production bug: /api/auth/activate redirected browsers to
    // https://cloudless-app-6dc5885cd6-hvlrg:3000/... — the pod hostname
    // cloudflared forwards as Host.
    const req = makeReq("http://cloudless-app-6dc5885cd6-hvlrg:3000/api/auth/activate?email=a%40b.c&token=x");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("falls back to the apex when Host is a private IP", () => {
    const req = makeReq("http://10.42.0.17:3000/api/test");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("ignores x-forwarded-host when it is a pod name", () => {
    const req = makeReq("http://cloudless-app-6dc5885cd6-hvlrg:3000/api/test", {
      "x-forwarded-host": "cloudless-app-6dc5885cd6-hvlrg:3000",
    });
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });
});
