import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/telegram/route";

const req = () => new NextRequest("https://cloudless.gr/telegram");

describe("GET /telegram", () => {
  afterEach(() => {
    delete process.env.TELEGRAM_CHANNEL_URL;
  });

  it("falls back to /links when no invite URL is configured", async () => {
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });

  it("redirects to the configured channel invite link", async () => {
    process.env.TELEGRAM_CHANNEL_URL = "https://t.me/+AbCdEfGhIjK";
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://t.me/+AbCdEfGhIjK");
  });

  it("falls back to /links when the configured URL is malformed", async () => {
    process.env.TELEGRAM_CHANNEL_URL = "t.me/+not-a-url";
    const res = GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });

  it("rejects non-https targets", async () => {
    process.env.TELEGRAM_CHANNEL_URL = "http://t.me/insecure";
    const res = GET(req());
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });

  it("builds the fallback from the canonical origin, not the request host", async () => {
    const leaked = new NextRequest("https://d3k7muo3c6lw6s.cloudfront.net/telegram");
    const res = GET(leaked);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cloudless.gr/links");
  });
});
