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
});
