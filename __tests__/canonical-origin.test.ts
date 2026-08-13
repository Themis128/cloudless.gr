// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { canonicalOrigin } from "@/lib/canonical-origin";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  if (ORIGINAL_SITE_URL == null) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

describe("canonicalOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr";
    const req = new NextRequest("https://d3k7muo3c6lw6s.cloudfront.net/api/checkout");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("strips a trailing slash from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr/";
    const req = new NextRequest("https://cloudless.gr/api/checkout");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("falls back to x-forwarded-host when env is unset and host is public", () => {
    const req = new NextRequest("https://internal-pod.local/api/checkout", {
      headers: {
        "x-forwarded-host": "cloudless.gr",
        "x-forwarded-proto": "https",
      },
    });
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("ignores x-forwarded-host when it points at the CloudFront origin", () => {
    const req = new NextRequest("https://d3k7muo3c6lw6s.cloudfront.net/api/checkout", {
      headers: {
        "x-forwarded-host": "d3k7muo3c6lw6s.cloudfront.net",
        "x-forwarded-proto": "https",
      },
    });
    // Forwarded host is the CloudFront leak — skip it and the falling-back
    // request origin is ALSO the leak — must hit the hardcoded apex.
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("returns the request origin verbatim on localhost dev", () => {
    const req = new NextRequest("http://localhost:3000/api/checkout");
    expect(canonicalOrigin(req)).toBe("http://localhost:3000");
  });

  it("returns the request origin verbatim on a custom dev port", () => {
    const req = new NextRequest("http://localhost:4000/api/checkout");
    expect(canonicalOrigin(req)).toBe("http://localhost:4000");
  });

  it("does not echo the Next listen bind 0.0.0.0 back to clients", () => {
    const req = new NextRequest("http://0.0.0.0:3000/en/");
    expect(canonicalOrigin(req)).toBe("https://cloudless.gr");
  });

  it("never includes a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cloudless.gr///";
    const req = new NextRequest("https://cloudless.gr/api/checkout");
    expect(canonicalOrigin(req).endsWith("/")).toBe(false);
  });
});
