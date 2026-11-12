import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/viber/route";

vi.mock("@/lib/canonical-origin", () => ({
  canonicalOrigin: vi.fn(() => "https://cloudless.gr"),
}));

const req = () => new NextRequest("https://cloudless.gr/viber");

describe("GET /viber", () => {
  afterEach(() => {
    delete process.env.VIBER_CHAT_URL;
  });

  it("redirects to the default viber:// chat URL", () => {
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("viber://chat?number=%2B306977777838");
  });

  it("honours an https VIBER_CHAT_URL override", () => {
    process.env.VIBER_CHAT_URL = "https://cloudless.gr/viber-bot";
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/viber-bot");
  });

  it("falls back to /links for disallowed protocols", () => {
    process.env.VIBER_CHAT_URL = "javascript:alert(1)";
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });

  it("falls back to /links for a malformed URL", () => {
    process.env.VIBER_CHAT_URL = "not a url";
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });
});
